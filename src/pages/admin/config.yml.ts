import type { APIRoute } from 'astro';
import { site } from '../../site.config';
export const GET: APIRoute = () => {
  const config = site.repository ? `backend:
  name: github
  repo: ${site.repository}
  branch: main
media_folder: public/images
public_folder: /images
locale: zh_Hans
collections:
  - name: notes
    label: 学习笔记
    folder: src/content/notes
    create: true
    slug: '{{slug}}'
    fields:
      - { name: title, label: 标题, widget: string }
      - { name: description, label: 摘要, widget: text }
      - { name: date, label: 日期, widget: datetime, format: 'YYYY-MM-DD', time_format: false }
      - { name: category, label: 分类, widget: string, default: 学习记录 }
      - { name: tags, label: 标签, widget: list, required: false }
      - { name: draft, label: 草稿, widget: boolean, default: true }
      - { name: body, label: 正文, widget: markdown }
` : '# Set CONTENT_REPOSITORY to enable the Git-based editor.\n';
  return new Response(config, { headers: { 'Content-Type': 'text/yaml; charset=utf-8' } });
};
