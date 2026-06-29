interface StatPanelProps {
  total: number;
  done: number;
  wrong: number;
  extraLabel: string;
  extraValue: string;
}

export function StatPanel({ total, done, wrong, extraLabel, extraValue }: StatPanelProps) {
  const correct = Math.max(0, done - wrong);
  const accuracy = done ? Math.round((correct / done) * 100) : 0;
  const stats = [
    ["总题数", total],
    ["已练", done],
    ["错题", wrong],
    ["准确率", `${accuracy}%`],
    [extraLabel, extraValue]
  ];
  return (
    <section className="stat-panel" aria-label="练习统计">
      {stats.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}
