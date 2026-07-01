import { answerText, isAnswerCorrect, isChoice, isObjective, TYPE_LABEL } from "../lib/questions";
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
  locked?: boolean;
  showSubmit?: boolean;
  allowReset?: boolean;
  detail?: QuestionProgress;
  memoryHintDraft: string;
  onChange: (value: unknown) => void;
  onMemoryHintChange: (value: string) => void;
  onSaveMemoryHint: () => void;
  onSubmit: () => void;
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
    locked = false,
    showSubmit = true,
    allowReset = true
  } = props;
  const showAnswer = reveal;
  const correct = isAnswerCorrect(question, value);
  const canShowMemoryHint = showAnswer && props.detail?.memoryHint;
  const imageIsReference = question.meta?.correctedFromImage === true;

  return (
    <article className="question-card">
      <div className="question-meta">
        <span>第 {index + 1} / {total} 题</span>
        {question.source ? <span>{question.source}</span> : null}
        {question.chapter ? <span>{question.chapter}</span> : null}
        <span>{TYPE_LABEL[question.type]}</span>
        {answered ? <span className={wrong ? "badge-danger" : "badge-success"}>{wrong ? "上次错误" : "已做"}</span> : null}
        {!answered && pending ? <span className="badge-info">已选择</span> : null}
        {favorite ? <span className="badge-warning">已收藏</span> : null}
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
          placeholder={question.type === "fill" ? "填写答案" : "写下你的答案或思路"}
        />
      )}

      <div className="question-actions">
        {showSubmit ? <button type="button" className="primary" onClick={props.onSubmit}>提交/查看解析</button> : null}
        <button type="button" onClick={props.onFavorite}>{favorite ? "取消收藏" : "收藏本题"}</button>
        <button type="button" onClick={props.onReset} disabled={!allowReset}>重做本题</button>
        <button type="button" onClick={props.onPrev}>上一题</button>
        <button type="button" onClick={props.onNext}>下一题</button>
      </div>

      {showAnswer ? (
        <section className={`analysis ${isObjective(question.type) ? (wrong || !correct ? "bad" : "ok") : ""}`}>
          <div className="analysis__result">
            <strong>{isObjective(question.type) ? (wrong || !correct ? "本题答错" : "本题答对") : "参考答案"}</strong>
            <div>
              <span>你的答案：</span>
              <MarkdownText value={String(Array.isArray(value) ? value.join("") : value || "未填写")} compact />
            </div>
            <div>
              <span>正确答案：</span>
              <MarkdownText value={answerText(question) || "见解析"} compact />
            </div>
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
