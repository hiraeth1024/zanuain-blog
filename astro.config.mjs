import { defineConfig } from 'astro/config';
import { existsSync, readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

const envFile = new URL('.env', import.meta.url);
const localEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};

export default defineConfig({
  site: process.env.SITE_URL || localEnv.SITE_URL || 'https://zanuain-blog.tallmint2.chatgpt.site',
  output: 'static',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    server: { proxy: { '^/api/bookmarks': process.env.BOOKMARKS_PROXY_URL || 'http://127.0.0.1:4322' } },
    preview: { proxy: { '^/api/bookmarks': process.env.BOOKMARKS_PROXY_URL || 'http://127.0.0.1:4322' } },
  },
  trailingSlash: 'always',
  devToolbar: { enabled: false },
  markdown: { shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } } },
});
