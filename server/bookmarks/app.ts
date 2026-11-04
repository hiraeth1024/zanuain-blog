import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { load } from 'cheerio';
import {
  openDatabase, getBookmark, findBookmark, saveBookmark, parseInput, parseTags, publicBookmark,
  rowsToBookmarks, getSettings, autoTags, validateUrl, HttpError, type Database, type Bookmark,
} from './model.ts';
import { session, requireAdmin, requireWrite, checkOrigin, login } from './auth.ts';
import { fetchPage, extractArticle, cleanArticle, safeFetch } from './web.ts';

type Options = { dataDirectory: string; origins: string[]; secureCookies?: boolean; jobs?: boolean };
const prefix = '/api/bookmarks';
function json(response: ServerResponse, status: number, data: unknown) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}
async function body(request: IncomingMessage) {
  if (!String(request.headers['content-type']).startsWith('application/json')) throw new HttpError(415, '请使用 JSON 提交数据。');
  let content = '';
  for await (const chunk of request) {
    content += chunk;
    if (Buffer.byteLength(content) > 1024 * 1024) throw new HttpError(413, '提交内容超过 1 MB。');
  }
  try {
    const parsed = JSON.parse(content);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
    return parsed as Record<string, unknown>;
  } catch { throw new HttpError(400, '提交的数据格式不正确。'); }
}
export function filterBookmarks(bookmarks: Bookmark[], query: URLSearchParams) {
  const words = (query.get('q') ?? '').match(/"[^"]*"|\S+/g) ?? [];
  return bookmarks.filter(bookmark => {
    if (query.get('tag') && !bookmark.tags.includes(query.get('tag')!)) return false;
    if (query.get('date') && new Date(bookmark.date_added).toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }) !== query.get('date')) return false;
    if (query.get('unread') === '1' && !bookmark.unread) return false;
    const source = `${bookmark.title} ${bookmark.url} ${bookmark.description} ${bookmark.author} ${bookmark.tags.join(' ')}`.toLowerCase();
    return words.every(word => {
      const excluded = word.startsWith('-');
      const token = (excluded ? word.slice(1) : word).replace(/^"|"$/g, '').toLowerCase();
      const matches = token.startsWith('#') ? bookmark.tags.some(tag => tag.toLowerCase() === token.slice(1)) : source.includes(token);
      return excluded ? !matches : matches;
    });
  });
}
const inView = (bookmark: Bookmark, view: string) => {
  if (view === 'trash') return bookmark.is_deleted;
  if (bookmark.is_deleted) return false;
  if (view === 'archived') return bookmark.is_archived;
  if (view === 'shared') return bookmark.shared;
  if (view === 'unread') return bookmark.unread && !bookmark.is_archived;
  return !bookmark.is_archived;
};
function enqueue(database: Database, id: number, snapshot: boolean) {
  database.prepare('INSERT INTO jobs(bookmark_id,snapshot) VALUES (?,?) ON CONFLICT(bookmark_id) DO UPDATE SET snapshot=MAX(snapshot,excluded.snapshot),attempts=0,available=0').run(id, Number(snapshot));
  database.prepare("UPDATE bookmarks SET capture_status='pending',capture_error='' WHERE id=?").run(id);
}
function assetPath(directory: string, filename: string) {
  if (!/^[a-f0-9-]+\.(html|bin)$/.test(filename)) throw new HttpError(404, '文件不存在。');
  return join(directory, filename);
}
function removeAssets(directory: string, bookmark: Bookmark) {
  for (const filename of [bookmark.article_path, bookmark.snapshot_path, bookmark.favicon_path, bookmark.preview_path]) {
    if (filename) { const path = assetPath(directory, filename); if (existsSync(path)) unlinkSync(path); }
  }
}
export function createBookmarkServer(options: Options) {
  const directory = resolve(options.dataDirectory);
  const assets = join(directory, 'assets');
  mkdirSync(assets, { recursive: true, mode: 0o700 });
  const database = openDatabase(join(directory, 'bookmarks.sqlite'));
  const metadataRequests = new Map<string, Promise<Awaited<ReturnType<typeof fetchPage>>>>();
  const cookie = (value: string, age = 604800) => `zanuain_session=${value}; Path=/api/bookmarks; HttpOnly; SameSite=Strict; Max-Age=${age}${options.secureCookies ? '; Secure' : ''}`;
  let working = false;
  let stopped = false;
  const worker = async () => {
    if (working || stopped) return;
    const job = database.prepare('SELECT * FROM jobs WHERE available<=? LIMIT 1').get(Date.now()) as {bookmark_id: number; snapshot: number; attempts: number} | undefined;
    if (!job) return;
    working = true;
    try {
      const bookmark = getBookmark(database, job.bookmark_id, true);
      const result = await fetchPage(bookmark.url);
      if (stopped) return;
      const current = getBookmark(database, bookmark.id, true);
      if (current.url !== bookmark.url) return;
      const articleName = `${randomUUID()}.html`;
      writeFileSync(join(assets, articleName), extractArticle(result.html, bookmark.url), { mode: 0o600 });
      let snapshotName = current.snapshot_path;
      if (job.snapshot) {
        snapshotName = `${randomUUID()}.html`;
        writeFileSync(join(assets, snapshotName), `<!doctype html><meta charset="utf-8"><title>网页快照</title>${cleanArticle(result.html, bookmark.url)}`, { mode: 0o600 });
      }
      database.prepare(`UPDATE bookmarks SET article_path=?,snapshot_path=?,capture_status='complete',capture_error='',
        title=CASE WHEN title='' OR title=url THEN ? ELSE title END,
        description=CASE WHEN description='' THEN ? ELSE description END,
        author=CASE WHEN author='' THEN ? ELSE author END WHERE id=?`)
        .run(articleName, snapshotName, result.metadata.title, result.metadata.description, result.metadata.author, bookmark.id);
      for (const [column, remote] of [['favicon_path', result.metadata.favicon], ['preview_path', current.preview_image_remote_url || result.metadata.preview_image]] as const) {
        if (!remote || stopped) continue;
        try {
          const image = await safeFetch(remote);
          if (stopped) return;
          if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'].includes(image.type)) continue;
          const filename = `${randomUUID()}.bin`;
          writeFileSync(join(assets, filename), image.body, { mode: 0o600 });
          database.prepare(`UPDATE bookmarks SET ${column}=? WHERE id=?`).run(filename, bookmark.id);
        } catch {}
      }
      database.prepare('DELETE FROM jobs WHERE bookmark_id=?').run(bookmark.id);
    } catch (error) {
      if (!stopped) {
        const message = error instanceof Error ? error.message : '抓取失败。';
        database.prepare("UPDATE bookmarks SET capture_status='failed',capture_error=? WHERE id=?").run(message, job.bookmark_id);
        if (job.attempts >= 2) database.prepare('DELETE FROM jobs WHERE bookmark_id=?').run(job.bookmark_id);
        else database.prepare('UPDATE jobs SET attempts=attempts+1,available=? WHERE bookmark_id=?').run(Date.now() + 60000 * (job.attempts + 1), job.bookmark_id);
      }
    } finally { working = false; }
  };
  const timer = options.jobs === false ? null : setInterval(() => { void worker(); }, 1000);
  timer?.unref();

  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      const path = url.pathname.replace(/\/+$/, '');
      const method = request.method ?? 'GET';
      if (path === `${prefix}/health` && method === 'GET') { json(response, 200, {service: 'zanuain-bookmarks', ok: true}); return; }
      if (!path.startsWith(prefix)) throw new HttpError(404, '接口不存在。');
      const current = session(database, request);
      const admin = !!current;
      if (path === `${prefix}/session` && method === 'GET') {
        const account = database.prepare('SELECT username FROM admin WHERE id=1').get();
        json(response, 200, { authenticated: admin, username: admin ? account?.username : null, csrf: current?.csrf, configured: !!account }); return;
      }
      if (path === `${prefix}/login` && method === 'POST') {
        checkOrigin(request, options.origins);
        const input = await body(request);
        const result = await login(database, String(input.username ?? ''), String(input.password ?? ''), request.socket.remoteAddress ?? 'unknown');
        if (current) database.prepare('DELETE FROM sessions WHERE token_hash=?').run(current.token_hash);
        response.setHeader('Set-Cookie', cookie(result.token));
        json(response, 200, { authenticated: true, csrf: result.csrf, username: result.username }); return;
      }
      if (method !== 'GET' && method !== 'HEAD') requireWrite(database, request, options.origins);
      if (path === `${prefix}/logout` && method === 'POST') {
        database.prepare('DELETE FROM sessions WHERE token_hash=?').run(current!.token_hash);
        response.setHeader('Set-Cookie', cookie('', 0)); json(response, 200, {ok: true}); return;
      }
      if (path === `${prefix}/settings`) {
        requireAdmin(database, request);
        if (method === 'PUT') {
          const input = await body(request);
          for (const key of ['default_unread', 'default_shared', 'automatic_snapshots']) {
            if (typeof input[key] !== 'boolean') throw new HttpError(422, '设置格式不正确。');
          }
          if (typeof input.auto_tags !== 'string' || input.auto_tags.length > 10000) throw new HttpError(422, '自动标签规则格式不正确。');
          for (const key of ['default_unread', 'default_shared', 'automatic_snapshots', 'auto_tags']) database.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(key, JSON.stringify(input[key]));
        } else if (method !== 'GET') throw new HttpError(405, '不支持此操作。');
        json(response, 200, getSettings(database)); return;
      }
      if (path === `${prefix}/check` && method === 'GET') {
        requireAdmin(database, request);
        const checkedUrl = validateUrl(url.searchParams.get('url') ?? '');
        const existing = findBookmark(database, checkedUrl);
        let metadata = {url: checkedUrl, title: '', description: '', author: '', preview_image: '', favicon: ''};
        let warning = '';
        if (url.searchParams.get('from_client') === '1') {
          metadata = {...metadata, title: (url.searchParams.get('title') ?? '').slice(0, 4096), description: (url.searchParams.get('description') ?? '').slice(0, 20000), author: (url.searchParams.get('author') ?? '').slice(0, 1024)};
        } else {
          if (!metadataRequests.has(checkedUrl) && metadataRequests.size >= 3) throw new HttpError(429, '正在抓取其他网页，请稍后重试。');
          try {
            let pending = metadataRequests.get(checkedUrl);
            if (!pending) {
              pending = fetchPage(checkedUrl);
              metadataRequests.set(checkedUrl, pending);
              void pending.finally(() => metadataRequests.delete(checkedUrl)).catch(() => {});
            }
            metadata = (await pending).metadata;
          } catch (error) { warning = error instanceof Error ? error.message : '自动获取失败，可手动填写。'; }
        }
        json(response, 200, {bookmark: existing ? publicBookmark(existing, true) : null, metadata, auto_tags: autoTags(database, checkedUrl), warning}); return;
      }
      if (path === `${prefix}/tags` && method === 'GET') {
        const rows = database.prepare(`SELECT tags.id,tags.name,COUNT(*) AS count FROM tags JOIN bookmark_tags ON tag_id=tags.id
          JOIN bookmarks ON bookmarks.id=bookmark_id WHERE is_deleted=0${admin ? '' : ' AND shared=1'}
          GROUP BY tags.id ORDER BY tags.name COLLATE NOCASE`).all();
        json(response, 200, rows); return;
      }
      const tagMatch = path.match(/^\/api\/bookmarks\/tags\/(\d+)$/);
      if (tagMatch && ['PUT', 'DELETE'].includes(method)) {
        const tagId = Number(tagMatch[1]);
        if (method === 'DELETE') database.prepare('DELETE FROM tags WHERE id=?').run(tagId);
        else {
          const input = await body(request);
          const tags = parseTags(String(input.name ?? '').trim().replace(/\s+/g, '-'));
          if (tags.length !== 1) throw new HttpError(422, '请输入标签名称。');
          const destination = database.prepare('SELECT id FROM tags WHERE name=? COLLATE NOCASE').get(tags[0]);
          if (destination && Number(destination.id) !== tagId) {
            database.exec('BEGIN IMMEDIATE');
            try {
              database.prepare('INSERT OR IGNORE INTO bookmark_tags SELECT bookmark_id,? FROM bookmark_tags WHERE tag_id=?').run(Number(destination.id), tagId);
              database.prepare('DELETE FROM tags WHERE id=?').run(tagId);
              database.exec('COMMIT');
            } catch (error) { database.exec('ROLLBACK'); throw error; }
          } else database.prepare('UPDATE tags SET name=? WHERE id=?').run(tags[0], tagId);
        }
        json(response, 200, {ok: true}); return;
      }
      if (path === `${prefix}/filters`) {
        requireAdmin(database, request);
        if (method === 'POST') {
          const input = await body(request);
          if (typeof input.name !== 'string' || !input.name.trim() || input.name.length > 80 || typeof input.query !== 'string' || input.query.length > 2000) throw new HttpError(422, '请输入有效的筛选名称和条件。');
          database.prepare('INSERT INTO filters(name,query) VALUES (?,?)').run(input.name.trim(), input.query);
        } else if (method !== 'GET') throw new HttpError(405, '不支持此操作。');
        const all = rowsToBookmarks(database, database.prepare('SELECT * FROM bookmarks').all());
        json(response, 200, database.prepare('SELECT * FROM filters').all().map(filter => {
          const query = new URLSearchParams(String(filter.query));
          return {...filter, count: filterBookmarks(all.filter(bookmark => inView(bookmark, query.get('view') ?? 'all')), query).length};
        })); return;
      }
      const filterMatch = path.match(/^\/api\/bookmarks\/filters\/(\d+)$/);
      if (filterMatch && method === 'DELETE') {
        database.prepare('DELETE FROM filters WHERE id=?').run(Number(filterMatch[1]));
        json(response, 200, {ok: true}); return;
      }
      if (path === `${prefix}/import` && method === 'POST') {
        const input = await body(request);
        if (typeof input.html !== 'string') throw new HttpError(422, '请选择 Netscape HTML 书签文件。');
        const document = load(input.html);
        const entries = document('a[href]').toArray();
        if (entries.length > 5000) throw new HttpError(422, '单次最多导入 5000 条书签。');
        let imported = 0;
        let skipped = 0;
        for (const entry of entries) {
          const link = document(entry);
          try {
            const input = parseInput({url: link.attr('href'), title: link.text(), tag_string: (link.attr('tags') ?? '').replaceAll(',', ' '), shared: link.attr('private') === '0', unread: link.attr('toread') === '1'});
            const result = saveBookmark(database, input);
            if (result.created && /^\d+$/.test(link.attr('add_date') ?? '')) {
              const timestamp = Number(link.attr('add_date')) * 1000;
              if (timestamp > 0 && timestamp <= Date.now()) database.prepare('UPDATE bookmarks SET date_added=? WHERE id=?').run(new Date(timestamp).toISOString(), result.bookmark.id);
            }
            imported++;
          } catch { skipped++; }
        }
        json(response, 200, {imported, skipped}); return;
      }
      if (path === `${prefix}/export` && method === 'GET') {
        requireAdmin(database, request);
        const bookmarks = rowsToBookmarks(database, database.prepare('SELECT * FROM bookmarks WHERE is_deleted=0').all());
        const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        const contents = bookmarks.map(bookmark => `<DT><A HREF="${escape(bookmark.url)}" ADD_DATE="${Math.floor(Date.parse(bookmark.date_added) / 1000)}" TAGS="${escape(bookmark.tags.join(','))}" PRIVATE="${bookmark.shared ? '0' : '1'}" TOREAD="${bookmark.unread ? '1' : '0'}">${escape(bookmark.title || bookmark.url)}</A>`).join('\n');
        response.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Content-Disposition': 'attachment; filename="bookmarks.html"'});
        response.end(`<!DOCTYPE NETSCAPE-Bookmark-file-1><META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8"><TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>\n${contents}\n</DL><p>`); return;
      }
      if (path === `${prefix}/bulk` && method === 'POST') {
        const input = await body(request);
        if (!Array.isArray(input.ids) || input.ids.length > 200 || !input.ids.every(id => Number.isSafeInteger(id) && id > 0)) throw new HttpError(422, '请选择最多 200 条书签。');
        const operations: Record<string, string> = {
          archive: 'is_archived=1', unarchive: 'is_archived=0', read: 'unread=0', unread: 'unread=1',
          share: 'shared=1', unshare: 'shared=0', trash: "is_deleted=1,date_deleted=strftime('%Y-%m-%dT%H:%M:%fZ','now')", restore: 'is_deleted=0,date_deleted=NULL',
        };
        const action = String(input.action);
        if (!operations[action]) throw new HttpError(422, '未知的批量操作。');
        database.exec('BEGIN IMMEDIATE');
        try {
          for (const id of input.ids) database.prepare(`UPDATE bookmarks SET ${operations[action]} WHERE id=?`).run(Number(id));
          database.exec('COMMIT');
        } catch (error) { database.exec('ROLLBACK'); throw error; }
        json(response, 200, {ok: true}); return;
      }
      if (path === prefix && method === 'GET') {
        const all = rowsToBookmarks(database, database.prepare(`SELECT * FROM bookmarks${admin ? '' : ' WHERE shared=1 AND is_deleted=0'} ORDER BY date_added DESC,id DESC`).all());
        const view = url.searchParams.get('view') ?? 'all';
        if (!admin && ['trash', 'archived'].includes(view)) throw new HttpError(401, '请先登录管理员账户。');
        const scoped = admin ? all.filter(bookmark => inView(bookmark, view)) : all;
        let selected = filterBookmarks(scoped, url.searchParams);
        if (url.searchParams.get('sort') === 'oldest') selected.reverse();
        if (url.searchParams.get('sort') === 'title') selected.sort((left, right) => (left.title || left.url).localeCompare(right.title || right.url, 'zh-CN'));
        const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
        const counts = Object.fromEntries(['all', 'unread', 'shared', 'archived', 'trash'].map(name => [name, all.filter(bookmark => inView(bookmark, name)).length]));
        const tags = [...new Set(scoped.flatMap(bookmark => bookmark.tags))].sort().map(name => ({name, count: scoped.filter(bookmark => bookmark.tags.includes(name)).length}));
        const activity = scoped.map(bookmark => ({date: new Date(bookmark.date_added).toLocaleDateString('sv-SE', {timeZone: 'Asia/Shanghai'}), id: bookmark.id}));
        json(response, 200, {items: selected.slice((page - 1) * 20, page * 20).map(bookmark => publicBookmark(bookmark, admin)), total: selected.length, page, pages: Math.ceil(selected.length / 20), counts, tags, activity}); return;
      }
      if (path === prefix && method === 'POST') {
        const input = parseInput(await body(request));
        const result = saveBookmark(database, input);
        enqueue(database, result.bookmark.id, getSettings(database).automatic_snapshots);
        json(response, result.created ? 201 : 200, {bookmark: publicBookmark(result.bookmark, true), created: result.created}); return;
      }
      const match = path.match(/^\/api\/bookmarks\/(\d+)(?:\/(article|snapshot|favicon|preview|capture|annotations))?$/);
      if (!match) throw new HttpError(404, '接口不存在。');
      const id = Number(match[1]);
      const action = match[2];
      const bookmark = getBookmark(database, id, admin);
      if (!action && method === 'GET') { json(response, 200, publicBookmark(bookmark, admin)); return; }
      if (!action && method === 'PUT') {
        const result = saveBookmark(database, parseInput(await body(request)), id);
        if (result.bookmark.url !== bookmark.url || result.bookmark.preview_image_remote_url !== bookmark.preview_image_remote_url) enqueue(database, id, getSettings(database).automatic_snapshots);
        json(response, 200, publicBookmark(result.bookmark, true)); return;
      }
      if (!action && method === 'DELETE') {
        if (!bookmark.is_deleted) throw new HttpError(409, '请先移入回收站，再永久删除。');
        database.prepare('DELETE FROM bookmarks WHERE id=?').run(id);
        removeAssets(assets, bookmark);
        json(response, 200, {ok: true}); return;
      }
      if (action === 'capture' && method === 'POST') {
        const input = await body(request);
        enqueue(database, id, input.snapshot === true);
        json(response, 202, {ok: true}); return;
      }
      if (action === 'annotations') {
        requireAdmin(database, request);
        if (method === 'POST') {
          const input = await body(request);
          if (typeof input.quote !== 'string' || !input.quote.trim() || input.quote.length > 10000 || typeof input.note !== 'string' || input.note.length > 20000 || !Number.isSafeInteger(input.start) || !Number.isSafeInteger(input.finish) || Number(input.start) < 0 || Number(input.finish) <= Number(input.start)) throw new HttpError(422, '请选择正文中的文字并填写有效批注。');
          database.prepare('INSERT INTO annotations(bookmark_id,quote,note,start,finish,date_added) VALUES (?,?,?,?,?,?)').run(id, input.quote, input.note, Number(input.start), Number(input.finish), new Date().toISOString());
        } else if (method === 'DELETE') {
          database.prepare('DELETE FROM annotations WHERE id=? AND bookmark_id=?').run(Number(url.searchParams.get('annotation')), id);
        } else if (method !== 'GET') throw new HttpError(405, '不支持此操作。');
        json(response, 200, database.prepare('SELECT * FROM annotations WHERE bookmark_id=? ORDER BY id').all(id)); return;
      }
      if (action === 'article' && method === 'GET') {
        if (!bookmark.article_path) { json(response, 200, {html: '', status: bookmark.capture_status, error: admin ? bookmark.capture_error : ''}); return; }
        json(response, 200, {html: readFileSync(assetPath(assets, bookmark.article_path), 'utf8'), status: bookmark.capture_status}); return;
      }
      if (['snapshot', 'favicon', 'preview'].includes(action ?? '') && method === 'GET') {
        const filename = action === 'snapshot' ? bookmark.snapshot_path : action === 'favicon' ? bookmark.favicon_path : bookmark.preview_path;
        if (!filename) throw new HttpError(404, '文件尚未生成。');
        const contents = readFileSync(assetPath(assets, filename));
        const type = action === 'snapshot' ? 'text/html; charset=utf-8' : contents[0] === 0x89 ? 'image/png' : contents[0] === 0xff ? 'image/jpeg' : contents.toString('ascii', 0, 3) === 'GIF' ? 'image/gif' : contents.toString('ascii', 0, 4) === 'RIFF' ? 'image/webp' : 'image/x-icon';
        response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        if (action === 'snapshot') response.setHeader('Content-Disposition', `attachment; filename="bookmark-${id}.html"`);
        response.writeHead(200, {'Content-Type': type}); response.end(contents); return;
      }
      throw new HttpError(405, '不支持此操作。');
    } catch (error) {
      if (!response.headersSent) json(response, error instanceof HttpError ? error.status : 500, {error: error instanceof HttpError ? error.message : '服务暂时无法完成操作，请重试。'});
      else response.end();
      if (!(error instanceof HttpError)) console.error('[bookmarks]', error);
    }
  });
  server.requestTimeout = 20000;
  server.headersTimeout = 10000;
  server.on('close', () => {
    stopped = true;
    if (timer) clearInterval(timer);
    if (!working) database.close();
  });
  return {server, database};
}
