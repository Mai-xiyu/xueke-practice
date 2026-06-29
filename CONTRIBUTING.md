# 贡献指南

本仓库采用 Vite + React + TypeScript。所有科目页面使用同一套运行时，题库只放在 `public/data/*.json`。

## 开发流程

```powershell
npm ci
npm run dev
npm run check
```

提交 PR 前必须通过：

```powershell
npm run validate
npm run typecheck
npm run test
npm run build
```

涉及页面交互时额外运行：

```powershell
npm run e2e
```

## 题库修改规则

- 题目 ID 不得因排序、去重或重构而改变。
- 新题必须使用 `docs/question-schema.md` 中的 canonical schema。
- 不确定答案不能伪造成确定答案；用 `analysis` 标注来源和不确定点。
- 判断题由选择题改写时，在 `analysis` 里保留来源线索。
- 不把题库写回 HTML。

## PR 要求

- 说明影响科目、题量变化、来源材料和校验结果。
- UI 改动附截图或 e2e 说明。
- Docker、Nginx、Actions、后端改动必须说明部署验证方式。
