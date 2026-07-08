# 题库 JSON Schema

题库文件位于 `public/data/*.json`，顶层必须是数组。

```ts
type QuestionType =
  | "single"
  | "multiple"
  | "judge"
  | "fill"
  | "short"
  | "essay"
  | "code"
  | "comprehensive";

interface Question {
  id: string;
  source: string;
  chapter: string;
  type: QuestionType;
  stem: string;
  options?: Record<string, string>;
  correct?: string[];
  answers?: string[];
  answer?: string;
  memoryAnswer?: string;
  analysis?: string;
  tags: string[];
  image?: string | null;
  meta?: Record<string, unknown>;
}
```

## 字段规则

- `single | multiple | judge` 必须有 `options` 和 `correct`。
- `fill` 必须有 `answers`。
- `short | essay | code | comprehensive` 必须有 `answer`。
- `memoryAnswer` 可选，用于给简答题、论述题、代码题补充口语化、便于背诵的“易记答案”；不能替代 `answer`。
- `analysis` 写解析、来源说明或不确定性说明。
- `image` 使用 `assets/...` 或 `data:image/...`。
- 旧字段 `tf`、`true_false`、`subjective`、`explain`、`explanation`、`explanations` 不再新增。

运行：

```powershell
npm run validate
```
