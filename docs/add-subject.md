# 新增科目流程

## 目标

新增科目只需要两个稳定入口：

1. 一个新的 `*_practice.html` 页面。
2. `subjects.json` 中的一条科目配置。

## 手工新增

1. 复制模板：

   ```powershell
   Copy-Item templates/subject_practice_template.html new_subject_practice.html
   ```

2. 修改页面里的：

   - `<title>`
   - `SUBJECT_TITLE`
   - `STORAGE_KEY`
   - `QUESTIONS`

3. 在 `subjects.json` 增加入口：

   ```json
   {
     "id": "new-subject",
     "title": "新科目",
     "mark": "NS",
     "href": "new_subject_practice.html",
     "accent": "new-subject",
     "description": "一句话说明覆盖范围。",
     "order": 50
   }
   ```

4. 校验：

   ```powershell
   npm run validate
   ```

## 题库规则

- `source` 使用真实来源，例如 `A卷真题`、`课堂简答题`、`实验题`。
- 不再使用 `衍生题` 作为来源。
- 判断题由选择题改写生成；如果要写入题库，`analysis/explanation` 里注明“由选择题 X 改写生成”。
- 简答题必须带参考答案，否则模拟考试和题库浏览会失去复盘价值。

## 用 AI 新增

把 `prompts/add-subject-prompt.md` 发给 AI，并附上试卷图片、docx、pdf 或老师资料。AI 产出后仍要运行：

```powershell
npm run validate
```
