# 学科练习系统

面向校园局域网的多科目练习系统。前端使用 Vite + React + TypeScript，所有科目共用同一套学习、模拟考试、错题本、收藏、题库浏览和进度同步逻辑。

## 当前科目

- 计算机科学技术学院：路由交换、网络安全、数据采集、数据可视化、数据结构、Linux课程
- 马克思主义学院：中国近代史、中华民族共同体
- 数学科学学院：高等数学(下)

## 快速开始

```powershell
npm ci
npm run dev
```

构建和校验：

```powershell
npm run check
npm run e2e
```

Docker 本地运行：

```powershell
docker compose up -d --build
```

访问：

```text
http://127.0.0.1:8088/
```

## 项目结构

```text
src/                         React/TypeScript 统一运行时
src/lib/questions.ts          题型、判分、搜索、模拟考试抽题
src/lib/progress.ts           进度保存、旧 localStorage 迁移、后端同步
src/styles/app.css            统一 UI 样式
public/subjects.json          科目注册表
public/data/*.json            canonical 题库
public/assets/**              图片等静态资产
backend/server.js             session JSON 后端
docker/nginx.conf             Nginx 静态站点和 /api 反代
tools/validate-site.mjs       题库和入口校验
tools/migrate-question-banks.mjs 旧题库迁移脚本
docs/architecture.md          架构说明
docs/question-schema.md       题库 schema
docs/ui-guidelines.md         UI 规范
CONTRIBUTING.md               PR 贡献指南
```

旧入口文件仍保留，例如：

```text
network_practice.html
modern_history_practice.html
data_visualization_practice.html
```

这些 HTML 只是 Vite 多页面 shell，真实 UI 由 `src/main.tsx` 挂载。

## 新增科目

1. 在 `public/data/<subject_id>.json` 新建题库。
2. 在 `public/subjects.json` 增加科目配置。
3. 如果需要保留旧式 URL，新建一个轻量 HTML shell，写入 `data-subject-id="<subject_id>"`。
4. 运行：

   ```powershell
   npm run validate
   npm run check
   ```

详细规则见：

- [docs/add-subject.md](docs/add-subject.md)
- [docs/question-schema.md](docs/question-schema.md)
- [prompts/add-subject-prompt.md](prompts/add-subject-prompt.md)

## 题库规则

- 题库只放在 `public/data/*.json`。
- 题型只允许：`single | multiple | judge | fill | short | essay | code | comprehensive`。
- 题目 ID 必须稳定，不能因重构、排序或去重改变。
- 不确定答案不得伪造成确定答案。
- 判断题由选择题改写时，必须在 `analysis` 中保留来源线索。
- 提交前必须运行 `npm run validate`。

## 进度保存

新版本使用：

```text
studyhub:v2:<subjectId>
```

首次打开会自动迁移旧 key，例如 `network-practice-v1`、`linux_practice_state_v1`、`modern_history_practice_state_v2`。旧 key 不删除，方便回滚。

Docker/Nginx 模式下会同步到：

```text
/api/session
```

GitHub Pages 模式不请求后端，只使用浏览器 localStorage。

## 部署

GitHub Actions：

```text
.github/workflows/github-pages.yml       构建 dist 并部署 Pages
.github/workflows/docker-hub.yml         校验、构建并发布 Docker Hub 镜像
.github/workflows/deploy-lan.yml         self-hosted runner 部署到局域网 Windows
.github/workflows/package-images.yml     构建 Docker tar 包
```

局域网 Windows 服务端：

```text
LAN IP: <LAN_SERVER_IP>
访问端口: 8088
部署目录: C:\xueke-practice
```

详见 [docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)。

## 给维护者

修改前先读：

1. [docs/architecture.md](docs/architecture.md)
2. [docs/question-schema.md](docs/question-schema.md)
3. [docs/ui-guidelines.md](docs/ui-guidelines.md)
4. [CONTRIBUTING.md](CONTRIBUTING.md)

PR 前至少运行：

```powershell
npm run check
```

涉及页面交互：

```powershell
npm run e2e
```

涉及 Docker、Nginx、后端或 workflow：

```powershell
docker compose up -d --build
```

## 安全边界

- 本项目只计划在校园/局域网公开。
- 不要暴露 Docker API、RDP、WinRM 到公网。
- 不可信 PR 不应触发 LAN 部署。
- `session-data/` 是用户进度数据，升级容器时必须保留。
