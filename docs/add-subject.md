# 新增科目流程

新增科目不需要复制或手写 HTML 页面。系统只有一个 React 运行时，科目入口由 `public/subjects.json` 注册，旧 URL 兼容 HTML 在构建后自动生成。

## 1. 确定 subjectId

`subjectId` 必须稳定、短小、可读，建议使用小写 kebab-case：

```text
modern-history
linux-course
higher-math-down
```

一旦发布，不要因为改名、排序或清洗题库而修改 `subjectId`。

## 2. 准备题库

新建：

```text
public/data/<subject_id>.json
```

顶层必须是题目数组，字段遵循 [question-schema.md](question-schema.md)。

每题至少包含：

```json
{
  "id": "new-subject-single-001",
  "source": "来源材料名称",
  "chapter": "章节或专题",
  "type": "single",
  "stem": "题干",
  "options": {
    "A": "选项 A",
    "B": "选项 B",
    "C": "选项 C",
    "D": "选项 D"
  },
  "correct": ["A"],
  "analysis": "解析和来源说明。",
  "tags": ["考点"]
}
```

## 3. 注册科目

在 `public/subjects.json` 的 `subjects` 中增加：

```json
{
  "id": "new-subject",
  "title": "新科目",
  "mark": "NS",
  "href": "new_subject_practice.html",
  "accent": "new-subject",
  "description": "一句话说明覆盖范围。",
  "order": 90,
  "college": "computer-science",
  "dataFile": "data/new-subject.json"
}
```

如果是新学院，在 `colleges` 中增加：

```json
{
  "id": "new-college",
  "title": "新学院",
  "order": 90
}
```

不要在仓库根目录新增 `new_subject_practice.html`。构建脚本会根据 `href` 在 `dist/` 中生成兼容入口。

## 4. 配置模拟考试

如果课程有明确考试结构，在科目配置中添加 `mockExam.sections`：

```json
"mockExam": {
  "title": "模拟考试",
  "sections": [
    { "type": "single", "count": 30, "score": 1 },
    { "type": "multiple", "count": 15, "score": 1 },
    { "type": "judge", "count": 10, "score": 1 },
    { "type": "short", "count": 2, "score": 15 }
  ]
}
```

没有正式规则时可以暂不配置，系统会按随机练习卷处理。

## 5. 题库清洗要求

- 去重基于题干、选项、答案和来源综合判断，不能只按题号。
- 保留旧题时保持旧 ID；新增题使用稳定新 ID。
- OCR 结果必须人工或规则清洗，不要提交明显乱码。
- 不确定答案不要写成确定答案。
- 来源字段应写真实来源，例如“2023 B卷单选题”“章节测验 第一章”。
- 不能用“AI 生成”“衍生题”作为最终来源。
- 图片资产放在 `public/assets/` 下，题目中用相对路径引用。

## 6. 校验

```powershell
npm run validate
npm run check
```

涉及页面交互或入口 URL 时：

```powershell
npm run e2e
```

## 7. 用 AI 新增科目

把 [prompts/add-subject-prompt.md](../prompts/add-subject-prompt.md) 和本文件一起提供给 AI。AI 产出后仍必须由维护者检查题库来源、答案可靠性、去重结果和校验输出。
