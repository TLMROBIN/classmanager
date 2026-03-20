import type { ClassItem } from "../types";

type ToolbarProps = {
  classes: ClassItem[];
  selectedClassId: string;
  search: string;
  onClassChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export function Toolbar(props: ToolbarProps) {
  const { classes, selectedClassId, search, onClassChange, onSearchChange } = props;

  return (
    <section className="toolbar">
      <div>
        <p className="section-kicker">班级</p>
        <select
          value={selectedClassId}
          onChange={(event) => onClassChange(event.target.value)}
          disabled={!classes.length}
        >
          {classes.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <p className="section-kicker">排行榜搜索</p>
        <input
          placeholder="按姓名筛选"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>
    </section>
  );
}
