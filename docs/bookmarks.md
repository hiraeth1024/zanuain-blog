# 内置书签模块

## 架构与边界

笔记继续由 Astro 静态构建。`/bookmarks/` 的 React 页面调用同源 `/api/bookmarks/`，Node.js 服务管理 SQLite 和资源目录；不部署、不连接外部 linkding-cn。新增界面继承现有 DESIGN 语义主题。关于终端保持独立样式。

参照版本：WooHooDai/linkding-cn `a4da78a0dff950de3a64c85db7533f388eaa89ed`。主要核对文件：`bookmarks/forms.py`、`templates/bookmarks/form.html`、两个 `bookmarklet*.js`、`services/bookmarks.py`、`utils.py`。数据规则以该版本为参照，代码使用本项目的 TypeScript 实现；没有直接复用原 SQLite 数据库或 Django 迁移。

## 本地运行

要求 Node.js 22.12+（22 系列）或 24+。Node 22 的内置 SQLite 会输出 ExperimentalWarning。

```sh
npm install
npm run bookmarks:admin -- --username admin
npm run dev
```

初始化命令会隐藏密码输入；留空则生成随机密码并只显示一次。无开放注册、无默认密码。CI/脚本也可通过 `BOOKMARKS_ADMIN_PASSWORD` 提供密码。已有管理员需使用 `--reset` 才能重设，同时撤销全部旧会话。密码使用带随机盐的 scrypt 保存，不存明文。

`npm run dev` 同时启动网站 4321 与 API 4322；关闭时只停止它自己创建的子进程。若网站已经运行，单独执行 `npm run bookmarks:serve`。两个服务均默认绑定回环地址。API 路径使用末尾斜杠，兼容 Astro 全局 `trailingSlash: always`。

访问 `/bookmarks/` 浏览公开书签；在页面点击“管理员登录”，登录后添加、编辑、归档、删除、管理标签与设置。

## 创建行为

- 独立新增页，字段顺序为标题、标签、URL、作者、描述、笔记、预览图、未读和公开选项。
- 空表单聚焦 URL，预填和编辑表单聚焦标签。支持 Ctrl/Cmd+Enter 保存。
- URL 输入 300ms 后查重和抓取；丢弃过期响应；保护已经手动编辑的字段。抓取失败仍可保存网址和手动信息。
- 标签空格分隔，自动创建；支持中文、拼音全拼子串和首字母前缀，方向键及 Enter/Tab 选中。
- URL 规范化用于去重，保留片段；重复创建更新已有记录，回收站记录恢复。修改为另一条记录的网址会报错。
- “重新抓取信息”允许覆盖元数据，各字段可单独撤销，继续手动编辑会清除该字段的撤销记录。
- 管理设置提供两种可拖到浏览器书签栏的收藏按钮：服务端抓取，以及客户端携带当前页标题、描述和作者。登录跳转保留完整预填参数；保存后尝试关闭窗口，浏览器不允许关闭时显示成功页。
- 自动标签采用“每行域名 + 标签”的规则，保存时应用。公开和未读默认值可配置。

这里复刻主要创建交互与数据规则，不宣称与整个上游项目功能完全等价。当前自动标签未实现上游的完整规则语言及适配订阅；预览图在保存后缓存，表单展示图片网址。正文使用 Readability 提取；快照为清理后的 HTML，不包含上游 SingleFile 对完整页面资源的离线打包。没有依赖外部网页代理。

## 可见性与数据

- 单管理员。匿名访客仅能读取公开且未进回收站的书签；公开的归档书签仍可被访客阅读。
- 匿名搜索、标签、数量、热力图仅计算公开数据。个人 notes 和高亮批注不向访客返回。
- 正文、图片、快照每次访问均重新校验可见性。撤回公开立即阻止访问；API 不缓存私密数据。
- HttpOnly、SameSite=Strict 会话；HTTPS 环境使用 Secure。写操作检查来源和 CSRF。登录按连接来源限流。反向代理连接共用来源限流，不信任用户传入的转发头。
- 网址抓取拒绝本机、私网、保留 IP、非标准端口及带凭据网址；DNS 结果固定到连接，重定向重新检查；限制时间和大小。抓取不执行远程脚本。正文清理危险 HTML。

数据默认存于 `.data/bookmarks/`，不会提交 Git：

```text
bookmarks.sqlite        书签、标签、用户、会话、筛选、批注、持久任务
bookmarks.sqlite-wal    SQLite 运行时 WAL
bookmarks.sqlite-shm    SQLite 运行时共享内存
assets/                正文、快照与图片
```

生产数据固定放在 `/var/lib/zanuain-bookmarks`，与代码发布目录隔离。HTML 导出便于迁移网址与标签，不能替代完整备份；批注、正文、密码、设置需备份整个数据目录。做文件级备份前停止服务，完整复制目录后重启；恢复同样在服务停止时执行。

## 生产部署

1. 安装受支持的 Node.js，在服务器建立 `zanuain` 服务用户。
2. 应用代码放 `/opt/zanuain-bookmarks`；该目录由部署用户更新、服务用户读取。数据目录 `/var/lib/zanuain-bookmarks` 由 `zanuain` 独占写入，权限 700。
3. 将 `deploy/bookmarks.env.example` 配置为 `/etc/zanuain-bookmarks.env`，设置真实 HTTPS 域名。由系统管理员保护该文件。
4. 安装 `deploy/bookmarks.service` 到 `/etc/systemd/system/bookmarks.service`。根据实际 Node 路径修改 `ExecStart`（示例 `/usr/bin/node`）。
5. 在应用目录执行 `npm ci --omit=dev`。以服务用户、相同环境配置运行管理员初始化命令。例如：

```sh
sudo -u zanuain BOOKMARKS_DATA_DIR=/var/lib/zanuain-bookmarks \
  /usr/bin/node --experimental-strip-types scripts/bookmarks-admin.ts --username admin
sudo systemctl daemon-reload
sudo systemctl enable --now bookmarks.service
```

6. 将 `deploy/nginx.conf` 的 API location 合并进现有 HTTPS 站点；API 端口只监听本机。证书与域名由现有服务器配置提供。
7. 在已有部署变量基础上设置 `BOOKMARKS_DEPLOY_ENABLED=true`。GitHub Actions 上传服务代码、安装生产依赖并重启。部署用户需要对代码目录的写权限，以及仅针对 `bookmarks.service` 的必要免密码 sudo 权限。工作流不会改写数据目录或环境文件。

可用 `GET /api/bookmarks/health` 检查服务。API 故障时笔记静态页面继续可用，书签页显示可重试提示。整个网站部署并未在本地实施任务中自动执行。

## 验证

```sh
npm run test:bookmarks
npm run check
npx tsc --noEmit
npm run build
```

接口测试使用临时 SQLite，覆盖鉴权、CSRF、公开过滤、统计隔离、重复恢复、资源权限、标签合并、导入导出及 HTML 清理。`tests/bookmarks-browser-server.ts` 仅用于人工／浏览器验收，在临时目录生成明确标注的测试数据，不使用真实书签库。
