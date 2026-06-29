import { answerText, isAnswerCorrect, isChoice, isObjective, TYPE_LABEL } from "../lib/questions";
import type { Question } from "../lib/types";

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  value: unknown;
  answered: boolean;
  wrong: boolean;
  favorite: boolean;
  reveal: boolean;
  onChange: (value: unknown) => void;
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
  const { question, index, total, value, answered, wrong, favorite, reveal } = props;
  const showAnswer = reveal || answered;
  const correct = isAnswerCorrect(question, value);

  return (
    <article className="question-card">
      <div className="question-meta">
        <span>{index + 1}/{total}</span>
        <span>{question.source}</span>
        <span>{question.chapter}</span>
        <span>{TYPE_LABEL[question.type]}</span>
      </div>
      <h2>{question.stem}</h2>
      {question.image ? <img className="question-image" src={question.image} alt="题目配图" /> : null}

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
                onClick={() => {
                  if (question.type === "multiple") {
                    const current = Array.isArray(value) ? value.map(String) : [];
                    props.onChange(current.includes(key) ? current.filter((item) => item !== key) : [...current, key].sort());
                  } else {
                    props.onChange(key);
                  }
                }}
              >
                <b>{key}</b>
                <span>{text}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <textarea
          className="text-answer"
          value={String(value ?? "")}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder={question.type === "fill" ? "填写答案" : "写下你的答案或思路"}
        />
      )}

      <div className="question-actions">
        <button type="button" className="primary" onClick={props.onSubmit}>提交/查看解析</button>
        <button type="button" onClick={props.onFavorite}>{favorite ? "取消收藏" : "收藏本题"}</button>
        <button type="button" onClick={props.onReset}>重做本题</button>
        <button type="button" onClick={props.onPrev}>上一题</button>
        <button type="button" onClick={props.onNext}>下一题</button>
      </div>

      {showAnswer ? (
        <section className={`analysis ${isObjective(question.type) ? (wrong || !correct ? "bad" : "ok") : ""}`}>
          <b>参考答案：{answerText(question) || "见解析"}</b>
          {question.analysis ? <p>{question.analysis}</p> : <p>暂无解析。</p>}
        </section>
      ) : null}
    </article>
  );
}
