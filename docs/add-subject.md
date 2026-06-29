# 新增科目流程

新增科目不再复制整页 HTML。页面能力由 React 统一运行时提供，只需要题库和注册表。

## 1. 准备题库

新建：

```text
public/data/<subject_id>.json
```

顶层是题目数组，字段遵循 [question-schema.md](question-schema.md)。

## 2. 注册科目

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

## 3. 增加旧式 URL 入口

如果需要 `new_subject_practice.html`：

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>新科目练习系统</title>
  </head>
  <body>
    <div id="root" data-subject-id="new-subject"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## 4. 校验

```powershell
npm run validate
npm run check
```

## 5. 用 AI 新增

把 [prompts/add-subject-prompt.md](../prompts/add-subject-prompt.md) 发给 AI，并附上试卷图片、docx、pdf 或老师资料。AI 产出后仍要运行校验。
