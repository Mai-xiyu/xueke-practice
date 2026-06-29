# AI 新增科目提示词

你要在现有“学科练习系统”中新增或补充题库。请严格按 Vite + React 版本的工程结构输出修改。

## 输入材料

我会提供试卷图片、docx、pdf、课堂资料、网页或题目文本。你需要识别题型、题干、选项、答案和解析。

## 输出要求

1. 题库只写入 `public/data/<subject_id>.json`。
2. 在 `public/subjects.json` 中追加或更新科目入口。
3. 如需新增 URL，创建轻量 HTML shell，不要写独立页面逻辑。
4. 不要引入外部 CDN。
5. 题库对象统一使用：

   ```json
   {
     "id": "唯一ID",
     "source": "真实来源",
     "chapter": "章节或专题",
     "type": "single | multiple | judge | fill | short | essay | code | comprehensive",
     "stem": "题干",
     "options": {"A": "...", "B": "..."},
     "correct": ["A"],
     "answers": ["填空答案"],
     "answer": "简答/代码/综合题参考答案",
     "analysis": "解析",
     "tags": [],
     "image": null,
     "meta": {}
   }
   ```

6. 不允许使用 `衍生题` 作为来源。
7. 判断题可由选择题改写生成，但必须在 `analysis` 中注明来源。
8. 简答题、论述题、综合题必须提供可复盘参考答案。
9. 不确定答案写入 `analysis`，不要伪造成确定答案。
10. 输出后说明运行：

   ```powershell
   npm run validate
   npm run check
   ```
