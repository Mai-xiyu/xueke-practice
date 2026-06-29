import type { MockExamConfig, OptionMap, Question, QuestionType } from "./types";

export const QUESTION_TYPES: QuestionType[] = [
  "single",
  "multiple",
  "judge",
  "fill",
  "short",
  "essay",
  "code",
  "comprehensive"
];

export const TYPE_LABEL: Record<QuestionType, string> = {
  single: "单选题",
  multiple: "多选题",
  judge: "判断题",
  fill: "填空题",
  short: "简答题",
  essay: "论述题",
  code: "代码题",
  comprehensive: "综合应用题"
};

export function normalizeType(value: unknown): QuestionType {
  const raw = String(value || "").trim().toLowerCase();
  if (["single", "choice", "select", "radio"].includes(raw)) return "single";
  if (["multiple", "multi", "checkbox"].includes(raw)) return "multiple";
  if (["judge", "tf", "true_false", "judgement", "boolean"].includes(raw)) return "judge";
  if (["fill", "blank", "completion"].includes(raw)) return "fill";
  if (["short", "subjective"].includes(raw)) return "short";
  if (["essay", "argument"].includes(raw)) return "essay";
  if (["code", "program", "programming"].includes(raw)) return "code";
  if (["comprehensive", "application", "case"].includes(raw)) return "comprehensive";
  return "single";
}

export function isObjective(type: QuestionType): boolean {
  return type === "single" || type === "multiple" || type === "judge" || type === "fill";
}

export function isChoice(type: QuestionType): boolean {
  return type === "single" || type === "multiple" || type === "judge";
}

export function normalizeOptions(options: unknown): OptionMap | undefined {
  if (!options) return undefined;
  if (Array.isArray(options)) {
    const out: OptionMap = {};
    options.forEach((item, index) => {
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        const label = String(record.label || record.key || String.fromCharCode(65 + index)).trim();
        out[label] = String(record.text || record.value || "");
      }
    });
    return Object.keys(out).length ? out : undefined;
  }
  if (typeof options === "object") {
    const out: OptionMap = {};
    Object.entries(options as Record<string, unknown>).forEach(([key, value]) => {
      out[String(key).trim()] = String(value ?? "");
    });
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

export function normalizeAnswerKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  if (/^[A-Z]+$/i.test(raw) && raw.length > 1) return raw.toUpperCase().split("");
  return [raw.toUpperCase()];
}

export function answerText(question: Question): string {
  if (question.type === "fill") return (question.answers || []).join(" / ");
  if (isChoice(question.type)) return (question.correct || []).join("");
  return question.answer || "";
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function isAnswerCorrect(question: Question, answer: unknown): boolean {
  if (!isObjective(question.type)) return true;
  if (question.type === "fill") {
    const expected = (question.answers || []).map(normalizeText).filter(Boolean);
    if (!expected.length) return true;
    const actual = normalizeText(answer);
    return expected.includes(actual);
  }
  const expected = [...(question.correct || [])].map(String).sort();
  if (!expected.length) return true;
  const actual = Array.isArray(answer)
    ? answer.map(String).sort()
    : normalizeAnswerKeys(answer).sort();
  return expected.length === actual.length && expected.every((item, index) => item === actual[index]);
}

export function questionSearchText(question: Question): string {
  return [
    question.id,
    question.source,
    question.chapter,
    question.type,
    question.stem,
    question.analysis,
    question.answer,
    question.answers?.join(" "),
    question.correct?.join(""),
    question.tags?.join(" "),
    question.options ? Object.values(question.options).join(" ") : "",
    typeof question.meta?.searchText === "string" ? question.meta.searchText : ""
  ].filter(Boolean).join(" ").toLowerCase();
}

export function questionMatches(question: Question, keyword: string): boolean {
  const value = keyword.trim().toLowerCase();
  return !value || questionSearchText(question).includes(value);
}

export function uniqueSorted(values: Array<string | undefined | null>): string[] {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

export function shuffle<T>(items: T[], seed = Date.now()): T[] {
  const out = [...items];
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  const next = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildMockExam(questions: Question[], config?: MockExamConfig, seed = Date.now()): Question[] {
  if (!config || !config.sections?.length) {
    return shuffle(questions, seed).slice(0, Math.min(50, questions.length));
  }
  const used = new Set<string>();
  const picked: Question[] = [];
  config.sections.forEach((section, index) => {
    const candidates = questions.filter((question) => {
      if (used.has(question.id) || question.type !== section.type) return false;
      if (!section.sourceTag) return true;
      return question.tags?.includes(section.sourceTag) || question.meta?.examTags === section.sourceTag;
    });
    shuffle(candidates, seed + index + 1).slice(0, section.count).forEach((question) => {
      used.add(question.id);
      picked.push(question);
    });
  });
  return picked;
}

export function scoreMockExam(questions: Question[], answers: Record<string, unknown>, config?: MockExamConfig) {
  const scoreByType = new Map<QuestionType, number>();
  config?.sections?.forEach((section) => scoreByType.set(section.type, section.score || 1));
  let score = 0;
  let totalScore = 0;
  questions.forEach((question) => {
    const point = scoreByType.get(question.type) || 1;
    totalScore += point;
    if (isAnswerCorrect(question, answers[question.id])) score += point;
  });
  return { score, totalScore };
}
