import { getCollection, type CollectionEntry } from 'astro:content';

export const getNotes = async () => (await getCollection('notes', ({ data }) => !data.draft))
  .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf() || a.id.localeCompare(b.id));
export const noteUrl = (id: string) => `/notes/${id.split('/').map(encodeURIComponent).join('/')}/`;
export const tagUrl = (tag: string) => `/tags/${encodeURIComponent(tag)}/`;
export const getTags = (notes: CollectionEntry<'notes'>[]) => {
  const counts = new Map<string, number>();
  for (const note of notes) for (const tag of new Set(note.data.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
};
export const formatDate = (date: Date) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai',
}).format(date).replaceAll('/', '.');
export const readingTime = (note: CollectionEntry<'notes'>) => {
  const text = note.body ?? '';
  const chinese = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const words = text.replace(/[\u4e00-\u9fff]/g, '').split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(chinese / 400 + words / 200));
};
