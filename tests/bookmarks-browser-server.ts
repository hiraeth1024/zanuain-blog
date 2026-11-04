import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createBookmarkServer } from '../server/bookmarks/app.ts';
import { hashPassword } from '../server/bookmarks/auth.ts';
import { parseInput, saveBookmark } from '../server/bookmarks/model.ts';

const directory = mkdtempSync(join(tmpdir(), 'zanuain-bookmarks-browser-'));
const {server, database} = createBookmarkServer({dataDirectory: directory, origins: ['http://localhost:4391'], jobs: false});
database.prepare('INSERT INTO admin VALUES (1,?,?)').run('qa-admin', await hashPassword('isolated-browser-test-only'));
const examples = [
  {url: 'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript', title: 'JavaScript 文档', description: '测试数据：语言基础、异步编程与浏览器接口，按需要逐项回查。', tag_string: '开发 文档 JavaScript', shared: true},
  {url: 'https://docs.astro.build/zh-cn/', title: 'Astro：内容驱动的网站', description: '测试数据：整理内容集合、静态构建和部署的阅读入口。', tag_string: 'Astro 文档', shared: true},
  {url: 'https://www.typescriptlang.org/docs/', title: 'TypeScript Handbook', description: '测试数据：类型缩小、泛型与日常开发中的类型设计。', tag_string: '开发 TypeScript', shared: true},
  {url: 'https://example.com/private', title: '仅管理员可见的测试书签', description: '测试数据：用于验证公开页面不会显示私密内容。', tag_string: '私人计划', shared: false},
];
for (const [index, example] of examples.entries()) {
  const {bookmark} = saveBookmark(database, parseInput({...example, unread: true}));
  const filename = `${randomUUID()}.html`;
  writeFileSync(join(directory, 'assets', filename), '<h2>从问题出发整理收藏</h2><p>这是一段用于浏览器验证的测试正文。收藏有价值的资料，添加便于回查的标签，再留下一点自己的理解。</p><p>阅读时可以选择这段文字，保存高亮和批注。公开访客可以阅读正文，但看不到个人批注。</p>');
  database.prepare("UPDATE bookmarks SET article_path=?,capture_status='complete',date_added=? WHERE id=?").run(filename, new Date(Date.now() - index * 86400000).toISOString(), bookmark.id);
}
server.listen(4392, '127.0.0.1', () => console.log('Isolated bookmark QA API: 4392 (temporary test data)'));
process.on('SIGTERM', () => server.close(() => {rmSync(directory, {recursive: true, force: true}); process.exit(0);}));
