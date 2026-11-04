# Docker 部署

项目包含 Astro 静态站点和 Node.js 书签 API。根目录 Dockerfile 提供 `web`（默认，Nginx）和 `api` 两个目标，docker-compose.yml 将它们组合部署。需要 Docker Engine 和 Docker Compose v2，构建使用 BuildKit。

## 正式部署

在项目根目录执行：

```sh
# 如果已有 .env，请合并配置，不要覆盖现有内容。
cp -n deploy/docker.env.example .env
```

编辑 `.env`，将以下地址替换为实际域名：

```dotenv
SITE_URL=https://notes.example.com
BOOKMARKS_ORIGINS=https://notes.example.com
WEB_PORT=8080
# CONTENT_REPOSITORY=your-name/zanuain-blog
```

```sh
docker compose up -d --build
docker compose exec api node --experimental-strip-types scripts/bookmarks-admin.ts --username admin
```

管理员初始化会隐藏密码输入；留空会生成随机密码并仅显示一次。已有管理员需追加 `--reset` 才能重设密码，旧会话随之失效。

配置宿主机 Nginx、Caddy 或其他 HTTPS 入口，将正式域名的全部请求转发到服务器的 HTTP 8080 端口。随后访问正式域名，进入 `/bookmarks/` 登录。Compose 默认将 8080 发布到所有网卡；若 HTTPS 入口就在宿主机，可设 `WEB_PORT=127.0.0.1:8080`，只绑定回环地址。

### HTTPS 要求

API 在 `NODE_ENV=production` 下要求 `BOOKMARKS_ORIGINS` 全部使用 HTTPS，否则拒绝启动。此配置需与浏览器访问来源完全一致（协议、域名、端口，无末尾斜杠）；多个来源用逗号分隔。生产会话 Cookie 包含 Secure，因此应通过 HTTPS 登录。

Nginx 容器内部监听 HTTP 80，证书由前置 HTTPS 入口管理。API 4322 端口仅在容器网络内开放。

## 本地 HTTP 试运行

仅用于本地验证，可用以下环境变量覆盖生产默认值：

```sh
NODE_ENV=development \
SITE_URL=http://localhost:8080 \
BOOKMARKS_ORIGINS=http://localhost:8080 \
WEB_PORT=127.0.0.1:8080 \
docker compose up -d --build

docker compose exec api node --experimental-strip-types scripts/bookmarks-admin.ts --username admin
```

使用 `http://localhost:8080` 访问，来源配置不包含 `http://127.0.0.1:8080` 时不要混用这两个地址。本地覆盖不会自动保存，后续重新创建容器时需传入相同变量，或将其写入本地 `.env`。

## 更新与检查

```sh
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 web api
curl -f http://localhost:8080/api/bookmarks/health
```

`SITE_URL` 和 `CONTENT_REPOSITORY` 是构建期参数，修改后必须重新构建。源码、笔记和样式更新也需重新构建。构建上下文排除本地依赖、缓存、Git、环境文件及 `.data`，不会把本地书签数据库打入镜像。

## 数据持久化与备份

API 以非 root 的 `node` 用户运行，SQLite、正文、快照和图片写入 `/data`，由 Compose 命名卷 `zanuain-blog_bookmarks-data` 保存。首次部署创建的是空数据库；本机 `.data/bookmarks` 中的内容不会自动迁入容器。

普通 `docker compose down` 保留数据卷，重建镜像也不影响数据。**不要执行 `docker compose down -v`，除非明确要删除全部书签数据。**

文件级备份应先停止服务，复制完整目录，再重启：

```sh
mkdir -p backups
backup_dir="backups/bookmarks-$(date +%Y%m%d-%H%M%S)"
mkdir "$backup_dir"
docker compose stop api
docker compose cp api:/data/. "$backup_dir/"
docker compose start api
```

备份包含管理员密码哈希和会话，应妥善保存。恢复需停止 API，将完整备份还原至数据卷，并确保属主为容器内 `node` 用户（UID/GID 1000），再启动服务。

## 单独构建镜像

```sh
docker build --target web --build-arg SITE_URL=https://notes.example.com -t zanuain-blog-web .
docker build --target api -t zanuain-blog-api .
```

只需静态笔记时，可单独运行 web：

```sh
docker run -d --name zanuain-blog-web -p 8080:80 zanuain-blog-web
```

此模式可以浏览静态页面，但书签 API 不可用；启用完整书签功能请使用 Compose。镜像没有自动发布到仓库，以上命令在部署机器本地构建。
