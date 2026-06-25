# 局域网 Windows Docker 服务器部署

推荐方案是 GitHub Actions self-hosted runner。Windows 服务器主动连接 GitHub 拉取任务，不需要把局域网服务器暴露到公网。

## 前提

- Windows 服务器已安装 Docker Desktop，并且在 PowerShell 中可以执行 `docker version` 和 `docker compose version`。
- Docker Desktop 正在运行。
- GitHub 仓库已经有 `DOCKERHUB_USERNAME` 和 `DOCKERHUB_TOKEN`。
- Docker Hub 中已经有 `xueke-practice:latest` 和 `xueke-practice:session-api-latest` 两类镜像标签。

## 安装 self-hosted runner

在 GitHub 仓库页面进入：

`Settings -> Actions -> Runners -> New self-hosted runner -> Windows`

按页面给出的命令下载 runner。配置时建议：

- runner 目录：`C:\actions-runner`
- runner 名称：`xueke-lan-server`
- 额外标签：`xueke-lan`

如果 Docker Desktop 只能在当前登录用户会话中访问，优先先用交互式 `run.cmd` 测试。确认 `docker version` 能执行后，再考虑按 Windows service 运行。

## 手动触发部署

进入 GitHub 仓库：

`Actions -> Deploy to LAN Windows server -> Run workflow`

默认参数：

- `web_port`: `8088`
- `deploy_dir`: `C:\xueke-practice`
- `session_data_dir`: `C:\xueke-practice\session-data`

部署使用的 Compose 模板在 `deploy/docker-compose.lan.yml`，环境变量示例在 `deploy/env.example`。

部署后局域网访问：

`http://服务器IP:8088/`

## 服务器本地手动部署

如果暂时不装 runner，也可以把仓库复制到服务器后执行：

```powershell
cd deploy
.\windows-redeploy.ps1 -DockerHubImage "你的DockerHub用户名/xueke-practice"
```

该脚本会复制 `docker-compose.lan.yml` 到 `C:\xueke-practice`，拉取最新镜像并重启容器。

## 安全边界

- 不要把 Docker API、Windows 远程桌面或 PowerShell Remoting 暴露到公网。
- self-hosted runner 只给这个仓库使用，标签固定为 `xueke-lan`。
- 不要在 fork 或不可信 PR 上运行部署 workflow。
- 会话 JSON 持久化在 `C:\xueke-practice\session-data`，不要随容器删除。
