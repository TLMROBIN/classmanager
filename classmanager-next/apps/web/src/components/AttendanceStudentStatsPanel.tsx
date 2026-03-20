import type { AttendanceStudentStatsResponse } from "../types";

type AttendanceStudentStatsPanelProps = {
  stats: AttendanceStudentStatsResponse | null;
  sortBy: "absent" | "late" | "attendanceRate" | "sortOrder";
  onSortByChange: (value: "absent" | "late" | "attendanceRate" | "sortOrder") => void;
};

export function AttendanceStudentStatsPanel({
  stats,
  sortBy,
  onSortByChange
}: AttendanceStudentStatsPanelProps) {
  return (
    <section className="panel">
      <div className="panel-header compact">
        <h3>学生考勤统计</h3>
        <span>{stats?.totals.students ?? 0} 人</span>
      </div>

      <div className="attendance-stats-toolbar">
        <label>
          <span>排序方式</span>
          <select
            value={sortBy}
            onChange={(event) =>
              onSortByChange(event.target.value as "absent" | "late" | "attendanceRate" | "sortOrder")
            }
          >
            <option value="absent">按缺勤排行</option>
            <option value="late">按迟到排行</option>
            <option value="attendanceRate">按出勤率排行</option>
            <option value="sortOrder">按座号顺序</option>
          </select>
        </label>
      </div>

      <div className="attendance-summary-strip">
        <div>
          <span>学生数</span>
          <strong>{stats?.totals.students ?? 0}</strong>
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
        <div>
          <span>记录数</span>
          <strong>{stats?.totals.records ?? 0}</strong>
        </div>
      </div>

      {stats?.items.length ? (
        <div className="attendance-stats-list">
          {stats.items.map((item, index) => (
            <div key={item.student.id} className="leaderboard-row">
              <div>
                <strong>
                  {index + 1}. {item.student.name}
                </strong>
                <span>
                  #{item.student.legacyId || "-"} · {item.student.primaryGroup?.name || "未分组"} · 出勤率{" "}
                  {(item.attendanceRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="attendance-stats-meta">
                <b>迟到 {item.late}</b>
                <b>缺勤 {item.absent}</b>
                <b>请假 {item.excused}</b>
                <b>总计 {item.total}</b>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">当前筛选条件下没有学生考勤统计</p>
      )}
    </section>
  );
}
