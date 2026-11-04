import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createBookmarkServer } from '../server/bookmarks/app.ts';
import { normalizeUrl, parseInput, parseTags } from '../server/bookmarks/model.ts';
import { hashPassword } from '../server/bookmarks/auth.ts';
import { isPublicAddress, safeFetch, extractMetadata, extractArticle } from '../server/bookmarks/web.ts';

const directory = mkdtempSync(join(tmpdir(), 'zanuain-bookmarks-test-'));
const origin = 'http://127.0.0.1:4321';
const application = createBookmarkServer({dataDirectory: directory, origins: [origin], jobs: false});
let endpoint = '';
let cookie = '';
let csrf = '';
let privateId = 0;
let publicId = 0;
async function request(path: string, method = 'GET', input?: unknown, authenticated = true, headers: Record<string, string> = {}) {
  const response = await fetch(endpoint + path, {
    method, headers: {
      Origin: origin, ...(input !== undefined ? {'Content-Type': 'application/json'} : {}),
      ...(authenticated ? {Cookie: cookie, 'X-CSRF-Token': csrf} : {}), ...headers,
    }, ...(input !== undefined ? {body: JSON.stringify(input)} : {}),
  });
  const text = await response.text();
  let data;
  try {data = JSON.parse(text);} catch {data = text;}
  return {response, status: response.status, data};
}
before(async () => {
  application.database.prepare('INSERT INTO admin VALUES (1,?,?)').run('admin', await hashPassword('test-password-very-long'));
  await new Promise<void>(resolve => application.server.listen(0, '127.0.0.1', resolve));
  const address = application.server.address();
  assert(address && typeof address !== 'string');
  endpoint = `http://127.0.0.1:${address.port}/api/bookmarks`;
});
after(async () => {
  await new Promise<void>(resolve => application.server.close(() => resolve()));
  rmSync(directory, {recursive: true, force: true});
});

test('网址排序、斜线归一化和片段保留；字段校验', () => {
  assert.equal(normalizeUrl('https://EXAMPLE.com/path///?z=2&a=1#part'), 'https://example.com/path?a=1&z=2#part');
  assert.notEqual(normalizeUrl('https://example.com/#one'), normalizeUrl('https://example.com/#two'));
  assert.deepEqual(parseTags('学习 学习 TypeScript typescript'), ['typescript', '学习'].sort((left, right) => left.localeCompare(right, 'zh-CN')));
  assert.throws(() => parseInput({url: 'javascript:alert(1)'}));
  assert.throws(() => parseInput({url: 'https://name:secret@example.com'}));
  assert.throws(() => parseInput({url: 'https://example.com', shared: 'false'}));
});
test('未登录、跨站登录、错误凭据被拒绝', async () => {
  assert.equal((await request('/', 'POST', {url: 'https://example.com'}, false)).status, 401);
  assert.equal((await request('/check?url=https://example.com', 'GET', undefined, false)).status, 401);
  assert.equal((await request('/login', 'POST', {username: 'admin', password: 'wrong'}, false, {Origin: 'https://evil.example'})).status, 403);
  assert.equal((await request('/login', 'POST', {username: 'admin', password: 'wrong'}, false)).status, 401);
});
test('登录使用 HttpOnly 会话；写入要求 CSRF 与同源', async () => {
  const result = await request('/login', 'POST', {username: 'admin', password: 'test-password-very-long'}, false);
  assert.equal(result.status, 200);
  const setCookie = result.response.headers.get('set-cookie')!;
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);
  cookie = setCookie.split(';')[0]; csrf = result.data.csrf;
  assert.equal((await request('/session')).data.authenticated, true);
  assert.equal((await request('/', 'POST', {url: 'https://example.com'}, true, {'X-CSRF-Token': 'bad'})).status, 403);
  assert.equal((await request('/', 'POST', {url: 'https://example.com'}, true, {Origin: 'https://evil.example'})).status, 403);
});
test('管理员创建私密和公开书签；访客统计和标签不泄漏', async () => {
  const privateResult = await request('/', 'POST', {url: 'https://private.example/secret', title: 'Private', notes: 'secret note', tag_string: 'private-tag', unread: true});
  assert.equal(privateResult.status, 201); privateId = privateResult.data.bookmark.id;
  const publicResult = await request('/', 'POST', {url: 'https://public.example/page/?b=2&a=1', title: 'Public', notes: 'private annotation text', tag_string: 'public-tag', shared: true});
  assert.equal(publicResult.status, 201); publicId = publicResult.data.bookmark.id;
  const publicList = await request('/', 'GET', undefined, false);
  assert.equal(publicList.data.total, 1);
  assert.equal(publicList.data.items[0].notes, undefined);
  assert.equal(publicList.data.activity.length, 1);
  assert(!JSON.stringify(publicList.data).includes('private-tag'));
  assert.equal((await request(`/${privateId}`, 'GET', undefined, false)).status, 404);
  assert.equal((await request(`/${privateId}/article`, 'GET', undefined, false)).status, 404);
  assert.equal((await request('/?view=trash', 'GET', undefined, false)).status, 401);
  const tags = await request('/tags', 'GET', undefined, false);
  assert.deepEqual(tags.data.map((tag: {name: string}) => tag.name), ['public-tag']);
});
test('客户端预填、查重、重复提交更新及回收站恢复', async () => {
  const check = await request('/check?url=https://public.example/page?a=1&from_client=1&title=Client');
  assert.equal(check.data.metadata.title, 'Client');
  await request('/bulk', 'POST', {ids: [publicId], action: 'trash'});
  const existing = await request('/check?' + new URLSearchParams({url: 'https://public.example/page?a=1&b=2', from_client: '1'}));
  assert.equal(existing.data.bookmark.id, publicId);
  assert.equal(existing.data.bookmark.is_deleted, true);
  const result = await request('/', 'POST', {url: 'https://public.example/page?a=1&b=2', title: 'Updated', shared: true, tag_string: 'public-tag second'});
  assert.equal(result.status, 200);
  assert.equal(result.data.created, false);
  assert.equal(result.data.bookmark.id, publicId);
  assert.equal(result.data.bookmark.is_deleted, false);
  assert.equal((await request('/')).data.total, 2);
  assert.equal((await request(`/${privateId}`, 'PUT', {url: 'https://public.example/page?a=1&b=2'})).status, 422);
});
test('搜索、标签和保存筛选按真实内容计算', async () => {
  assert.equal((await request('/?q=Updated')).data.total, 1);
  assert.equal((await request('/?q=-Updated')).data.total, 1);
  assert.equal((await request('/?tag=second')).data.total, 1);
  const saved = await request('/filters', 'POST', {name: '阅读', query: 'q=Updated'});
  assert.equal(saved.data[0].count, 1);
  assert.equal((await request('/filters', 'GET', undefined, false)).status, 401);
});
test('归档、公开与未读状态相互独立', async () => {
  await request('/bulk', 'POST', {ids: [publicId], action: 'archive'});
  assert.equal((await request('/')).data.total, 1);
  assert.equal((await request('/?view=archived')).data.total, 1);
  assert.equal((await request('/', 'GET', undefined, false)).data.total, 1);
  await request('/bulk', 'POST', {ids: [publicId], action: 'unarchive'});
});
test('批注始终私密；撤回公开后附件立即不可访问', async () => {
  const filename = `${randomUUID()}.html`;
  writeFileSync(join(directory, 'assets', filename), '<p>Text for annotation</p>');
  application.database.prepare('UPDATE bookmarks SET article_path=?,snapshot_path=? WHERE id=?').run(filename, filename, publicId);
  assert.equal((await request(`/${publicId}/article`, 'GET', undefined, false)).status, 200);
  assert.equal((await request(`/${publicId}/annotations`, 'POST', {quote: 'Text', note: 'Private thought', start: 0, finish: 4})).status, 200);
  assert.equal((await request(`/${publicId}/annotations`, 'GET', undefined, false)).status, 401);
  await request('/bulk', 'POST', {ids: [publicId], action: 'unshare'});
  assert.equal((await request(`/${publicId}/snapshot`, 'GET', undefined, false)).status, 404);
  assert.equal((await request(`/${publicId}/article`, 'GET', undefined, false)).status, 404);
  await request('/bulk', 'POST', {ids: [publicId], action: 'share'});
});
test('标签合并不丢失关联，HTML 导入去重，导出转义', async () => {
  const tags = (await request('/tags')).data;
  const second = tags.find((tag: {name: string}) => tag.name === 'second');
  await request(`/tags/${second.id}`, 'PUT', {name: 'public-tag'});
  assert.deepEqual((await request(`/${publicId}`)).data.tags, ['public-tag']);
  const imported = await request('/import', 'POST', {html: '<DL><DT><A HREF="https://import.example" TAGS="测试,文档">A &lt;script&gt;</A><DT><A HREF="javascript:alert(1)">bad</A></DL>'});
  assert.deepEqual(imported.data, {imported: 1, skipped: 1});
  const exported = await request('/export');
  assert.match(exported.data, /A &lt;script&gt;/);
  assert(!exported.data.includes('<script>'));
  assert.equal((await request('/export', 'GET', undefined, false)).status, 401);
});
test('永久删除前必须进入回收站；删除级联清理', async () => {
  assert.equal((await request(`/${privateId}`, 'DELETE')).status, 409);
  await request('/bulk', 'POST', {ids: [privateId], action: 'trash'});
  assert.equal((await request(`/${privateId}`, 'DELETE')).status, 200);
  assert.equal((await request(`/${privateId}`)).status, 404);
});
test('抓取阻止私网地址，正文清理脚本、事件、外部嵌入', async () => {
  for (const address of ['127.0.0.1', '10.1.1.1', '192.168.1.1', '169.254.169.254', '::1', '::ffff:127.0.0.1']) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress('8.8.8.8'), true);
  await assert.rejects(safeFetch('http://127.0.0.1/'));
  const html = '<html><head><title>Title</title><meta name="description" content="Description"></head><body><article><h1>Article</h1><p>Some useful text.</p><script>alert(1)</script><img src="http://evil.example" onerror="alert(2)"><a href="javascript:alert(3)">link</a></article></body></html>';
  assert.equal(extractMetadata(html, 'https://example.com').title, 'Title');
  const article = extractArticle(html, 'https://example.com');
  assert(!/<script|onerror|javascript:|<img/.test(article));
  assert.match(article, /Some useful text/);
});
test('退出使会话失效，旧 CSRF 无法继续写入', async () => {
  assert.equal((await request('/logout', 'POST', {})).status, 200);
  assert.equal((await request('/session')).data.authenticated, false);
  assert.equal((await request('/', 'POST', {url: 'https://example.com'})).status, 401);
});
