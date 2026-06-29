export type QuestionType =
  | "single"
  | "multiple"
  | "judge"
  | "fill"
  | "short"
  | "essay"
  | "code"
  | "comprehensive";

export type OptionMap = Record<string, string>;

export interface Question {
  id: string;
  source: string;
  chapter: string;
  type: QuestionType;
  stem: string;
  options?: OptionMap;
  correct?: string[];
  answers?: string[];
  answer?: string;
  analysis?: string;
  tags?: string[];
  image?: string | null;
  meta?: Record<string, unknown>;
}

export interface College {
  id: string;
  title: string;
  order: number;
}

export interface MockSection {
  type: QuestionType;
  count: number;
  score?: number;
  label?: string;
  sourceTag?: string;
}

export interface MockExamConfig {
  title?: string;
  sections: MockSection[];
}

export interface Subject {
  id: string;
  title: string;
  mark: string;
  href: string;
  accent: string;
  description: string;
  order: number;
  college: string;
  dataFile: string;
  mockExam?: MockExamConfig;
}

export interface SubjectDirectory {
  subjects: Subject[];
  colleges: College[];
}

export interface ProgressState {
  answers: Record<string, unknown>;
  wrong: Record<string, true>;
  favorites: Record<string, true>;
  mockRuns: Array<{
    id: string;
    title: string;
    questionIds: string[];
    score: number;
    totalScore: number;
    submittedAt: string;
  }>;
  migratedFrom?: string[];
  updatedAt?: string;
}

export interface AnswerCardItem {
  id: string;
  index: number;
  label: string;
  type: QuestionType;
  done: boolean;
  wrong: boolean;
  marked: boolean;
}
