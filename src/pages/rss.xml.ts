import type { APIRoute } from 'astro';
import { getNotes, noteUrl } from '../lib/notes';
import { site } from '../site.config';
const escape = (text: string) => text.replace(/[<>&"']/g, value => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[value]!);
export const GET: APIRoute = async ({ site: siteUrl }) => {
  const notes = await getNotes();
  const origin = siteUrl!;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${escape(site.name)} 的学习笔记</title><description>${escape(site.description)}</description><link>${origin.href}</link><language>zh-CN</language><atom:link href="${new URL('/rss.xml', origin).href}" rel="self" type="application/rss+xml"/>${notes.map(note => `<item><title>${escape(note.data.title)}</title><description>${escape(note.data.description)}</description><link>${escape(new URL(noteUrl(note.id), origin).href)}</link><guid isPermaLink="true">${escape(new URL(noteUrl(note.id), origin).href)}</guid><pubDate>${note.data.date.toUTCString()}</pubDate>${note.data.tags.map(tag => `<category>${escape(tag)}</category>`).join('')}</item>`).join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
