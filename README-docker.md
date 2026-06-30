# Docker 部署说明

本项目提供两个容器：

- `web`：Nginx 静态站点，服务 Vite 构建产物，并把 `/api/` 反代到后端。
- `session-api`：Node.js JSON session API，用于在 Docker/Nginx 部署中保存学习进度快照。

GitHub Pages 等纯静态部署不需要 `session-api`。

## 本地构建运行

```powershell
docker compose up -d --build
```

默认访问：

```text
http://127.0.0.1:8088/
```

停止：

```powershell
docker compose down
```

查看状态：

```powershell
docker compose ps
```

## 数据持久化

`session-api` 默认把 JSON 数据写入：

```text
./session-data:/data
```

升级镜像或重建容器时不要删除 `session-data/`。该目录包含用户学习进度，不应提交到 Git。

前端会在浏览器 cookie 和 localStorage 中保存 `study_hub_client_id`。后端优先使用该 client id 保存 session，因此客户端切换 IP 后仍能续用同一份进度。

## 开发者仪表盘

Docker/Nginx 部署提供：

```text
http://127.0.0.1:8088/dev.html
http://127.0.0.1:8088/api/dev-dashboard
```

仪表盘展示：

- 最近在线设备，按最近 `/api/session` 请求估算。
- 有历史 session 的设备。
- 当前 IP 和历史 IP。
- 每个设备保存过的应用快照数量、进度 key 数量和最近路径。

`/dev.html` 由后端直接提供，不属于主 React 前端。默认不展示完整 localStorage 内容，只展示汇总数量，避免把答题数据直接暴露在页面上。

在 Docker Desktop for Windows 通过端口映射对外提供服务时，容器内经常只能看到 Docker 网桥地址，例如 `172.19.0.1`。仪表盘会把这种地址标记为 `Docker NAT（真实 IP 不可见）`，设备识别以 cookie client id 为准。若必须记录真实客户端 IP，需要在 Windows 宿主机上放一个宿主机级反向代理，由它把真实来源写入 `X-Forwarded-For` 后再转发到 Docker。

开发者密码由后端环境变量控制：

```text
DEV_DASHBOARD_PASSWORD=change-this-password
```

默认值是 `123456`。面向多人网络部署时应显式设置为自定义密码。

## 镜像构建

前端镜像采用多阶段构建：

1. `node:22-alpine` 执行 `npm ci` 和 `npm run build`。
2. `nginx:alpine` 只复制 `dist/` 和 Nginx 配置。

`npm run build` 会先构建 `index.html`，再由 `tools/generate-legacy-pages.mjs` 生成旧 URL 兼容 HTML。`/dev.html` 由后端在运行时提供。

## Docker Hub 发布

GitHub Actions workflow：

```text
.github/workflows/docker-hub.yml
```

需要配置：

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
DOCKERHUB_IMAGE   可选，默认 <DOCKERHUB_USERNAME>/xueke-practice
```

发布标签：

```text
latest
session-api-latest
sha-<commit>
session-api-sha-<commit>
```

Pull request 只构建校验，不推送镜像；`main` 分支和 tag 才推送。

## 局域网部署

推荐使用 self-hosted runner 手动触发：

```text
Actions -> Deploy to LAN Windows server -> Run workflow
```

需要填写：

```text
web_port          对外 HTTP 端口，例如 8088
deploy_dir        Windows Docker 主机上的部署目录
session_data_dir  持久化 session JSON 的目录
```

可选环境变量：

```text
DEV_DASHBOARD_PASSWORD   开发者仪表盘登录密码，默认 123456
```

通用说明见 [docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)。公开文档不应包含真实服务器 IP、个人用户名或本机路径。
