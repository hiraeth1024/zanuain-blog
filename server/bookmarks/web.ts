import http from 'node:http';
import https from 'node:https';
import { lookup } from 'node:dns/promises';
import ipaddr from 'ipaddr.js';
import { load } from 'cheerio';
import sanitize from 'sanitize-html';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { HttpError, validateUrl } from './model.ts';

export function isPublicAddress(address: string) {
  try {
    const parsed = ipaddr.process(address);
    return parsed.range() === 'unicast';
  } catch { return false; }
}
export async function safeFetch(value: string, redirects = 0): Promise<{url: string; body: Buffer; type: string}> {
  const url = new URL(validateUrl(value));
  if (redirects > 4) throw new Error('网页重定向次数过多。');
  if (url.port && !['80', '443'].includes(url.port)) throw new Error('仅抓取使用标准 HTTP/HTTPS 端口的公开网页。');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(entry => !isPublicAddress(entry.address))) throw new HttpError(422, '不能抓取本机、内网或保留地址。');
  const resolved = addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? https : http).get(url, {
      agent: false,
      // Node's automatic IPv4/IPv6 selection requests an array with all: true.
      // Reuse only the addresses validated above, without resolving DNS again.
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, addresses);
        else callback(null, resolved.address, resolved.family);
      },
      headers: { 'User-Agent': 'ZanuainBookmarks/1.0', Accept: 'text/html,image/*;q=0.8', 'Accept-Encoding': 'identity' },
    }, response => {
      const status = response.statusCode ?? 500;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        safeFetch(new URL(response.headers.location, url).href, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) { response.resume(); reject(new Error(`网页返回 HTTP ${status}。`)); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) { request.destroy(new Error('网页或图片超过 5 MB。')); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => resolve({ url: url.href, body: Buffer.concat(chunks), type: String(response.headers['content-type'] ?? '').split(';')[0] }));
    });
    const deadline = setTimeout(() => request.destroy(new Error('抓取超时，可手动填写后保存。')), 12000);
    request.on('close', () => clearTimeout(deadline));
    request.on('error', reject);
  });
}
function absoluteUrl(value: string | undefined, base: string) {
  if (!value) return '';
  try {
    const url = new URL(value, base);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
export function extractMetadata(html: string, url: string) {
  const document = load(html);
  const content = (selector: string) => document(selector).first().attr('content')?.trim() ?? '';
  return {
    url,
    title: (content('meta[property="og:title"]') || document('title').first().text()).trim().slice(0, 4096),
    description: (content('meta[name="description"]') || content('meta[property="og:description"]')).slice(0, 20000),
    author: (content('meta[name="author"]') || content('meta[property="article:author"]')).slice(0, 1024),
    preview_image: absoluteUrl(content('meta[property="og:image"]') || content('meta[name="twitter:image"]'), url),
    favicon: absoluteUrl(document('link[rel~="icon"]').first().attr('href') || '/favicon.ico', url),
  };
}
export async function fetchPage(url: string) {
  const result = await safeFetch(url);
  if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(result.type)) throw new Error('此链接不是可提取的网页，可手动填写标题后保存。');
  const html = result.body.toString('utf8');
  return { html, metadata: extractMetadata(html, result.url) };
}
export function cleanArticle(html: string, url: string) {
  const document = load(html);
  document('a[href]').each((_index, element) => {
    const link = document(element);
    const href = absoluteUrl(link.attr('href'), url);
    if (href) link.attr('href', href); else link.removeAttr('href');
  });
  document('img,video,audio,iframe,form,input,button,script,style,link,meta').remove();
  return sanitize(document('body').html() ?? document.html(), {
    allowedTags: ['p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li', 'a', 'strong', 'b', 'em', 'i', 's', 'del', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'figure', 'figcaption'],
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    allowedSchemes: ['http', 'https'],
    transformTags: { a: sanitize.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' }) },
  });
}
export function extractArticle(html: string, url: string) {
  const { document } = parseHTML(html);
  const article = new Readability(document as unknown as Document, { charThreshold: 0 }).parse();
  return cleanArticle(article?.content || html, url);
}
