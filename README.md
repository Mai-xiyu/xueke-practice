# 学科练习系统

面向多科目题库的练习系统。前端使用 Vite + React + TypeScript，题库使用 JSON 维护，支持学习模式、模拟考试、题库浏览、错题本、收藏、待复习、进度保存、Markdown 公式渲染和 Docker/Nginx 部署。

正式站点只读取 `public/data/*.json`。Markdown 文件用于题库投稿和 PR 校验，合并前必须转换为 canonical JSON。

## 功能

- 多学院、多科目入口。
- 题干、选项、解析支持 Markdown、GFM 表格、代码块和 KaTeX 数学公式。
- 学习模式、题库浏览、模拟考试、错题本、收藏和待复习。
- 右侧答题卡按题型分组。
- 浏览器 localStorage 保存进度；Docker 部署可选 JSON session 后端。
- `/dev.html` 后端开发者仪表盘可查看在线设备和历史 session 汇总。
- 保留旧科目 URL，构建时自动生成兼容 HTML。

## 快速开始

```powershell
npm ci
npm run dev:api
npm run dev
```

常用检查：

```powershell
npm run validate
npm run typecheck
npm run test
npm run build
npm run check
```

Docker 本地运行：

```powershell
docker compose up -d --build
```

默认访问：

```text
http://127.0.0.1:8088/
```

## 项目结构

```text
src/                            React/TypeScript 运行时
src/components/                 共用组件
src/pages/                      首页和科目练习页
src/lib/                        题目、进度、科目注册逻辑
src/styles/app.css              统一样式

public/subjects.json            科目注册表
public/data/*.json              正式题库
public/assets/**                图片等静态资源

contrib/question-banks/         Markdown 题库投稿草稿
backend/server.js               可选 JSON session 后端和 /dev.html
docker/nginx.conf               Nginx 静态站点和 /api 反代
tools/                          校验、导入和构建辅助脚本
docs/                           架构、题库、部署和投稿文档
```

源码根目录只保留 `index.html`。科目入口如 `linux_practice.html`、`modern_history_practice.html` 由 `npm run build` 后在 `dist/` 中自动生成。

## 题库 JSON Schema

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

规则见 [docs/question-schema.md](docs/question-schema.md)。

## Markdown 和数学公式

题干、选项、解析和参考答案支持 Markdown：

- 行内公式：`$a^2+b^2=c^2$`
- 块级公式：`$$\int_0^1 x^2 dx = \frac{1}{3}$$`
- GFM 表格、列表、粗体、代码块

Markdown 渲染禁用 raw HTML。题库里写入 `<script>` 或 HTML 标签时不会执行。

## 投稿题库

优先使用 GitHub Issue 或 PR 投稿：[提交题库或问题](https://github.com/Mai-xiyu/xueke-practice/issues/new/choose)。

Markdown 投稿草稿放在：

```text
contrib/question-banks/
```

示例：

````md
```question
id: higher-math-down-ch03-001
subject: higher-math-down
type: single
source: 期末资料
chapter: 第三章 微分方程
tags: [微分方程]
correct: B
```

设 $y'=2x$，则 $y$ 的通解为（ ）。

A. $x+C$
B. $x^2+C$
C. $2x+C$
D. $x^2$

```analysis
因为 $\int 2x\,dx=x^2+C$。
```
````

校验和导入预览：

```powershell
npm run validate
npm run import:markdown -- --out .artifacts/markdown-import
```

详细格式见 [docs/markdown-question-bank.md](docs/markdown-question-bank.md)。

## AI 如何提 PR

AI coding agent 修改本仓库前应阅读：

1. [docs/ai-contributor-guide.md](docs/ai-contributor-guide.md)
2. [docs/add-subject.md](docs/add-subject.md)
3. [docs/question-schema.md](docs/question-schema.md)
4. [docs/markdown-question-bank.md](docs/markdown-question-bank.md)
5. [CONTRIBUTING.md](CONTRIBUTING.md)

基本要求：

- 不新增根目录科目 HTML，旧 URL 由构建脚本生成。
- 不提交 `node_modules/`、`dist/`、`session-data/`、临时 OCR 文件、截图裁剪文件或 Docker tar 包。
- 不提交账号、密码、API key、私有 IP、个人路径或本地机器信息。
- 题目 ID 必须稳定；去重不能只按题号。
- 不确定答案不能伪造成确定答案。
- PR 必须写清影响科目、题量变化、来源材料、去重策略和校验结果。

## 进度保存

浏览器本地进度 key：

```text
studyhub:v2:<subjectId>
```

Docker/Nginx 模式会尝试同步到：

```text
/api/session
```

GitHub Pages 等纯静态部署没有后端，自动退化为 localStorage。客户端会在 cookie 和 localStorage 中保存 `study_hub_client_id`，用于在 IP 变化时继续识别同一设备。

## 开发者仪表盘

Docker/Nginx 后端提供：

```text
/dev.html
/api/dev-dashboard
```

默认开发密码：

```text
123456
```

生产或多人部署必须通过环境变量覆盖：

```text
DEV_DASHBOARD_PASSWORD=change-this-password
```

GitHub Pages 等纯静态部署没有后端 API，因此不提供 `/dev.html`。

## 部署

- GitHub Pages：`.github/workflows/github-pages.yml`
- Docker Hub：`.github/workflows/docker-hub.yml`
- Docker 本地部署：[README-docker.md](README-docker.md)
- 局域网 Windows Docker 部署：[docs/lan-windows-deploy.md](docs/lan-windows-deploy.md)

Pull request 只构建校验，不应触发带部署权限的 workflow。
