# 架构说明

## 前端

系统是 Vite 多页面应用。旧 URL 仍然存在，但每个 HTML 只负责提供 `#root` 和 `data-subject-id`，实际页面由 `src/main.tsx` 挂载 React 应用。

核心模块：

- `src/App.tsx`：加载科目目录，判断当前页面是总览还是科目页。
- `src/pages/HomePage.tsx`：学院和科目总览。
- `src/pages/PracticePage.tsx`：学习、题库浏览、错题、收藏、模拟考试。
- `src/lib/questions.ts`：题型、判分、搜索、模拟考试抽题。
- `src/lib/progress.ts`：localStorage、旧进度迁移、后端 session 同步。
- `src/styles/app.css`：统一视觉风格。

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
