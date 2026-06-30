# Markdown 题库投稿格式

Markdown 投稿面向贡献者和 AI coding agent。正式站点不直接读取 Markdown，维护者会先校验并转换为 `public/data/*.json`。

## 文件位置

```text
contrib/question-banks/<subject-id>-<topic>.md
```

每个文件可以包含多道题。每道题必须以 ````question` fenced block 开始，随后写题干、选项、可选答案块和解析块。

## 基本格式

````md
```question
id: higher-math-down-ch03-001
subject: higher-math-down
type: single
source: 期末资料
chapter: 第三章 微分方程
tags: [微分方程, 积分]
correct: B
```

设 $y'=2x$，则 $y$ 的通解为（ ）。

A. $x+C$
B. $x^2+C$
C. $2x+C$
D. $x^2$

```analysis
因为 $\int 2x\,dx=x^2+C$。
```
````

## 字段

- `id`：稳定题号，发布后不要改。
- `subject`：必须等于 `public/subjects.json` 中的科目 ID。
- `type`：`single | multiple | judge | fill | short | essay | code | comprehensive`。
- `source`：可追溯来源，不写“AI 生成”或“未知”。
- `chapter`：章节或专题。
- `tags`：数组格式，例如 `[KMP, 串匹配]`。
- `correct`：选择题和判断题答案，例如 `A` 或 `AC`。
- `answer`：填空题可用 `answer: cat`，主观题可用元数据或 `answer` fenced block。

## 主观题

````md
```question
id: linux-course-short-001
subject: linux-course
type: short
source: Linux 复习题
chapter: Shell
tags: [Shell, 循环]
```

写一个 Bash 脚本，输入行数 $n$，打印实心直角三角形。

```answer
使用双重循环，外层控制行数，内层输出当前行需要的 `*`。
```

```analysis
核心是理解外层循环的行号和内层循环次数之间的关系。
```
````

## 判断题

判断题可以省略选项，转换工具会默认生成：

```json
{ "A": "对", "B": "错" }
```

答案仍写 `correct: A` 或 `correct: B`。

## 禁止内容

- 不写 HTML、`<script>`、事件属性或外部 iframe。
- 不提交账号、密码、API key、私有 IP、个人路径。
- 不提交 OCR 中间文件、截图裁剪文件、Docker tar 包或构建产物。
- 不把不确定答案写成确定答案；应在 `analysis` 里说明不确定来源。

## 校验和预览

```powershell
npm run validate
node tools/import-markdown-bank.mjs --out .artifacts/markdown-import
```
