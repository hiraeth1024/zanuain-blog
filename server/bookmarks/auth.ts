import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type { IncomingMessage } from 'node:http';
import type { Database } from './model.ts';
import { HttpError } from './model.ts';

const scrypt = promisify(scryptCallback);
export async function hashPassword(password: string) {
  if (password.length < 12 || password.length > 256) throw new HttpError(422, '密码需为 12–256 个字符。');
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, digest] = encoded.split(':');
  const calculated = await scrypt(password.slice(0, 256), salt, 64) as Buffer;
  const expected = Buffer.from(digest, 'hex');
  return calculated.length === expected.length && timingSafeEqual(calculated, expected);
}
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function session(database: Database, request: IncomingMessage) {
  const token = request.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('zanuain_session='))?.slice(16);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const stored = database.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires>?').get(tokenHash(token), Date.now());
  return stored as {token_hash: string; csrf: string; expires: number} | null;
}
export function requireAdmin(database: Database, request: IncomingMessage) {
  const current = session(database, request);
  if (!current) throw new HttpError(401, '请先登录管理员账户。');
  return current;
}
export function checkOrigin(request: IncomingMessage, allowedOrigins: string[]) {
  const origin = request.headers.origin;
  if (!origin || !allowedOrigins.includes(origin)) throw new HttpError(403, '请求来源不受信任，请从本站重新操作。');
}
export function requireWrite(database: Database, request: IncomingMessage, allowedOrigins: string[]) {
  checkOrigin(request, allowedOrigins);
  const current = requireAdmin(database, request);
  if (request.headers['x-csrf-token'] !== current.csrf) throw new HttpError(403, '会话校验失败，请刷新页面后重试。');
  return current;
}
export async function login(database: Database, username: string, password: string, address: string) {
  const key = tokenHash(address);
  const current = database.prepare('SELECT count,expires FROM login_attempts WHERE key=?').get(key) as {count: number; expires: number} | undefined;
  if (current && current.expires > Date.now() && current.count >= 8) throw new HttpError(429, '尝试次数过多，请 15 分钟后重试。');
  database.prepare('DELETE FROM login_attempts WHERE expires<?').run(Date.now());
  database.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key, Date.now() + 900000);
  const admin = database.prepare('SELECT username,password_hash FROM admin WHERE id=1').get() as {username: string; password_hash: string} | undefined;
  const placeholder = '00000000000000000000000000000000:' + '0'.repeat(128);
  const correct = await verifyPassword(password, admin?.password_hash ?? placeholder);
  if (!admin || username !== admin.username || !correct) throw new HttpError(401, '用户名或密码不正确。');
  database.prepare('DELETE FROM login_attempts WHERE key=?').run(key);
  database.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());
  const token = randomBytes(32).toString('hex');
  const csrf = randomBytes(32).toString('hex');
  database.prepare('INSERT INTO sessions VALUES (?,?,?)').run(tokenHash(token), csrf, Date.now() + 7 * 86400000);
  return { token, csrf, username: admin.username };
}
