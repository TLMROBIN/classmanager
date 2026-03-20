type TopStatusBarProps = {
  activeViewLabel: string;
  className: string;
  tenantName: string;
  studentCount: number;
  classFrozen: boolean;
  pendingAttendanceRecords: number;
  pendingAttendanceSessions: number;
};

export function TopStatusBar(props: TopStatusBarProps) {
  const {
    activeViewLabel,
    className,
    tenantName,
    studentCount,
    classFrozen,
    pendingAttendanceRecords,
    pendingAttendanceSessions
  } = props;

  return (
    <section className="top-status-bar">
      <div className="status-pill">
        <span>当前视图</span>
        <strong>{activeViewLabel}</strong>
      </div>
      <div className="status-pill">
        <span>当前班级</span>
        <strong>{className || "未选择"}</strong>
      </div>
      <div className="status-pill">
        <span>所属租户</span>
        <strong>{tenantName || "未登录"}</strong>
      </div>
      <div className="status-pill accent">
        <span>学生规模</span>
        <strong>{studentCount}</strong>
      </div>
      <div className={`status-pill ${classFrozen ? "warning" : "accent"}`}>
        <span>班级状态</span>
        <strong>{classFrozen ? "已冻结" : "正常"}</strong>
      </div>
      <div className="status-pill warning">
        <span>考勤待迁移</span>
        <strong>
          {pendingAttendanceSessions} 场次 / {pendingAttendanceRecords} 记录
        </strong>
      </div>
    </section>
  );
}
