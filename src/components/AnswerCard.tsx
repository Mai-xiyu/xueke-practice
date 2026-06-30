import { useMemo, useState } from "react";
import { TYPE_LABEL } from "../lib/questions";
import type { AnswerCardItem, QuestionType } from "../lib/types";

interface AnswerCardProps {
  items: AnswerCardItem[];
  currentId?: string;
  onJump: (id: string) => void;
}

type CardFilter = "all" | "todo" | "done" | "correct" | "wrong" | "marked" | "review";

const order: QuestionType[] = ["single", "multiple", "judge", "fill", "short", "essay", "code", "comprehensive"];
const filterLabels: Record<CardFilter, string> = {
  all: "全部",
  todo: "未做",
  done: "已做",
  correct: "正确",
  wrong: "错误",
  marked: "收藏",
  review: "待复习"
};

function itemClass(item: AnswerCardItem, currentId?: string) {
  return [
    "answer-card__btn",
    item.id === currentId ? "active" : "",
    item.done ? "done" : "",
    item.correct ? "correct" : "",
    item.wrong ? "wrong" : "",
    item.marked ? "marked" : "",
    item.reviewDue ? "review-due" : ""
  ].filter(Boolean).join(" ");
}

function filterItem(item: AnswerCardItem, filter: CardFilter, keyword: string) {
  const normalized = keyword.trim().toLowerCase();
  if (normalized) {
    const haystack = `${item.label} ${item.stem}`.toLowerCase();
    if (!haystack.includes(normalized)) return false;
  }
  if (filter === "todo") return !item.done;
  if (filter === "done") return item.done;
  if (filter === "correct") return item.correct;
  if (filter === "wrong") return item.wrong;
  if (filter === "marked") return item.marked;
  if (filter === "review") return item.reviewDue;
  return true;
}

function nearbyItems(items: AnswerCardItem[], currentId?: string) {
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));
  const start = Math.max(0, currentIndex - 5);
  const end = Math.min(items.length, currentIndex + 6);
  return items.slice(start, end);
}

export function AnswerCard({ items, currentId, onJump }: AnswerCardProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<CardFilter>("all");
  const [keyword, setKeyword] = useState("");
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));
  const summary = useMemo(() => ({
    done: items.filter((item) => item.done).length,
    correct: items.filter((item) => item.correct).length,
    wrong: items.filter((item) => item.wrong).length,
    marked: items.filter((item) => item.marked).length,
    review: items.filter((item) => item.reviewDue).length
  }), [items]);
  const nearby = nearbyItems(items, currentId);
  const fullItems = useMemo(() => items.filter((item) => filterItem(item, filter, keyword)), [filter, items, keyword]);

  function jump(id: string) {
    onJump(id);
    setOpen(false);
  }

  return (
    <>
      <aside className="answer-card" aria-label="答题卡">
        <div className="answer-card__head">
          <h2>答题卡</h2>
          <p>第 {items.length ? currentIndex + 1 : 0} / {items.length} 题</p>
        </div>
        <dl className="answer-card__summary">
          <div><dt>已做</dt><dd>{summary.done}</dd></div>
          <div><dt>正确</dt><dd>{summary.correct}</dd></div>
          <div><dt>错误</dt><dd>{summary.wrong}</dd></div>
          <div><dt>收藏</dt><dd>{summary.marked}</dd></div>
          <div><dt>待复习</dt><dd>{summary.review}</dd></div>
        </dl>
        <section className="answer-card__section">
          <h3>附近题号</h3>
          <div className="answer-card__grid compact">
            {nearby.map((item) => (
              <button key={item.id} type="button" className={itemClass(item, currentId)} onClick={() => jump(item.id)} aria-label={`跳转到第 ${item.label} 题`}>
                {item.label}
              </button>
            ))}
          </div>
        </section>
        <button type="button" className="answer-card__open" onClick={() => setOpen(true)}>打开完整答题卡</button>
        <div className="answer-card__legend" aria-label="状态说明">
          <span>白：未做</span>
          <span>绿：正确</span>
          <span>红：错误</span>
          <span>★：收藏</span>
          <span>●：待复习</span>
        </div>
      </aside>

      {open ? (
        <div className="card-drawer" role="dialog" aria-modal="true" aria-label="完整答题卡">
          <button className="card-drawer__backdrop" type="button" aria-label="关闭完整答题卡" onClick={() => setOpen(false)} />
          <section className="card-drawer__panel">
            <div className="card-drawer__head">
              <div>
                <h2>完整答题卡</h2>
                <p>{fullItems.length} / {items.length} 题</p>
              </div>
              <button type="button" onClick={() => setOpen(false)}>关闭</button>
            </div>
            <div className="card-drawer__filters">
              {(Object.keys(filterLabels) as CardFilter[]).map((key) => (
                <button key={key} type="button" className={filter === key ? "active" : ""} onClick={() => setFilter(key)}>
                  {filterLabels[key]}
                </button>
              ))}
              <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜索题号或题干" />
            </div>
            <div className="card-drawer__body">
              {order.map((type) => {
                const group = fullItems.filter((item) => item.type === type);
                if (!group.length) return null;
                return (
                  <section className="answer-card__section" key={type}>
                    <h3>{TYPE_LABEL[type]}</h3>
                    <div className="answer-card__grid drawer-grid">
                      {group.map((item) => (
                        <button key={item.id} type="button" className={itemClass(item, currentId)} onClick={() => jump(item.id)} title={item.stem}>
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
