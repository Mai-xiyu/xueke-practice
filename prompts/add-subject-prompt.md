# AI 新增科目提示词

你要在“学科练习系统”中新增或补充题库。项目是 Vite + React + TypeScript，所有科目共用统一运行时。你必须按仓库结构输出可审查的修改，不要生成独立 HTML 页面。

## 必读文件

在修改前阅读：

1. `README.md`
2. `docs/ai-contributor-guide.md`
3. `docs/add-subject.md`
4. `docs/question-schema.md`
5. `public/subjects.json`

## 输入材料

维护者可能提供试卷图片、docx、pdf、课堂资料、网页、Markdown 或题目文本。你需要识别题型、题干、选项、答案、解析、章节、来源和标签。

## 修改范围

允许修改：

- `public/data/<subject_id>.json`
- `public/subjects.json`
- `public/assets/**`，仅当题目需要图片
- 必要文档

禁止修改：

- 根目录 `*_practice.html`
- `dist/`
- `node_modules/`
- `session-data/`
- OCR 缓存、截图裁剪、原始聊天文件、Docker tar 包
- 与本次科目无关的题库

## 题库 schema

统一字段：

```json
{
  "id": "stable-question-id",
  "source": "真实来源",
  "chapter": "章节或专题",
  "type": "single | multiple | judge | fill | short | essay | code | comprehensive",
  "stem": "题干",
  "options": { "A": "...", "B": "..." },
  "correct": ["A"],
  "answers": ["填空答案"],
  "answer": "简答/代码/综合题参考答案",
  "analysis": "解析、来源说明或不确定性说明",
  "tags": [],
  "image": null,
  "meta": {}
}
```

题型规则：

- `single | multiple | judge` 使用 `options` 和 `correct`。
- `fill` 使用 `answers`。
- `short | essay | code | comprehensive` 使用 `answer`。
- `analysis` 尽量给出解释；没有可靠解析时写来源和不确定性，不要编造。

## 质量要求

1. 题目 ID 必须稳定，不能随排序改变。
2. 新增题必须去重，去重依据包括题干、选项、答案、来源和章节。
3. 不确定答案不得写成确定答案。
4. 不允许把“AI 生成”“衍生题”作为最终来源。
5. 判断题可由选择题改写，但必须在 `analysis` 中保留原题线索。
6. 简答、论述、代码和综合应用题必须提供可复盘参考答案。
7. OCR 结果必须清理明显乱码、断行和重复水印。
8. 不硬编码题量，所有题量由数据动态计算。
9. 不引入外部 CDN 或大型 UI 框架。
10. 不提交账号、密码、API key、私有 IP、个人路径或本机用户名。

## 新增科目步骤

1. 创建 `public/data/<subject_id>.json`。
2. 在 `public/subjects.json` 中添加科目配置。
3. 设置唯一 `href`，例如 `new_subject_practice.html`。
4. 不要创建这个 HTML 文件；构建脚本会生成。
5. 如果有模拟考试规则，配置 `mockExam.sections`。
6. 运行校验。

## 必须运行

```powershell
npm run validate
npm run check
```

涉及页面渲染、导航或交互时再运行：

```powershell
npm run e2e
```

## PR 说明

提交 PR 时说明：

- 影响科目
- 题量变化，按题型列出
- 来源材料
- 去重策略
- 不确定题目的处理方式
- 运行过的校验命令
