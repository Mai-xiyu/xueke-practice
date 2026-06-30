# 贡献指南

本仓库采用 Vite + React + TypeScript。所有科目页面使用同一套运行时，题库只放在 `public/data/*.json`，科目入口只在 `public/subjects.json` 注册。

## 开发流程

```powershell
npm ci
npm run dev
```

提交 PR 前至少通过：

```powershell
npm run validate
npm run typecheck
npm run test
npm run build
```

等价聚合命令：

```powershell
npm run check
```

涉及页面导航、答题交互、抽屉、模拟考试或响应式布局时额外运行：

```powershell
npm run e2e
```

## 题库修改规则

- 题目 ID 不得因排序、去重或重构改变。
- 新题必须使用 [docs/question-schema.md](docs/question-schema.md) 中的 canonical schema。
- 不确定答案不能伪造成确定答案；用 `analysis` 标注来源和不确定点。
- 判断题由选择题改写时，在 `analysis` 中保留来源线索。
- 不把题库写回 HTML。
- 不提交 OCR 中间产物、截图源文件、爬虫缓存和本地归档。
- 不提交账号、密码、API key、私有 IP、个人路径或本机用户名。

## 新增科目

阅读：

1. [docs/add-subject.md](docs/add-subject.md)
2. [docs/question-schema.md](docs/question-schema.md)
3. [docs/ai-contributor-guide.md](docs/ai-contributor-guide.md)

只需要新增或修改：

- `public/data/<subject_id>.json`
- `public/subjects.json`
- 必要的 `public/assets/**`
- 必要文档

不要新增根目录 `*_practice.html`。构建脚本会根据 `subjects.json` 中的 `href` 在 `dist/` 里生成兼容入口。

## PR 要求

PR 描述必须说明：

- 影响科目。
- 题量变化，按题型列出。
- 来源材料。
- 去重策略。
- 校验结果。
- 是否影响 UI、Docker、Nginx、后端或 GitHub Actions。

UI 改动需要截图或 e2e 说明。部署相关改动需要说明本地或 Docker 验证方式。

## AI 辅助贡献

允许使用 AI 生成初稿，但维护者和贡献者仍需对结果负责。AI 产出的题库必须经过来源检查、去重检查和 schema 校验。AI 不得伪造答案、来源或解析。
