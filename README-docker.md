# 学科练习系统

面向校园局域网部署的静态题库练习系统，包含：

- 路由交换
- 网络安全
- 数据采集
- 数据结构

页面进度默认保存到浏览器 `localStorage`。Docker Compose 部署时，会通过后端 API 按访问 IP 持久化会话 JSON。

## 本地运行

```powershell
cd <repo-path>
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:8088/
```

## 镜像

本地构建会生成：

```text
xueke-practice-web:local
xueke-practice-session-api:local
```

## 会话持久化

浏览器通过 `/api/session` 同步各页面的 `localStorage`。Nginx 传递客户端 IP，后端按 IP 写入：

```text
session-data/<client-ip>.json
```

直接双击 HTML 使用 `file://` 打开时，同步后端不可用，页面会自动退回纯本地 `localStorage`。

## 新增科目

1. 复制 `templates/subject_practice_template.html` 为新的 `*_practice.html`。
2. 写入题库数组。
3. 在 `subjects.json` 增加入口。
4. 运行校验：

   ```powershell
   npm run validate
   ```

可以把 `prompts/add-subject-prompt.md` 连同试卷文件发给 AI，让 AI 按本项目格式生成新科目页面和 `subjects.json` 修改。

## GitHub Actions 发布到 Docker Hub

仓库需要配置：

- Repository variable: `DOCKERHUB_USERNAME`
- Repository secret: `DOCKERHUB_TOKEN`
- Repository variable 可选: `DOCKERHUB_IMAGE`

未设置 `DOCKERHUB_IMAGE` 时，默认推送：

```text
<DOCKERHUB_USERNAME>/xueke-practice
```

工作流文件：

```text
.github/workflows/docker-hub.yml
```

推送到 `main` 或创建 `v*.*.*` tag 后会自动构建并上传 Docker Hub。

默认会推送两个运行镜像：

```text
<DOCKERHUB_USERNAME>/xueke-practice:latest
<DOCKERHUB_USERNAME>/xueke-practice:session-api-latest
```

## 局域网 Windows 服务器部署

推荐在局域网 Windows Docker 主机上安装 GitHub Actions self-hosted runner，并给 runner 增加 `xueke-lan` 标签。之后可以在 GitHub 页面手动触发：

```text
Actions -> Deploy to LAN Windows server -> Run workflow
```

部署工作流文件：

```text
.github/workflows/deploy-lan.yml
```

详细步骤见：

```text
docs/lan-windows-deploy.md
```

## 停止

```powershell
docker compose down
```
