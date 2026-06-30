import { describe, expect, it } from "vitest";
import { parseMarkdownQuestionBank } from "./markdown-bank.mjs";

describe("parseMarkdownQuestionBank", () => {
  it("parses choice questions with math and analysis", () => {
    const parsed = parseMarkdownQuestionBank(`
\`\`\`question
id: higher-math-down-ch03-001
subject: higher-math-down
type: single
source: 期末资料
chapter: 第三章
tags: [微分方程, 积分]
correct: B
\`\`\`

设 $y'=2x$，则 $y$ 的通解为（ ）。

A. $x+C$
B. $x^2+C$

\`\`\`analysis
因为 $\\int 2x\\,dx=x^2+C$。
\`\`\`
`, "sample.md");

    expect(parsed).toHaveLength(1);
    expect(parsed[0].subject).toBe("higher-math-down");
    expect(parsed[0].question.options?.B).toBe("$x^2+C$");
    expect(parsed[0].question.correct).toEqual(["B"]);
    expect(parsed[0].question.analysis).toContain("\\int");
  });

  it("parses subjective answer blocks", () => {
    const parsed = parseMarkdownQuestionBank(`
\`\`\`question
id: linux-course-short-001
subject: linux-course
type: short
source: Linux 复习题
chapter: Shell
tags: [Shell]
\`\`\`

写一个 Bash 脚本打印三角形。

\`\`\`answer
使用双重循环。
\`\`\`
`, "sample.md");

    expect(parsed[0].question.answer).toBe("使用双重循环。");
  });
});
