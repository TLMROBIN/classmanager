import { useEffect, useMemo, useState } from "react";

import { getStudentStatusLabel, isStudentDailyParticipant, summarizeStudentStatuses } from "../lib/studentStatus";
import type {
  PointAudit,
  PointBatchAdjustmentHistoryItem,
  SettingsOverview,
  StudentItem,
  StudentStatusOptionItem
} from "../types";

type StudentListPanelProps = {
  students: StudentItem[];
  selectedStudentId: string;
  selectedBatchStudentIds: string[];
  studentSearch: string;
  selectedGroup: string;
  selectedDorm: string;
  selectedStatus: string;
  groups: string[];
  dorms: string[];
  statusOptions: StudentStatusOptionItem[];
  groupedCount: number;
  filteredCount: number;
  batchAdjusting: boolean;
  batchReverting: boolean;
  creatingStudent: boolean;
  batchAdjustMessage: string;
  studentWriteMessage: string;
  batchAdjustmentHistory: PointBatchAdjustmentHistoryItem[];
  activePointBatchCorrection: PointBatchAdjustmentHistoryItem | null;
  pointAudits: PointAudit[];
  revertingBatchAdjustmentId: string;
  revertingPointAuditId: string;
  batchUpdatingPositions: boolean;
  batchPositionMessage: string;
  positions: SettingsOverview["positions"];
  batchUpdatingOrganization: boolean;
  batchOrganizationMessage: string;
  availableGroups: SettingsOverview["groups"];
  availableDormitories: SettingsOverview["dormitories"];
  batchUpdatingStatus: boolean;
  batchStatusMessage: string;
  canRevertLatestBatchAdjustment: boolean;
  canManagePoints: boolean;
  classFrozen: boolean;
  onStudentSearchChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onDormChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onSelect: (studentId: string) => void;
  onToggleBatchStudent: (studentId: string) => void;
  onSelectAllFilteredStudents: () => void;
  onClearBatchStudents: () => void;
  onCreateStudent: (input: {
    studentNo: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder?: number;
  }) => Promise<void>;
  onBatchAdjust: (input: {
    studentIds: string[];
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }) => Promise<void>;
  onBatchUpdatePositions: (input: { studentIds: string[]; positionIds: string[] }) => Promise<void>;
  onBatchUpdateOrganization: (input: {
    studentIds: string[];
    groupId?: string | null;
    dormitoryId?: string | null;
  }) => Promise<void>;
  onBatchUpdateStatus: (input: { studentIds: string[]; status: string }) => Promise<void>;
  onRevertLatestBatchAdjust: () => Promise<void>;
  onRevertBatchAdjustById: (item: PointBatchAdjustmentHistoryItem) => Promise<void>;
  onStartPointBatchCorrection: (item: PointBatchAdjustmentHistoryItem) => void;
  onCancelPointBatchCorrection: () => void;
  onRevertPointAudit: (audit: PointAudit) => Promise<void>;
};

function formatPointValue(value: number) {
  if (!Number.isFinite(value)) return "0";
  const normalized = Math.round(value * 100) / 100;
  if (Number.isInteger(normalized)) {
    return String(normalized);
  }
  return normalized.toFixed(2).replace(/\.?0+$/, "");
}

function formatSignedPointDelta(value: number) {
  return `${value > 0 ? "+" : ""}${formatPointValue(value)}`;
}

function formatStudentPreview(students: StudentItem[]) {
  if (!students.length) {
    return "无";
  }

  const names = students.slice(0, 5).map((student) => `${student.sortOrder}. ${student.name}`);
  return students.length > 5 ? `${names.join("、")} 等 ${students.length} 人` : names.join("、");
}

export function StudentListPanel(props: StudentListPanelProps) {
  const {
    students,
    selectedStudentId,
    selectedBatchStudentIds,
    studentSearch,
    selectedGroup,
    selectedDorm,
    selectedStatus,
    groups,
    dorms,
    statusOptions,
    groupedCount,
    filteredCount,
    batchAdjusting,
    batchReverting,
    creatingStudent,
    batchAdjustMessage,
    studentWriteMessage,
    batchAdjustmentHistory,
    activePointBatchCorrection,
    pointAudits,
    revertingBatchAdjustmentId,
    revertingPointAuditId,
    batchUpdatingPositions,
    batchPositionMessage,
    positions,
    batchUpdatingOrganization,
    batchOrganizationMessage,
    availableGroups,
    availableDormitories,
    batchUpdatingStatus,
    batchStatusMessage,
    canRevertLatestBatchAdjustment,
    canManagePoints,
    classFrozen,
    onStudentSearchChange,
    onGroupChange,
    onDormChange,
    onStatusChange,
    onSelect,
    onToggleBatchStudent,
    onSelectAllFilteredStudents,
    onClearBatchStudents,
    onCreateStudent,
    onBatchAdjust,
    onBatchUpdatePositions,
    onBatchUpdateOrganization,
    onBatchUpdateStatus,
    onRevertLatestBatchAdjust,
    onRevertBatchAdjustById,
    onStartPointBatchCorrection,
    onCancelPointBatchCorrection,
    onRevertPointAudit
  } = props;
  const [formError, setFormError] = useState("");
  const [createError, setCreateError] = useState("");
  const [positionError, setPositionError] = useState("");
  const [organizationError, setOrganizationError] = useState("");
  const [positionIdsDraft, setPositionIdsDraft] = useState<string[]>([]);
  const [batchGroupIdDraft, setBatchGroupIdDraft] = useState("");
  const [batchDormitoryIdDraft, setBatchDormitoryIdDraft] = useState("");
  const [batchStatusDraft, setBatchStatusDraft] = useState("active");
  const [batchTransactionType, setBatchTransactionType] = useState<"bonus" | "penalty">("bonus");
  const [batchValue, setBatchValue] = useState("1");
  const [batchReason, setBatchReason] = useState("");
  const [batchScene, setBatchScene] = useState("班级");
  const [batchCategory, setBatchCategory] = useState("班务");
  const [recentAuditTypeFilter, setRecentAuditTypeFilter] = useState<"" | "point.adjust" | "point.adjust.batch">("");
  const [recentAuditRevertFilter, setRecentAuditRevertFilter] = useState<"" | "revertible" | "locked">("");
  const [recentAuditSearch, setRecentAuditSearch] = useState("");
  const [recentAuditDateFrom, setRecentAuditDateFrom] = useState("");
  const [recentAuditDateTo, setRecentAuditDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"" | "bonus" | "penalty">("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const studentMap = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const selectedBatchStudents = useMemo(
    () => selectedBatchStudentIds.map((studentId) => studentMap.get(studentId)).filter((student): student is StudentItem => Boolean(student)),
    [selectedBatchStudentIds, studentMap]
  );

  useEffect(() => {
    if (!activePointBatchCorrection) return;
    const normalizedValue = Number(activePointBatchCorrection.value);
    setBatchTransactionType(activePointBatchCorrection.transactionType);
    setBatchValue(
      Number.isFinite(normalizedValue) ? String(Math.abs(normalizedValue)) : activePointBatchCorrection.value.replace(/^-/, "")
    );
    setBatchReason(activePointBatchCorrection.reason);
    setBatchScene(activePointBatchCorrection.scene);
    setBatchCategory(activePointBatchCorrection.category);
    setFormError("");
  }, [activePointBatchCorrection]);

  useEffect(() => {
    if (!statusOptions.length) return;
    if (statusOptions.some((item) => item.value === batchStatusDraft)) {
      return;
    }
    setBatchStatusDraft(statusOptions[0]?.value || "active");
  }, [batchStatusDraft, statusOptions]);

  function formatBatchTime(item: PointBatchAdjustmentHistoryItem) {
    const time = item.occurredAt || item.createdAt;
    return time ? new Date(time).toLocaleString("zh-CN") : "-";
  }

  function matchesDateRange(value: string, dateFrom: string, dateTo: string) {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  }

  const filteredBatchHistory = batchAdjustmentHistory.filter((item) => {
    const matchesType = !historyTypeFilter || item.transactionType === historyTypeFilter;
    const keyword = historySearch.trim();
    const matchesSearch =
      !keyword ||
      item.reason.includes(keyword) ||
      item.scene.includes(keyword) ||
      item.category.includes(keyword) ||
      item.value.includes(keyword) ||
      String(item.count).includes(keyword) ||
      item.batchId.slice(0, 8).includes(keyword);
    const matchesDate = matchesDateRange(item.occurredAt || item.createdAt, historyDateFrom, historyDateTo);
    return matchesType && matchesSearch && matchesDate;
  });
  const filteredPointAudits = pointAudits.filter((item) => {
    const matchesType = !recentAuditTypeFilter || item.action === recentAuditTypeFilter;
    const matchesRevert = !recentAuditRevertFilter || (recentAuditRevertFilter === "revertible" ? item.canRevert : !item.canRevert);
    const keyword = recentAuditSearch.trim();
    const studentName = typeof item.afterData?.studentName === "string" ? item.afterData.studentName : "";
    const reason = typeof item.afterData?.reason === "string" ? item.afterData.reason : "";
    const actorName = item.actorUser?.displayName || item.actorUser?.username || "";
    const matchesSearch =
      !keyword || [item.label, studentName, reason, actorName].some((value) => value.includes(keyword));
    const matchesDate = matchesDateRange(item.createdAt, recentAuditDateFrom, recentAuditDateTo);
    return matchesType && matchesRevert && matchesSearch && matchesDate;
  });
  const filteredPointAuditSummary = filteredPointAudits.reduce(
    (totals, item) => {
      if (item.action === "point.adjust") totals.single += 1;
      if (item.action === "point.adjust.batch") totals.batch += 1;
      if (item.canRevert) totals.revertible += 1;
      return totals;
    },
    { single: 0, batch: 0, revertible: 0 }
  );
  const filteredBatchHistorySummary = filteredBatchHistory.reduce(
    (totals, item) => {
      if (item.transactionType === "bonus") totals.bonus += 1;
      if (item.transactionType === "penalty") totals.penalty += 1;
      totals.students += item.count;
      return totals;
    },
    { bonus: 0, penalty: 0, students: 0 }
  );
  const filteredStudentStatusSummary = summarizeStudentStatuses(
    students.map((student) => student.status),
    statusOptions
  );
  const defaultStudentStatusValue =
    statusOptions.find((item) => item.value === "active")?.value || statusOptions[0]?.value || "active";
  const selectedBatchStatusLabel = getStudentStatusLabel(batchStatusDraft.trim(), statusOptions);
  const activeCorrectionTypeLabel = activePointBatchCorrection
    ? activePointBatchCorrection.transactionType === "penalty"
      ? "扣分"
      : "加分"
    : "";

  async function handleCreateStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const studentNo = String(form.get("studentNo") || "").trim();
    const gender = String(form.get("gender") || "").trim();
    const status = String(form.get("status") || "active").trim();
    const sortOrderRaw = String(form.get("sortOrder") || "").trim();
    const sortOrder = sortOrderRaw ? Number(sortOrderRaw) : undefined;
    if (!name) {
      setCreateError("姓名不能为空");
      return;
    }
    if (!status) {
      setCreateError("状态不能为空");
      return;
    }
    if (sortOrderRaw && (!Number.isInteger(sortOrder) || Number(sortOrder) < 0)) {
      setCreateError("排序必须是大于等于 0 的整数");
      return;
    }
    if (!window.confirm(`确认新增学生“${name}”？`)) return;
    setCreateError("");
    await onCreateStudent({
      studentNo: studentNo || null,
      name,
      gender: gender || null,
      status,
      sortOrder
    });
    event.currentTarget.reset();
  }

  async function handleBatchPositionSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBatchStudentIds.length) {
      setPositionError("请先勾选要调整的学生");
      return;
    }
    const confirmed = window.confirm(
      `确认更新 ${selectedBatchStudentIds.length} 名学生的岗位归属？`
    );
    if (!confirmed) return;
    setPositionError("");
    await onBatchUpdatePositions({
      studentIds: selectedBatchStudentIds,
      positionIds: positionIdsDraft
    });
  }

  async function handleBatchOrganizationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBatchStudentIds.length) {
      setOrganizationError("请先勾选要调整的学生");
      return;
    }
    if (!batchGroupIdDraft && !batchDormitoryIdDraft) {
      setOrganizationError("请至少选择小组或宿舍调整项");
      return;
    }
    const confirmed = window.confirm(
      `确认更新 ${selectedBatchStudentIds.length} 名学生的小组/宿舍归属？`
    );
    if (!confirmed) return;
    setOrganizationError("");
    const payload: { groupId?: string | null; dormitoryId?: string | null; studentIds: string[] } = {
      studentIds: selectedBatchStudentIds
    };
    if (batchGroupIdDraft) {
      payload.groupId = batchGroupIdDraft === "__clear__" ? null : batchGroupIdDraft;
    }
    if (batchDormitoryIdDraft) {
      payload.dormitoryId = batchDormitoryIdDraft === "__clear__" ? null : batchDormitoryIdDraft;
    }
    await onBatchUpdateOrganization(payload);
  }

  async function handleBatchStatusSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBatchStudentIds.length) {
      setOrganizationError("请先勾选要调整的学生");
      return;
    }
    if (!batchStatusDraft.trim()) {
      setOrganizationError("学生状态不能为空");
      return;
    }
    const confirmed = window.confirm(
      `确认更新 ${selectedBatchStudentIds.length} 名学生的状态为“${getStudentStatusLabel(batchStatusDraft.trim(), statusOptions)}”？`
    );
    if (!confirmed) return;
    setOrganizationError("");
    await onBatchUpdateStatus({
      studentIds: selectedBatchStudentIds,
      status: batchStatusDraft.trim()
    });
  }

  const togglePositionSelection = (positionId: string) => {
    setPositionIdsDraft((current) =>
      current.includes(positionId) ? current.filter((item) => item !== positionId) : [...current, positionId]
    );
  };

  async function handleBatchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const transactionType = batchTransactionType;
    const value = Number(batchValue || 0);
    const reason = batchReason.trim();
    const scene = batchScene.trim();
    const category = batchCategory.trim();
    if (!selectedBatchStudentIds.length) {
      setFormError("请先勾选至少 1 名学生");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("分值必须大于 0");
      return;
    }
    if (!reason || !scene || !category) {
      setFormError("理由、场景、类别不能为空");
      return;
    }
    const selectedBalanceTotal = selectedBatchStudents.reduce(
      (sum, student) => sum + Number(student.account?.balancePoints ?? 0),
      0
    );
    const totalDelta = (transactionType === "penalty" ? -1 : 1) * value * selectedBatchStudents.length;
    const nextBalanceTotal = selectedBalanceTotal + totalDelta;
    const studentPreview = formatStudentPreview(selectedBatchStudents);
    const confirmationMessage = activePointBatchCorrection
      ? [
          "确认修正这条批量积分调整？",
          `原类型：${activeCorrectionTypeLabel}`,
          `原分值：${Math.abs(Number(activePointBatchCorrection.value))} 分`,
          `原理由：${activePointBatchCorrection.reason}`,
          `原场景：${activePointBatchCorrection.scene} · ${activePointBatchCorrection.category}`,
          `原影响人数：${activePointBatchCorrection.count} 人`,
          `原总变动：${formatSignedPointDelta(
            (activePointBatchCorrection.transactionType === "penalty" ? -1 : 1) *
              Math.abs(Number(activePointBatchCorrection.value)) *
              activePointBatchCorrection.count
          )} 分`,
          `新类型：${transactionType === "penalty" ? "扣分" : "加分"}`,
          `新分值：${value} 分`,
          `新理由：${reason}`,
          `新场景：${scene} · ${category}`,
          `新目标人数：${selectedBatchStudentIds.length} 人`,
          `新总变动：${formatSignedPointDelta(totalDelta)} 分`,
          `学生预览：${studentPreview}`,
          `当前勾选总余额：${formatPointValue(selectedBalanceTotal)}`,
          `提交后勾选总余额：${formatPointValue(nextBalanceTotal)}`,
          "提交后会先撤销原批次，再按当前勾选结果重建。"
        ].join("\n")
      : [
          `确认对当前勾选的 ${selectedBatchStudentIds.length} 名学生${transactionType === "penalty" ? "扣除" : "增加"} ${value} 分？`,
          `理由：${reason}`,
          `场景：${scene} · ${category}`,
          `学生预览：${studentPreview}`,
          `本次总变动：${formatSignedPointDelta(totalDelta)} 分`,
          `当前勾选总余额：${formatPointValue(selectedBalanceTotal)}`,
          `提交后勾选总余额：${formatPointValue(nextBalanceTotal)}`
        ].join("\n");
    if (!window.confirm(confirmationMessage)) {
      return;
    }
    setFormError("");
    await onBatchAdjust({
      studentIds: selectedBatchStudentIds,
      transactionType,
      value,
      reason,
      scene,
      category
    });
  }

  return (
    <article className="panel">
      <div className="panel-header">
        <h2>学生列表</h2>
        <span>
          {filteredCount} 人 / {groupedCount} 组
        </span>
      </div>
      <div className="student-filters">
        <input
          placeholder="按姓名或学号搜索"
          value={studentSearch}
          onChange={(event) => onStudentSearchChange(event.target.value)}
        />
        <select value={selectedGroup} onChange={(event) => onGroupChange(event.target.value)}>
          <option value="">全部小组</option>
          {groups.map((group) => (
            <option key={group} value={group}>
              {group}
            </option>
          ))}
        </select>
        <select value={selectedDorm} onChange={(event) => onDormChange(event.target.value)}>
          <option value="">全部宿舍</option>
          {dorms.map((dorm) => (
            <option key={dorm} value={dorm}>
              {dorm}
            </option>
          ))}
        </select>
        <select value={selectedStatus} onChange={(event) => onStatusChange(event.target.value)}>
          <option value="">全部状态</option>
          {statusOptions.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
      <div className="attendance-summary-strip">
        {filteredStudentStatusSummary.map((item) => (
          <div key={item.value}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </div>
        ))}
      </div>
      <form className="adjustment-form" onSubmit={handleCreateStudent}>
        <div className="panel-header compact">
          <h3>新增学生</h3>
          <span>{creatingStudent ? "提交中" : "写入新系统"}</span>
        </div>
        {classFrozen ? <p className="muted">当前班级已冻结，学生新增已暂停。</p> : null}
        <div className="student-filters">
          <label>
            <span>姓名</span>
            <input name="name" type="text" placeholder="例如：张三" />
          </label>
          <label>
            <span>学号</span>
            <input name="studentNo" type="text" placeholder="可留空" />
          </label>
          <label>
            <span>性别</span>
            <input name="gender" type="text" placeholder="可留空" />
          </label>
          <label>
            <span>状态</span>
            <select name="status" defaultValue={defaultStudentStatusValue}>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>排序</span>
            <input name="sortOrder" type="number" min="0" step="1" placeholder="默认追加到末尾" />
          </label>
        </div>
        {createError ? <p className="warning-text">{createError}</p> : null}
        {studentWriteMessage ? <p className="success-text">{studentWriteMessage}</p> : null}
        <button
          type="submit"
          className="adjustment-submit"
          disabled={creatingStudent || !canManagePoints || classFrozen}
        >
          {creatingStudent ? "提交中..." : "新增学生"}
        </button>
      </form>
      <form className="adjustment-form" onSubmit={handleBatchSubmit}>
        <div className="panel-header compact">
          <h3>批量加减分</h3>
          <span>{selectedBatchStudentIds.length} 人已勾选</span>
        </div>
        {activePointBatchCorrection ? (
          <div className="migration-card">
            <p className="section-kicker">批量修正中</p>
            <strong>{activePointBatchCorrection.reason}</strong>
            <span>
              原批次：{activeCorrectionTypeLabel} · {Math.abs(Number(activePointBatchCorrection.value))} 分 ·{" "}
              {activePointBatchCorrection.scene} · {activePointBatchCorrection.category} · {activePointBatchCorrection.count} 人
            </span>
            <span className="muted">提交后会先撤销原批次，再按当前勾选学生重建这次批量积分调整。</span>
          </div>
        ) : null}
        <div className="inline-action-row">
          <button type="button" className="inline-action" onClick={onSelectAllFilteredStudents}>
            全选当前筛选
          </button>
          <button type="button" className="inline-action" onClick={onClearBatchStudents}>
            清空勾选
          </button>
        </div>
        {classFrozen ? <p className="muted">当前班级已冻结，批量积分调整已暂停。</p> : null}
        <div className="student-filters">
          <label>
            <span>类型</span>
            <select value={batchTransactionType} onChange={(event) => setBatchTransactionType(event.target.value as "bonus" | "penalty")}>
              <option value="bonus">加分</option>
              <option value="penalty">扣分</option>
            </select>
          </label>
          <label>
            <span>分值</span>
            <input type="number" step="0.5" min="0.5" value={batchValue} onChange={(event) => setBatchValue(event.target.value)} />
          </label>
          <label>
            <span>理由</span>
            <input type="text" value={batchReason} onChange={(event) => setBatchReason(event.target.value)} placeholder="例如：课堂表现" />
          </label>
          <label>
            <span>场景</span>
            <input type="text" value={batchScene} onChange={(event) => setBatchScene(event.target.value)} />
          </label>
          <label>
            <span>类别</span>
            <input type="text" value={batchCategory} onChange={(event) => setBatchCategory(event.target.value)} />
          </label>
        </div>
        {formError ? <p className="warning-text">{formError}</p> : null}
        {batchAdjustMessage ? <p className="success-text">{batchAdjustMessage}</p> : null}
        <div className="inline-action-row">
          <button type="submit" className="adjustment-submit" disabled={batchAdjusting || batchReverting || !canManagePoints || classFrozen}>
            {batchAdjusting ? (activePointBatchCorrection ? "批量修正中..." : "提交中...") : activePointBatchCorrection ? "提交批量修正" : "提交批量积分调整"}
          </button>
          {activePointBatchCorrection ? (
            <button
              type="button"
              className="inline-action"
              disabled={batchAdjusting || batchReverting}
              onClick={onCancelPointBatchCorrection}
            >
              取消修正模式
            </button>
          ) : null}
          {canRevertLatestBatchAdjustment ? (
            <button
              type="button"
              className="inline-action"
              disabled={batchAdjusting || batchReverting || !canManagePoints || classFrozen}
              onClick={() => {
                void onRevertLatestBatchAdjust();
              }}
            >
              {batchReverting ? "撤销中..." : "撤销最近批量调整"}
            </button>
          ) : null}
        </div>
        <p className="muted">
          {activePointBatchCorrection
            ? "批量修正会复用当前学生页勾选结果，并用新批次替换当前修正目标。"
            : "批量积分调整会复用当前学生页勾选结果。"}
        </p>
      </form>
      <form className="adjustment-form" onSubmit={handleBatchOrganizationSubmit}>
        <div className="panel-header compact">
          <h3>最近积分操作</h3>
          <span>{filteredPointAudits.length} / {pointAudits.length} 条</span>
        </div>
        <div className="student-filters">
          <label>
            <span>操作类型</span>
            <select
              value={recentAuditTypeFilter}
              onChange={(event) => setRecentAuditTypeFilter(event.target.value as "" | "point.adjust" | "point.adjust.batch")}
            >
              <option value="">全部</option>
              <option value="point.adjust">单条调整</option>
              <option value="point.adjust.batch">批量调整</option>
            </select>
          </label>
          <label>
            <span>撤销状态</span>
            <select
              value={recentAuditRevertFilter}
              onChange={(event) => setRecentAuditRevertFilter(event.target.value as "" | "revertible" | "locked")}
            >
              <option value="">全部</option>
              <option value="revertible">可撤销</option>
              <option value="locked">不可撤销</option>
            </select>
          </label>
          <label>
            <span>关键词</span>
            <input
              type="text"
              value={recentAuditSearch}
              onChange={(event) => setRecentAuditSearch(event.target.value)}
              placeholder="按学生/理由/操作人筛选"
            />
          </label>
          <label>
            <span>开始日期</span>
            <input type="date" value={recentAuditDateFrom} onChange={(event) => setRecentAuditDateFrom(event.target.value)} />
          </label>
          <label>
            <span>结束日期</span>
            <input type="date" value={recentAuditDateTo} onChange={(event) => setRecentAuditDateTo(event.target.value)} />
          </label>
        </div>
        <div className="attendance-summary-strip">
          <div>
            <span>单条调整</span>
            <strong>{filteredPointAuditSummary.single}</strong>
          </div>
          <div>
            <span>批量调整</span>
            <strong>{filteredPointAuditSummary.batch}</strong>
          </div>
          <div>
            <span>当前可撤销</span>
            <strong>{filteredPointAuditSummary.revertible}</strong>
          </div>
        </div>
        <div className="transaction-list">
          {filteredPointAudits.length ? (
            filteredPointAudits.map((item) => {
              const studentName = typeof item.afterData?.studentName === "string" ? item.afterData.studentName : "";
              const reason = typeof item.afterData?.reason === "string" ? item.afterData.reason : "";
              const value = item.afterData?.value != null ? String(item.afterData.value) : "";
              return (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>{item.actorUser?.displayName || item.actorUser?.username || "系统"}</strong>
                    <span>{[item.label, studentName, reason, value].filter(Boolean).join(" · ") || item.action}</span>
                  </div>
                  <div className="transaction-actions">
                    <span className="muted">{item.canRevert ? "可撤销" : "不可撤销"}</span>
                    <b>{new Date(item.createdAt).toLocaleString("zh-CN")}</b>
                    {canManagePoints && item.canRevert ? (
                      <button
                        type="button"
                        className="inline-action"
                        disabled={classFrozen || revertingPointAuditId === item.id}
                        onClick={() => {
                          void onRevertPointAudit(item);
                        }}
                      >
                        {revertingPointAuditId === item.id ? "撤销中..." : "撤销"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="muted">{pointAudits.length ? "当前筛选条件下没有匹配的积分操作" : "暂无最近积分操作"}</p>
          )}
        </div>
        <div className="panel-header compact">
          <h3>批量小组/宿舍调整</h3>
          <span>{selectedBatchStudentIds.length} 人已勾选</span>
        </div>
        <div className="student-filters">
          <label>
            <span>小组</span>
            <select
              value={batchGroupIdDraft}
              onChange={(event) => setBatchGroupIdDraft(event.target.value)}
              disabled={batchUpdatingOrganization || !canManagePoints || classFrozen}
            >
              <option value="">保持不变</option>
              <option value="__clear__">清空小组</option>
              {availableGroups.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>宿舍</span>
            <select
              value={batchDormitoryIdDraft}
              onChange={(event) => setBatchDormitoryIdDraft(event.target.value)}
              disabled={batchUpdatingOrganization || !canManagePoints || classFrozen}
            >
              <option value="">保持不变</option>
              <option value="__clear__">清空宿舍</option>
              {availableDormitories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {classFrozen ? <p className="muted">当前班级已冻结，组织归属调整已暂停。</p> : null}
        {organizationError ? <p className="warning-text">{organizationError}</p> : null}
        {batchOrganizationMessage ? <p className="success-text">{batchOrganizationMessage}</p> : null}
        <button
          type="submit"
          className="adjustment-submit"
          disabled={batchUpdatingOrganization || !canManagePoints || classFrozen}
        >
          {batchUpdatingOrganization ? "保存中..." : "保存组织归属"}
        </button>
      </form>
      <form className="adjustment-form" onSubmit={handleBatchStatusSubmit}>
        <div className="panel-header compact">
          <h3>批量状态调整</h3>
          <span>{selectedBatchStudentIds.length} 人已勾选</span>
        </div>
        <div className="student-filters">
          <label>
            <span>学生状态</span>
            <select
              value={batchStatusDraft}
              onChange={(event) => setBatchStatusDraft(event.target.value)}
              disabled={batchUpdatingStatus || !canManagePoints || classFrozen}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-action-row">
          <button type="button" className="inline-action" onClick={() => setBatchStatusDraft("active")}>
            设为在读
          </button>
          <button type="button" className="inline-action" onClick={() => setBatchStatusDraft("archived")}>
            设为归档
          </button>
          <button type="button" className="inline-action" onClick={() => setBatchStatusDraft("graduated")}>
            设为毕业
          </button>
          <button type="button" className="inline-action" onClick={() => setBatchStatusDraft("transferred")}>
            设为转出
          </button>
        </div>
        {classFrozen ? <p className="muted">当前班级已冻结，学生状态调整已暂停。</p> : null}
        <p className="muted">
          当前选中状态“{selectedBatchStatusLabel}”
          {isStudentDailyParticipant(batchStatusDraft, statusOptions) ? "会默认参与" : "不会默认参与"}
          日常点名、作业与全班生成。
        </p>
        {organizationError ? <p className="warning-text">{organizationError}</p> : null}
        {batchStatusMessage ? <p className="success-text">{batchStatusMessage}</p> : null}
        <button
          type="submit"
          className="adjustment-submit"
          disabled={batchUpdatingStatus || !canManagePoints || classFrozen}
        >
          {batchUpdatingStatus ? "保存中..." : "保存学生状态"}
        </button>
      </form>
      <form className="adjustment-form" onSubmit={handleBatchPositionSubmit}>
        <div className="panel-header compact">
          <h3>批量岗位调整</h3>
          <span>{selectedBatchStudentIds.length} 人已勾选</span>
        </div>
        <div className="attendance-missing-list">
          {positions.length ? (
            positions
              .filter((item) => item.isActive)
              .map((item) => (
                <label key={item.id} className="selection-toggle">
                  <input
                    type="checkbox"
                    checked={positionIdsDraft.includes(item.id)}
                    onChange={() => togglePositionSelection(item.id)}
                    disabled={batchUpdatingPositions || !canManagePoints || classFrozen}
                  />
                  <span>
                    {item.name} · {item.category}
                  </span>
                </label>
              ))
          ) : (
            <p className="muted">当前班级暂无岗位配置</p>
          )}
        </div>
        {classFrozen ? <p className="muted">当前班级已冻结，岗位调整已暂停。</p> : null}
        {positionError ? <p className="warning-text">{positionError}</p> : null}
        {batchPositionMessage ? <p className="success-text">{batchPositionMessage}</p> : null}
        <button
          type="submit"
          className="adjustment-submit"
          disabled={batchUpdatingPositions || !canManagePoints || classFrozen}
        >
          {batchUpdatingPositions ? "保存中..." : "保存岗位归属"}
        </button>
      </form>
      <div className="panel-header compact">
        <h3>历史批量调整</h3>
        <span>{filteredBatchHistory.length} / {batchAdjustmentHistory.length} 条</span>
      </div>
      <div className="student-filters">
        <label>
          <span>调整类型</span>
          <select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value as "" | "bonus" | "penalty")}>
            <option value="">全部</option>
            <option value="bonus">加分</option>
            <option value="penalty">扣分</option>
          </select>
        </label>
        <label>
          <span>关键词</span>
          <input
            type="text"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="按理由/场景/类别/人数/分值/批次筛选"
          />
        </label>
        <label>
          <span>开始日期</span>
          <input type="date" value={historyDateFrom} onChange={(event) => setHistoryDateFrom(event.target.value)} />
        </label>
        <label>
          <span>结束日期</span>
          <input type="date" value={historyDateTo} onChange={(event) => setHistoryDateTo(event.target.value)} />
        </label>
      </div>
      <div className="attendance-summary-strip">
        <div>
          <span>加分批次</span>
          <strong>{filteredBatchHistorySummary.bonus}</strong>
        </div>
        <div>
          <span>扣分批次</span>
          <strong>{filteredBatchHistorySummary.penalty}</strong>
        </div>
        <div>
          <span>影响学生</span>
          <strong>{filteredBatchHistorySummary.students}</strong>
        </div>
      </div>
      {classFrozen ? <p className="muted">当前班级已冻结，历史批量调整仍可查看，但撤销已暂停。</p> : null}
      <div className="transaction-list">
        {filteredBatchHistory.length ? (
          filteredBatchHistory.map((item) => (
            <div key={item.batchId} className="transaction-row">
              <div>
                <strong>{item.reason}</strong>
                <span>
                  {item.transactionType === "penalty" ? "扣分" : "加分"} · {item.scene} · {item.category} · {item.count} 人
                </span>
                <span className="muted">
                  批次 {item.batchId.slice(0, 8)} · 发生 {formatBatchTime(item)}
                  {activePointBatchCorrection?.batchId === item.batchId ? " · 修正中" : ""}
                </span>
              </div>
              <div className="transaction-actions">
                <b>{item.value}</b>
                {canManagePoints ? (
                  <button
                    type="button"
                    className="inline-action"
                    disabled={classFrozen || batchAdjusting}
                    onClick={() => onStartPointBatchCorrection(item)}
                  >
                    {activePointBatchCorrection?.batchId === item.batchId ? "已载入修正" : "修正此批次"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={batchAdjusting || batchReverting || !canManagePoints || classFrozen}
                  onClick={() => {
                    void onRevertBatchAdjustById(item);
                  }}
                  title={classFrozen ? "班级冻结时不可撤销批量调整" : "撤销该批量积分调整"}
                >
                  {revertingBatchAdjustmentId === item.batchId ? "撤销中..." : "撤销"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">{batchAdjustmentHistory.length ? "当前筛选条件下没有匹配的批量调整" : "暂无历史批量调整"}</p>
        )}
      </div>
      <div className="student-list">
        {students.map((student) => (
          <div key={student.id} className={`student-row ${student.id === selectedStudentId ? "active" : ""}`}>
            <label className="selection-toggle">
              <input
                type="checkbox"
                checked={selectedBatchStudentIds.includes(student.id)}
                onChange={() => onToggleBatchStudent(student.id)}
              />
              <span>选择</span>
            </label>
            <button type="button" className="student-row-button" onClick={() => onSelect(student.id)}>
              <div>
                <strong>{student.name}</strong>
                <span>
                  #{student.legacyId || "-"} · {student.primaryGroup?.name || "未分组"} ·{" "}
                  {student.primaryDorm?.name || "未分宿舍"} · {getStudentStatusLabel(student.status, statusOptions)}
                </span>
              </div>
              <b>{student.account?.balancePoints ?? "0"}</b>
            </button>
          </div>
        ))}
      </div>
    </article>
  );
}
