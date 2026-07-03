import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  AnswerCard,
  AnswerCardLegend,
  AnswerMetric,
  buildAnswerSummary,
  FullAnswerCardControl,
  NearbyQuestionGrid,
  QuestionNumberCard
} from "../components/AnswerCard";
import { FloatingLayoutProvider, FloatingPanel, RestoreTray } from "../components/FloatingLayout";
import { QuestionCard } from "../components/QuestionCard";
import { buildStatEntries, StatCard, StatPanel } from "../components/StatPanel";
import {
  buildMockExam,
  interleaveByType,
  isChoice,
  isObjective,
  isAnswerCorrect,
  questionMatches,
  scoreMockExam,
  shuffle,
  TYPE_LABEL,
  uniqueSorted,
  type MockTypeScore
} from "../lib/questions";
import {
  compareReviewPriority,
  isReviewDue,
  loadLocalProgress,
  loadRemoteSnapshot,
  markUncertain,
  masteryLevel,
  migrateSnapshotProgress,
  recordQuestionAttempt,
  saveLocalProgress,
  saveMemoryHint,
  saveRemoteSnapshot
} from "../lib/progress";
import { loadQuestions } from "../lib/registry";
import type { FloatingPanelConfig } from "../lib/floatingLayout";
import type { AnswerCardItem, ProgressState, Question, QuestionType, Subject, SubjectDirectory } from "../lib/types";

type Mode = "study" | "browse" | "wrong" | "favorite" | "review" | "mock";
type QuestionOrder = "default" | "interleave" | "random";

interface PracticePageProps {
  directory: SubjectDirectory;
  subject: Subject;
}

const EMPTY_PROGRESS: ProgressState = { answers: {}, wrong: {}, favorites: {}, review: {}, details: {}, mockRuns: [] };
const FLOATING_BREAKPOINT = 900;
const FLOATING_MIN_HEIGHT = 820;
const MOCK_TYPE_ORDER: QuestionType[] = ["single", "multiple", "fill", "judge", "short", "code", "essay", "comprehensive"];

interface MockResult {
  title: string;
  subjectTitle: string;
  score: number;
  totalScore: number;
  completed: number;
  total: number;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  typeScores: MockTypeScore[];
  wrongIds: string[];
}

const BASE_FLOATING_CONFIGS: FloatingPanelConfig[] = [
  { id: "subject", defaultRect: { x: 28, y: 76, width: 520, height: 96 }, minWidth: 220, minHeight: 86, priority: 1 },
  { id: "stat-total", defaultRect: { x: 28, y: 210, width: 170, height: 86 }, minWidth: 150, minHeight: 80, priority: 2 },
  { id: "stat-done", defaultRect: { x: 210, y: 210, width: 170, height: 86 }, minWidth: 150, minHeight: 80, priority: 3 },
  { id: "stat-wrong", defaultRect: { x: 392, y: 210, width: 170, height: 86 }, minWidth: 150, minHeight: 80, priority: 4 },
  { id: "stat-accuracy", defaultRect: { x: 574, y: 210, width: 170, height: 86 }, minWidth: 150, minHeight: 80, priority: 5 },
  { id: "stat-bank", defaultRect: { x: 756, y: 210, width: 170, height: 86 }, minWidth: 150, minHeight: 80, priority: 6 },
  { id: "mode-tabs", defaultRect: { x: 28, y: 316, width: 550, height: 76 }, minWidth: 220, minHeight: 68, priority: 7 },
  { id: "filter-chapter", defaultRect: { x: 28, y: 420, width: 250, height: 64 }, minWidth: 210, minHeight: 58, priority: 8 },
  { id: "filter-type", defaultRect: { x: 294, y: 420, width: 250, height: 64 }, minWidth: 210, minHeight: 58, priority: 9 },
  { id: "filter-source", defaultRect: { x: 560, y: 420, width: 250, height: 64 }, minWidth: 210, minHeight: 58, priority: 10 },
  { id: "filter-search", defaultRect: { x: 826, y: 420, width: 280, height: 64 }, minWidth: 220, minHeight: 58, priority: 11 },
  { id: "question", defaultRect: { x: 28, y: 520, width: 760, height: 560 }, minWidth: 420, minHeight: 260, priority: 12 },
  { id: "filter-order", defaultRect: { x: 826, y: 500, width: 280, height: 64 }, minWidth: 210, minHeight: 58, priority: 13 }
];

const ANSWER_FLOATING_CONFIGS: FloatingPanelConfig[] = [
  { id: "answer-done", defaultRect: { x: 1040, y: 120, width: 128, height: 88 }, minWidth: 112, minHeight: 80, priority: 20 },
  { id: "answer-correct", defaultRect: { x: 1180, y: 120, width: 128, height: 88 }, minWidth: 112, minHeight: 80, priority: 21 },
  { id: "answer-wrong", defaultRect: { x: 1040, y: 210, width: 128, height: 88 }, minWidth: 112, minHeight: 80, priority: 22 },
  { id: "answer-marked", defaultRect: { x: 1180, y: 210, width: 128, height: 88 }, minWidth: 112, minHeight: 80, priority: 23 },
  { id: "answer-review", defaultRect: { x: 1040, y: 300, width: 128, height: 88 }, minWidth: 112, minHeight: 80, priority: 24 },
  { id: "answer-nearby", defaultRect: { x: 1040, y: 390, width: 270, height: 136 }, minWidth: 220, minHeight: 120, priority: 25 },
  { id: "answer-full", defaultRect: { x: 1040, y: 575, width: 270, height: 64 }, minWidth: 220, minHeight: 58, priority: 26 },
  { id: "answer-legend", defaultRect: { x: 1040, y: 678, width: 270, height: 70 }, minWidth: 220, minHeight: 62, priority: 27 }
];

const MOCK_FLOATING_CONFIG: FloatingPanelConfig = {
  id: "mock-strip",
  defaultRect: { x: 800, y: 76, width: 330, height: 120 },
  minWidth: 280,
  minHeight: 98,
  priority: 18
};

function pageAppName() {
  return decodeURIComponent(location.pathname.split("/").pop() || "index.html");
}

function normalizeIndex(index: number, total: number) {
  if (!total) return 0;
  if (index < 0) return total - 1;
  if (index >= total) return 0;
  return index;
}

function orderMockQuestions(questions: Question[]) {
  return [...questions].sort((left, right) => {
    const leftType = MOCK_TYPE_ORDER.indexOf(left.type);
    const rightType = MOCK_TYPE_ORDER.indexOf(right.type);
    const leftRank = leftType === -1 ? MOCK_TYPE_ORDER.length : leftType;
    const rightRank = rightType === -1 ? MOCK_TYPE_ORDER.length : rightType;
    return leftRank - rightRank;
  });
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes <= 0) return `${rest} 秒`;
  return `${minutes} 分 ${rest} 秒`;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function typeOptions(questions: Question[]) {
  return uniqueSorted(questions.map((question) => question.type));
}

function hasMeaningfulProgress(progress: ProgressState) {
  return Boolean(
    Object.keys(progress.answers).length ||
    Object.keys(progress.wrong).length ||
    Object.keys(progress.favorites).length ||
    Object.keys(progress.review).length ||
    Object.keys(progress.details).length ||
    progress.mockRuns.length
  );
}

function useDesktopFloating() {
  const [desktop, setDesktop] = useState(() => (
    typeof window === "undefined" ? true : window.innerWidth >= FLOATING_BREAKPOINT && window.innerHeight >= FLOATING_MIN_HEIGHT
  ));
  useEffect(() => {
    const update = () => setDesktop(window.innerWidth >= FLOATING_BREAKPOINT && window.innerHeight >= FLOATING_MIN_HEIGHT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return desktop;
}

export function PracticePage({ subject }: PracticePageProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>("study");
  const [chapter, setChapter] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [keyword, setKeyword] = useState("");
  const [order, setOrder] = useState<QuestionOrder>("default");
  const [orderSeed, setOrderSeed] = useState(() => Date.now());
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState<ProgressState>(() => {
    try {
      return loadLocalProgress(subject.id);
    } catch {
      return EMPTY_PROGRESS;
    }
  });
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [revealed, setRevealed] = useState<Record<string, true>>({});
  const [analysisRevealed, setAnalysisRevealed] = useState<Record<string, true>>({});
  const [memoryHints, setMemoryHints] = useState<Record<string, string>>({});
  const [mockQuestions, setMockQuestions] = useState<Question[]>([]);
  const [mockSubmitted, setMockSubmitted] = useState(false);
  const [mockStartedAt, setMockStartedAt] = useState<string | null>(null);
  const [mockResult, setMockResult] = useState<MockResult | null>(null);
  const [mockReviewing, setMockReviewing] = useState(false);
  const [syncReady, setSyncReady] = useState(false);

  // Snapshot the wrong/review queue when entering those modes, so answering a
  // question does not immediately remove it from the list before the user sees feedback.
  const [queueIds, setQueueIds] = useState<string[] | null>(null);
  useEffect(() => {
    if (mode === "wrong") {
      setQueueIds(questions.filter((question) => progress.wrong[question.id]).map((question) => question.id));
    } else if (mode === "review") {
      setQueueIds(
        questions
          .filter((question) => isReviewDue(progress.details[question.id]))
          .sort((left, right) => compareReviewPriority(progress.details[left.id], progress.details[right.id]))
          .map((question) => question.id)
      );
    } else {
      setQueueIds(null);
    }
    // progress is intentionally not a dependency: the queue is a snapshot taken on mode entry.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, questions]);

  useEffect(() => {
    let cancelled = false;
    loadQuestions(subject)
      .then((data) => {
        if (!cancelled) setQuestions(data);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(error.message || String(error));
      });
    return () => { cancelled = true; };
  }, [subject]);

  useEffect(() => {
    if (!syncReady) return;
    saveLocalProgress(subject.id, progress);
    const timer = window.setTimeout(() => saveRemoteSnapshot(pageAppName()), 700);
    return () => window.clearTimeout(timer);
  }, [progress, subject.id, syncReady]);

  useEffect(() => {
    let cancelled = false;
    setSyncReady(false);
    loadRemoteSnapshot(pageAppName())
      .then((snapshot) => {
        if (cancelled || !snapshot) return;
        const remote = migrateSnapshotProgress(subject.id, snapshot);
        if (!remote) return;
        setProgress((current) => (hasMeaningfulProgress(current) ? current : { ...EMPTY_PROGRESS, ...remote }));
      })
      .finally(() => {
        if (!cancelled) setSyncReady(true);
      });
    return () => { cancelled = true; };
  }, [subject.id]);

  const chapters = useMemo(() => uniqueSorted(questions.map((question) => question.chapter)), [questions]);
  const sources = useMemo(() => uniqueSorted(questions.map((question) => question.source)), [questions]);
  const types = useMemo(() => typeOptions(questions), [questions]);

  const visibleQuestions = useMemo(() => {
    const matchesFilters = (question: Question) =>
      (!chapter || question.chapter === chapter) &&
      (!type || question.type === type) &&
      (!source || question.source === source) &&
      questionMatches(question, keyword);

    if (mode === "mock") return mockQuestions.length ? mockQuestions : [];
    if (mode === "wrong" || mode === "review") {
      if (!queueIds) return [];
      const byId = new Map(questions.map((question) => [question.id, question]));
      return queueIds
        .map((id) => byId.get(id))
        .filter((question): question is Question => Boolean(question))
        .filter(matchesFilters);
    }
    const filtered = questions.filter((question) => {
      if (mode === "favorite" && !progress.favorites[question.id]) return false;
      return matchesFilters(question);
    });
    if (mode === "study" || mode === "browse") {
      if (order === "interleave") return interleaveByType(filtered);
      if (order === "random") return shuffle(filtered, orderSeed);
    }
    return filtered;
  }, [chapter, keyword, mockQuestions, mode, order, orderSeed, progress.favorites, queueIds, questions, source, type]);

  useEffect(() => {
    setIndex((current) => normalizeIndex(current, visibleQuestions.length));
  }, [visibleQuestions.length]);

  const current = visibleQuestions[index];
  const doneCount = Object.keys(progress.details).filter((id) => progress.details[id]?.attempts > 0 || progress.answers[id] !== undefined).length;
  const wrongCount = Object.keys(progress.wrong).length;
  const favoriteCount = Object.keys(progress.favorites).length;
  const reviewCount = questions.filter((question) => isReviewDue(progress.details[question.id])).length;
  const masteredCount = questions.filter((question) => masteryLevel(progress.details[question.id]) === "mastered").length;
  const statEntries = buildStatEntries({
    total: questions.length,
    done: doneCount,
    wrong: wrongCount,
    extraLabel: "今日复习/已掌握",
    extraValue: `${reviewCount}/${masteredCount}`
  });
  const answerItems: AnswerCardItem[] = visibleQuestions.map((question, i) => {
    const state = answerState(question);
    return {
      id: question.id,
      index: i + 1,
      label: String(i + 1),
      type: question.type,
      pending: state.pending,
      done: state.done,
      correct: state.correct,
      wrong: state.wrong,
      marked: Boolean(progress.favorites[question.id]),
      reviewDue: isReviewDue(progress.details[question.id]),
      stem: question.stem
    };
  });
  const answerSummary = buildAnswerSummary(answerItems);
  const currentIndex = Math.max(0, visibleQuestions.findIndex((question) => question.id === current?.id));
  const canFloat = useDesktopFloating();
  const showMockResult = mode === "mock" && mockSubmitted && !mockReviewing;
  const hasAnswerPanels = mode !== "browse" && visibleQuestions.length > 1 && !showMockResult;
  const showAnswerMetrics = hasAnswerPanels && mode !== "mock";
  const answerFloatingConfigs = showAnswerMetrics
    ? ANSWER_FLOATING_CONFIGS
    : hasAnswerPanels && mode === "mock"
      ? [ANSWER_FLOATING_CONFIGS[5]]
      : [];
  const floatingConfigs = [
    ...BASE_FLOATING_CONFIGS,
    ...(mode === "mock" && !showMockResult ? [MOCK_FLOATING_CONFIG] : []),
    ...answerFloatingConfigs
  ];

  function draftValue(question: Question) {
    if (drafts[question.id] !== undefined) return drafts[question.id];
    if (mode === "mock") return question.type === "multiple" ? [] : "";
    if (mode === "wrong" || mode === "review") return question.type === "multiple" ? [] : "";
    return drafts[question.id] ?? progress.answers[question.id] ?? (question.type === "multiple" ? [] : "");
  }

  function hasAnswerValue(question: Question, value: unknown) {
    if (question.type === "multiple") return Array.isArray(value) && value.length > 0;
    if (value === null || value === undefined) return false;
    return String(value).trim().length > 0;
  }

  function answerState(question: Question) {
    const stored = progress.answers[question.id];
    const draft = drafts[question.id];
    const value = draft !== undefined ? draft : stored;
    if (mode === "mock") {
      const correct = isAnswerCorrect(question, value);
      return {
        pending: !mockSubmitted && hasAnswerValue(question, value),
        done: mockSubmitted,
        correct: mockSubmitted && correct,
        wrong: mockSubmitted && !correct
      };
    }
    const done = stored !== undefined;
    return {
      pending: !done && hasAnswerValue(question, draft),
      done,
      correct: done && !progress.wrong[question.id],
      wrong: Boolean(progress.wrong[question.id])
    };
  }

  function updateDraft(question: Question, value: unknown) {
    setDrafts((prev) => ({ ...prev, [question.id]: value }));
  }

  function submit(question: Question, value = draftValue(question), showAnalysis = true) {
    const wrong = !isAnswerCorrect(question, value);
    setProgress((prev) => recordQuestionAttempt(prev, question.id, value, !wrong));
    setRevealed((prev) => ({ ...prev, [question.id]: true }));
    if (showAnalysis) setAnalysisRevealed((prev) => ({ ...prev, [question.id]: true }));
  }

  function updateAnswer(question: Question, value: unknown) {
    updateDraft(question, value);
    // Single/judge questions give instant feedback; multiple-choice needs an
    // explicit submit so picking the first option is not judged prematurely.
    if (mode === "study" && isChoice(question.type) && question.type !== "multiple") {
      submit(question, value, false);
    }
  }

  function showQuestionAnalysis(question: Question) {
    if (!revealed[question.id] && mode !== "browse" && !(mode === "mock" && mockSubmitted)) {
      submit(question, draftValue(question), true);
      return;
    }
    setAnalysisRevealed((prev) => ({ ...prev, [question.id]: true }));
  }

  function markQuestionUncertain(question: Question) {
    setProgress((prev) => markUncertain(prev, question.id));
    setRevealed((prev) => ({ ...prev, [question.id]: true }));
    setAnalysisRevealed((prev) => ({ ...prev, [question.id]: true }));
  }

  function reset(question: Question) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setRevealed((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setAnalysisRevealed((prev) => {
      const next = { ...prev };
      delete next[question.id];
      return next;
    });
    setProgress((prev) => {
      const next: ProgressState = {
        ...prev,
        answers: { ...prev.answers },
        wrong: { ...prev.wrong },
        review: { ...prev.review }
      };
      delete next.answers[question.id];
      delete next.wrong[question.id];
      delete next.review[question.id];
      return next;
    });
  }

  function toggleFavorite(question: Question) {
    setProgress((prev) => {
      const favorites = { ...prev.favorites };
      if (favorites[question.id]) delete favorites[question.id];
      else favorites[question.id] = true;
      const detail = prev.details[question.id];
      return {
        ...prev,
        favorites,
        details: detail ? { ...prev.details, [question.id]: { ...detail, isFavorite: Boolean(favorites[question.id]) } } : prev.details
      };
    });
  }

  function updateMemoryHint(question: Question) {
    const value = memoryHints[question.id] || "";
    setProgress((prev) => saveMemoryHint(prev, question.id, value));
    setMemoryHints((prev) => ({ ...prev, [question.id]: "" }));
  }

  function startMock() {
    const picked = orderMockQuestions(buildMockExam(questions, subject.mockExam));
    const startedAt = new Date().toISOString();
    setMockQuestions(picked);
    setMockSubmitted(false);
    setMockStartedAt(startedAt);
    setMockResult(null);
    setMockReviewing(false);
    setDrafts({});
    setRevealed({});
    setAnalysisRevealed({});
    setMode("mock");
    setIndex(0);
  }

  function submitMock() {
    if (!mockQuestions.length || mockSubmitted) return;
    const confirmed = window.confirm("确认交卷吗？交卷后将统一判分并显示答案解析。");
    if (!confirmed) return;
    const submittedAnswers = Object.fromEntries(mockQuestions.map((question) => [question.id, draftValue(question)]));
    const { score, totalScore, typeScores } = scoreMockExam(mockQuestions, submittedAnswers, subject.mockExam);
    const submittedAt = new Date();
    const startedAt = mockStartedAt || submittedAt.toISOString();
    const completed = mockQuestions.filter((question) => hasAnswerValue(question, submittedAnswers[question.id])).length;
    const durationSeconds = Math.max(0, Math.round((submittedAt.getTime() - new Date(startedAt).getTime()) / 1000));
    const wrongIds = mockQuestions
      .filter((question) => !isAnswerCorrect(question, submittedAnswers[question.id]))
      .map((question) => question.id);
    const result: MockResult = {
      title: subject.mockExam?.title || "随机练习卷",
      subjectTitle: subject.title,
      score,
      totalScore,
      completed,
      total: mockQuestions.length,
      startedAt,
      submittedAt: submittedAt.toISOString(),
      durationSeconds,
      typeScores,
      wrongIds
    };
    setMockSubmitted(true);
    setMockResult(result);
    setMockReviewing(false);
    setIndex(0);
    setProgress((prev) => {
      let next = prev;
      mockQuestions.forEach((question) => {
        next = recordQuestionAttempt(next, question.id, submittedAnswers[question.id], isAnswerCorrect(question, submittedAnswers[question.id]), submittedAt);
      });
      return {
        ...next,
        mockRuns: [
          {
            id: `mock-${Date.now()}`,
            title: result.title,
            subjectTitle: subject.title,
            questionIds: mockQuestions.map((question) => question.id),
            score,
            totalScore,
            submittedAt: result.submittedAt,
            startedAt: result.startedAt,
            durationSeconds,
            completed,
            total: mockQuestions.length
          },
          ...next.mockRuns
        ].slice(0, 20)
      };
    });
  }

  function jumpToQuestion(id: string) {
    setIndex(Math.max(0, visibleQuestions.findIndex((question) => question.id === id)));
  }

  function reviewMockQuestion(id: string) {
    setMockReviewing(true);
    setIndex(Math.max(0, mockQuestions.findIndex((question) => question.id === id)));
  }

  const subjectHead = (
    <section className="subject-head">
      <h1>{subject.title}练习系统</h1>
      <p>{subject.description}</p>
    </section>
  );

  function renderModeTabs(layoutSelect?: ReactNode) {
    const items: Array<[Mode, string]> = [
      ["study", "学习模式"],
      ["mock", "模拟考试"],
      ["browse", "题库浏览"],
      ["wrong", `错题本 ${wrongCount}`],
      ["favorite", `收藏 ${favoriteCount}`],
      ["review", `今日复习 ${reviewCount}`]
    ];
    return (
      <div className="mode-tabs">
        {items.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={mode === key ? "active" : ""}
            onClick={() => {
              if (key === "mock") startMock();
              else {
                setMode(key);
                setIndex(0);
              }
            }}
          >
            {label}
          </button>
        ))}
        {layoutSelect}
      </div>
    );
  }

  const chapterFilter = (
    <select value={chapter} onChange={(event) => { setChapter(event.target.value); setIndex(0); }}>
      <option value="">全部章节</option>
      {chapters.map((item) => <option key={item}>{item}</option>)}
    </select>
  );

  const typeFilter = (
    <select value={type} onChange={(event) => { setType(event.target.value); setIndex(0); }}>
      <option value="">全部题型</option>
      {types.map((item) => <option key={item} value={item}>{TYPE_LABEL[item as QuestionType] || item}</option>)}
    </select>
  );

  const sourceFilter = (
    <select value={source} onChange={(event) => { setSource(event.target.value); setIndex(0); }}>
      <option value="">全部来源</option>
      {sources.map((item) => <option key={item}>{item}</option>)}
    </select>
  );

  const searchFilter = (
    <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setIndex(0); }} placeholder="搜索题干 / 答案 / 标签" />
  );

  const orderFilter = mode === "study" || mode === "browse" ? (
    <select
      value={order}
      aria-label="练习顺序"
      onChange={(event) => {
        const next = event.target.value as QuestionOrder;
        if (next === "random") setOrderSeed(Date.now());
        setOrder(next);
        setIndex(0);
      }}
    >
      <option value="default">顺序：题库顺序</option>
      <option value="interleave">顺序：题型交错</option>
      <option value="random">顺序：随机打乱</option>
    </select>
  ) : null;

  const filters = mode !== "mock" ? (
    <div className="filters">
      {chapterFilter}
      {typeFilter}
      {sourceFilter}
      {searchFilter}
      {orderFilter}
    </div>
  ) : null;

  const mockStrip = mode === "mock" && !showMockResult ? (
    <section className="mock-strip">
      <div>
        <b>{subject.mockExam?.title || "随机练习卷"}</b>
        <span>{mockQuestions.length} 题</span>
      </div>
      <button type="button" className="primary" onClick={submitMock} disabled={!mockQuestions.length || mockSubmitted}>
        {mockSubmitted ? "已交卷" : "交卷/记录成绩"}
      </button>
      {mockSubmitted && progress.mockRuns[0] ? <strong>{progress.mockRuns[0].score} / {progress.mockRuns[0].totalScore}</strong> : null}
    </section>
  ) : null;

  const currentState = current ? answerState(current) : null;

  const mockResultPanel = mockResult ? (
    <section className="mock-result">
      <div className="mock-result__head">
        <div>
          <p>模拟考试结果</p>
          <h2>{mockResult.subjectTitle}</h2>
        </div>
        <strong>{mockResult.score} / {mockResult.totalScore}</strong>
      </div>
      <dl className="mock-result__grid">
        <div>
          <dt>试卷</dt>
          <dd>{mockResult.title}</dd>
        </div>
        <div>
          <dt>完成</dt>
          <dd>{mockResult.completed} / {mockResult.total}</dd>
        </div>
        <div>
          <dt>测试时长</dt>
          <dd>{formatDuration(mockResult.durationSeconds)}</dd>
        </div>
        <div>
          <dt>测试时间</dt>
          <dd>{formatDateTime(mockResult.submittedAt)}</dd>
        </div>
      </dl>
      <section className="mock-result__types">
        <h3>题型得分</h3>
        <table>
          <thead>
            <tr><th>题型</th><th>答对</th><th>得分</th><th>正确率</th></tr>
          </thead>
          <tbody>
            {mockResult.typeScores.map((entry) => (
              <tr key={entry.type}>
                <td>{TYPE_LABEL[entry.type]}</td>
                <td>{entry.correct} / {entry.total}</td>
                <td>{entry.score} / {entry.totalScore}</td>
                <td>{entry.total ? Math.round((entry.correct / entry.total) * 100) : 0}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {mockResult.wrongIds.length ? (
        <section className="mock-result__wrong">
          <h3>错题回顾（{mockResult.wrongIds.length} 题）</h3>
          <div className="mock-result__wrong-list">
            {mockResult.wrongIds.map((id) => {
              const questionIndex = mockQuestions.findIndex((question) => question.id === id);
              if (questionIndex < 0) return null;
              return (
                <button key={id} type="button" onClick={() => reviewMockQuestion(id)}>
                  第 {questionIndex + 1} 题 · {TYPE_LABEL[mockQuestions[questionIndex].type]}
                </button>
              );
            })}
          </div>
          <p className="mock-result__note">错题已进入错题本和复习队列，建议交卷后立即重看一遍。</p>
        </section>
      ) : (
        <p className="mock-result__note">全部答对，太棒了！</p>
      )}
      <div className="question-actions">
        <button type="button" className="primary" onClick={() => setMockReviewing(true)}>考试回顾</button>
        <button type="button" onClick={startMock}>重新组卷</button>
      </div>
    </section>
  ) : (
    <section className="empty-state">暂无考试结果。</section>
  );

  const questionPanel = current ? (
    <QuestionCard
      question={current}
      index={index}
      total={visibleQuestions.length}
      value={draftValue(current)}
      answered={Boolean(currentState?.done)}
      pending={Boolean(currentState?.pending)}
      wrong={Boolean(currentState?.wrong)}
      favorite={Boolean(progress.favorites[current.id])}
      reveal={mode === "mock" ? mockSubmitted && mockReviewing : mode === "browse" || Boolean(revealed[current.id])}
      showAnalysis={mode === "mock" ? mockSubmitted && mockReviewing : mode === "browse" || Boolean(analysisRevealed[current.id])}
      showAnalysisButton={mode !== "mock" && mode !== "browse" && !analysisRevealed[current.id]}
      locked={mode === "mock" && mockSubmitted}
      showSubmit={mode === "wrong" || mode === "favorite" || mode === "review" || (mode === "study" && (current.type === "multiple" || !isChoice(current.type)))}
      showFavorite={mode !== "mock"}
      showReset={mode !== "mock"}
      allowReset={mode !== "mock"}
      showUncertain={mode !== "mock" && mode !== "browse"}
      detail={progress.details[current.id]}
      memoryHintDraft={memoryHints[current.id] || ""}
      onChange={(value) => updateAnswer(current, value)}
      onMemoryHintChange={(value) => setMemoryHints((prev) => ({ ...prev, [current.id]: value }))}
      onSaveMemoryHint={() => updateMemoryHint(current)}
      onSubmit={() => submit(current, draftValue(current), !isObjective(current.type))}
      onShowAnalysis={() => showQuestionAnalysis(current)}
      onUncertain={() => markQuestionUncertain(current)}
      onReset={() => reset(current)}
      onFavorite={() => toggleFavorite(current)}
      onPrev={() => setIndex((value) => normalizeIndex(value - 1, visibleQuestions.length))}
      onNext={() => setIndex((value) => normalizeIndex(value + 1, visibleQuestions.length))}
    />
  ) : (
    <section className="empty-state">
      {mode === "review"
        ? "今日没有到期的复习题。答错或标记“我不确定”的题目会按记忆间隔自动进入这里。"
        : mode === "wrong"
          ? "错题本是空的，继续保持！"
          : mode === "favorite"
            ? "还没有收藏的题目。在题目下方点击“收藏本题”即可加入。"
            : "没有匹配题目。"}
    </section>
  );
  const mainPanel = showMockResult ? mockResultPanel : questionPanel;

  if (loadError) {
    return <main className="practice-layout"><section className="empty-state">题库加载失败：{loadError}</section></main>;
  }

  return (
    <FloatingLayoutProvider subjectId={subject.id}>
      {(layout) => {
        const floatingActive = layout.enabled && canFloat;

        const questionRect = layout.state.panels.question?.rect;
        const missingFloatingPanels = floatingConfigs.some((config) => !layout.state.panels[config.id]?.rect);
        const badQuestionRect = !questionRect ||
          questionRect.width < 360 ||
          questionRect.x < 80 ||
          questionRect.y < 96 ||
          questionRect.x + questionRect.width > window.innerWidth - 8 ||
          questionRect.y + Math.min(questionRect.height, 260) > window.innerHeight - 8;
        const enableFloating = () => {
          if (missingFloatingPanels || badQuestionRect) layout.autoArrange(floatingConfigs);
          layout.setEnabled(true);
        };
        const resetFloatingLayout = () => {
          layout.reset();
        };
        const renderLayoutSelect = () => canFloat ? (
          <label className="layout-select">
            <select
              aria-label="布局"
              value={floatingActive ? "floating" : "classic"}
              onChange={(event) => {
                const action = event.target.value;
                if (action === "classic") layout.setEnabled(false);
                if (action === "floating") enableFloating();
                if (action === "focus") layout.focusQuestion(floatingPanels.map((panel) => panel.config));
                if (action === "reset") resetFloatingLayout();
              }}
            >
              <option value="classic">布局：经典布局</option>
              <option value="floating">布局：浮动布局</option>
              {floatingActive ? <option value="focus">布局：整理窗口</option> : null}
              <option value="reset">布局：重置布局</option>
            </select>
          </label>
        ) : null;
        const modeTabs = renderModeTabs(renderLayoutSelect());
        const floatingPanels = [
          { id: "subject", title: "题头", config: BASE_FLOATING_CONFIGS[0], node: subjectHead },
          ...statEntries.map((item, statIndex) => ({
            id: `stat-${item.id}`,
            title: item.label,
            config: BASE_FLOATING_CONFIGS[statIndex + 1],
            node: <StatCard label={item.label} value={item.value} />
          })),
          { id: "mode-tabs", title: "模式", config: BASE_FLOATING_CONFIGS[6], node: modeTabs },
          ...(mode !== "mock" ? [
            { id: "filter-chapter", title: "章节", config: BASE_FLOATING_CONFIGS[7], node: <div className="floating-filter">{chapterFilter}</div> },
            { id: "filter-type", title: "题型", config: BASE_FLOATING_CONFIGS[8], node: <div className="floating-filter">{typeFilter}</div> },
            { id: "filter-source", title: "来源", config: BASE_FLOATING_CONFIGS[9], node: <div className="floating-filter">{sourceFilter}</div> },
            { id: "filter-search", title: "搜索", config: BASE_FLOATING_CONFIGS[10], node: <div className="floating-filter">{searchFilter}</div> },
            ...(orderFilter ? [{ id: "filter-order", title: "顺序", config: BASE_FLOATING_CONFIGS[12], node: <div className="floating-filter">{orderFilter}</div> }] : [])
          ] : []),
          ...(mode === "mock" && mockStrip ? [{ id: "mock-strip", title: "模拟考试", config: MOCK_FLOATING_CONFIG, node: mockStrip }] : []),
          { id: "question", title: showMockResult ? "考试结果" : "题目", config: BASE_FLOATING_CONFIGS[11], node: mainPanel },
          ...(showAnswerMetrics ? [
            { id: "answer-done", title: "已做", config: ANSWER_FLOATING_CONFIGS[0], node: <dl className="answer-card__summary single"><AnswerMetric label="已做" value={answerSummary.done} /></dl> },
            { id: "answer-correct", title: "正确", config: ANSWER_FLOATING_CONFIGS[1], node: <dl className="answer-card__summary single"><AnswerMetric label="正确" value={answerSummary.correct} /></dl> },
            { id: "answer-wrong", title: "错误", config: ANSWER_FLOATING_CONFIGS[2], node: <dl className="answer-card__summary single"><AnswerMetric label="错误" value={answerSummary.wrong} /></dl> },
            { id: "answer-marked", title: "收藏", config: ANSWER_FLOATING_CONFIGS[3], node: <dl className="answer-card__summary single"><AnswerMetric label="收藏" value={answerSummary.marked} /></dl> },
            { id: "answer-review", title: "待复习", config: ANSWER_FLOATING_CONFIGS[4], node: <dl className="answer-card__summary single"><AnswerMetric label="待复习" value={answerSummary.review} /></dl> },
            {
              id: "answer-nearby",
              title: "附近题号",
              config: ANSWER_FLOATING_CONFIGS[5],
              node: (
                <section className="answer-card__section floating-answer-section">
                  <p>第 {visibleQuestions.length ? currentIndex + 1 : 0} / {visibleQuestions.length} 题</p>
                  <NearbyQuestionGrid items={answerItems} currentId={current?.id} onJump={jumpToQuestion} />
                </section>
              )
            },
            { id: "answer-full", title: "完整答题卡", config: ANSWER_FLOATING_CONFIGS[6], node: <FullAnswerCardControl items={answerItems} currentId={current?.id} onJump={jumpToQuestion} /> },
            { id: "answer-legend", title: "图例", config: ANSWER_FLOATING_CONFIGS[7], node: <AnswerCardLegend /> }
          ] : hasAnswerPanels && mode === "mock" ? [
            {
              id: "answer-nearby",
              title: "答题卡",
              config: ANSWER_FLOATING_CONFIGS[5],
              node: <QuestionNumberCard items={answerItems} currentId={current?.id} onJump={jumpToQuestion} />
            }
          ] : [])
        ];

        if (!floatingActive) {
          return (
            <main className={`practice-layout${mode === "browse" ? " no-card" : ""}`}>
              {subjectHead}
              <StatPanel total={questions.length} done={doneCount} wrong={wrongCount} extraLabel="今日复习/已掌握" extraValue={`${reviewCount}/${masteredCount}`} />
              <section className="toolbar">
                {modeTabs}
                {filters}
              </section>
              {mockStrip}
              <div className="practice-content">
                <section className="question-zone">{mainPanel}</section>
                {hasAnswerPanels ? (
                  mode === "mock"
                    ? <QuestionNumberCard items={answerItems} currentId={current?.id} onJump={jumpToQuestion} />
                    : <AnswerCard items={answerItems} currentId={current?.id} onJump={jumpToQuestion} />
                ) : null}
              </div>
            </main>
          );
        }

        return (
          <main className="practice-layout floating-layout">
            <div className="floating-stage" aria-label="浮动练习面板">
              {floatingPanels.map((panel) => (
                <FloatingPanel
                  key={panel.id}
                  id={panel.id}
                  title={panel.title}
                  config={panel.config}
                  state={layout.state.panels[panel.id]}
                  onUpdate={layout.updatePanel}
                  onRect={(id, rect) => layout.patchPanelRect(id, rect, floatingConfigs)}
                  onBringToFront={layout.bringToFront}
                  onHide={layout.hidePanel}
                >
                  {panel.node}
                </FloatingPanel>
              ))}
            </div>
            <RestoreTray
              items={floatingPanels.map((panel) => ({ id: panel.id, title: panel.title, hidden: Boolean(layout.state.panels[panel.id]?.hidden) }))}
              onRestore={layout.restorePanel}
            />
          </main>
        );
      }}
    </FloatingLayoutProvider>
  );
}
