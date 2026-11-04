import { resolve } from 'node:path';
import { createBookmarkServer } from './app.ts';

const port = Number(process.env.BOOKMARKS_PORT || 4322);
const host = process.env.BOOKMARKS_HOST || '127.0.0.1';
const origins = (process.env.BOOKMARKS_ORIGINS || 'http://127.0.0.1:4321,http://localhost:4321').split(',').map(value => value.trim());
const secureCookies = origins.every(value => value.startsWith('https://'));
if (process.env.NODE_ENV === 'production' && !secureCookies) throw new Error('生产环境 BOOKMARKS_ORIGINS 必须使用 HTTPS。');
const { server } = createBookmarkServer({
  dataDirectory: resolve(process.env.BOOKMARKS_DATA_DIR || '.data/bookmarks'), origins, secureCookies,
});
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`[bookmarks] 无法启动：${host}:${port} 已被占用。请先在已有开发服务的终端按 Ctrl+C，再运行 npm run dev。`);
  } else {
    console.error(`[bookmarks] 启动失败：${error.message}`);
  }
  server.close(() => process.exit(1));
});
server.listen(port, host, () => {
  console.log(`Bookmarks API ready on ${host}:${port}`);
  process.send?.({type: 'ready'});
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => server.close(() => process.exit(0)));
// Stop the API if its development launcher exits unexpectedly.
if (process.connected) process.on('disconnect', () => server.close(() => process.exit(0)));
