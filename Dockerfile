# syntax=docker/dockerfile:1

# 两个运行目标共用同一次构建：
#   web  静态站点（Astro 构建产物 + Nginx）
#   api  书签服务（Node.js，读写持久化 SQLite 数据）
#
#   docker build --target web -t zanuain-blog-web .
#   docker build --target api -t zanuain-blog-api .
#
# 日常使用 `docker compose up -d --build`，见 docs/docker.md。

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV npm_config_fund=false \
    npm_config_audit=false \
    npm_config_update_notifier=false \
    ASTRO_TELEMETRY_DISABLED=1

# 安装全部依赖（含 devDependencies），供 Astro 构建使用。
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# 构建静态站点。SITE_URL 与 CONTENT_REPOSITORY 是构建期变量，运行时修改需要重新构建。
FROM base AS build
ARG SITE_URL=https://notes.example.com
ARG CONTENT_REPOSITORY=
ENV SITE_URL=${SITE_URL} \
    CONTENT_REPOSITORY=${CONTENT_REPOSITORY}
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && test -f dist/index.html

# 书签服务只需要生产依赖，控制镜像体积。
FROM base AS api-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

FROM node:${NODE_VERSION} AS api
WORKDIR /app
ENV NODE_ENV=production \
    BOOKMARKS_HOST=0.0.0.0 \
    BOOKMARKS_PORT=4322 \
    BOOKMARKS_DATA_DIR=/data

COPY --from=api-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node scripts ./scripts

# 数据目录使用命名卷持久化；首次挂载时 Docker 会继承这里的属主（node:node）。
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]

USER node
EXPOSE 4322

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.BOOKMARKS_PORT||4322)+'/api/bookmarks/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "server/bookmarks/index.ts"]

# 默认目标：静态站点。Nginx 官方镜像启动时用 envsubst 渲染 /etc/nginx/templates/*.template。
FROM nginx:alpine AS web
COPY deploy/nginx.docker.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# 书签 API 的容器地址；单独 docker run 时可用 --add-host 或改成实际地址。
ENV BOOKMARKS_UPSTREAM=api:4322

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
