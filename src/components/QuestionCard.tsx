import { answerText, isAnswerCorrect, isChoice, isObjective, TYPE_LABEL } from "../lib/questions";
import { MASTERY_LABEL, masteryLevel } from "../lib/progress";
import type { Question, QuestionProgress } from "../lib/types";
import { MarkdownText } from "./MarkdownText";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  value: unknown;
  answered: boolean;
  pending?: boolean;
  wrong: boolean;
  favorite: boolean;
  reveal: boolean;
  showAnalysis?: boolean;
  showAnalysisButton?: boolean;
  locked?: boolean;
  showSubmit?: boolean;
  showFavorite?: boolean;
  showReset?: boolean;
  allowReset?: boolean;
  showUncertain?: boolean;
  detail?: QuestionProgress;
  memoryHintDraft: string;
  onChange: (value: unknown) => void;
  onMemoryHintChange: (value: string) => void;
  onSaveMemoryHint: () => void;
  onSubmit: () => void;
  onShowAnalysis: () => void;
  onUncertain?: () => void;
  onReset: () => void;
  onFavorite: () => void;
  onPrev: () => void;
  onNext: () => void;
}

function optionEntries(question: Question) {
  return Object.entries(question.options || {});
}

function selected(value: unknown, key: string): boolean {
  return Array.isArray(value) ? value.includes(key) : value === key;
}

// Extracts per-option reasons from analyses written as "A：xxx" lines.
function optionReasons(question: Question): Record<string, string> {
  const out: Record<string, string> = {};
  if (!question.analysis || !question.options) return out;
  question.analysis.split(/\n+/).forEach((line) => {
    const match = line.trim().match(/^([A-H])\s*[：:、.．]\s*(.+)$/);
    if (!match || !(match[1] in (question.options || {}))) return;
    const reason = match[2].trim();
    if (/^(正确|错误)[。.!！]?$/.test(reason)) return;
    out[match[1]] = reason;
  });
  return out;
}

// First sentence of the analysis, used as a short hint before the full analysis is expanded.
function analysisSnippet(analysis?: string): string {
  const text = String(analysis || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const match = text.match(/^[^。！？!?]*[。！？!?]?/);
  const first = (match ? match[0] : text).trim();
  if (!first) return "";
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
}

function displayAnswerText(question: Question): string {
  if (isChoice(question.type)) {
    const correct = question.correct || [];
    if (!correct.length) return answerText(question);
    return correct.map((key) => {
      const optionText = question.options?.[key];
      return optionText ? `${key}. ${optionText}` : key;
    }).join("\n");
  }
  return answerText(question);
}

const MASTERY_CLASS: Record<string, string> = {
  weak: "badge-danger",
  learning: "badge-info",
  mastered: "badge-success"
};

export function QuestionCard(props: QuestionCardProps) {
  const {
    question,
    index,
    total,
    value,
    answered,
    pending = false,
    wrong,
    favorite,
    reveal,
    showAnalysis = reveal,
    showAnalysisButton = false,
    locked = false,
    showSubmit = true,
    showFavorite = true,
    showReset = true,
    allowReset = true,
    showUncertain = false
  } = props;
  const showAnswer = reveal;
  const correct = isAnswerCorrect(question, value);
  const canShowMemoryHint = showAnalysis && props.detail?.memoryHint;
  const imageIsReference = question.meta?.correctedFromImage === true;
  const mastery = masteryLevel(props.detail);
  const needsReview = question.meta?.needsReview === true;
  const reasons = showAnswer ? optionReasons(question) : {};
  const snippet = showAnswer && !showAnalysis ? analysisSnippet(question.analysis) : "";
  const correctAnswer = displayAnswerText(question) || "见解析";

  return (
    <article className="question-card">
      <div className="question-meta">
        <span>第 {index + 1} / {total} 题</span>
        {question.source ? <span>{question.source}</span> : null}
        {question.chapter ? <span>{question.chapter}</span> : null}
        <span>{TYPE_LABEL[question.type]}</span>
        {mastery !== "new" ? <span className={MASTERY_CLASS[mastery]}>{MASTERY_LABEL[mastery]}</span> : null}
        {answered ? <span className={wrong ? "badge-danger" : "badge-success"}>{wrong ? "上次错误" : "已做"}</span> : null}
        {!answered && pending ? <span className="badge-info">已选择</span> : null}
        {favorite ? <span className="badge-warning">已收藏</span> : null}
        {needsReview ? <span className="badge-warning" title="该题在题库审计中被标记，答案或选项可能有误">待人工复核</span> : null}
      </div>
      {canShowMemoryHint ? <p className="memory-hint">你的记忆提示：{props.detail?.memoryHint}</p> : null}
      <div className="question-stem">
        <MarkdownText value={question.stem} />
      </div>
      {question.image ? (
        imageIsReference ? (
          <details className="source-image">
            <summary>查看原截图</summary>
            <img className="question-image" src={question.image} alt="题目原截图" />
          </details>
        ) : (
          <img className="question-image" src={question.image} alt="题目配图" />
        )
      ) : null}

      {isChoice(question.type) ? (
        <div className="options">
          {optionEntries(question).map(([key, text]) => {
            const picked = selected(value, key);
            const isRight = question.correct?.includes(key);
            const reason = showAnswer && (isRight || picked) ? reasons[key] : "";
            const className = [
              "option",
              picked ? "picked" : "",
              showAnswer && isRight ? "correct" : "",
              showAnswer && picked && !isRight ? "wrong" : ""
            ].filter(Boolean).join(" ");
            return (
              <button
                key={key}
                type="button"
                className={className}
                disabled={locked}
                onClick={() => {
                  if (locked) return;
                  if (question.type === "multiple") {
                    const current = Array.isArray(value) ? value.map(String) : [];
                    props.onChange(current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort());
                  } else {
                    props.onChange(key);
                  }
                }}
              >
                <b className="option-letter">{key}</b>
                <div className="option-text">
                  <MarkdownText value={text} compact />
                  {reason ? <span className="option-reason"><MarkdownText value={reason} compact /></span> : null}
                </div>
                {showAnswer && isRight ? <em>正确答案</em> : null}
                {showAnswer && picked && !isRight ? <em>你的选择</em> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          className="text-answer"
          value={String(value ?? "")}
          readOnly={locked}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={question.type === "fill" ? "先主动回忆再填写答案" : "先写下你的答案或思路，再对照解析"}
        />
      )}

      {showAnswer && !showAnalysis && isObjective(question.type) ? (
        <section className={`quick-feedback ${correct ? "ok" : "bad"}`}>
          <strong>{correct ? "答对了" : "答错了"}</strong>
          <div className="quick-feedback__answer">
            <span>正确答案：</span>
            <MarkdownText value={correctAnswer} compact />
          </div>
          {snippet ? (
            <span className="quick-feedback__hint">
              <MarkdownText value={snippet} compact />
            </span>
          ) : null}
        </section>
      ) : null}

      <div className="question-actions">
        {showSubmit ? <button type="button" className="primary" onClick={props.onSubmit}>提交答案</button> : null}
        {showUncertain && !showAnswer ? (
          <button type="button" className="uncertain" onClick={props.onUncertain} title="不计对错，加入待复习队列并显示答案">
            我不确定
          </button>
        ) : null}
        {showAnalysisButton ? <button type="button" className={showAnswer ? "" : "primary"} onClick={props.onShowAnalysis}>答案解析</button> : null}
        {showFavorite ? <button type="button" onClick={props.onFavorite}>{favorite ? "取消收藏" : "收藏本题"}</button> : null}
        {showReset ? <button type="button" onClick={props.onReset} disabled={!allowReset}>重做本题</button> : null}
        <button type="button" onClick={props.onPrev}>上一题</button>
        <button type="button" onClick={props.onNext}>下一题</button>
      </div>

      {showAnalysis ? (
        <section className={`analysis ${isObjective(question.type) ? (wrong || !correct ? "bad" : "ok") : ""}`}>
          <div className="analysis__result">
            <strong>{isObjective(question.type) ? (wrong || !correct ? "本题答错" : "本题答对") : "参考答案"}</strong>
            {isObjective(question.type) ? (
              <>
                <div>
                  <span>你的答案：</span>
                  <MarkdownText value={String(Array.isArray(value) ? value.join("") : value || "未填写")} compact />
                </div>
                <div>
                  <span>正确答案：</span>
                  <MarkdownText value={correctAnswer} compact />
                </div>
              </>
            ) : (
              <div className="analysis__answer-block">
                <MarkdownText value={correctAnswer} />
              </div>
            )}
          </div>
          <div className="analysis__block">
            <h3>解析</h3>
            <MarkdownText value={question.analysis || "题库暂未提供详细解析，先记住正确答案，并在下次复习时主动回忆判断依据。"} />
          </div>
          <div className="analysis__block">
            <h3>记忆提示</h3>
            <div className="memory-input">
              <input
                value={props.memoryHintDraft}
                maxLength={20}
                onChange={(event) => props.onMemoryHintChange(event.target.value)}
                placeholder="10 个字以内写判断依据"
              />
              <button type="button" onClick={props.onSaveMemoryHint}>保存提示</button>
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}
