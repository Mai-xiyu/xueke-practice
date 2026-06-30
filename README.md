# 学科练习系统

一个面向多科目题库的练习系统。项目使用 Vite + React + TypeScript 构建，题库以 JSON 形式维护，所有科目共用同一套学习、模拟考试、错题本、收藏、待复习、题库浏览和进度保存逻辑。

项目可以作为纯静态站点部署到 GitHub Pages，也可以通过 Docker/Nginx 部署，并可选启用 JSON session 后端保存局域网用户进度。

## 功能概览

- 多学院、多科目入口。
- 统一刷题页、题库浏览、模拟考试、错题本、收藏和待复习。
- 右侧答题卡按题型和当前题集动态渲染，适配大题库。
- 进度按 `subjectId + questionId` 保存，避免筛选、乱序和跨科目时串题。
- 支持主动回忆提示和简单间隔复习调度。
- 题库、科目注册、模拟考试规则均从 JSON 配置读取。
- 保留旧入口 URL，例如 `network_practice.html`，但这些 HTML 在构建产物中生成，不作为源码文件维护。

## 当前科目

科目列表由 [public/subjects.json](public/subjects.json) 动态注册。当前仓库包含：

- 计算机科学技术学院：路由交换、网络安全、数据采集、数据可视化、数据结构、Linux 课程
- 马克思主义学院：中国近代史、中华民族共同体
- 数学科学学院：高等数学(下)

## 快速开始

```powershell
npm ci
npm run dev
```

本地开发地址默认由 Vite 输出。Docker 本地运行：

```powershell
docker compose up -d --build
```

默认访问：

```text
http://127.0.0.1:8088/
```

常用校验：

```powershell
npm run validate
npm run typecheck
npm run test
npm run build
npm run check
```

涉及页面交互时运行：

```powershell
npm run e2e
```

## 项目结构

```text
src/                            React/TypeScript 统一运行时
src/pages/                      首页和科目练习页
src/components/                 共享 UI 组件
src/lib/questions.ts            题型、判分、搜索、模拟考试抽题
src/lib/progress.ts             进度保存、旧状态迁移、间隔复习、后端同步
src/styles/app.css              统一视觉样式

public/subjects.json            科目注册表
public/data/*.json              canonical 题库
public/assets/**                图片等静态资源

backend/server.js               可选 JSON session 后端
docker/nginx.conf               Nginx 静态站点和 /api 反代
deploy/                         局域网 Docker 部署模板
tools/validate-site.mjs         题库、科目和入口校验
tools/generate-legacy-pages.mjs 构建后生成旧 URL 兼容 HTML

docs/                           架构、题库、UI、部署和新增科目文档
prompts/                        给 AI coding agent 的维护提示词
```

源码根目录只保留 `index.html`。科目入口如 `linux_practice.html`、`modern_history_practice.html` 由 `npm run build` 后在 `dist/` 中自动生成。不要把科目题目或独立渲染逻辑写回 HTML。

## 题库规范

题库文件位于 `public/data/*.json`，顶层必须是数组。统一题型：

```text
single | multiple | judge | fill | short | essay | code | comprehensive
```

核心字段：

```ts
{
  id: string;
  source: string;
  chapter: string;
  type: QuestionType;
  stem: string;
  options?: Record<string, string>;
  correct?: string[];
  answers?: string[];
  answer?: string;
  analysis?: string;
  tags: string[];
  image?: string | null;
  meta?: Record<string, unknown>;
}
```

基本规则：

- 题目 ID 必须稳定，不能因为排序、去重或重构改变。
- 选择题和判断题使用 `correct` 数组。
- 填空题使用 `answers`。
- 简答、论述、代码、综合应用题使用 `answer`。
- 不确定答案不能伪造成确定答案，必须在 `analysis` 中标注不确定来源。
- 判断题由选择题改写时，必须在 `analysis` 中保留原题线索。
- 题库来源、章节、标签尽量结构化，便于筛选和复习。

详细说明见 [docs/question-schema.md](docs/question-schema.md)。

## 新增科目

新增科目不需要复制 HTML 页面，只需要题库和科目注册：

1. 新增 `public/data/<subject_id>.json`。
2. 在 `public/subjects.json` 中注册科目和所属学院。
3. 为科目配置唯一 `href`，例如 `new_subject_practice.html`。
4. 如有正式模拟考试规则，在 `mockExam.sections` 中配置抽题规则。
5. 运行 `npm run validate` 和 `npm run check`。

完整流程见 [docs/add-subject.md](docs/add-subject.md)。

## 给 AI Coding Agent

本仓库接受 AI 辅助维护，但 AI 必须按工程边界提交修改，而不是把题库、页面和临时产物混在一起。

AI 修改前必须阅读：

1. [docs/ai-contributor-guide.md](docs/ai-contributor-guide.md)
2. [docs/add-subject.md](docs/add-subject.md)
3. [docs/question-schema.md](docs/question-schema.md)
4. [docs/architecture.md](docs/architecture.md)
5. [CONTRIBUTING.md](CONTRIBUTING.md)

新增科目时，AI 应遵循以下约束：

- 只修改 `public/subjects.json`、`public/data/*.json`、必要静态资源和必要文档。
- 不新增根目录 `*_practice.html`，旧 URL 由构建脚本生成。
- 不把 OCR 中间文件、截图裁剪文件、原始聊天文件、Docker tar、`dist/`、`node_modules/` 提交到仓库。
- 不引入外部 CDN 或与当前技术栈无关的大型框架。
- 不硬编码题量，题量必须从 JSON 动态计算。
- 不用“AI 生成”“衍生题”这类不可追溯来源作为最终来源字段。
- 题目去重时保留最稳定的旧 ID；新增题使用可读、可追溯、稳定的 ID。
- 对没有答案或解析的题目，不得编造确定答案；应标注 `analysis` 或暂缓导入。
- PR 必须说明影响科目、题量变化、来源材料、去重策略和校验结果。

可直接使用 [prompts/add-subject-prompt.md](prompts/add-subject-prompt.md) 作为 AI 新增科目的提示词。

## 进度保存

浏览器本地进度 key：

```text
studyhub:v2:<subjectId>
```

Docker/Nginx 模式下，前端会尝试同步到：

```text
/api/session
```

GitHub Pages 等纯静态部署没有后端，自动退化为只使用浏览器 localStorage。

进度数据包括：

- 作答次数、答错次数、答对次数、连续答对次数。
- 最近作答时间、下次复习时间。
- 收藏、错题、待复习状态。
- 可选主动回忆提示 `memoryHint`。

## 部署

GitHub Actions：

```text
.github/workflows/github-pages.yml   构建并发布 GitHub Pages
.github/workflows/docker-hub.yml     构建并发布 Docker 镜像
.github/workflows/deploy-lan.yml     手动触发 self-hosted runner 局域网部署
.github/workflows/package-images.yml 构建 Docker tar 包
```

Docker 部署见 [README-docker.md](README-docker.md)。

局域网 Windows Docker 部署见 [docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)。文档只提供通用模板，不包含个人服务器地址或本地路径。

## 工作区边界

仓库只保留源码、题库 JSON、静态资产、部署配置和文档。以下内容不得提交：

- `node_modules/`
- `dist/`
- `session-data/`
- `.artifacts/`
- OCR 缓存、爬虫临时文件、截图裁剪文件、Docker tar 包
- 根目录科目 HTML shell，例如 `network_practice.html`

历史采集材料如需保留，应放在仓库外部归档。

## 安全边界

- 不提交账号、密码、API key、私有 IP、真实部署路径或个人机器信息。
- 不暴露 Docker API、RDP、WinRM 或内网服务到公网。
- 不可信 PR 不应触发带有部署权限的 workflow。
- `session-data/` 是用户进度数据，升级容器时必须保留并避免提交。
