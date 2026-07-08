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
  memoryAnswer?: string;
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
  review: Record<string, true>;
  details: Record<string, QuestionProgress>;
  mockRuns: Array<{
    id: string;
    title: string;
    subjectTitle?: string;
    questionIds: string[];
    score: number;
    totalScore: number;
    submittedAt: string;
    startedAt?: string;
    durationSeconds?: number;
    completed?: number;
    total?: number;
  }>;
  migratedFrom?: string[];
  updatedAt?: string;
}

export interface QuestionProgress {
  questionId: string;
  attempts: number;
  wrongCount: number;
  correctCount: number;
  correctStreak: number;
  lastAnsweredAt: string | null;
  nextReviewAt: string | null;
  isFavorite: boolean;
  isWrong: boolean;
  confidence?: 1 | 2 | 3 | 4 | 5;
  lastSelectedAnswer?: unknown;
  memoryHint?: string | null;
}

export interface AnswerCardItem {
  id: string;
  index: number;
  label: string;
  type: QuestionType;
  pending: boolean;
  done: boolean;
  correct: boolean;
  wrong: boolean;
  marked: boolean;
  reviewDue: boolean;
  stem: string;
}
