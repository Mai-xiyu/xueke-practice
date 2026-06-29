import { describe, expect, it } from "vitest";
import { buildMockExam, isAnswerCorrect, normalizeOptions, normalizeType } from "./questions";
import type { Question } from "./types";

describe("question helpers", () => {
  it("normalizes legacy type aliases", () => {
    expect(normalizeType("tf")).toBe("judge");
    expect(normalizeType("true_false")).toBe("judge");
    expect(normalizeType("subjective")).toBe("short");
  });

  it("normalizes array options", () => {
    expect(normalizeOptions([{ label: "A", text: "甲" }, { label: "B", text: "乙" }])).toEqual({ A: "甲", B: "乙" });
  });

  it("scores choice and fill answers", () => {
    expect(isAnswerCorrect({ id: "1", source: "s", chapter: "c", type: "single", stem: "x", correct: ["C"], tags: [] }, "C")).toBe(true);
    expect(isAnswerCorrect({ id: "2", source: "s", chapter: "c", type: "multiple", stem: "x", correct: ["A", "D"], tags: [] }, ["D", "A"])).toBe(true);
    expect(isAnswerCorrect({ id: "3", source: "s", chapter: "c", type: "fill", stem: "x", answers: ["np.mean(arr)"], tags: [] }, " NP.MEAN(arr) ")).toBe(true);
  });

  it("builds mock exams from configured sections", () => {
    const questions: Question[] = [
      { id: "s1", source: "s", chapter: "c", type: "single", stem: "s1", correct: ["A"], options: { A: "a" }, tags: [] },
      { id: "s2", source: "s", chapter: "c", type: "single", stem: "s2", correct: ["A"], options: { A: "a" }, tags: [] },
      { id: "j1", source: "s", chapter: "c", type: "judge", stem: "j1", correct: ["A"], options: { A: "对", B: "错" }, tags: [] }
    ];
    const exam = buildMockExam(questions, { sections: [{ type: "single", count: 1 }, { type: "judge", count: 1 }] }, 1);
    expect(exam).toHaveLength(2);
    expect(exam.map((question) => question.type).sort()).toEqual(["judge", "single"]);
  });
});
