import type { AttendanceDailyStatsResponse } from "../types";

type AttendanceDailyStatsPanelProps = {
  stats: AttendanceDailyStatsResponse | null;
  sortBy: "absent" | "late" | "attendanceRate" | "date";
  onSortByChange: (value: "absent" | "late" | "attendanceRate" | "date") => void;
};

export function AttendanceDailyStatsPanel({
  stats,
  sortBy,
  onSortByChange
}: AttendanceDailyStatsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <h3>异常日列表</h3>
        <span>{stats?.totals.days ?? 0} 天</span>
      </div>

      <div className="attendance-stats-toolbar">
        <label>
          <span>排序方式</span>
          <select
            value={sortBy}
            onChange={(event) =>
              onSortByChange(event.target.value as "absent" | "late" | "attendanceRate" | "date")
            }
          >
            <option value="absent">按缺勤最多</option>
            <option value="late">按迟到最多</option>
            <option value="attendanceRate">按出勤率最低</option>
            <option value="date">按日期最近</option>
          </select>
        </label>
      </div>

      <div className="attendance-summary-strip">
        <div>
          <span>天数</span>
          <strong>{stats?.totals.days ?? 0}</strong>
        </div>
        <div>
          <span>场次</span>
          <strong>{stats?.totals.sessions ?? 0}</strong>
        </div>
        <div>
          <span>迟到</span>
          <strong>{stats?.totals.late ?? 0}</strong>
        </div>
        <div>
          <span>缺勤</span>
          <strong>{stats?.totals.absent ?? 0}</strong>
        </div>
        <div>
          <span>请假</span>
          <strong>{stats?.totals.excused ?? 0}</strong>
        </div>
      </div>

      {stats?.items.length ? (
        <div className="attendance-stats-list">
          {stats.items.map((item, index) => (
            <div key={item.sessionDate} className="leaderboard-row">
              <div>
                <strong>
                  {index + 1}. {item.sessionDate}
                </strong>
                <span>
                  {item.sessionNames.join(" / ")} · {item.sessions} 场 · 出勤率 {(item.attendanceRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="attendance-stats-meta">
                <b>迟到 {item.late}</b>
                <b>缺勤 {item.absent}</b>
                <b>请假 {item.excused}</b>
                <b>记录 {item.records}</b>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">当前筛选条件下没有异常日统计</p>
      )}
    </section>
  );
}
