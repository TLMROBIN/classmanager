import type { PointsSummary } from "../types";

type StatsGridProps = {
  summary: PointsSummary | null;
};

export function StatsGrid({ summary }: StatsGridProps) {
  return (
    <section className="stats-grid">
      <article className="metric-card">
        <span>学生数</span>
        <strong>{summary?.studentCount ?? 0}</strong>
      </article>
      <article className="metric-card">
        <span>积分流水</span>
        <strong>{summary?.transactionCount ?? 0}</strong>
      </article>
      <article className="metric-card">
        <span>总积分</span>
        <strong>{summary?.totals.totalPoints ?? "0"}</strong>
      </article>
      <article className="metric-card">
        <span>余额积分</span>
        <strong>{summary?.totals.balancePoints ?? "0"}</strong>
      </article>
    </section>
  );
}
