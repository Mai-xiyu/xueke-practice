# GitHub 与 Docker Hub 自动发布

## GitHub Actions 需要的配置

在 GitHub 仓库中进入：

`Settings -> Secrets and variables -> Actions`

新增：

- Repository variable: `DOCKERHUB_USERNAME`
- Repository secret: `DOCKERHUB_TOKEN`
- Repository variable 可选: `DOCKERHUB_IMAGE`

如果不设置 `DOCKERHUB_IMAGE`，默认镜像名为：

```text
<DOCKERHUB_USERNAME>/xueke-practice
```

## 触发规则

`.github/workflows/docker-hub.yml` 会在以下情况运行：

- push 到 `main`
- 创建 `v*.*.*` tag
- 手动 `workflow_dispatch`
- pull request 只构建校验，不推送

## 部署更新

服务器上拉取新镜像：

```bash
docker pull <dockerhub-namespace>/xueke-practice:latest
docker compose up -d
```

如果用本仓库的 `docker-compose.yml`，可以把 `web.image` 改成 Docker Hub 镜像名。
