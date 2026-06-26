# 学科练习系统

面向校园局域网的题库练习系统。当前仓库包含四个科目入口、统一前端样式、按浏览器 client id 持久化进度的后端、Docker/Nginx 部署配置，以及 GitHub Actions 自动打包流程。

当前科目：

- 路由交换
- 网络安全
- 数据采集
- 数据结构

当前局域网访问地址：

```text
http://<LAN_SERVER_IP>:8088/
```

当前 Windows 服务器部署目录：

```text
C:\xueke-practice
```

不要把 SSH 密码、Docker Hub token、GitHub token 或其他凭据写进仓库。

## 快速使用

本地 Docker 运行：

```powershell
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:8088/
```

校验题库和入口：

```powershell
npm run validate
```

停止：

```powershell
docker compose down
```

## 文件地图

```text
index.html                                  总入口，读取 subjects.json
subjects.json                               科目注册表
*_practice.html                             各科目题库页面
assets/common.css                           统一样式
assets/session-sync.js                      顶部导航和进度同步
backend/server.js                           会话 JSON 后端
docker/nginx.conf                           Nginx 静态站点和 /api 反代
docker-compose.yml                          本地构建运行
Dockerfile                                  前端 Nginx 镜像
backend/Dockerfile                          会话 API 镜像
templates/subject_practice_template.html    新科目模板
tools/validate-site.js                      题库/入口校验脚本
prompts/add-subject-prompt.md               给 AI 新增科目的提示词
docs/add-subject.md                         新增科目说明
docs/lan-windows-deploy.md                  局域网 Windows 服务器部署说明
README-docker.md                            Docker 部署补充说明
```

## 新增科目

优先按这个流程：

1. 复制 `templates/subject_practice_template.html` 为新的 `*_practice.html`。
2. 写入题库数组，设置页面标题、`SUBJECT_TITLE` 和 `STORAGE_KEY`。
3. 在 `subjects.json` 增加一条科目配置。
4. 运行：

   ```powershell
   npm run validate
   ```

详细说明见 [docs/add-subject.md](docs/add-subject.md)。

如果让 AI 处理，把 [prompts/add-subject-prompt.md](prompts/add-subject-prompt.md) 和试卷图片、docx、pdf 或老师资料一起发给 AI。

题库约束：

- 不使用 `衍生题` 作为来源。
- 判断题可以从选择题改写生成。
- 简答题必须有参考答案。
- 来源字段应写真实来源，例如 `A卷真题`、`课堂简答题`、`实验题`。

## 进度保存

浏览器端先保存到 `localStorage`。通过 Docker/Nginx 运行时，页面还会同步到后端：

```text
/api/session
```

后端持久化目录：

```text
session-data/
```

Windows Docker Desktop 下，后端看到的 IP 可能是 Docker 网关地址，不一定是真实学生 IP。因此当前实现优先使用浏览器生成的 `study_hub_client_id` 区分用户，IP 只是兜底。

## GitHub Actions

当前 workflow：

```text
.github/workflows/docker-hub.yml       构建并发布 Docker Hub 镜像
.github/workflows/deploy-lan.yml       通过 self-hosted runner 部署到局域网 Windows 服务器
.github/workflows/package-images.yml   云端构建 Docker tar 包，供离线/受限网络部署
```

Docker Hub 发布需要仓库配置：

```text
DOCKERHUB_USERNAME
DOCKERHUB_TOKEN
```

可选：

```text
DOCKERHUB_IMAGE
```

默认发布镜像：

```text
<DOCKERHUB_USERNAME>/xueke-practice:latest
<DOCKERHUB_USERNAME>/xueke-practice:session-api-latest
```

## 局域网 Windows 服务器部署

推荐长期方案：

1. 在 Windows Docker 服务器安装 GitHub Actions self-hosted runner。
2. 给 runner 加标签 `xueke-lan`。
3. 在 GitHub 页面手动触发：

   ```text
   Actions -> Deploy to LAN Windows server -> Run workflow
   ```

详见 [docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)。

已验证的服务器信息：

```text
LAN IP: <LAN_SERVER_IP>
访问端口: 8088
部署目录: C:\xueke-practice
```

注意：Windows Docker Desktop 在普通 SSH 非交互会话里可能会触发凭据助手错误：

```text
error getting credentials
A specified logon session does not exist.
```

如果遇到这个问题，用以下任一方式：

- 通过交互式登录会话/计划任务执行部署脚本。
- 使用 `Package Docker image tarballs` workflow 云端构建 tar 包，再上传到服务器执行 `docker load`。
- 使用真正的 self-hosted runner，并确认 runner 运行用户能访问 Docker Desktop。

## 给 AI 维护者

修改仓库前先读：

1. 本文件。
2. [docs/add-subject.md](docs/add-subject.md)。
3. [prompts/add-subject-prompt.md](prompts/add-subject-prompt.md)。
4. [tools/validate-site.js](tools/validate-site.js)。

维护规则：

- 新增科目只改 `subjects.json` 和新的 `*_practice.html`，除非确实需要共享能力。
- 统一 UI 放在 `assets/common.css`，不要在单个页面里做风格分叉。
- 共享进度逻辑放在 `assets/session-sync.js`，后端接口放在 `backend/server.js`。
- 不要提交 `session-data/`、`.artifacts/`、`.env*`、token、密码或临时产物。
- 不要删除已有题库、错题/收藏/模拟考试功能，除非用户明确要求。
- 遇到试卷图片或 docx，先结构化题目，再写入题库；不确定答案要标注，不要编造。
- 判断题从选择题改写时，在说明里保留来源线索。

提交前至少运行：

```powershell
npm run validate
node --check backend/server.js
node --check assets/session-sync.js
```

如果改了 Docker、Nginx、后端或部署 workflow，还要至少验证一种部署路径：

- 本地 `docker compose up -d --build`
- GitHub Actions `Package Docker image tarballs`
- GitHub Actions `Build and publish Docker image`

## 安全边界

- 本项目只计划在校园/局域网公开。
- 不要暴露 Docker API、RDP、WinRM 到公网。
- 不可信 PR 不应触发 LAN 部署。
- `session-data/` 是用户进度数据，升级容器时必须保留。

## 参考文档

- [GitHub README 文档](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)
- [GitHub Markdown 相对链接](https://docs.github.com/github/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)
- [GitHub self-hosted runner 标签](https://docs.github.com/actions/using-jobs/choosing-the-runner-for-a-job)
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/)
- [Docker Compose pull](https://docs.docker.com/reference/cli/docker/compose/pull/)
