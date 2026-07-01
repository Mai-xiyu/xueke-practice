import { useMemo, useState } from "react";
import { TYPE_LABEL } from "../lib/questions";
import type { AnswerCardItem, QuestionType } from "../lib/types";

interface AnswerCardProps {
  items: AnswerCardItem[];
  currentId?: string;
  onJump: (id: string) => void;
}

interface AnswerWidgetProps extends AnswerCardProps {
  title?: string;
}

type CardFilter = "all" | "todo" | "done" | "correct" | "wrong" | "marked" | "review";

const order: QuestionType[] = ["single", "multiple", "fill", "judge", "short", "code", "essay", "comprehensive"];
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
    item.pending ? "pending" : "",
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
  if (filter === "todo") return !item.done && !item.pending;
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

export function buildAnswerSummary(items: AnswerCardItem[]) {
  return {
    done: items.filter((item) => item.done).length,
    correct: items.filter((item) => item.correct).length,
    wrong: items.filter((item) => item.wrong).length,
    marked: items.filter((item) => item.marked).length,
    review: items.filter((item) => item.reviewDue).length
  };
}

export function AnswerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="answer-card__metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function NearbyQuestionGrid({ items, currentId, onJump }: AnswerCardProps) {
  const nearby = nearbyItems(items, currentId);
  return (
    <div className="answer-card__grid compact">
      {nearby.map((item) => (
        <button key={item.id} type="button" className={itemClass(item, currentId)} onClick={() => onJump(item.id)} aria-label={`跳转到第 ${item.label} 题`}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function AnswerCardLegend() {
  return (
    <div className="answer-card__legend" aria-label="状态说明">
      <span>白：未做</span>
      <span>蓝：已选择</span>
      <span>绿：正确</span>
      <span>红：错误</span>
      <span>★：收藏</span>
      <span>●：待复习</span>
    </div>
  );
}

export function FullAnswerCardControl({ items, currentId, onJump, title = "打开完整答题卡" }: AnswerWidgetProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<CardFilter>("all");
  const [keyword, setKeyword] = useState("");
  const fullItems = useMemo(() => items.filter((item) => filterItem(item, filter, keyword)), [filter, items, keyword]);

  function jump(id: string) {
    onJump(id);
    setOpen(false);
  }

  return (
    <>
      <button type="button" className="answer-card__open" onClick={() => setOpen(true)}>{title}</button>

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

export function QuestionNumberCard({ items, currentId, onJump, title = "答题卡" }: AnswerWidgetProps) {
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));

  return (
    <aside className="answer-card answer-card--numbers" aria-label={title}>
      <div className="answer-card__head">
        <h2>{title}</h2>
        <p>第 {items.length ? currentIndex + 1 : 0} / {items.length} 题</p>
      </div>
      <div className="answer-card__grid drawer-grid">
        {items.map((item) => (
          <button key={item.id} type="button" className={itemClass(item, currentId)} onClick={() => onJump(item.id)} title={item.stem}>
            {item.label}
          </button>
        ))}
      </div>
      <AnswerCardLegend />
    </aside>
  );
}

export function AnswerCard({ items, currentId, onJump }: AnswerCardProps) {
  const currentIndex = Math.max(0, items.findIndex((item) => item.id === currentId));
  const summary = useMemo(() => buildAnswerSummary(items), [items]);

  return (
    <aside className="answer-card" aria-label="答题卡">
      <div className="answer-card__head">
        <h2>答题卡</h2>
        <p>第 {items.length ? currentIndex + 1 : 0} / {items.length} 题</p>
      </div>
      <dl className="answer-card__summary">
        <AnswerMetric label="已做" value={summary.done} />
        <AnswerMetric label="正确" value={summary.correct} />
        <AnswerMetric label="错误" value={summary.wrong} />
        <AnswerMetric label="收藏" value={summary.marked} />
        <AnswerMetric label="待复习" value={summary.review} />
      </dl>
      <section className="answer-card__section">
        <h3>附近题号</h3>
        <NearbyQuestionGrid items={items} currentId={currentId} onJump={onJump} />
      </section>
      <FullAnswerCardControl items={items} currentId={currentId} onJump={onJump} />
      <AnswerCardLegend />
    </aside>
  );
}
