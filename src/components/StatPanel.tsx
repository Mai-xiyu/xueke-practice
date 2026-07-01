interface StatPanelProps {
  total: number;
  done: number;
  wrong: number;
  extraLabel: string;
  extraValue: string;
}

export interface StatEntry {
  id: string;
  label: string;
  value: string | number;
}

export function buildStatEntries({ total, done, wrong, extraLabel, extraValue }: StatPanelProps): StatEntry[] {
  const correct = Math.max(0, done - wrong);
  const accuracy = done ? Math.round((correct / done) * 100) : 0;
  return [
    { id: "total", label: "总题数", value: total },
    { id: "done", label: "已练", value: done },
    { id: "wrong", label: "错题", value: wrong },
    { id: "accuracy", label: "准确率", value: `${accuracy}%` },
    { id: "bank", label: extraLabel, value: extraValue }
  ];
}

export function StatCard({ label, value }: Omit<StatEntry, "id">) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

export function StatPanel(props: StatPanelProps) {
  const stats = buildStatEntries(props);
  return (
    <section className="stat-panel" aria-label="练习统计">
      {stats.map((item) => <StatCard key={item.id} label={item.label} value={item.value} />)}
    </section>
  );
}
