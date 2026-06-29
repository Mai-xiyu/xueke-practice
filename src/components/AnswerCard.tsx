import { TYPE_LABEL } from "../lib/questions";
import type { AnswerCardItem, QuestionType } from "../lib/types";

interface AnswerCardProps {
  items: AnswerCardItem[];
  currentId?: string;
  onJump: (id: string) => void;
}

const order: QuestionType[] = ["single", "multiple", "judge", "fill", "short", "essay", "code", "comprehensive"];

export function AnswerCard({ items, currentId, onJump }: AnswerCardProps) {
  return (
    <aside className="answer-card" aria-label="答题卡">
      <h2>答题卡</h2>
      <p>当前 {Math.max(1, items.findIndex((item) => item.id === currentId) + 1)} / {items.length}</p>
      {order.map((type) => {
        const group = items.filter((item) => item.type === type);
        if (!group.length) return null;
        return (
          <section className="answer-card__section" key={type}>
            <h3>{TYPE_LABEL[type]}</h3>
            <div className="answer-card__grid">
              {group.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    "answer-card__btn",
                    item.id === currentId ? "active" : "",
                    item.done ? "done" : "",
                    item.wrong ? "wrong" : "",
                    item.marked ? "marked" : ""
                  ].filter(Boolean).join(" ")}
                  onClick={() => onJump(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </aside>
  );
}
