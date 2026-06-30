import { useEffect, useMemo, useState } from "react";
import { AnswerCard } from "../components/AnswerCard";
import { QuestionCard } from "../components/QuestionCard";
import { StatPanel } from "../components/StatPanel";
import {
  buildMockExam,
  isAnswerCorrect,
  questionMatches,
  scoreMockExam,
  TYPE_LABEL,
  uniqueSorted
} from "../lib/questions";
import {
  isReviewDue,
  loadLocalProgress,
  loadRemoteSnapshot,
  migrateSnapshotProgress,
  recordQuestionAttempt,
  saveLocalProgress,
  saveMemoryHint,
  saveRemoteSnapshot
} from "../lib/progress";
import { loadQuestions } from "../lib/registry";
import type { AnswerCardItem, ProgressState, Question, QuestionType, Subject, SubjectDirectory } from "../lib/types";

type Mode = "study" | "browse" | "wrong" | "favorite" | "review" | "mock";

interface PracticePageProps {
  directory: SubjectDirectory;
  subject: Subject;
}

const EMPTY_PROGRESS: ProgressState = { answers: {}, wrong: {}, favorites: {}, review: {}, details: {}, mockRuns: [] };

function pageAppName() {
  return decodeURIComponent(location.pathname.split("/").pop() || "index.html");
}

function normalizeIndex(index: number, total: number) {
  if (!total) return 0;
  if (index < 0) return total - 1;
  if (index >= total) return 0;
  return index;
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

export function PracticePage({ subject }: PracticePageProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<Mode>("study");
  const [chapter, setChapter] = useState("");
  const [type, setType] = useState("");
  const [source, setSource] = useState("");
  const [keyword, setKeyword] = useState("");
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
  const [memoryHints, setMemoryHints] = useState<Record<string, string>>({});
  const [mockQuestions, setMockQuestions] = useState<Question[]>([]);
  const [mockSubmitted, setMockSubmitted] = useState(false);
  const [syncReady, setSyncReady] = useState(false);

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
    const base = mode === "mock" && mockQuestions.length ? mockQuestions : questions;
    return base.filter((question) => {
      if (mode === "wrong" && !progress.wrong[question.id]) return false;
      if (mode === "favorite" && !progress.favorites[question.id]) return false;
      if (mode === "review" && !isReviewDue(progress.details[question.id])) return false;
      if (mode !== "mock") {
        if (chapter && question.chapter !== chapter) return false;
        if (type && question.type !== type) return false;
        if (source && question.source !== source) return false;
        if (!questionMatches(question, keyword)) return false;
      }
      return true;
    });
  }, [chapter, keyword, mockQuestions, mode, progress.favorites, progress.wrong, questions, source, type]);

  useEffect(() => {
    setIndex((current) => normalizeIndex(current, visibleQuestions.length));
  }, [visibleQuestions.length]);

  const current = visibleQuestions[index];
  const doneCount = Object.keys(progress.details).filter((id) => progress.details[id]?.attempts > 0 || progress.answers[id] !== undefined).length;
  const wrongCount = Object.keys(progress.wrong).length;
  const favoriteCount = Object.keys(progress.favorites).length;
  const reviewCount = questions.filter((question) => isReviewDue(progress.details[question.id])).length;
  const answerItems: AnswerCardItem[] = visibleQuestions.map((question, i) => ({
    id: question.id,
    index: i + 1,
    label: String(i + 1),
    type: question.type,
    done: progress.answers[question.id] !== undefined,
    correct: progress.answers[question.id] !== undefined && !progress.wrong[question.id],
    wrong: Boolean(progress.wrong[question.id]),
    marked: Boolean(progress.favorites[question.id]),
    reviewDue: isReviewDue(progress.details[question.id]),
    stem: question.stem
  }));

  function draftValue(question: Question) {
    if (drafts[question.id] !== undefined) return drafts[question.id];
    if (mode === "wrong" || mode === "review") return question.type === "multiple" ? [] : "";
    return drafts[question.id] ?? progress.answers[question.id] ?? (question.type === "multiple" ? [] : "");
  }

  function updateDraft(question: Question, value: unknown) {
    setDrafts((prev) => ({ ...prev, [question.id]: value }));
  }

  function submit(question: Question) {
    const value = draftValue(question);
    const wrong = !isAnswerCorrect(question, value);
    setProgress((prev) => recordQuestionAttempt(prev, question.id, value, !wrong));
    setRevealed((prev) => ({ ...prev, [question.id]: true }));
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
    const picked = buildMockExam(questions, subject.mockExam);
    setMockQuestions(picked);
    setMockSubmitted(false);
    setMode("mock");
    setIndex(0);
  }

  function submitMock() {
    const { score, totalScore } = scoreMockExam(mockQuestions, progress.answers, subject.mockExam);
    setMockSubmitted(true);
    setProgress((prev) => ({
      ...prev,
      mockRuns: [
        {
          id: `mock-${Date.now()}`,
          title: subject.mockExam?.title || "随机练习卷",
          questionIds: mockQuestions.map((question) => question.id),
          score,
          totalScore,
          submittedAt: new Date().toISOString()
        },
        ...prev.mockRuns
      ].slice(0, 20)
    }));
  }

  if (loadError) {
    return <main className="practice-layout"><section className="empty-state">题库加载失败：{loadError}</section></main>;
  }

  return (
    <main className={`practice-layout${mode === "browse" ? " no-card" : ""}`}>
      <section className="subject-head">
        <h1>{subject.title}练习系统</h1>
        <p>{subject.description}</p>
      </section>

      <StatPanel
        total={questions.length}
        done={doneCount}
        wrong={wrongCount}
        extraLabel="题库/题型"
        extraValue={`${sources.length}/${types.length}`}
      />

      <section className="toolbar">
        <div className="mode-tabs">
          {[
            ["study", "学习模式"],
            ["browse", "题库浏览"],
            ["wrong", `错题本 ${wrongCount}`],
            ["favorite", `收藏 ${favoriteCount}`],
            ["review", `待复习 ${reviewCount}`]
          ].map(([key, label]) => (
            <button key={key} type="button" className={mode === key ? "active" : ""} onClick={() => { setMode(key as Mode); setIndex(0); }}>
              {label}
            </button>
          ))}
          <button type="button" className={mode === "mock" ? "active" : ""} onClick={startMock}>模拟考试</button>
        </div>
        {mode !== "mock" ? (
          <div className="filters">
            <select value={chapter} onChange={(event) => { setChapter(event.target.value); setIndex(0); }}>
              <option value="">全部章节</option>
              {chapters.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select value={type} onChange={(event) => { setType(event.target.value); setIndex(0); }}>
              <option value="">全部题型</option>
              {types.map((item) => <option key={item} value={item}>{TYPE_LABEL[item as QuestionType] || item}</option>)}
            </select>
            <select value={source} onChange={(event) => { setSource(event.target.value); setIndex(0); }}>
              <option value="">全部来源</option>
              {sources.map((item) => <option key={item}>{item}</option>)}
            </select>
            <input value={keyword} onChange={(event) => { setKeyword(event.target.value); setIndex(0); }} placeholder="搜索题干 / 答案 / 标签" />
          </div>
        ) : null}
      </section>

      {mode === "mock" ? (
        <section className="mock-strip">
          <div>
            <b>{subject.mockExam?.title || "随机练习卷"}</b>
            <span>{mockQuestions.length} 题</span>
          </div>
          <button type="button" className="primary" onClick={submitMock}>交卷/记录成绩</button>
          {mockSubmitted && progress.mockRuns[0] ? <strong>{progress.mockRuns[0].score} / {progress.mockRuns[0].totalScore}</strong> : null}
        </section>
      ) : null}

      <div className="practice-content">
        <section className="question-zone">
          {current ? (
            <QuestionCard
              question={current}
              index={index}
              total={visibleQuestions.length}
              value={draftValue(current)}
              answered={progress.answers[current.id] !== undefined}
              wrong={Boolean(progress.wrong[current.id])}
              favorite={Boolean(progress.favorites[current.id])}
              reveal={mode === "browse" || Boolean(revealed[current.id])}
              detail={progress.details[current.id]}
              memoryHintDraft={memoryHints[current.id] || ""}
              onChange={(value) => updateDraft(current, value)}
              onMemoryHintChange={(value) => setMemoryHints((prev) => ({ ...prev, [current.id]: value }))}
              onSaveMemoryHint={() => updateMemoryHint(current)}
              onSubmit={() => submit(current)}
              onReset={() => reset(current)}
              onFavorite={() => toggleFavorite(current)}
              onPrev={() => setIndex((value) => normalizeIndex(value - 1, visibleQuestions.length))}
              onNext={() => setIndex((value) => normalizeIndex(value + 1, visibleQuestions.length))}
            />
          ) : (
            <section className="empty-state">没有匹配题目。</section>
          )}
        </section>
        {mode !== "browse" && visibleQuestions.length > 1 ? (
          <AnswerCard
            items={answerItems}
            currentId={current?.id}
            onJump={(id) => setIndex(Math.max(0, visibleQuestions.findIndex((question) => question.id === id)))}
          />
        ) : null}
      </div>
    </main>
  );
}
