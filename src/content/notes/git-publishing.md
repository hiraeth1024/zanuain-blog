---
title: 把一次 Git 提交，变成一次更新
description: 从本地预览到静态构建，梳理这个笔记站的发布路径。
date: 2026-11-01
category: 使用指南
tags: [入门示例, Git, 部署]
---

这是一篇项目自带的流程说明。自动发布需要先配置自己的 GitHub 仓库与服务器，当前项目还没有连接远程仓库。

## 本地预览

在项目目录执行：

```bash
npm install
npm run dev
```

打开终端输出的本地地址。修改 Markdown 后，开发服务器会更新页面。

## 检查并构建

```bash
npm run check
npm run build
npm run preview
```

构建会在 `dist/` 生成完整的静态站点。正式服务器不需要运行 Node.js，也不需要数据库。

## 连接自动发布

项目中的 `.github/workflows/deploy.yml` 负责在 `main` 更新时执行检查和构建。启用部署变量、配置 SSH 密钥与已核验的服务器公钥后，再通过 SSH 和 rsync 将产物同步到服务器。

详细配置见 `README.md`。服务器尚未配置时，工作流只检查和构建。

## 保留一次修改的来由

提交说明不必复杂，只要未来能看明白：

```bash
git add src/content/notes/
git commit -m "notes: 补充 Markdown 图片用法"
git push origin main
```

这样每篇笔记的修改就有了可追溯的记录。
