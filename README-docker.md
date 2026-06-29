# Docker 部署说明

前端镜像采用两阶段构建：

1. `node:22-alpine` 执行 `npm ci` 和 `npm run build`。
2. `nginx:alpine` 只复制 `dist` 和 Nginx 配置。

## 本地构建运行

```powershell
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:8088/
```

停止：

```powershell
docker compose down
```

## 服务

```text
web          Nginx 静态站点，暴露 8088 -> 80
session-api  Node JSON session API，容器内 3000
```

`session-api` 的数据目录：

```text
./session-data:/data
```

升级镜像或重建容器时不要删除 `session-data/`。

## GitHub Actions

- `github-pages.yml`：`npm ci -> npm run check -> npm run build -> upload dist`
- `docker-hub.yml`：校验并发布 Docker Hub 镜像
- `package-images.yml`：构建 Docker tar 包
- `deploy-lan.yml`：self-hosted runner 在局域网 Windows 服务器拉取并重启容器

Docker Hub 变量：

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
DOCKERHUB_IMAGE 可选
```

## 局域网部署

已验证服务器：

```text
LAN IP: <LAN_SERVER_IP>
端口: 8088
目录: C:\xueke-practice
```

详见：

```text
docs/lan-windows-deploy.md
```
