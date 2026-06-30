# 架构说明

## 前端

系统是 Vite + React 单源码入口应用。仓库根目录只保留 `index.html`；旧 URL 仍然存在，但由构建脚本在 `dist/` 中生成兼容 HTML。实际页面由 `src/main.tsx` 挂载 React 应用，并根据当前 URL 的文件名匹配 `public/subjects.json` 中的科目。

核心模块：

- `src/App.tsx`：加载科目目录，判断当前页面是总览还是科目页。
- `src/pages/HomePage.tsx`：学院和科目总览。
- `src/pages/PracticePage.tsx`：学习、题库浏览、错题、收藏、模拟考试。
- `src/lib/questions.ts`：题型、判分、搜索、模拟考试抽题。
- `src/lib/progress.ts`：localStorage、旧进度迁移、间隔复习状态、后端 session 同步。
- `src/styles/app.css`：统一视觉风格。
- `tools/generate-legacy-pages.mjs`：构建后把 `dist/index.html` 复制成各科旧 URL，保持历史链接可访问。

## 学习进度模型

进度按科目独立保存，key 为 `studyhub:v2:<subjectId>`。题目状态按 `questionId` 记录，不依赖当前题号，因为筛选、乱序、模拟考试都会改变题号。

核心字段：

- `answers`：最近一次答案。
- `wrong`：当前错题集合。
- `favorites`：收藏集合。
- `review`：进入复习调度的题目集合。
- `details`：每题的长期复习明细，包括 `attempts`、`wrongCount`、`correctCount`、`correctStreak`、`lastAnsweredAt`、`nextReviewAt`、`memoryHint`。

复习间隔：

- 答错：10 分钟后复习。
- 连续答对 1 次：1 天后复习。
- 连续答对 2 次：3 天后复习。
- 连续答对 3 次：7 天后复习。
- 连续答对 4 次：14 天后复习。
- 连续答对 5 次及以上：30 天后复习。

该策略的目标是把普通刷题变成检索练习和间隔复习，避免用户只看答案形成熟悉感。

## 数据

运行时读取：

- `public/subjects.json`
- `public/data/*.json`
- `public/assets/**`

构建后这些文件保持为：

- `/subjects.json`
- `/data/*.json`
- `/assets/**`

## 部署

GitHub Pages 使用 `dist` 静态产物，不启用后端进度同步。Docker/Nginx 使用同一份 `dist`，并通过 `/api/session` 反代到 `backend/server.js` 保存进度 JSON。

## 工作区边界

仓库只保存 React 源码、题库 JSON、静态资产、部署配置和文档。以下内容不得提交：

- `node_modules/`
- `dist/`
- `session-data/`
- `.artifacts/`
- 临时 OCR、爬虫缓存、截图裁剪、Docker tar 包
- 根目录科目 HTML shell，例如 `network_practice.html`；它们只能存在于构建产物 `dist/` 中。

历史采集产物如仍需保留，应移动到仓库外的本地归档目录，例如桌面 `xueke-local-artifacts-archive/`。
