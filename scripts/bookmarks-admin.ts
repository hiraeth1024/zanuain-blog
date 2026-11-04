import { resolve, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { openDatabase } from '../server/bookmarks/model.ts';
import { hashPassword } from '../server/bookmarks/auth.ts';

const argumentsList = process.argv.slice(2);
const username = argumentsList[argumentsList.indexOf('--username') + 1] || 'admin';
const directory = resolve(process.env.BOOKMARKS_DATA_DIR || '.data/bookmarks');
const database = openDatabase(join(directory, 'bookmarks.sqlite'));
const exists = database.prepare('SELECT id FROM admin').get();
if (exists && !argumentsList.includes('--reset')) throw new Error('管理员已存在。如需重设密码，请加 --reset；现有会话将失效。');
if (!/^[a-zA-Z0-9_.-]{1,64}$/.test(username)) throw new Error('用户名须为 1–64 位字母、数字或 ._-。');
let password = process.env.BOOKMARKS_ADMIN_PASSWORD || '';
let generated = false;
if (!password && process.stdin.isTTY) {
  let hidden = false;
  const output = new Writable({write(chunk, _encoding, done) { if (!hidden) process.stdout.write(chunk); done(); }});
  const prompt = createInterface({input: process.stdin, output, terminal: true});
  process.stdout.write('管理员密码（至少 12 位，输入隐藏；留空生成）：');
  hidden = true;
  password = await prompt.question('');
  prompt.close();
  process.stdout.write('\n');
}
if (!password) { password = randomBytes(24).toString('base64url'); generated = true; }
const passwordHash = await hashPassword(password);
database.prepare('INSERT OR REPLACE INTO admin VALUES (1,?,?)').run(username, passwordHash);
database.prepare('DELETE FROM sessions').run();
database.close();
console.log(`管理员 ${username} 已配置。${exists ? '旧会话已失效。' : ''}`);
if (generated) console.log(`请保存此密码（仅显示一次）：${password}`);
