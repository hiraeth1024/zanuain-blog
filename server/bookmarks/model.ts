import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type BookmarkInput = {
  url: string; title: string; description: string; author: string; notes: string;
  preview_image_remote_url: string; tag_string: string; unread: boolean; shared: boolean;
};
export type Bookmark = BookmarkInput & {
  id: number; url_normalized: string; is_archived: boolean; is_deleted: boolean;
  date_added: string; date_modified: string; date_deleted: string | null; tags: string[];
  article_path: string; snapshot_path: string; favicon_path: string; preview_path: string;
  capture_status: string; capture_error: string;
};
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export function extractUrl(value: string) {
  return value.match(/https?:\/\/[^\s<>"\u3000]+/i)?.[0] ?? value.trim();
}
export function validateUrl(value: string) {
  const extracted = extractUrl(value);
  let parsed: URL;
  try { parsed = new URL(extracted); } catch { throw new HttpError(422, '请输入完整的 HTTP 或 HTTPS 网址。'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || extracted.length > 2048)
    throw new HttpError(422, '网址须使用 HTTP 或 HTTPS，且不能包含登录凭据。');
  return extracted;
}
export function normalizeUrl(value: string) {
  const parsed = new URL(value.trim());
  const parameters = [...parsed.searchParams].sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0);
  const query = parameters.map(([key, entry]) => `${encodeURIComponent(key)}=${encodeURIComponent(entry)}`).join('&');
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${parsed.pathname.replace(/\/+$/, '')}${query ? `?${query}` : ''}${parsed.hash}`;
}
export function parseTags(value: string) {
  const names = value.trim().split(/\s+/).filter(Boolean);
  if (names.length > 80 || names.some(name => name.length > 64)) throw new HttpError(422, '最多 80 个标签，每个标签最多 64 个字符。');
  return [...new Map(names.map(name => [name.toLowerCase(), name])).values()].sort((left, right) => left.localeCompare(right, 'zh-CN'));
}
export function parseInput(value: Record<string, unknown>): BookmarkInput {
  const text = (key: string, max: number) => {
    if (value[key] !== undefined && typeof value[key] !== 'string') throw new HttpError(422, `${key} 格式不正确。`);
    const content = String(value[key] ?? '').trim();
    if (content.length > max) throw new HttpError(422, `${key} 内容过长。`);
    return content;
  };
  const boolean = (key: string) => {
    if (value[key] !== undefined && typeof value[key] !== 'boolean') throw new HttpError(422, `${key} 须为布尔值。`);
    return value[key] === true;
  };
  const tags = text('tag_string', 6000);
  parseTags(tags);
  const preview = text('preview_image_remote_url', 2048);
  if (preview) validateUrl(preview);
  return {
    url: validateUrl(text('url', 2048)), title: text('title', 4096), description: text('description', 20000),
    author: text('author', 1024), notes: text('notes', 100000), tag_string: tags,
    preview_image_remote_url: preview, unread: boolean('unread'), shared: boolean('shared'),
  };
}

export function openDatabase(path: string) {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const database = new DatabaseSync(path);
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admin (id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS login_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL, url_normalized TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '', author TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '', preview_image_remote_url TEXT NOT NULL DEFAULT '',
      unread INTEGER NOT NULL DEFAULT 0, shared INTEGER NOT NULL DEFAULT 0, is_archived INTEGER NOT NULL DEFAULT 0,
      is_deleted INTEGER NOT NULL DEFAULT 0, date_added TEXT NOT NULL, date_modified TEXT NOT NULL, date_deleted TEXT,
      article_path TEXT NOT NULL DEFAULT '', snapshot_path TEXT NOT NULL DEFAULT '',
      favicon_path TEXT NOT NULL DEFAULT '', preview_path TEXT NOT NULL DEFAULT '',
      capture_status TEXT NOT NULL DEFAULT 'idle', capture_error TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY, name TEXT NOT NULL COLLATE NOCASE UNIQUE);
    CREATE TABLE IF NOT EXISTS bookmark_tags (
      bookmark_id INTEGER REFERENCES bookmarks(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(bookmark_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS filters (id INTEGER PRIMARY KEY, name TEXT NOT NULL, query TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS annotations (
      id INTEGER PRIMARY KEY, bookmark_id INTEGER NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
      quote TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', start INTEGER NOT NULL, finish INTEGER NOT NULL,
      date_added TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      bookmark_id INTEGER PRIMARY KEY REFERENCES bookmarks(id) ON DELETE CASCADE,
      snapshot INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 0
    );
    PRAGMA user_version = 1;
  `);
  return database;
}
export type Database = ReturnType<typeof openDatabase>;
export function getSettings(database: Database) {
  const defaults = { default_unread: true, default_shared: false, automatic_snapshots: false, auto_tags: '' };
  const rows = database.prepare('SELECT key, value FROM settings').all() as {key: string; value: string}[];
  return Object.assign(defaults, Object.fromEntries(rows.map(row => [row.key, JSON.parse(row.value)]))) as typeof defaults;
}
export function rowsToBookmarks(database: Database, rows: Record<string, unknown>[]): Bookmark[] {
  return rows.map(row => {
    const tags = database.prepare('SELECT name FROM tags JOIN bookmark_tags ON tag_id=tags.id WHERE bookmark_id=? ORDER BY name COLLATE NOCASE').all(Number(row.id)) as {name: string}[];
    return {
      ...row, unread: !!row.unread, shared: !!row.shared, is_archived: !!row.is_archived, is_deleted: !!row.is_deleted,
      tags: tags.map(tag => tag.name), tag_string: tags.map(tag => tag.name).join(' '),
    } as Bookmark;
  });
}
export function getBookmark(database: Database, id: number, admin: boolean) {
  const row = database.prepare(`SELECT * FROM bookmarks WHERE id=?${admin ? '' : ' AND shared=1 AND is_deleted=0'}`).get(id);
  if (!row) throw new HttpError(404, '书签不存在或未公开。');
  return rowsToBookmarks(database, [row])[0];
}
export function findBookmark(database: Database, url: string) {
  const row = database.prepare('SELECT * FROM bookmarks WHERE url_normalized=?').get(normalizeUrl(url));
  return row ? rowsToBookmarks(database, [row])[0] : null;
}
export function publicBookmark(bookmark: Bookmark, admin: boolean) {
  const { article_path, snapshot_path, favicon_path, preview_path, capture_error, ...visible } = bookmark;
  return {
    ...visible, notes: admin ? visible.notes : undefined, capture_error: admin ? capture_error : undefined,
    has_article: !!article_path, has_snapshot: !!snapshot_path,
    favicon: favicon_path ? `/api/bookmarks/${bookmark.id}/favicon` : '',
    preview: preview_path ? `/api/bookmarks/${bookmark.id}/preview` : '',
  };
}
export function autoTags(database: Database, url: string) {
  const hostname = new URL(url).hostname.toLowerCase();
  return getSettings(database).auto_tags.split('\n').flatMap(line => {
    const [domain, ...tags] = line.trim().split(/\s+/);
    return domain && (hostname === domain || hostname.endsWith(`.${domain}`)) ? tags : [];
  });
}
export function saveBookmark(database: Database, input: BookmarkInput, id?: number) {
  const existing = findBookmark(database, input.url);
  if (id && existing && existing.id !== id) throw new HttpError(422, '另一个书签已使用此网址。');
  const previous = id ? getBookmark(database, id, true) : existing;
  const date = new Date().toISOString();
  const values = [input.url, normalizeUrl(input.url), input.title, input.description, input.author,
    input.notes, input.preview_image_remote_url, Number(input.unread), Number(input.shared)];
  database.exec('BEGIN IMMEDIATE');
  try {
    let savedId = previous?.id;
    if (previous) {
      database.prepare(`UPDATE bookmarks SET url=?,url_normalized=?,title=?,description=?,author=?,notes=?,
        preview_image_remote_url=?,unread=?,shared=?,date_modified=?,is_deleted=0,date_deleted=NULL WHERE id=?`)
        .run(...values, date, previous.id);
      if (previous.url !== input.url) database.prepare("UPDATE bookmarks SET article_path='',snapshot_path='',favicon_path='',preview_path='',capture_status='idle' WHERE id=?").run(previous.id);
    } else {
      savedId = Number(database.prepare(`INSERT INTO bookmarks
        (url,url_normalized,title,description,author,notes,preview_image_remote_url,unread,shared,date_added,date_modified)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(...values, date, date).lastInsertRowid);
    }
    database.prepare('DELETE FROM bookmark_tags WHERE bookmark_id=?').run(savedId!);
    const names = parseTags([input.tag_string, ...autoTags(database, input.url)].join(' '));
    for (const name of names) {
      database.prepare('INSERT OR IGNORE INTO tags(name) VALUES (?)').run(name);
      database.prepare('INSERT OR IGNORE INTO bookmark_tags(bookmark_id,tag_id) SELECT ?,id FROM tags WHERE name=? COLLATE NOCASE').run(savedId!, name);
    }
    database.exec('COMMIT');
    return { bookmark: getBookmark(database, savedId!, true), created: !previous };
  } catch (error) { database.exec('ROLLBACK'); throw error; }
}
