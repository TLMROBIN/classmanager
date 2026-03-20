import { useEffect, useState } from "react";

import type { HomeworkBatchHistoryItem, HomeworkDetail, HomeworkOverview, HomeworkStudentStats, StudentItem } from "../types";

const RECENT_HOMEWORK_AUDIT_TYPES = [
  { value: "homework.record.create", label: "单条登记" },
  { value: "homework.record.batch_create", label: "批量登记" },
  { value: "homework.record.revert", label: "单条撤销" },
  { value: "homework.record.batch_revert", label: "批量撤销" }
] as const;

type RecentHomeworkAuditAction = (typeof RECENT_HOMEWORK_AUDIT_TYPES)[number]["value"];

type HomeworkPanelProps = {
  homework: HomeworkOverview | null;
  homeworkDetail: HomeworkDetail | null;
  homeworkStudentStats: HomeworkStudentStats | null;
  students: StudentItem[];
  configuredSubjects: Array<{
    id: string;
    name: string;
    representativeStudentIds: string[];
  }>;
  selectedBatchStudentIds: string[];
  canManageHomework: boolean;
  classFrozen: boolean;
  creatingHomeworkRecord: boolean;
  creatingHomeworkBatchRecord: boolean;
  revertingHomeworkBatchRecord: boolean;
  canRevertLatestHomeworkBatch: boolean;
  revertingHomeworkRecordId: string;
  revertingHomeworkAuditId: string;
  revertingHomeworkBatchId: string;
  homeworkWriteMessage: string;
  homeworkBatchHistory: HomeworkBatchHistoryItem[];
  activeHomeworkBatchCorrection: HomeworkBatchHistoryItem | null;
  onCreateHomeworkRecord: (input: {
    studentId: string;
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }) => void;
  onCreateHomeworkBatchRecord: (input: {
    studentIds: string[];
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }) => void;
  onRevertHomeworkBatchRecord: () => void;
  onRevertHomeworkBatchRecordById: (input: HomeworkBatchHistoryItem) => void;
  onStartHomeworkBatchCorrection: (item: HomeworkBatchHistoryItem) => void;
  onCancelHomeworkBatchCorrection: () => void;
  onRevertHomeworkRecord: (input: {
    transactionId: string;
    subjectName: string;
    homeworkDate: string;
    studentName: string;
    eventType: "missing" | "register";
  }) => void;
  onRevertHomeworkAudit: (input: {
    auditId: string;
    label: string;
    subjectName: string;
    homeworkDate: string;
    studentName: string;
    eventType: "missing" | "register" | "";
    batchId?: string;
  }) => void;
  selectedHomeworkDate: string;
  selectedHomeworkSubject: string;
  onHomeworkDateChange: (value: string) => void;
  onHomeworkSubjectChange: (value: string) => void;
};

export function HomeworkPanel({
  homework,
  homeworkDetail,
  homeworkStudentStats,
  students,
  configuredSubjects,
  selectedBatchStudentIds,
  canManageHomework,
  classFrozen,
  creatingHomeworkRecord,
  creatingHomeworkBatchRecord,
  revertingHomeworkBatchRecord,
  canRevertLatestHomeworkBatch,
  revertingHomeworkRecordId,
  revertingHomeworkAuditId,
  revertingHomeworkBatchId,
  homeworkWriteMessage,
  homeworkBatchHistory,
  activeHomeworkBatchCorrection,
  onCreateHomeworkRecord,
  onCreateHomeworkBatchRecord,
  onRevertHomeworkBatchRecord,
  onRevertHomeworkBatchRecordById,
  onStartHomeworkBatchCorrection,
  onCancelHomeworkBatchCorrection,
  onRevertHomeworkRecord,
  onRevertHomeworkAudit,
  selectedHomeworkDate,
  selectedHomeworkSubject,
  onHomeworkDateChange,
  onHomeworkSubjectChange
}: HomeworkPanelProps) {
  const [recordStudentId, setRecordStudentId] = useState("");
  const [recordSubjectName, setRecordSubjectName] = useState("");
  const [recordHomeworkDate, setRecordHomeworkDate] = useState("");
  const [recordEventType, setRecordEventType] = useState<"missing" | "register">("missing");
  const [recordValue, setRecordValue] = useState("1");
  const [recentAuditTypeFilter, setRecentAuditTypeFilter] = useState<"" | RecentHomeworkAuditAction>("");
  const [recentAuditRevertFilter, setRecentAuditRevertFilter] = useState<"" | "revertible" | "locked">("");
  const [recentAuditSearch, setRecentAuditSearch] = useState("");
  const [recentAuditDateFrom, setRecentAuditDateFrom] = useState("");
  const [recentAuditDateTo, setRecentAuditDateTo] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<"" | "penalty" | "reward">("");
  const [historyDateFrom, setHistoryDateFrom] = useState("");
  const [historyDateTo, setHistoryDateTo] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"createdAt" | "occurredAt" | "count">("createdAt");
  const [detailEventTypeFilter, setDetailEventTypeFilter] = useState<"" | "missing" | "register">("");
  const [detailStudentSearch, setDetailStudentSearch] = useState("");
  const [detailSortBy, setDetailSortBy] = useState<"occurredAtDesc" | "occurredAtAsc" | "studentName">("occurredAtDesc");
  const [statsStatusFilter, setStatsStatusFilter] = useState<"" | "attention" | "normal">("");
  const [statsStudentSearch, setStatsStudentSearch] = useState("");
  const [statsSortBy, setStatsSortBy] = useState<"missingDesc" | "registerDesc" | "studentName">("missingDesc");

  useEffect(() => {
    if (!activeHomeworkBatchCorrection) return;
    setRecordSubjectName(activeHomeworkBatchCorrection.subjectName);
    setRecordHomeworkDate(activeHomeworkBatchCorrection.homeworkDate);
    setRecordEventType(activeHomeworkBatchCorrection.eventType);
    setRecordValue(activeHomeworkBatchCorrection.value);
  }, [activeHomeworkBatchCorrection]);

  function formatDateTime(value: string) {
    return value ? new Date(value).toLocaleString("zh-CN") : "-";
  }

  function formatBatchTime(item: HomeworkBatchHistoryItem) {
    const time = item.occurredAt || item.createdAt;
    return time ? new Date(time).toLocaleString("zh-CN") : "-";
  }

  function matchesDateRange(value: string, dateFrom: string, dateTo: string) {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  }

  const filteredBatchHistory = homeworkBatchHistory
    .filter((item) => {
      const matchesType = !historyTypeFilter || item.transactionType === historyTypeFilter;
      const keyword = historySearch.trim();
      const batchIdShort = item.batchId.slice(0, 8);
      const typeLabel = item.transactionType === "penalty" ? "未交" : "登记";
      const matchesSearch =
        !keyword ||
        [
          item.reason,
          item.subjectName,
          item.homeworkDate,
          item.scene,
          item.category,
          item.value,
          item.representativeRewardValue || "",
          String(item.count),
          String(item.representativeCount),
          item.occurredAt.slice(0, 10),
          item.createdAt.slice(0, 10),
          batchIdShort,
          typeLabel
        ]
          .some((value) => value.includes(keyword));
      const matchesDate = matchesDateRange(item.occurredAt || item.createdAt, historyDateFrom, historyDateTo);
      return matchesType && matchesSearch && matchesDate;
    })
    .sort((left, right) => {
      if (historySortBy === "count") {
        return right.totalCount - left.totalCount;
      }
      const leftValue = historySortBy === "occurredAt" ? left.occurredAt : left.createdAt;
      const rightValue = historySortBy === "occurredAt" ? right.occurredAt : right.createdAt;
      return rightValue.localeCompare(leftValue);
    });
  const filteredRecentAudits = (homework?.recentAudits || []).filter((item) => {
    const matchesType = !recentAuditTypeFilter || item.action === recentAuditTypeFilter;
    const matchesRevert = !recentAuditRevertFilter || (recentAuditRevertFilter === "revertible" ? item.canRevert : !item.canRevert);
    const keyword = recentAuditSearch.trim();
    const subjectName = typeof item.afterData?.subjectName === "string" ? item.afterData.subjectName : "";
    const homeworkDate = typeof item.afterData?.homeworkDate === "string" ? item.afterData.homeworkDate : "";
    const studentName = typeof item.afterData?.studentName === "string" ? item.afterData.studentName : "";
    const eventType = item.afterData?.eventType === "missing" ? "未交" : item.afterData?.eventType === "register" ? "登记" : "";
    const revertedCount = typeof item.afterData?.revertedCount === "number" ? String(item.afterData.revertedCount) : "";
    const batchSize = typeof item.metadata?.batchSize === "number" ? String(item.metadata.batchSize) : "";
    const batchId = typeof item.afterData?.batchId === "string" ? item.afterData.batchId.slice(0, 8) : "";
    const actorName = item.actorUser?.displayName || item.actorUser?.username || "";
    const matchesSearch =
      !keyword ||
      [item.label, subjectName, homeworkDate, studentName, eventType, revertedCount, batchSize, batchId, actorName].some((value) =>
        value.includes(keyword)
      );
    const matchesDate = matchesDateRange(item.createdAt, recentAuditDateFrom, recentAuditDateTo);
    return matchesType && matchesRevert && matchesSearch && matchesDate;
  });
  const filteredRecentAuditSummary = filteredRecentAudits.reduce(
    (totals, item) => {
      if (item.action === "homework.record.create") totals.single += 1;
      if (item.action === "homework.record.batch_create") totals.batch += 1;
      if (item.action === "homework.record.revert") totals.singleRevert += 1;
      if (item.action === "homework.record.batch_revert") totals.batchRevert += 1;
      if (item.canRevert) totals.revertible += 1;
      return totals;
    },
    { single: 0, batch: 0, singleRevert: 0, batchRevert: 0, revertible: 0 }
  );
  function buildRecentAuditContext(item: HomeworkOverview["recentAudits"][number]) {
    const context: string[] = [];
    const eventType = item.afterData?.eventType === "missing" ? "未交" : item.afterData?.eventType === "register" ? "登记" : "";
    const value = item.afterData?.value != null ? String(item.afterData.value) : "";
    const batchSize = typeof item.metadata?.batchSize === "number" ? item.metadata.batchSize : null;
    const revertedCount = typeof item.afterData?.revertedCount === "number" ? item.afterData.revertedCount : null;
    const batchId = typeof item.afterData?.batchId === "string" ? item.afterData.batchId.slice(0, 8) : "";
    const correctionBatchId =
      typeof item.afterData?.correctionBatchId === "string" ? item.afterData.correctionBatchId.slice(0, 8) : "";
    const reason = typeof item.afterData?.reason === "string" ? item.afterData.reason : "";

    if (eventType) {
      context.push(`类型 ${eventType}`);
    }
    if (value) {
      context.push(`分值 ${value}`);
    }
    if (batchSize) {
      context.push(`批量 ${batchSize} 人`);
    }
    if (revertedCount) {
      context.push(`回退 ${revertedCount} 条`);
    }
    if (batchId) {
      context.push(`批次 ${batchId}`);
    }
    if (correctionBatchId) {
      context.push(`替代批次 ${correctionBatchId}`);
    }
    if (reason) {
      context.push(`理由 ${reason}`);
    }

    return context.join(" · ");
  }
  const filteredBatchHistorySummary = filteredBatchHistory.reduce(
    (totals, item) => {
      if (item.transactionType === "penalty") totals.missingBatches += 1;
      if (item.transactionType === "reward") totals.registerBatches += 1;
      totals.students += item.count;
      totals.representatives += item.representativeCount;
      return totals;
    },
    { missingBatches: 0, registerBatches: 0, students: 0, representatives: 0 }
  );
  const filteredHomeworkDetailItems = (homeworkDetail?.items || [])
    .filter((item) => {
      const matchesEventType = !detailEventTypeFilter || item.eventType === detailEventTypeFilter;
      const keyword = detailStudentSearch.trim();
      const matchesStudent = !keyword || item.student.name.includes(keyword) || (item.student.legacyId || "").includes(keyword);
      return matchesEventType && matchesStudent;
    })
    .sort((left, right) => {
      if (detailSortBy === "studentName") {
        return left.student.name.localeCompare(right.student.name, "zh-CN");
      }
      if (detailSortBy === "occurredAtAsc") {
        return left.occurredAt.localeCompare(right.occurredAt);
      }
      return right.occurredAt.localeCompare(left.occurredAt);
    });
  const filteredHomeworkDetailTotals = filteredHomeworkDetailItems.reduce(
    (totals, item) => {
      totals.events += 1;
      if (item.eventType === "missing") {
        totals.missingCount += 1;
      } else {
        totals.registerCount += 1;
      }
      return totals;
    },
    { events: 0, missingCount: 0, registerCount: 0 }
  );
  const filteredHomeworkStudentStatsItems = (homeworkStudentStats?.items || [])
    .filter((item) => {
      const matchesStatus =
        !statsStatusFilter ||
        (statsStatusFilter === "attention" ? item.missingCount > 0 : item.missingCount === 0);
      const keyword = statsStudentSearch.trim();
      const matchesStudent = !keyword || item.student.name.includes(keyword) || (item.student.legacyId || "").includes(keyword);
      return matchesStatus && matchesStudent;
    })
    .sort((left, right) => {
      if (statsSortBy === "studentName") {
        return left.student.name.localeCompare(right.student.name, "zh-CN");
      }
      if (statsSortBy === "registerDesc") {
        if (right.registerCount !== left.registerCount) {
          return right.registerCount - left.registerCount;
        }
        return left.student.name.localeCompare(right.student.name, "zh-CN");
      }
      if (right.missingCount !== left.missingCount) {
        return right.missingCount - left.missingCount;
      }
      return left.student.name.localeCompare(right.student.name, "zh-CN");
    });
  const filteredHomeworkStudentStatsTotals = filteredHomeworkStudentStatsItems.reduce(
    (totals, item) => {
      totals.students += 1;
      totals.missingCount += item.missingCount;
      totals.registerCount += item.registerCount;
      return totals;
    },
    { students: 0, missingCount: 0, registerCount: 0 }
  );
  const selectedSubjectConfig = configuredSubjects.find((item) => item.name === recordSubjectName.trim()) || null;
  const selectedSubjectRepresentativeNames = (selectedSubjectConfig?.representativeStudentIds || [])
    .map((studentId) => students.find((item) => item.id === studentId)?.name || "")
    .filter(Boolean);
  const canSubmitBatchRecord =
    recordEventType === "missing"
      ? selectedBatchStudentIds.length > 0 || selectedSubjectRepresentativeNames.length > 0
      : selectedBatchStudentIds.length > 0;
  const activeCorrectionTypeLabel = activeHomeworkBatchCorrection
    ? activeHomeworkBatchCorrection.eventType === "missing"
      ? "未交扣分"
      : "登记奖励"
    : "";

  function submitRecord() {
    if (!recordStudentId || !recordSubjectName.trim() || !recordHomeworkDate || !Number(recordValue)) return;
    onCreateHomeworkRecord({
      studentId: recordStudentId,
      subjectName: recordSubjectName.trim(),
      homeworkDate: recordHomeworkDate,
      eventType: recordEventType,
      value: Number(recordValue)
    });
  }

  function submitBatchRecord() {
    if (!canSubmitBatchRecord || !recordSubjectName.trim() || !recordHomeworkDate || !Number(recordValue)) return;
    onCreateHomeworkBatchRecord({
      studentIds: selectedBatchStudentIds,
      subjectName: recordSubjectName.trim(),
      homeworkDate: recordHomeworkDate,
      eventType: recordEventType,
      value: Number(recordValue)
    });
  }

  return (
    <>
      <section className="panel">
      <div className="panel-header">
        <h2>作业总览</h2>
        <span>{homework?.range.days ?? 0} 天窗口</span>
      </div>

      {homework ? (
        <>
          <div className="attendance-summary-strip">
            <div>
              <span>学科数</span>
              <strong>{homework.totals.subjects}</strong>
            </div>
            <div>
              <span>作业日数</span>
              <strong>{homework.totals.homeworkDays}</strong>
            </div>
            <div>
              <span>未交记录</span>
              <strong>{homework.totals.missingCount}</strong>
            </div>
            <div>
              <span>登记奖励</span>
              <strong>{homework.totals.registerCount}</strong>
            </div>
          </div>

          <div className="migration-grid">
            {homework.subjects.map((item) => (
              <div key={item.subjectName} className="migration-card">
                <p className="section-kicker">学科</p>
                <strong>{item.subjectName}</strong>
                <span>
                  未交 {item.missingCount} 次 · 登记 {item.registerCount} 次 · 涉及 {item.affectedStudentCount} 人
                </span>
                <span>最近作业日：{item.lastHomeworkDate || "-"}</span>
              </div>
            ))}
          </div>

          <div className="panel-header compact">
            <h3>作业登记</h3>
            <span>{canManageHomework ? "可写" : "只读"}</span>
          </div>
          <div className="adjustment-form">
            {activeHomeworkBatchCorrection ? (
              <div className="migration-card">
                <p className="section-kicker">批量修正中</p>
                <strong>
                  {activeHomeworkBatchCorrection.subjectName} · {activeHomeworkBatchCorrection.homeworkDate}
                </strong>
                <span>
                  原批次：{activeCorrectionTypeLabel} · {activeHomeworkBatchCorrection.count} 人
                  {activeHomeworkBatchCorrection.representativeCount
                    ? ` · 课代表 ${activeHomeworkBatchCorrection.representativeCount} 人`
                    : ""}
                </span>
                <span className="muted">
                  提交后会先撤销原批次，再按当前勾选学生重建这次批量作业登记。
                </span>
                <div className="import-footer">
                  <button type="button" className="inline-action" onClick={onCancelHomeworkBatchCorrection}>
                    取消修正模式
                  </button>
                </div>
              </div>
            ) : null}
            {!canManageHomework ? <p className="muted">当前账号没有作业登记写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，作业登记与撤销已暂停。</p> : null}
            <label>
              <span>学生</span>
              <select value={recordStudentId} onChange={(event) => setRecordStudentId(event.target.value)}>
                <option value="">请选择学生</option>
                {students.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} #{item.legacyId || "-"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>学科</span>
              <input
                list="configured-homework-subjects"
                value={recordSubjectName}
                onChange={(event) => setRecordSubjectName(event.target.value)}
                placeholder="例如：语文"
              />
            </label>
            <datalist id="configured-homework-subjects">
              {configuredSubjects.map((item) => (
                <option key={item.id} value={item.name} />
              ))}
            </datalist>
            <label>
              <span>作业日期</span>
              <input type="date" value={recordHomeworkDate} onChange={(event) => setRecordHomeworkDate(event.target.value)} />
            </label>
            <label>
              <span>事件类型</span>
              <select value={recordEventType} onChange={(event) => setRecordEventType(event.target.value as "missing" | "register")}>
                <option value="missing">未交扣分</option>
                <option value="register">登记奖励</option>
              </select>
            </label>
            <label>
              <span>分值</span>
              <input type="number" min="0.1" step="0.1" value={recordValue} onChange={(event) => setRecordValue(event.target.value)} />
            </label>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={
                  !canManageHomework ||
                  classFrozen ||
                  creatingHomeworkRecord ||
                  !recordStudentId ||
                  !recordSubjectName.trim() ||
                  !recordHomeworkDate ||
                  !Number(recordValue)
                }
                onClick={submitRecord}
              >
                {creatingHomeworkRecord ? "提交中..." : "登记作业事件"}
              </button>
              <span className="muted">当前阶段会直接写入积分流水，并自动刷新作业统计。</span>
            </div>
            {homeworkWriteMessage ? <p className="success-text">{homeworkWriteMessage}</p> : null}
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={
                  !canManageHomework ||
                  classFrozen ||
                  creatingHomeworkBatchRecord ||
                  !canSubmitBatchRecord ||
                  !recordSubjectName.trim() ||
                  !recordHomeworkDate ||
                  !Number(recordValue)
                }
                onClick={submitBatchRecord}
              >
                {creatingHomeworkBatchRecord
                  ? activeHomeworkBatchCorrection
                    ? "批量修正中..."
                    : "批量提交中..."
                  : `${activeHomeworkBatchCorrection ? "提交批量修正" : "批量登记"}${
                      selectedBatchStudentIds.length ? ` ${selectedBatchStudentIds.length} 名未交学生` : ""
                    }${
                      recordEventType === "missing" && selectedSubjectRepresentativeNames.length
                        ? `${selectedBatchStudentIds.length ? "，" : " "}课代表 ${selectedSubjectRepresentativeNames.length} 名`
                        : ""
                    }`}
              </button>
              {canRevertLatestHomeworkBatch ? (
                <button
                  type="button"
                  className="inline-action"
                  disabled={!canManageHomework || classFrozen || creatingHomeworkBatchRecord || revertingHomeworkBatchRecord}
                  onClick={onRevertHomeworkBatchRecord}
                >
                  {revertingHomeworkBatchRecord ? "撤销中..." : "撤销最近批量登记"}
                </button>
              ) : null}
              <span className="muted">
                {activeHomeworkBatchCorrection
                  ? "批量修正会复用当前学生页勾选结果，并用新批次替换当前修正目标。"
                  : "批量登记会复用当前学生页勾选结果，跳过已存在的同日同学科记录。"}
                {recordEventType === "missing" && selectedSubjectRepresentativeNames.length
                  ? ` 当前学科课代表：${selectedSubjectRepresentativeNames.join(" / ")}。`
                  : ""}
              </span>
            </div>
          </div>

          <div className="panel-header compact">
            <h3>作业登记明细</h3>
            <span>{filteredHomeworkDetailTotals.events} / {homeworkDetail?.totals.events ?? 0} 条</span>
          </div>

          <div className="panel-header compact">
            <h3>最近作业操作</h3>
            <span>{filteredRecentAudits.length} / {homework?.recentAudits.length ?? 0} 条</span>
          </div>
          <div className="student-filters">
            <label>
              <span>操作类型</span>
              <select
                value={recentAuditTypeFilter}
                onChange={(event) => setRecentAuditTypeFilter(event.target.value as "" | RecentHomeworkAuditAction)}
              >
                <option value="">全部</option>
                {RECENT_HOMEWORK_AUDIT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                placeholder="按学科/日期/学生/批次/人数/操作人筛选"
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
              <span>单条登记</span>
              <strong>{filteredRecentAuditSummary.single}</strong>
            </div>
            <div>
              <span>批量登记</span>
              <strong>{filteredRecentAuditSummary.batch}</strong>
            </div>
            <div>
              <span>单条撤销</span>
              <strong>{filteredRecentAuditSummary.singleRevert}</strong>
            </div>
            <div>
              <span>批量撤销</span>
              <strong>{filteredRecentAuditSummary.batchRevert}</strong>
            </div>
            <div>
              <span>当前可撤销</span>
              <strong>{filteredRecentAuditSummary.revertible}</strong>
            </div>
          </div>
          <div className="transaction-list">
            {filteredRecentAudits.map((item) => {
              const subjectName = typeof item.afterData?.subjectName === "string" ? item.afterData.subjectName : "";
              const homeworkDate = typeof item.afterData?.homeworkDate === "string" ? item.afterData.homeworkDate : "";
              const studentName = typeof item.afterData?.studentName === "string" ? item.afterData.studentName : "";
              const eventType = item.afterData?.eventType === "missing" ? "未交" : item.afterData?.eventType === "register" ? "登记" : "";
              return (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>{item.actorUser?.displayName || item.actorUser?.username || "系统"}</strong>
                    <span>
                      {[item.label, subjectName, homeworkDate, studentName, eventType].filter(Boolean).join(" · ") || item.action}
                    </span>
                    {buildRecentAuditContext(item) ? <span className="muted">{buildRecentAuditContext(item)}</span> : null}
                    <span className="muted">{item.canRevert ? "可撤销" : "不可撤销"}</span>
                  </div>
                  <div className="transaction-actions">
                    <b>{new Date(item.createdAt).toLocaleString("zh-CN")}</b>
                    {canManageHomework && item.canRevert ? (
                      <button
                        type="button"
                        className="inline-action"
                        disabled={classFrozen || revertingHomeworkAuditId === item.id}
                        onClick={() =>
                          onRevertHomeworkAudit({
                            auditId: item.id,
                            label: item.label,
                            subjectName,
                            homeworkDate,
                            studentName,
                            batchId: typeof item.metadata?.batchId === "string" ? item.metadata.batchId : undefined,
                            eventType: item.afterData?.eventType === "missing" || item.afterData?.eventType === "register"
                              ? item.afterData.eventType
                              : ""
                          })
                        }
                      >
                        {revertingHomeworkAuditId === item.id ? "撤销中..." : "撤销"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {!filteredRecentAudits.length ? (
              <p className="muted">{homework?.recentAudits.length ? "当前筛选条件下没有匹配的作业操作" : "暂无最近作业操作"}</p>
            ) : null}
          </div>

          <div className="attendance-filters">
            <label>
              <span>作业日期</span>
              <select value={selectedHomeworkDate} onChange={(event) => onHomeworkDateChange(event.target.value)}>
                <option value="">自动选择最新</option>
                {(homeworkDetail?.filters.availableHomeworkDates || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>学科</span>
              <select value={selectedHomeworkSubject} onChange={(event) => onHomeworkSubjectChange(event.target.value)}>
                <option value="">自动选择首个学科</option>
                {(homeworkDetail?.filters.availableSubjects || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="homework-filter-summary">
              <span>未交 {filteredHomeworkDetailTotals.missingCount}</span>
              <span>登记 {filteredHomeworkDetailTotals.registerCount}</span>
            </div>
          </div>
          <div className="student-filters">
            <label>
              <span>事件类型</span>
              <select value={detailEventTypeFilter} onChange={(event) => setDetailEventTypeFilter(event.target.value as "" | "missing" | "register")}>
                <option value="">全部</option>
                <option value="missing">未交</option>
                <option value="register">登记</option>
              </select>
            </label>
            <label>
              <span>学生筛选</span>
              <input
                type="text"
                value={detailStudentSearch}
                onChange={(event) => setDetailStudentSearch(event.target.value)}
                placeholder="按姓名或学号筛选"
              />
            </label>
            <label>
              <span>排序方式</span>
              <select
                value={detailSortBy}
                onChange={(event) => setDetailSortBy(event.target.value as "occurredAtDesc" | "occurredAtAsc" | "studentName")}
              >
                <option value="occurredAtDesc">最新优先</option>
                <option value="occurredAtAsc">最早优先</option>
                <option value="studentName">按学生姓名</option>
              </select>
            </label>
          </div>

          <div className="transaction-list">
            {filteredHomeworkDetailItems.map((item) => (
              <div key={item.id} className="transaction-row">
                <div>
                  <strong>
                    {item.subjectName} · {item.homeworkDate}
                  </strong>
                  <span>
                    {item.student.name} #{item.student.legacyId || "-"} · {item.eventType === "missing" ? "未交" : "登记"} · {item.value}
                  </span>
                </div>
                <div className="transaction-actions">
                  <b>{new Date(item.occurredAt).toLocaleString("zh-CN")}</b>
                  {canManageHomework ? (
                    <button
                      type="button"
                      className="inline-action"
                      disabled={revertingHomeworkRecordId === item.id || classFrozen}
                      onClick={() =>
                        onRevertHomeworkRecord({
                          transactionId: item.id,
                          subjectName: item.subjectName,
                          homeworkDate: item.homeworkDate,
                          studentName: item.student.name,
                          eventType: item.eventType
                        })
                      }
                    >
                      {revertingHomeworkRecordId === item.id ? "撤销中..." : "撤销"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {!filteredHomeworkDetailItems.length ? (
              <p className="muted">{homeworkDetail?.items.length ? "当前筛选条件下没有匹配的作业明细" : "暂无作业登记明细"}</p>
            ) : null}
          </div>

          <div className="panel-header compact">
            <h3>学生作业统计</h3>
            <span>{filteredHomeworkStudentStatsTotals.students} / {homeworkStudentStats?.totals.students ?? 0} 人</span>
          </div>
          <div className="student-filters">
            <label>
              <span>学生状态</span>
              <select value={statsStatusFilter} onChange={(event) => setStatsStatusFilter(event.target.value as "" | "attention" | "normal")}>
                <option value="">全部</option>
                <option value="attention">需关注</option>
                <option value="normal">正常</option>
              </select>
            </label>
            <label>
              <span>学生筛选</span>
              <input
                type="text"
                value={statsStudentSearch}
                onChange={(event) => setStatsStudentSearch(event.target.value)}
                placeholder="按姓名或学号筛选"
              />
            </label>
            <label>
              <span>排序方式</span>
              <select value={statsSortBy} onChange={(event) => setStatsSortBy(event.target.value as "missingDesc" | "registerDesc" | "studentName")}>
                <option value="missingDesc">未交次数优先</option>
                <option value="registerDesc">登记次数优先</option>
                <option value="studentName">按学生姓名</option>
              </select>
            </label>
            <div className="homework-filter-summary">
              <span>未交 {filteredHomeworkStudentStatsTotals.missingCount}</span>
              <span>登记 {filteredHomeworkStudentStatsTotals.registerCount}</span>
            </div>
          </div>

          <div className="transaction-list">
            {filteredHomeworkStudentStatsItems.map((item) => (
              <div key={item.student.id} className="transaction-row">
                <div>
                  <strong>
                    {item.student.name} #{item.student.legacyId || "-"}
                  </strong>
                  <span>
                    未交 {item.missingCount} 次 · 登记 {item.registerCount} 次
                  </span>
                </div>
                <b>{item.missingCount > 0 ? "需关注" : "正常"}</b>
              </div>
            ))}
            {!filteredHomeworkStudentStatsItems.length ? (
              <p className="muted">{homeworkStudentStats?.items.length ? "当前筛选条件下没有匹配的学生统计" : "暂无学生作业统计"}</p>
            ) : null}
          </div>
        </>
      ) : (
        <p className="muted">当前班级暂无作业总览</p>
      )}
      </section>
      <section className="panel">
      <div className="panel-header">
        <h2>历史批量作业登记</h2>
        <span>{filteredBatchHistory.length} / {homeworkBatchHistory.length} 条</span>
      </div>
      <div className="student-filters">
        <label>
          <span>登记类型</span>
          <select value={historyTypeFilter} onChange={(event) => setHistoryTypeFilter(event.target.value as "" | "penalty" | "reward")}>
            <option value="">全部</option>
            <option value="penalty">未交</option>
            <option value="reward">登记</option>
          </select>
        </label>
        <label>
          <span>理由筛选</span>
          <input
            type="text"
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="按理由/类型/人数/日期/批次筛选"
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
        <label>
          <span>排序方式</span>
          <select value={historySortBy} onChange={(event) => setHistorySortBy(event.target.value as "createdAt" | "occurredAt" | "count")}>
            <option value="createdAt">按入库时间</option>
            <option value="occurredAt">按发生时间</option>
            <option value="count">按影响人数</option>
          </select>
        </label>
      </div>
      <div className="attendance-summary-strip">
        <div>
          <span>未交批次</span>
          <strong>{filteredBatchHistorySummary.missingBatches}</strong>
        </div>
        <div>
          <span>登记批次</span>
          <strong>{filteredBatchHistorySummary.registerBatches}</strong>
        </div>
        <div>
          <span>学生人数</span>
          <strong>{filteredBatchHistorySummary.students}</strong>
        </div>
        <div>
          <span>课代表奖励</span>
          <strong>{filteredBatchHistorySummary.representatives}</strong>
        </div>
      </div>
      {classFrozen ? <p className="muted">当前班级已冻结，历史批量作业登记仍可查看，但撤销已暂停。</p> : null}
      <div className="transaction-list">
        {filteredBatchHistory.length ? (
          filteredBatchHistory.map((item) => (
            <div key={item.batchId} className="transaction-row">
              <div>
                <strong>
                  {item.subjectName || item.reason} {item.homeworkDate ? `· ${item.homeworkDate}` : ""}
                </strong>
                <span>
                  {item.eventType === "missing" ? "未交扣分" : "登记奖励"} · 学生 {item.count} 人 · {item.value} 分
                  {item.representativeCount
                    ? ` · 课代表 ${item.representativeCount} 人${item.representativeRewardValue ? `（各 ${item.representativeRewardValue} 分）` : ""}`
                    : ""}
                </span>
                <span className="muted">
                  批次 {item.batchId.slice(0, 8)} · 总计 {item.totalCount} 条 · 发生 {formatDateTime(item.occurredAt)} · 入库{" "}
                  {formatDateTime(item.createdAt)}
                  {activeHomeworkBatchCorrection?.batchId === item.batchId ? " · 修正中" : ""}
                </span>
              </div>
              <div className="transaction-actions">
                <span className="muted">{formatBatchTime(item)}</span>
                {canManageHomework ? (
                  <button
                    type="button"
                    className="inline-action"
                    disabled={classFrozen || creatingHomeworkBatchRecord}
                    onClick={() => onStartHomeworkBatchCorrection(item)}
                  >
                    {activeHomeworkBatchCorrection?.batchId === item.batchId ? "已载入修正" : "修正此批次"}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={classFrozen || revertingHomeworkBatchRecord || revertingHomeworkBatchId === item.batchId}
                  onClick={() => onRevertHomeworkBatchRecordById(item)}
                  title={classFrozen ? "班级冻结时不可撤销批量作业登记" : "撤销该批量作业登记"}
                >
                  {revertingHomeworkBatchId === item.batchId ? "撤销中..." : "撤销"}
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="muted">{homeworkBatchHistory.length ? "当前筛选条件下没有匹配的批量作业登记" : "暂无历史批量作业登记"}</p>
        )}
      </div>
      </section>
    </>
  );
}
