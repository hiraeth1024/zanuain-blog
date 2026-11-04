import { spawn } from 'node:child_process';
const processes = [];
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill('SIGTERM');
  process.exitCode = code;
};
const start = (argumentsList, ipc = false) => {
  const child = spawn(process.execPath, argumentsList, {
    stdio: ipc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
  });
  processes.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', (code, signal) => stop(code ?? (signal ? 1 : 0)));
  return child;
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());

const api = start(
  ['--env-file-if-exists=.env', '--experimental-strip-types', 'server/bookmarks/index.ts'],
  true,
);
api.once('message', message => {
  if (stopping || message?.type !== 'ready') return;
  start(['node_modules/astro/bin/astro.mjs', 'dev', '--host', '127.0.0.1', ...process.argv.slice(2)]);
});
