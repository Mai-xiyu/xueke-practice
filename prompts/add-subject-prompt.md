# AI 新增科目提示词

你要在现有“学科练习系统”中新增一个科目。请严格按现有工程结构输出可直接落地的文件修改。

## 输入材料

我会提供试卷图片、docx、pdf、课堂资料或题目文本。你需要识别题型、题干、选项、答案和解析。

## 输出要求

1. 新建一个 `<subject_id>_practice.html`。
2. 基于 `templates/subject_practice_template.html` 的结构实现，不要引入外部 CDN。
3. 在 `subjects.json` 追加新科目入口。
4. 题库对象统一使用：

   ```js
   {
     id: "唯一ID",
     source: "真实来源",
     chapter: "章节或专题",
     type: "single | multiple | fill | judge | short | code",
     stem: "题干",
     options: {"A":"...", "B":"..."},
     correct: ["A"],
     answers: ["填空答案"],
     answer: "简答/代码参考答案",
     analysis: "解析",
     tags: []
   }
   ```

5. 不允许使用 `衍生题` 作为来源。
6. 判断题通过选择题改写生成。生成规则：

   - 从选择题中抽取正确或错误选项构造判断陈述。
   - 正确判断题答案为 `A`，错误判断题答案为 `B`。
   - `analysis` 中注明由哪一道选择题改写。

7. 简答题必须提供可背诵的参考答案。
8. 输出后说明运行校验命令：

   ```powershell
   npm run validate
   ```

## 质量标准

- 不把不确定答案伪造成确定答案；有争议时写入 `note` 或 `analysis`。
- 题目 ID 稳定，后续新增题目不能改变旧 ID。
- 页面要支持学习、模拟、错题和题库浏览。
