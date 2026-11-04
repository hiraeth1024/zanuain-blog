# Zanuain · 个人学习笔记

用 Markdown 写笔记，用 Git 记录修改，输出纯静态网页。

布局与模块参照 [Cube007](https://www.cube007.cn/)，不实现工具模块；样式严格依据 `DESIGN/` 的 Notion 设计规范，默认白色背景。当前三篇笔记是可删除的入门示例。

顶部为笔记、标签、书签、关于、搜索和 RSS 导航；首页先展示个人介绍、真实笔记/标签统计和浏览入口，再展示左侧最新笔记流、右侧标签面板。另有标签详情、独立搜索、RSS、关于、阅读目录、复制链接、相关笔记及相邻篇目。书签页面在本站内实现，沿用 linkding-cn 的创建与数据管理方式；管理员登录后管理，访客只读公开书签。没有固定左侧分类导航或首页筛选工具栏。

## 本地运行

需要 Node.js 22.12+（推荐 Node 22 LTS）与 npm。

```bash
npm install
npm run dev
```

默认打开 http://127.0.0.1:4321 。

```bash
npm run check    # Astro / TypeScript 检查
npm run build    # 生成 dist/ 静态文件
npm run preview  # 预览构建结果
npm run test:bookmarks # 书签服务安全与数据规则
```

笔记和其余公开页面保持静态输出；首页背景使用 React + TypeScript + Tailwind。书签页面由独立 Node.js + SQLite 服务提供动态数据、登录和管理，生产服务器需要运行书签服务与 Nginx。管理员初始化、数据备份与发布步骤见 [docs/bookmarks.md](docs/bookmarks.md)。

## 全局主题

默认纯白，不自动跟随系统偏好。顶部月亮／太阳按钮切换浅色与深色，手机折叠菜单关闭时仍可使用；选择保存在 `localStorage` 的 `zanuain-theme`，首屏绘制前恢复，其他标签页同步。存储不可用时仍可当页切换，重新加载回默认浅色。

主题只修改 `src/styles/themes.css` 的语义颜色；原始 `DESIGN/` 参考色板与关于终端内部保持固定。全站页面、发布看板及 Shiki 代码块均适配；首页深色滤镜只作用于装饰画布。当前设计系统见根 `DESIGN.md`，实施与验证见 `DESIGN/IMPLEMENTATION.md`。

## 首页动态背景

首页首屏接入 [React Bits Shape Waves](https://reactbits.dev/backgrounds/shape-waves) 的 TypeScript + Tailwind 版本；参数位于 `src/pages/index.astro`，组件源码位于 `src/components/ShapeWaves.tsx`。使用白色底、灰色混合形状与 `</>` 遮罩，保留鼠标波纹和 1.6 秒入场；装饰层透明度为 28%，以保持正文可读。

使用兼容官方组件 API 的 `vgpu@0.3.0`。React 为首页背景、发布看板和关于页终端在浏览器中挂载；Tailwind 不加载 Preflight，沿用 DESIGN 的原有排版。背景组件尊重减少动态效果偏好，离屏或切换后台时停止持续动画；无 WebGPU 时保留所选主题与静态内容；禁用脚本时默认白底。浏览器需支持 WebGPU 才能显示背景动画，网站本身仍为纯静态输出。

第三方组件来源与许可见 `public/licenses/react-bits-LICENSE.txt`。

## 发布数据看板

首页标签面板下方提供发布热力图与月历，两种视图可切换。按已发布笔记的 `date` 和 `category` 计算周／月篇数、活跃天数、最长连续发布天数和分类计数；草稿沿用内容查询规则排除。不使用收藏数据、演示活动或外部接口。

热力图展示截至所选周的十五周，日历展示所选月。支持周／月翻页、回到今天、按分类筛选，以及点击日期查看当天的笔记链接。每周从周日开始，列编号按该周周一的 ISO 周数显示；日期以 `Asia/Shanghai` 为准。页面加载时更新当前日期，静态内容变更随 Git 构建发布。

统计逻辑位于 `src/lib/publications.ts`，交互组件位于 `src/components/PublicationDashboard.tsx`；运行 `npm run test:publications` 可检查日期与统计边界。

## 项目结构

```text
DESIGN/                 用户提供的设计参考与 tokens（保留）
src/content/notes/      Markdown 笔记
src/content.config.ts  笔记元信息校验
src/components/        笔记流、标签列表与 SVG 图标
src/layouts/           顶部导航、页脚与页面布局
src/pages/             首页、标签、搜索、关于、RSS、写作、阅读页与 404
src/site.config.ts     站名、简介与可选源码仓库
src/styles/            全局样式，导入 DESIGN/variables.css
src/lib/               内容查询、日期与阅读时长
public/                直接复制到站点的静态资源
deploy/nginx.conf      自有服务器 Nginx 配置示例
.github/workflows/     自动检查、构建和可选 SSH 部署
```

## 关于页终端

关于页使用基于 [TermFolio](https://github.com/SimonAKing/TermFolio) MIT 源码适配的 React 19 + TypeScript 终端，替换原站点介绍文档组件。终端内固定为深色；页面默认白色，外层随全站主题切换。实现位于 `src/components/AboutTerminal.tsx`，命令逻辑位于 `src/lib/terminal.ts`，许可位于 `public/licenses/termfolio-LICENSE.txt`；没有引入原包的 React 16 依赖。

输入 `help` 查看命令；`about`、`stack`、`links` 查看站点介绍和技术信息，`notes`、`tags`、`search Markdown` 查询现有公开内容，`open notes` 等命令打开对应站点入口。支持 ↑↓ 历史、Tab 前缀补全、`clear`、Ctrl L 清屏、Esc 清空输入和重新开始。本次命令记录仅保存在页面内存中；它是浏览器内的站点导航组件，不连接系统 Shell。无脚本时仍显示简介和普通站点链接。

运行 `npm run test:terminal` 检查命令解析、搜索、补全和导航规则。

## 404 页面

404 页使用 [React Bits FuzzyText 官方 TS + Tailwind 注册表](https://reactbits.dev/r/FuzzyText-TS-TW.json)源码，位于 `src/components/FuzzyText.tsx`，复用现有 React 环境，无新增依赖或 shadcn 脚手架；许可沿用 `public/licenses/react-bits-LICENSE.txt`。`NotFoundCode.tsx` 将 `404` 保留为 React 字符串子节点，避免 Astro slot 的 HTML 对象被转成文字；全部指定参数及适配说明见 `DESIGN/IMPLEMENTATION.md`。

文字继承 `currentColor`，随全站浅深主题保持单色；1.4 秒入场后持续横向模糊，悬停增强。无脚本或 Canvas 初始化失败时保留静态 `404`，实时切换减少动态效果偏好后静态显示；首页与搜索链接始终可用。构建生成 `dist/404.html`，开发环境与构建后静态预览中，不存在的地址均已验证返回 HTTP 404 与自定义页面；自有服务器沿用 `deploy/nginx.conf` 的 `error_page 404 /404.html`，部署后由服务器配置决定错误页响应。

## 添加笔记

在 `src/content/notes/` 新建 `your-note.md`，或把已有 Markdown 放入该目录。每篇文件开头都需要以下 `---` 包裹的 YAML 信息，其中 `title`、`description`、`date`、`category` 必填；日期使用 `YYYY-MM-DD`。缺少必填字段会导致内容校验失败，阻止开发预览和构建：

```markdown
---
title: 笔记标题
description: 用一句话描述笔记。
date: 2026-11-03
category: 学习记录
tags: [示例]
draft: false
---

## 从一个问题开始

这里写正文。
```

- 文件名生成 `/notes/your-note/`，子目录也可以使用；发布后尽量保持文件名稳定。
- 标签从已发布笔记自动生成，可在标签页浏览；分类显示在阅读页。
- `draft: true` 排除公开输出，但不会让公开 Git 仓库中的源文件变成私密内容。
- 图片放在 `public/images/` 并使用 `![说明](/images/name.png)` 引用。
- 首页按日期倒序，阅读时长由正文估算；独立搜索页在浏览器内过滤标题、摘要与标签，无网络请求。
- 没有 JavaScript 时，列表与 Markdown 阅读页仍可访问。

## Sites 托管

本项目已接入 Sites，地址为 https://zanuain-blog.tallmint2.chatgpt.site ，首次发布为仅所有者可访问的私有站点。`.openai/hosting.json` 保存站点身份与 `dist/` 静态输出配置；后续更新应复用其中的 `project_id`。

默认规范链接和 RSS 使用上述 Sites 地址；设置 `SITE_URL` 可覆盖为自己的域名。构建命令仍为 `npm run build`，无需运行时服务器。

## Docker 部署

已提供多阶段 `Dockerfile` 和 `docker-compose.yml`，分别运行 Nginx 静态站点与 Node.js 书签 API，书签数据使用命名卷持久化。

```sh
# 已有 .env 时，请合并配置而不是覆盖。
cp -n deploy/docker.env.example .env
# 将 .env 中 SITE_URL、BOOKMARKS_ORIGINS 改为正式 HTTPS 域名。
docker compose up -d --build
docker compose exec api node --experimental-strip-types scripts/bookmarks-admin.ts --username admin
```

默认发布 HTTP 8080 端口，正式环境需通过 HTTPS 反向代理访问。完整配置、本地 HTTP 试运行与备份操作见 [Docker 部署说明](docs/docker.md)。

## GitHub Actions 部署到自己的服务器

使用自己的域名发布前设置 `SITE_URL`，确保 RSS 中的笔记地址指向正式站。未设置时默认使用 Sites 地址。本地可复制 `.env.example` 为 `.env`；GitHub Actions 读取同名仓库 Variables。

当前尚未连接远程仓库或服务器。推送到 GitHub 后，Actions 默认仅检查和构建；部署需要显式启用。网站静态文件和书签服务独立发布。启用书签服务发布还需配置 Nginx 反向代理、systemd 服务和位于 `/var/lib/zanuain-bookmarks` 的持久数据目录；详细配置参见 [书签部署说明](docs/bookmarks.md#生产部署)。

1. 创建自己的 GitHub 仓库，设置 `origin`，推送 `main`。
2. 在服务器创建专用的站点目录 `/var/www/zanuain-blog/public`，允许专门的部署用户写入，并为该用户安装 rsync。
3. 将部署专用 SSH 密钥的公钥加入该用户的 `authorized_keys`。
4. 在仓库 Settings → Secrets and variables → Actions 中设置以下参数。也可以将生产凭据配置在 `production` Environment 中。

| 类型 | 名称 | 用途 |
| --- | --- | --- |
| Secret | `SSH_PRIVATE_KEY` | 部署用的无口令 Ed25519 私钥 |
| Secret | `SSH_KNOWN_HOSTS` | 已独立核验指纹的服务器 SSH 公钥条目；非 22 端口条目应为 `[host]:port` |
| Variable | `DEPLOY_HOST` | 服务器域名或 IPv4 地址 |
| Variable | `DEPLOY_USER` | 部署用户 |
| Variable | `DEPLOY_PORT` | SSH 端口，默认 `22` |
| Variable | `DEPLOY_PATH` | `/var/www/zanuain-blog/public` 等专用目录 |
| Variable | `DEPLOY_ENABLED` | 设为 `true` 启用自动部署 |
| Variable | `BOOKMARKS_DEPLOY_ENABLED` | 设为 `true` 同步书签服务代码并重启 systemd 服务 |
| Variable | `SITE_URL` | 正式站点地址，如 `https://notes.example.com`，用于 RSS |
| Variable | `CONTENT_REPOSITORY` | 可选，自己的 `账号/仓库名`，用于 GitHub 链接及在线写作 |

5. 参考 `deploy/nginx.conf` 配置域名、站点根目录和 HTTPS。域名和 TLS 证书需在服务器上配置。
6. 推送到 `main` 或手动运行工作流，即可检查、构建并同步 `dist/`。Pull request 仅检查与构建，不会部署。

同步使用 `rsync --delete-delay` 清理删除的笔记。`DEPLOY_PATH` 必须是站点专用目录，不要放置上传文件、服务器配置或其他需要保留的数据。工作流限定路径为 `/var/www/<站点>` 或 `/var/www/<站点>/public`。

笔记阅读不需要 Node.js、数据库或运行时后端；启用动态书签功能时，服务器单独运行 Node.js 书签服务。书签数据库与静态站点目录分离，发布静态文件不会覆盖收藏数据。

## 写作入口

页脚保留与参考站相同的“GitHub”和“写作”入口。未设置 `CONTENT_REPOSITORY` 时，显示明确的配置说明，不显示虚假登录或错误的仓库链接。

配置 `CONTENT_REPOSITORY=自己的账号/仓库名` 后重新构建，`/admin/` 加载 [Sveltia CMS](https://sveltiacms.app/en/docs/start)，`/admin/config.yml` 自动指向该仓库的 `main` 分支和笔记目录。可使用 Sveltia 支持的 GitHub 访问令牌登录；OAuth 需要另行配置认证服务，详见 [GitHub backend 文档](https://sveltiacms.app/en/docs/backends/github)。未在本次任务中连接账号或验证真实发布。

在线编辑器从官方推荐 CDN 加载，只有启用并访问写作页时才使用；公开页面不加载此脚本。GitHub 源码与写作配置中只填写公开仓库标识，不要将访问令牌写入环境文件或提交到 Git。
