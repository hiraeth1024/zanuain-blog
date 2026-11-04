import test from 'node:test';
import assert from 'node:assert/strict';
import { completeCommand, executeCommand, introduction } from '../src/lib/terminal.ts';

const context = {
  name: 'Zanuain', description: '学习记录', repository: '',
  notes: [
    { title: 'Markdown 写作', description: '整理代码块', date: '2026.11.03', category: '记录', href: '/notes/markdown/', tags: ['Git'] },
    { title: 'Notion 设计', description: 'Typography reference', date: '2026.11.02', category: '参考', href: '/notes/design/', tags: ['UI'] },
  ],
  tags: [{ name: 'Git', count: 1, href: '/tags/Git/' }, { name: 'UI', count: 1, href: '/tags/UI/' }],
};
const output = command => executeCommand(command, context);

test('intro, notes and tags reflect supplied public content, including empty collections', () => {
  assert.ok(introduction(context).some(line => line.text === '2 篇公开笔记 · 2 个标签'));
  assert.deepEqual(output('notes').lines.map(line => line.href), context.notes.map(note => note.href));
  assert.deepEqual(output('tags').lines.map(line => line.href), context.tags.map(tag => tag.href));
  assert.ok(executeCommand('notes', { ...context, notes: [] }).lines[0].text.includes('还没有'));
});
test('search combines case-insensitive title, description and tag terms', () => {
  assert.equal(output('SEARCH markdown git').lines[1].href, '/notes/markdown/');
  assert.equal(output('search TYPOGRAPHY').lines[1].href, '/notes/design/');
  assert.ok(output('search missing').lines[1].text.includes('没有找到'));
  assert.equal(output('search').lines[0].type, 'error');
});
test('echo preserves argument case and treats markup and shell syntax as text', () => {
  assert.equal(output('  ECHO Hello World 中文  ').lines[0].text, 'Hello World 中文');
  assert.equal(output('echo <script>alert(1)</script>; rm -rf /').lines[0].text, '<script>alert(1)</script>; rm -rf /');
});
test('navigation resolves only known destinations and handles an unconfigured repository', () => {
  assert.equal(output('open notes').navigate, '/#feed');
  assert.equal(output('open search').navigate, '/search/');
  assert.equal(output('open source').lines[0].type, 'error');
  assert.equal(output('open javascript:alert(1)').navigate, undefined);
  assert.equal(executeCommand('open source', { ...context, repository: 'https://github.com/test/site' }).navigate, 'https://github.com/test/site');
});
test('aliases, unknown input and session history have recoverable results', () => {
  assert.deepEqual(output('ls'), output('help'));
  assert.equal(output('cls').clear, true);
  assert.equal(output('exit').navigate, '/');
  assert.ok(output('badcommand').lines[0].text.includes('help'));
  assert.deepEqual(output('   ').lines, []);
  assert.equal(executeCommand('history', context, ['notes', 'help']).lines[1].text, '2  help');
});
test('completion is deterministic, supports destinations and never evaluates input', () => {
  assert.deepEqual(completeCommand('sea'), ['search']);
  assert.deepEqual(completeCommand('OPEN n'), ['open notes']);
  assert.ok(completeCommand('h').includes('history'));
  assert.deepEqual(completeCommand(''), []);
  assert.deepEqual(completeCommand('<img>'), []);
});
test('date uses Shanghai time even when given a UTC instant across midnight', () => {
  const result = executeCommand('date', context, [], new Date('2026-11-02T17:00:00Z'));
  assert.ok(result.lines[0].text.includes('2026年11月3日'));
  assert.ok(result.lines[0].text.includes('Asia/Shanghai'));
});
