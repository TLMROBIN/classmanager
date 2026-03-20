export type ViewKey = "overview" | "students" | "attendance" | "homework" | "legacy" | "exports" | "settings" | "admin";

type ViewTabsProps = {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
  items?: Array<{ key: ViewKey; label: string; description: string }>;
};

const defaultItems: Array<{ key: ViewKey; label: string; description: string }> = [
  { key: "overview", label: "概览", description: "积分总览与排行榜" },
  { key: "students", label: "学生", description: "学生列表与详情" },
  { key: "attendance", label: "考勤", description: "只读考勤概览与迁移状态" },
  { key: "homework", label: "作业", description: "作业学科总览与最近记录" },
  { key: "legacy", label: "旧功能", description: "留言、任务与兼容数据" },
  { key: "exports", label: "导出", description: "结构化导出任务与历史" },
  { key: "settings", label: "设置", description: "班级配置与规则清单" }
];

export function ViewTabs({ activeView, onChange, items = defaultItems }: ViewTabsProps) {
  return (
    <section className="view-tabs">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`view-tab ${item.key === activeView ? "active" : ""}`}
          onClick={() => onChange(item.key)}
        >
          <strong>{item.label}</strong>
          <span>{item.description}</span>
        </button>
      ))}
    </section>
  );
}
