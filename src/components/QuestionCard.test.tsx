import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import type { Question } from "../lib/types";
import { QuestionCard } from "./QuestionCard";

const noop = () => undefined;

function renderCard(question: Question, overrides: Partial<ComponentProps<typeof QuestionCard>> = {}) {
  return render(
    <QuestionCard
      question={question}
      index={0}
      total={1}
      value={overrides.value ?? ""}
      answered={false}
      wrong={false}
      favorite={false}
      reveal
      showAnalysis
      memoryHintDraft=""
      onChange={noop}
      onMemoryHintChange={noop}
      onSaveMemoryHint={noop}
      onSubmit={noop}
      onShowAnalysis={noop}
      onReset={noop}
      onFavorite={noop}
      onPrev={noop}
      onNext={noop}
      {...overrides}
    />
  );
}

describe("QuestionCard answer rendering", () => {
  it("renders subjective reference answers as full markdown instead of compact inline text", () => {
    const question: Question = {
      id: "short-1",
      source: "test",
      chapter: "chapter",
      type: "short",
      stem: "写出命令。",
      answer: "参考代码：\n\n```bash\necho hello\n```",
      analysis: "解析里的代码也应正常显示：\n\n```bash\necho hello\n```",
      tags: []
    };

    const { container } = renderCard(question);

    expect(container.querySelector(".analysis__answer-block")).not.toBeNull();
    expect(container.querySelector(".analysis__answer-block pre code")?.textContent).toContain("echo hello");
    expect(container.querySelector(".analysis__answer-block .markdown-content--compact")).toBeNull();
  });

  it("shows objective correct answers with option text", () => {
    const question: Question = {
      id: "single-1",
      source: "test",
      chapter: "chapter",
      type: "single",
      stem: "选择正确项。",
      options: { A: "第一项", B: "第二项" },
      correct: ["B"],
      analysis: "B：第二项正确。",
      tags: []
    };

    const { container } = renderCard(question, { value: "A", wrong: true });

    expect(container.textContent).toContain("正确答案：B. 第二项");
  });
});
