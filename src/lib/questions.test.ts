import { describe, expect, it } from "vitest";
import { buildMockExam, interleaveByType, isAnswerCorrect, normalizeOptions, normalizeType, scoreMockExam } from "./questions";
import type { Question } from "./types";

function makeQuestion(id: string, type: Question["type"]): Question {
  return { id, source: "s", chapter: "c", type, stem: id, correct: ["A"], options: { A: "a", B: "b" }, tags: [] };
}

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

  it("interleaves questions across type groups", () => {
    const questions = [
      makeQuestion("s1", "single"),
      makeQuestion("s2", "single"),
      makeQuestion("s3", "single"),
      makeQuestion("j1", "judge"),
      makeQuestion("j2", "judge")
    ];
    const mixed = interleaveByType(questions);
    expect(mixed.map((question) => question.id)).toEqual(["s1", "j1", "s2", "j2", "s3"]);
    expect(interleaveByType(questions.slice(0, 2)).map((question) => question.id)).toEqual(["s1", "s2"]);
  });

  it("reports per-type scores for mock exams", () => {
    const questions = [makeQuestion("s1", "single"), makeQuestion("s2", "single"), makeQuestion("j1", "judge")];
    const { score, totalScore, typeScores } = scoreMockExam(
      questions,
      { s1: "A", s2: "B", j1: "A" },
      { sections: [{ type: "single", count: 2, score: 2 }, { type: "judge", count: 1, score: 1 }] }
    );
    expect(score).toBe(3);
    expect(totalScore).toBe(5);
    expect(typeScores).toEqual([
      { type: "single", correct: 1, total: 2, score: 2, totalScore: 4 },
      { type: "judge", correct: 1, total: 1, score: 1, totalScore: 1 }
    ]);
  });
});
