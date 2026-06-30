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

## 镜像构建

前端镜像采用多阶段构建：

1. `node:22-alpine` 执行 `npm ci` 和 `npm run build`。
2. `nginx:alpine` 只复制 `dist/` 和 Nginx 配置。

`npm run build` 会先构建 `index.html`，再由 `tools/generate-legacy-pages.mjs` 生成旧 URL 兼容 HTML。

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

通用说明见 [docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)。公开文档不应包含真实服务器 IP、个人用户名或本机路径。
