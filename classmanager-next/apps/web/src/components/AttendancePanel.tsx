import { useEffect, useState } from "react";

import type {
  AttendanceAudit,
  AttendanceBatchHistoryItem,
  AttendanceIssuesResponse,
  AttendanceOverview,
  AttendanceRecordStatus,
  AttendanceSessionDetail,
  AttendanceSessionListResponse,
  AttendanceSessionListItem,
  StudentItem
} from "../types";

const ATTENDANCE_WEEKDAY_OPTIONS = [
  { key: "monday", label: "周一", dayIndex: 1 },
  { key: "tuesday", label: "周二", dayIndex: 2 },
  { key: "wednesday", label: "周三", dayIndex: 3 },
  { key: "thursday", label: "周四", dayIndex: 4 },
  { key: "friday", label: "周五", dayIndex: 5 },
  { key: "saturday", label: "周六", dayIndex: 6 },
  { key: "sunday", label: "周日", dayIndex: 0 }
] as const;

const RECENT_ATTENDANCE_AUDIT_TYPES = [
  { value: "attendance.session.create", label: "新建场次" },
  { value: "attendance.record.create", label: "单条补录" },
  { value: "attendance.record.batch_create", label: "批量补录" },
  { value: "attendance.record.batch_create_revert", label: "批量补录撤销" },
  { value: "attendance.record.update", label: "单条修正" },
  { value: "attendance.record.revert", label: "单条修正撤销" },
  { value: "attendance.record.batch_update", label: "批量修正" },
  { value: "attendance.record.batch_revert", label: "批量修正撤销" },
  { value: "attendance.session.settle", label: "场次结算" },
  { value: "attendance.session.settle_revert", label: "场次结算撤销" },
  { value: "attendance.issue.absent_settle", label: "异常缺勤结算" },
  { value: "attendance.policy.update", label: "规则更新" }
] as const;

type AttendanceWeekdayKey = (typeof ATTENDANCE_WEEKDAY_OPTIONS)[number]["key"];
type AttendanceStatusFilter = "" | AttendanceRecordStatus;
type RecentAttendanceAuditAction = (typeof RECENT_ATTENDANCE_AUDIT_TYPES)[number]["value"];

type AttendanceScheduleDraft = {
  clientKey: string;
  id?: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  lateTime: string;
  isActive: boolean;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function createEmptyWeekendRulesDraft(): Record<AttendanceWeekdayKey, string[]> {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  };
}

function normalizeTimeDraftValue(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  const match = trimmed.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function formatDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) return `${dateFrom} ~ ${dateTo}`;
  if (dateFrom) return `${dateFrom} 起`;
  if (dateTo) return `截至 ${dateTo}`;
  return "全部日期";
}

function normalizeWeekendRulesDraft(
  value: unknown,
  schedules: Array<{
    id: string;
    code: string;
  }>
) {
  const normalized = createEmptyWeekendRulesDraft();
  if (!isPlainRecord(value)) {
    return normalized;
  }

  const orderMap = new Map(schedules.map((item, index) => [item.code, index]));
  const codeById = new Map(schedules.map((item) => [item.id, item.code]));

  for (const option of ATTENDANCE_WEEKDAY_OPTIONS) {
    const rawList = value[option.key];
    if (!Array.isArray(rawList)) continue;
    const nextCodes = rawList
      .map((item) => {
        if (typeof item === "number" && Number.isInteger(item) && item >= 0 && item < schedules.length) {
          return schedules[item]?.code || null;
        }
        if (typeof item !== "string") return null;
        const trimmed = item.trim();
        if (!trimmed) return null;
        if (orderMap.has(trimmed)) return trimmed;
        if (codeById.has(trimmed)) return codeById.get(trimmed) || null;
        if (/^\d+$/.test(trimmed)) {
          const index = Number(trimmed);
          if (index >= 0 && index < schedules.length) {
            return schedules[index]?.code || null;
          }
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
    normalized[option.key] = Array.from(new Set(nextCodes)).sort(
      (left, right) => (orderMap.get(left) ?? 999) - (orderMap.get(right) ?? 999)
    );
  }

  return normalized;
}

function normalizeSundaySpecialLateTimeDraft(
  value: unknown,
  schedules: Array<{
    id: string;
    code: string;
  }>
) {
  if (!isPlainRecord(value) || !isPlainRecord(value.sundaySpecialLateTime)) {
    return {} as Record<string, string>;
  }

  const normalized: Record<string, string> = {};
  for (const schedule of schedules) {
    const nextValue =
      value.sundaySpecialLateTime[schedule.code] ?? value.sundaySpecialLateTime[schedule.id];
    const normalizedTime = normalizeTimeDraftValue(nextValue);
    if (normalizedTime) {
      normalized[schedule.code] = normalizedTime;
    }
  }
  return normalized;
}

function getWeekdayKeyForDate(value: string): AttendanceWeekdayKey | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  return ATTENDANCE_WEEKDAY_OPTIONS.find((item) => item.dayIndex === date.getUTCDay())?.key || null;
}

function createAttendanceScheduleDraft(
  item?: Partial<Omit<AttendanceScheduleDraft, "clientKey">>
): AttendanceScheduleDraft {
  return {
    clientKey:
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `schedule_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    id: item?.id,
    code: item?.code || "",
    name: item?.name || "",
    startTime: item?.startTime || "00:00",
    endTime: item?.endTime || "00:00",
    lateTime: item?.lateTime || "00:00",
    isActive: item?.isActive ?? true
  };
}

function normalizeAttendanceScheduleDrafts(attendance: AttendanceOverview | null) {
  return (attendance?.schedules || []).map((item) =>
    createAttendanceScheduleDraft({
      id: item.id,
      code: item.code,
      name: item.name,
      startTime: item.startTime,
      endTime: item.endTime,
      lateTime: item.lateTime,
      isActive: item.isActive
    })
  );
}

const ATTENDANCE_RECORD_STATUSES: AttendanceRecordStatus[] = ["present", "late", "absent", "excused"];

const attendanceStatusLabels: Record<AttendanceRecordStatus, string> = {
  present: "出勤",
  late: "迟到",
  absent: "缺勤",
  excused: "请假"
};

function attendanceStatusUsesCheckIn(status: string) {
  return status === "present" || status === "late";
}

type AttendancePanelProps = {
  attendance: AttendanceOverview | null;
  sessionListMeta: AttendanceSessionListResponse | null;
  sessions: AttendanceSessionListItem[];
  selectedSessionId: string;
  sessionDetail: AttendanceSessionDetail | null;
  attendanceAudits: { items: AttendanceAudit[] } | null;
  attendanceIssues: AttendanceIssuesResponse | null;
  attendanceBatchHistory: AttendanceBatchHistoryItem[];
  canManageAttendance: boolean;
  classFrozen: boolean;
  revertingAttendanceAuditId: string;
  updatingAttendanceRecordId: string;
  revertingAttendanceRecordId: string;
  selectedRecordIds: string[];
  batchUpdatingAttendance: boolean;
  batchRevertingAttendance: boolean;
  batchRevertingAttendanceCreate: boolean;
  revertingAttendanceBatch: boolean;
  revertingAttendanceBatchId: string;
  creatingAttendanceSession: boolean;
  updatingAttendanceSchedules: boolean;
  updatingAttendancePolicy: boolean;
  updatingAttendanceIssues: boolean;
  awardingPerfectAttendance: boolean;
  revertingPerfectAttendance: boolean;
  canRevertPerfectAttendance: boolean;
  perfectStudentsCount: number;
  settlingAttendanceSession: boolean;
  settlingAttendanceIssues: boolean;
  revertingAttendanceSessionSettlement: boolean;
  lastAttendanceIssueSettlementPreview: {
    settledCount: number;
    skippedCount: number;
    sessionCount: number;
    firstSessionLabel: string;
    absentPenaltyValue: string;
    dateFrom: string;
    dateTo: string;
    sessionCode: string;
  } | null;
  creatingAttendanceRecord: boolean;
  creatingAttendanceRecordBatch: boolean;
  attendanceWriteMessage: string;
  students: StudentItem[];
  dateFrom: string;
  dateTo: string;
  sessionCode: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSessionCodeChange: (value: string) => void;
  onSelectSession: (sessionId: string) => void;
  onUpdateAttendanceRecord: (recordId: string, status: AttendanceRecordStatus) => void;
  onRevertAttendanceRecord: (recordId: string) => void;
  onCreateAttendanceSession: (input: {
    sessionDate: string;
    sessionCode: string;
    initialStatus: AttendanceRecordStatus;
  }) => void;
  onUpdateAttendanceSchedules: (input: {
    items: Array<{
      id?: string;
      code: string;
      name: string;
      startTime: string;
      endTime: string;
      lateTime: string;
      isActive?: boolean;
    }>;
  }) => void;
  onUpdateAttendancePolicy: (input: {
    latePenaltyValue: number;
    absentPenaltyValue: number;
    perfectAttendanceBonusValue: number;
    weekendRules: Record<string, string[]>;
    specialRules: Record<string, unknown>;
  }) => void;
  onAwardPerfectAttendance: () => void;
  onRevertPerfectAttendance: () => void;
  onSettleAttendanceSession: () => void;
  onRevertAttendanceSessionSettlement: () => void;
  onCreateAttendanceRecord: (input: { studentId: string; status: AttendanceRecordStatus }) => void;
  onCreateAttendanceRecordBatch: (input: {
    studentIds: string[];
    status: AttendanceRecordStatus;
  }) => void;
  onRevertAttendanceAudit: (audit: AttendanceAudit) => void;
  onToggleRecordSelection: (recordId: string) => void;
  onSelectAllRecords: () => void;
  onClearRecordSelection: () => void;
  onBatchUpdateAttendanceRecords: (status: AttendanceRecordStatus) => void;
  onBatchRevertAttendanceRecords: () => void;
  onBatchRevertAttendanceCreateRecords: () => void;
  onRevertAttendanceBatchById: (item: AttendanceBatchHistoryItem) => void;
  onUpdateAttendanceIssues: (recordIds: string[], status: AttendanceRecordStatus) => void;
  onSettleAttendanceIssues: (recordIds: string[]) => void;
};

export function AttendancePanel({
  attendance,
  sessionListMeta,
  sessions,
  selectedSessionId,
  sessionDetail,
  attendanceAudits,
  attendanceIssues,
  attendanceBatchHistory,
  canManageAttendance,
  classFrozen,
  revertingAttendanceAuditId,
  updatingAttendanceRecordId,
  revertingAttendanceRecordId,
  selectedRecordIds,
  batchUpdatingAttendance,
  batchRevertingAttendance,
  batchRevertingAttendanceCreate,
  revertingAttendanceBatch,
  revertingAttendanceBatchId,
  creatingAttendanceSession,
  updatingAttendanceSchedules,
  updatingAttendancePolicy,
  updatingAttendanceIssues,
  awardingPerfectAttendance,
  revertingPerfectAttendance,
  canRevertPerfectAttendance,
  perfectStudentsCount,
  settlingAttendanceSession,
  settlingAttendanceIssues,
  revertingAttendanceSessionSettlement,
  lastAttendanceIssueSettlementPreview,
  creatingAttendanceRecord,
  creatingAttendanceRecordBatch,
  attendanceWriteMessage,
  students,
  dateFrom,
  dateTo,
  sessionCode,
  onDateFromChange,
  onDateToChange,
  onSessionCodeChange,
  onSelectSession,
  onUpdateAttendanceRecord,
  onRevertAttendanceRecord,
  onCreateAttendanceSession,
  onUpdateAttendanceSchedules,
  onUpdateAttendancePolicy,
  onAwardPerfectAttendance,
  onRevertPerfectAttendance,
  onSettleAttendanceSession,
  onRevertAttendanceSessionSettlement,
  onCreateAttendanceRecord,
  onCreateAttendanceRecordBatch,
  onRevertAttendanceAudit,
  onToggleRecordSelection,
  onSelectAllRecords,
  onClearRecordSelection,
  onBatchUpdateAttendanceRecords,
  onBatchRevertAttendanceRecords,
  onBatchRevertAttendanceCreateRecords,
  onRevertAttendanceBatchById,
  onUpdateAttendanceIssues,
  onSettleAttendanceIssues
}: AttendancePanelProps) {
  const [newSessionDate, setNewSessionDate] = useState("");
  const [newSessionCode, setNewSessionCode] = useState("");
  const [newSessionInitialStatus, setNewSessionInitialStatus] = useState<AttendanceRecordStatus>("present");
  const [latePenaltyDraft, setLatePenaltyDraft] = useState(attendance?.policy?.latePenaltyValue || "-1");
  const [absentPenaltyDraft, setAbsentPenaltyDraft] = useState(attendance?.policy?.absentPenaltyValue || "-5");
  const [perfectBonusDraft, setPerfectBonusDraft] = useState(attendance?.policy?.perfectAttendanceBonusValue || "10");
  const [scheduleDrafts, setScheduleDrafts] = useState<AttendanceScheduleDraft[]>(() =>
    normalizeAttendanceScheduleDrafts(attendance)
  );
  const [weekendRulesDraft, setWeekendRulesDraft] = useState<Record<AttendanceWeekdayKey, string[]>>(() =>
    normalizeWeekendRulesDraft(attendance?.policy?.weekendRules, attendance?.schedules || [])
  );
  const [sundaySpecialLateTimeDraft, setSundaySpecialLateTimeDraft] = useState<Record<string, string>>(() =>
    normalizeSundaySpecialLateTimeDraft(attendance?.policy?.specialRules, attendance?.schedules || [])
  );
  const [newRecordStudentId, setNewRecordStudentId] = useState("");
  const [newRecordStudentIds, setNewRecordStudentIds] = useState<string[]>([]);
  const [newRecordStatus, setNewRecordStatus] = useState<AttendanceRecordStatus>("present");
  const [recentAuditTypeFilter, setRecentAuditTypeFilter] = useState<"" | RecentAttendanceAuditAction>("");
  const [recentAuditRevertFilter, setRecentAuditRevertFilter] = useState<"" | "revertible" | "locked">("");
  const [recentAuditSearch, setRecentAuditSearch] = useState("");
  const [recentAuditDateFrom, setRecentAuditDateFrom] = useState("");
  const [recentAuditDateTo, setRecentAuditDateTo] = useState("");
  const [historyOperationFilter, setHistoryOperationFilter] = useState<"" | "batch_create" | "batch_update">("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<AttendanceStatusFilter>("");
  const [historySearch, setHistorySearch] = useState("");
  const [historySortBy, setHistorySortBy] = useState<"recordedAt" | "count">("recordedAt");
  const [issueStatusFilter, setIssueStatusFilter] = useState<"" | "late" | "absent" | "excused">("");
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedIssueRecordIds, setSelectedIssueRecordIds] = useState<string[]>([]);
  const [detailStatusFilter, setDetailStatusFilter] = useState<AttendanceStatusFilter>("");
  const [detailStudentSearch, setDetailStudentSearch] = useState("");
  const [sessionStatusFilter, setSessionStatusFilter] = useState<"" | "open" | "closed">("");
  const [sessionSearch, setSessionSearch] = useState("");
  const scheduleOrderMap = new Map((attendance?.schedules || []).map((item, index) => [item.code, index]));
  const activeSchedules = (attendance?.schedules || []).filter((item) => item.isActive);
  const selectedNewSessionWeekday = getWeekdayKeyForDate(newSessionDate);
  const hasConfiguredWeekendRules = ATTENDANCE_WEEKDAY_OPTIONS.some(
    (option) => weekendRulesDraft[option.key].length > 0
  );
  const availableNewSessionSchedules = activeSchedules.filter((item) => {
    if (!selectedNewSessionWeekday || !hasConfiguredWeekendRules) {
      return true;
    }
    return weekendRulesDraft[selectedNewSessionWeekday].includes(item.code);
  });
  const missingStudents = sessionDetail
    ? students.filter((student) => !sessionDetail.items.some((item) => item.student.id === student.id))
    : [];
  const formatBatchTime = (value: string) => new Date(value).toLocaleString("zh-CN");
  const matchesDateRange = (value: string, dateFrom: string, dateTo: string) => {
    const datePart = value.slice(0, 10);
    if (dateFrom && datePart < dateFrom) return false;
    if (dateTo && datePart > dateTo) return false;
    return true;
  };
  const filteredBatchHistory = attendanceBatchHistory
    .filter((item) => {
      const matchesOperation = !historyOperationFilter || item.operation === historyOperationFilter;
      const matchesStatus = !historyStatusFilter || item.status === historyStatusFilter;
      const keyword = historySearch.trim();
      const operationLabel = item.operation === "batch_create" ? "批量补录" : "批量修正";
      const statusLabel = attendanceStatusLabels[item.status] || item.status;
      const matchesSearch =
        !keyword ||
        [operationLabel, statusLabel, String(item.count), item.recordedAt.slice(0, 10), item.batchId.slice(0, 8)].some((value) => value.includes(keyword));
      return matchesOperation && matchesStatus && matchesSearch;
    })
    .sort((left, right) => {
      if (historySortBy === "count") {
        return right.count - left.count;
      }
      return right.recordedAt.localeCompare(left.recordedAt);
    });
  const filteredRecentAudits = (attendanceAudits?.items || []).filter((audit) => {
    const matchesType = !recentAuditTypeFilter || audit.action === recentAuditTypeFilter;
    const matchesRevert = !recentAuditRevertFilter || (recentAuditRevertFilter === "revertible" ? audit.canRevert : !audit.canRevert);
    const keyword = recentAuditSearch.trim();
    const actorName = audit.actorUser?.displayName || audit.actorUser?.username || "";
    const studentName = typeof audit.afterData?.studentName === "string" ? audit.afterData.studentName : "";
    const sessionName = typeof audit.afterData?.sessionName === "string" ? audit.afterData.sessionName : "";
    const sessionCode = typeof audit.afterData?.sessionCode === "string" ? audit.afterData.sessionCode : "";
    const status = typeof audit.afterData?.status === "string" ? audit.afterData.status : "";
    const settledCount = typeof audit.afterData?.settledCount === "number" ? String(audit.afterData.settledCount) : "";
    const revertedCount = typeof audit.afterData?.revertedCount === "number" ? String(audit.afterData.revertedCount) : "";
    const batchSize = typeof audit.metadata?.batchSize === "number" ? String(audit.metadata.batchSize) : "";
    const matchesSearch =
      !keyword ||
      [audit.label, actorName, studentName, sessionName, sessionCode, status, settledCount, revertedCount, batchSize].some((value) =>
        value.includes(keyword)
      );
    const matchesDate = matchesDateRange(audit.createdAt, recentAuditDateFrom, recentAuditDateTo);
    return matchesType && matchesRevert && matchesSearch && matchesDate;
  });
  const filteredRecentAuditSummary = filteredRecentAudits.reduce(
    (totals, audit) => {
      if (["attendance.record.update", "attendance.record.revert"].includes(audit.action)) totals.singleUpdate += 1;
      if (["attendance.record.batch_update", "attendance.record.batch_revert"].includes(audit.action)) totals.batchUpdate += 1;
      if (["attendance.session.create", "attendance.record.create", "attendance.record.batch_create", "attendance.record.batch_create_revert"].includes(audit.action)) totals.create += 1;
      if (["attendance.session.settle", "attendance.session.settle_revert"].includes(audit.action)) totals.sessionSettle += 1;
      if (audit.action === "attendance.issue.absent_settle") totals.issueSettle += 1;
      if (audit.canRevert) totals.revertible += 1;
      return totals;
    },
    {
      singleUpdate: 0,
      batchUpdate: 0,
      create: 0,
      sessionSettle: 0,
      issueSettle: 0,
      revertible: 0
    }
  );
  const buildRecentAuditContext = (audit: AttendanceAudit) => {
    const context: string[] = [];
    const studentName = typeof audit.afterData?.studentName === "string" ? audit.afterData.studentName : "";
    const sessionDate = typeof audit.afterData?.sessionDate === "string" ? audit.afterData.sessionDate : "";
    const sessionCode = typeof audit.afterData?.sessionCode === "string" ? audit.afterData.sessionCode : "";
    const sessionName = typeof audit.afterData?.sessionName === "string" ? audit.afterData.sessionName : "";
    const status = typeof audit.afterData?.status === "string" ? audit.afterData.status : "";
    const initialStatus = typeof audit.afterData?.initialStatus === "string" ? audit.afterData.initialStatus : "";
    const batchSize = typeof audit.metadata?.batchSize === "number" ? audit.metadata.batchSize : null;
    const settledCount = typeof audit.afterData?.settledCount === "number" ? audit.afterData.settledCount : null;
    const revertedCount = typeof audit.afterData?.revertedCount === "number" ? audit.afterData.revertedCount : null;
    const studentCount = typeof audit.afterData?.studentCount === "number" ? audit.afterData.studentCount : null;
    const value = audit.afterData?.value != null ? String(audit.afterData.value) : "";

    if (studentName) {
      context.push(`学生 ${studentName}`);
    }
    if (sessionDate || sessionCode || sessionName) {
      context.push(`场次 ${[sessionDate, sessionCode, sessionName].filter(Boolean).join(" ")}`);
    }
    if (audit.afterData?.deleted === true) {
      context.push("结果 已删除");
    } else if (status && status in attendanceStatusLabels) {
      context.push(`状态 ${attendanceStatusLabels[status as AttendanceRecordStatus]}`);
    } else if (status) {
      context.push(`状态 ${status}`);
    }
    if (initialStatus && initialStatus in attendanceStatusLabels) {
      context.push(`初始 ${attendanceStatusLabels[initialStatus as AttendanceRecordStatus]}`);
    }
    if (studentCount) {
      context.push(`生成 ${studentCount} 人`);
    }
    if (batchSize) {
      context.push(`批量 ${batchSize} 人`);
    }
    if (settledCount) {
      context.push(`结算 ${settledCount} 条`);
    }
    if (revertedCount) {
      context.push(`回退 ${revertedCount} 条`);
    }
    if (value) {
      context.push(`分值 ${value}`);
    }

    return context.join(" · ");
  };
  const filteredIssueItems = (attendanceIssues?.items || []).filter((item) => {
    const matchesStatus = !issueStatusFilter || item.status === issueStatusFilter;
    const keyword = issueSearch.trim();
    const statusLabel = attendanceStatusLabels[item.status] || item.status;
    const settleLabel = item.status === "absent" ? (item.pointTransactionId ? "已结算" : "待结算") : "";
    const matchesKeyword =
      !keyword ||
      [
        item.session.sessionDate,
        item.session.sessionName,
        item.session.sessionCode,
        item.student.name,
        item.student.legacyId || "",
        statusLabel,
        settleLabel
      ].some((value) => value.includes(keyword));
    return matchesStatus && matchesKeyword;
  });
  const filteredIssueSummary = filteredIssueItems.reduce(
    (totals, item) => {
      totals.records += 1;
      if (item.status === "late") totals.late += 1;
      if (item.status === "absent") {
        totals.absent += 1;
        if (item.pointTransactionId) totals.settledAbsent += 1;
        else totals.settleableAbsent += 1;
      }
      if (item.status === "excused") totals.excused += 1;
      return totals;
    },
    {
      records: 0,
      late: 0,
      absent: 0,
      excused: 0,
      settleableAbsent: 0,
      settledAbsent: 0
    }
  );
  const selectedIssueItems = (attendanceIssues?.items || []).filter((item) => selectedIssueRecordIds.includes(item.recordId));
  const selectedIssueSummary = selectedIssueItems.reduce(
    (totals, item) => {
      if (item.status === "late") totals.late += 1;
      if (item.status === "absent") {
        totals.absent += 1;
        if (item.pointTransactionId) totals.settledAbsent += 1;
        else totals.settleableAbsent += 1;
      }
      if (item.status === "excused") totals.excused += 1;
      return totals;
    },
    {
      late: 0,
      absent: 0,
      excused: 0,
      settleableAbsent: 0,
      settledAbsent: 0
    }
  );
  const selectedIssueSessionCount = new Set(selectedIssueItems.map((item) => item.session.id)).size;
  const selectedSettleableIssueCount = selectedIssueItems.filter(
    (item) => item.status === "absent" && !item.pointTransactionId
  ).length;
  const filteredSessionDetailItems = (sessionDetail?.items || []).filter((item) => {
    const matchesStatus = !detailStatusFilter || item.status === detailStatusFilter;
    const keyword = detailStudentSearch.trim();
    const matchesStudent =
      !keyword || item.student.name.includes(keyword) || (item.student.legacyId || "").includes(keyword) || (item.note || "").includes(keyword);
    return matchesStatus && matchesStudent;
  });
  const filteredSessionDetailSummary = filteredSessionDetailItems.reduce(
    (totals, item) => {
      totals.total += 1;
      if (item.status === "present") totals.present += 1;
      if (item.status === "late") totals.late += 1;
      if (item.status === "absent") totals.absent += 1;
      if (item.status === "excused") totals.excused += 1;
      return totals;
    },
    { total: 0, present: 0, late: 0, absent: 0, excused: 0 }
  );
  const filteredSessions = sessions.filter((item) => {
    const matchesStatus = !sessionStatusFilter || item.status === sessionStatusFilter;
    const keyword = sessionSearch.trim();
    const matchesSearch =
      !keyword ||
      [item.sessionName, item.sessionDate, item.sessionCode, item.status].some((value) => value.includes(keyword));
    return matchesStatus && matchesSearch;
  });

  useEffect(() => {
    setNewRecordStudentId("");
    setNewRecordStudentIds([]);
  }, [selectedSessionId]);

  useEffect(() => {
    setLatePenaltyDraft(attendance?.policy?.latePenaltyValue || "-1");
    setAbsentPenaltyDraft(attendance?.policy?.absentPenaltyValue || "-5");
    setPerfectBonusDraft(attendance?.policy?.perfectAttendanceBonusValue || "10");
  }, [attendance?.policy?.latePenaltyValue, attendance?.policy?.absentPenaltyValue, attendance?.policy?.perfectAttendanceBonusValue]);

  useEffect(() => {
    setScheduleDrafts(normalizeAttendanceScheduleDrafts(attendance));
    setWeekendRulesDraft(normalizeWeekendRulesDraft(attendance?.policy?.weekendRules, attendance?.schedules || []));
    setSundaySpecialLateTimeDraft(
      normalizeSundaySpecialLateTimeDraft(attendance?.policy?.specialRules, attendance?.schedules || [])
    );
  }, [attendance]);

  useEffect(() => {
    setSelectedIssueRecordIds((current) =>
      current.filter((id) => attendanceIssues?.items.some((item) => item.recordId === id))
    );
  }, [attendanceIssues]);

  useEffect(() => {
    if (newSessionCode && !availableNewSessionSchedules.some((item) => item.code === newSessionCode)) {
      setNewSessionCode("");
    }
  }, [availableNewSessionSchedules, newSessionCode]);

  const toggleMissingStudentSelection = (studentId: string) => {
    setNewRecordStudentIds((current) =>
      current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId]
    );
  };

  const toggleIssueSelection = (recordId: string) => {
    setSelectedIssueRecordIds((current) =>
      current.includes(recordId) ? current.filter((item) => item !== recordId) : [...current, recordId]
    );
  };

  const toggleWeekendRuleSchedule = (day: AttendanceWeekdayKey, scheduleCode: string) => {
    setWeekendRulesDraft((current) => {
      const nextList = current[day].includes(scheduleCode)
        ? current[day].filter((item) => item !== scheduleCode)
        : [...current[day], scheduleCode];
      return {
        ...current,
        [day]: Array.from(new Set(nextList)).sort(
          (left, right) => (scheduleOrderMap.get(left) ?? 999) - (scheduleOrderMap.get(right) ?? 999)
        )
      };
    });
  };

  const setSundaySpecialLateTime = (scheduleCode: string, value: string) => {
    setSundaySpecialLateTimeDraft((current) => {
      const nextValue = normalizeTimeDraftValue(value);
      if (!nextValue) {
        const { [scheduleCode]: _removed, ...rest } = current;
        return rest;
      }
      return {
        ...current,
        [scheduleCode]: nextValue
      };
    });
  };

  const updateScheduleDraft = (clientKey: string, patch: Partial<AttendanceScheduleDraft>) => {
    setScheduleDrafts((current) =>
      current.map((item) => (item.clientKey === clientKey ? { ...item, ...patch } : item))
    );
  };

  const moveScheduleDraft = (clientKey: string, direction: -1 | 1) => {
    setScheduleDrafts((current) => {
      const index = current.findIndex((item) => item.clientKey === clientKey);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(nextIndex, 0, item);
      return next;
    });
  };

  const removeScheduleDraft = (clientKey: string) => {
    setScheduleDrafts((current) => current.filter((item) => item.clientKey !== clientKey));
  };

  return (
    <article className="panel attendance-panel">
      <div className="panel-header">
        <h2>考勤概览</h2>
        <span>{attendance?.feature.attendanceEnabled ? "已启用" : "未启用"}</span>
      </div>

      {attendance ? (
        <>
          <div className="migration-callout">
            <div className="migration-copy">
              <p className="section-kicker">迁移状态</p>
              <h3>
                {attendance.migration.pendingRecords > 0 ? "考勤仍处于只读观察阶段" : "考勤历史已完成导入"}
              </h3>
              <p className="muted">
                {attendance.migration.pendingRecords > 0
                  ? "当前新系统已经导入考勤规则和时段，但尚未写入历史场次与考勤记录。这能保证积分、学生和配置先稳定运行，再单独处理考勤历史数据。"
                  : "当前新系统已经完成考勤规则、时段、历史场次和记录导入。下面的筛选区可以直接核对历史数据。"}
              </p>
            </div>
            <div className="migration-metrics">
              <div>
                <span>{attendance.migration.pendingSessions > 0 ? "待迁移场次" : "已导入场次"}</span>
                <strong>
                  {attendance.migration.pendingSessions > 0
                    ? attendance.migration.pendingSessions
                    : attendance.migration.importedSessions}
                </strong>
              </div>
              <div>
                <span>{attendance.migration.pendingRecords > 0 ? "待迁移记录" : "已导入记录"}</span>
                <strong>
                  {attendance.migration.pendingRecords > 0
                    ? attendance.migration.pendingRecords
                    : attendance.migration.importedRecords}
                </strong>
              </div>
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <span>迟到扣分</span>
              <strong>{attendance.policy?.latePenaltyValue ?? "-"}</strong>
            </div>
            <div>
              <span>缺勤扣分</span>
              <strong>{attendance.policy?.absentPenaltyValue ?? "-"}</strong>
            </div>
            <div>
              <span>周全勤奖</span>
              <strong>{attendance.policy?.perfectAttendanceBonusValue ?? "-"}</strong>
            </div>
            <div>
              <span>已导入场次</span>
              <strong>{attendance.migration.importedSessions}</strong>
            </div>
          </div>

          {canManageAttendance ? (
            <div className="adjustment-form">
              <div className="panel-header compact">
                <h3>考勤规则</h3>
                <span>模块配置</span>
              </div>
              <div className="student-filters">
                <label>
                  <span>迟到扣分</span>
                  <input type="number" step="0.5" value={latePenaltyDraft} onChange={(event) => setLatePenaltyDraft(event.target.value)} />
                </label>
                <label>
                  <span>缺勤扣分</span>
                  <input type="number" step="0.5" value={absentPenaltyDraft} onChange={(event) => setAbsentPenaltyDraft(event.target.value)} />
                </label>
                <label>
                  <span>周全勤奖</span>
                  <input type="number" step="0.5" value={perfectBonusDraft} onChange={(event) => setPerfectBonusDraft(event.target.value)} />
                </label>
              </div>
              <div className="panel-header compact">
                <h3>时段配置</h3>
                <span>新增、停用和排序考勤时段</span>
              </div>
              <div className="schedule-list">
                {scheduleDrafts.map((item, index) => (
                  <div key={item.clientKey} className="migration-card">
                    <div className="attendance-create-row">
                      <input
                        type="text"
                        value={item.code}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { code: event.target.value })}
                        placeholder="时段编码"
                      />
                      <input
                        type="text"
                        value={item.name}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { name: event.target.value })}
                        placeholder="时段名称"
                      />
                      <input
                        type="time"
                        value={item.startTime}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { startTime: event.target.value })}
                      />
                      <input
                        type="time"
                        value={item.endTime}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { endTime: event.target.value })}
                      />
                      <input
                        type="time"
                        value={item.lateTime}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { lateTime: event.target.value })}
                      />
                      <select
                        value={item.isActive ? "active" : "disabled"}
                        onChange={(event) => updateScheduleDraft(item.clientKey, { isActive: event.target.value === "active" })}
                      >
                        <option value="active">启用</option>
                        <option value="disabled">停用</option>
                      </select>
                    </div>
                    <div className="inline-action-row">
                      <button
                        type="button"
                        className="inline-action"
                        disabled={index === 0}
                        onClick={() => moveScheduleDraft(item.clientKey, -1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action"
                        disabled={index === scheduleDrafts.length - 1}
                        onClick={() => moveScheduleDraft(item.clientKey, 1)}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="inline-action"
                        onClick={() => removeScheduleDraft(item.clientKey)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                {!scheduleDrafts.length ? <p className="muted">当前还没有草稿时段，可先新增一个。</p> : null}
              </div>
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={classFrozen || updatingAttendanceSchedules}
                  onClick={() =>
                    onUpdateAttendanceSchedules({
                      items: scheduleDrafts.map((item) => ({
                        id: item.id,
                        code: item.code.trim(),
                        name: item.name.trim(),
                        startTime: item.startTime,
                        endTime: item.endTime,
                        lateTime: item.lateTime,
                        isActive: item.isActive
                      }))
                    })
                  }
                >
                  {updatingAttendanceSchedules ? "保存中..." : "保存时段配置"}
                </button>
                <button
                  type="button"
                  className="inline-action"
                  disabled={classFrozen || updatingAttendanceSchedules}
                  onClick={() => setScheduleDrafts((current) => [...current, createAttendanceScheduleDraft()])}
                >
                  新增时段
                </button>
                <span className="muted">删除旧时段时，如该时段已有历史场次，新系统会自动转为停用并保留历史数据。</span>
              </div>
              <div className="panel-header compact">
                <h3>周规则</h3>
                <span>按星期控制可创建时段</span>
              </div>
              <div className="migration-grid">
                {ATTENDANCE_WEEKDAY_OPTIONS.map((option) => {
                  const selectedNames = attendance.schedules
                    .filter((item) => weekendRulesDraft[option.key].includes(item.code))
                    .map((item) => item.name);
                  return (
                    <div key={option.key} className="migration-card">
                      <p className="section-kicker">{option.label}</p>
                      <strong>{selectedNames.length ? selectedNames.join("、") : "当前不安排考勤"}</strong>
                      <div className="attendance-missing-list">
                        {attendance.schedules.map((item) => (
                          <label key={`${option.key}-${item.code}`} className="selection-toggle">
                            <input
                              type="checkbox"
                              checked={weekendRulesDraft[option.key].includes(item.code)}
                              onChange={() => toggleWeekendRuleSchedule(option.key, item.code)}
                            />
                            <span>{item.name}{item.isActive ? "" : "（停用）"}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="panel-header compact">
                <h3>周日特殊迟到时间</h3>
                <span>仅在周日新建场次时覆盖默认迟到线</span>
              </div>
              <div className="schedule-list">
                {attendance.schedules.map((item) => (
                  <div key={item.code} className="schedule-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>
                        默认迟到线 {item.lateTime}
                        {item.isActive ? "" : " · 当前停用"}
                      </span>
                    </div>
                    <div className="inline-action-row">
                      <input
                        type="time"
                        value={sundaySpecialLateTimeDraft[item.code] || ""}
                        onChange={(event) => setSundaySpecialLateTime(item.code, event.target.value)}
                      />
                      <button
                        type="button"
                        className="inline-action"
                        onClick={() => setSundaySpecialLateTime(item.code, "")}
                      >
                        清除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="import-footer">
                <button
                  type="button"
                  className="adjustment-submit"
                  disabled={classFrozen || updatingAttendancePolicy}
                  onClick={() =>
                    onUpdateAttendancePolicy({
                      latePenaltyValue: Number(latePenaltyDraft),
                      absentPenaltyValue: Number(absentPenaltyDraft),
                      perfectAttendanceBonusValue: Number(perfectBonusDraft),
                      weekendRules: ATTENDANCE_WEEKDAY_OPTIONS.reduce<Record<string, string[]>>((result, option) => {
                        result[option.key] = weekendRulesDraft[option.key];
                        return result;
                      }, {}),
                      specialRules: (() => {
                        const nextSpecialRules = { ...(attendance.policy?.specialRules || {}) };
                        const sundaySpecialLateTime = Object.fromEntries(
                          Object.entries(sundaySpecialLateTimeDraft).filter(([, value]) => Boolean(value))
                        );
                        if (Object.keys(sundaySpecialLateTime).length) {
                          nextSpecialRules.sundaySpecialLateTime = sundaySpecialLateTime;
                        } else {
                          delete nextSpecialRules.sundaySpecialLateTime;
                        }
                        return nextSpecialRules;
                      })()
                    })
                  }
                >
                  {updatingAttendancePolicy ? "保存中..." : "保存考勤规则"}
                </button>
                <span className="muted">保存后将统一使用时段 code 存储周规则；周日特殊迟到时间会覆盖对应时段的默认迟到线。</span>
              </div>
            </div>
          ) : null}

          {canManageAttendance ? (
            <div className="attendance-batch-toolbar">
              <span>周全勤奖</span>
              <div className="inline-action-row">
                <button
                  type="button"
                  className="inline-action"
                  disabled={classFrozen || awardingPerfectAttendance || perfectStudentsCount === 0}
                  onClick={onAwardPerfectAttendance}
                >
                  {awardingPerfectAttendance ? "发放中..." : `发放全勤奖（${perfectStudentsCount} 人）`}
                </button>
                <button
                  type="button"
                  className="inline-action"
                  disabled={classFrozen || revertingPerfectAttendance || !canRevertPerfectAttendance}
                  onClick={onRevertPerfectAttendance}
                >
                  {revertingPerfectAttendance ? "撤销中..." : "撤销最近全勤奖"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="migration-grid">
            <div className="migration-card">
              <p className="section-kicker">本轮已完成</p>
              <strong>
                {attendance.migration.pendingRecords > 0 ? "规则与时段已落库" : "规则、时段与历史记录已落库"}
              </strong>
              <span>
                {attendance.migration.pendingRecords > 0
                  ? `已导入考勤策略、周规则、特殊规则以及 ${attendance.schedules.length} 个时段配置。`
                  : `已导入 ${attendance.migration.importedSessions} 个历史场次和 ${attendance.migration.importedRecords} 条考勤记录。`}
              </span>
            </div>
            <div className="migration-card warning">
              <p className="section-kicker">本轮未导入</p>
              <strong>{attendance.migration.pendingRecords > 0 ? "历史场次与考勤记录" : "历史缺口已清零"}</strong>
              <span>
                {attendance.migration.pendingRecords > 0
                  ? `当前仍保留 ${attendance.migration.pendingSessions} 个历史场次和 ${attendance.migration.pendingRecords} 条考勤记录待后续迁移。`
                  : "当前班级考勤历史已全部进入新库，后续重点转向读写接口和统计能力。"}
              </span>
            </div>
            <div className="migration-card">
              <p className="section-kicker">下一步建议</p>
              <strong>{attendance.migration.pendingRecords > 0 ? "先完成归档学生策略" : "继续做统计与写操作"}</strong>
              <span>
                {attendance.migration.pendingRecords > 0
                  ? "在正式迁移考勤记录前，先确认历史姓名与当前学生的归档映射规则，避免统计失真。"
                  : "当前可以继续补按日统计、补录和撤销能力，但仍建议先保持只读验证。 "}
              </span>
            </div>
          </div>

          {canManageAttendance ? (
            <div className="attendance-batch-toolbar">
              <span>新建考勤场次</span>
              <div className="attendance-create-row">
                <input type="date" value={newSessionDate} onChange={(event) => setNewSessionDate(event.target.value)} />
                <select value={newSessionCode} onChange={(event) => setNewSessionCode(event.target.value)}>
                  <option value="">选择时段</option>
                  {availableNewSessionSchedules.map((item) => (
                    <option key={item.id} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <select
                  value={newSessionInitialStatus}
                  onChange={(event) =>
                    setNewSessionInitialStatus(event.target.value as AttendanceRecordStatus)
                  }
                >
                  <option value="present">默认出勤</option>
                  <option value="late">默认迟到</option>
                  <option value="absent">默认缺勤</option>
                  <option value="excused">默认请假</option>
                </select>
                <button
                  type="button"
                  className="inline-action"
                  disabled={!newSessionDate || !newSessionCode || creatingAttendanceSession || classFrozen}
                  onClick={() =>
                    onCreateAttendanceSession({
                      sessionDate: newSessionDate,
                      sessionCode: newSessionCode,
                      initialStatus: newSessionInitialStatus
                    })
                  }
                >
                  {creatingAttendanceSession ? "创建中..." : "创建场次"}
                </button>
              </div>
              <p className="muted">创建场次时会按设置页标记为“参与日常”的学生状态自动生成记录。</p>
              {newSessionDate && hasConfiguredWeekendRules ? (
                <p className="muted">
                  {selectedNewSessionWeekday
                    ? availableNewSessionSchedules.length
                      ? `${ATTENDANCE_WEEKDAY_OPTIONS.find((item) => item.key === selectedNewSessionWeekday)?.label || "当天"}按周规则可选 ${availableNewSessionSchedules
                          .map((item) => item.name)
                          .join("、")}`
                      : `${ATTENDANCE_WEEKDAY_OPTIONS.find((item) => item.key === selectedNewSessionWeekday)?.label || "当天"}当前没有可创建的考勤时段`
                    : "当前日期无法识别星期，已回退显示全部启用时段。"}
                </p>
              ) : null}
            </div>
          ) : null}
          {classFrozen ? <p className="muted">当前班级已冻结，考勤写操作与撤销已暂停。</p> : null}

          <div className="schedule-list">
            {attendance.schedules.map((item) => (
              <div key={item.id} className="schedule-row">
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {item.startTime} - {item.endTime} · 迟到线 {item.lateTime}
                  </span>
                </div>
                <b>{item.isActive ? "启用" : "停用"}</b>
              </div>
            ))}
          </div>

          <div className="attendance-history-grid">
            <div className="attendance-session-list">
              <div className="panel-header compact">
                <h3>历史场次</h3>
                <span>{filteredSessions.length} / {sessionListMeta?.totals.sessions ?? sessions.length} 条</span>
              </div>
              <div className="attendance-filters">
                <label>
                  <span>开始日期</span>
                  <input type="date" value={dateFrom} onChange={(event) => onDateFromChange(event.target.value)} />
                </label>
                <label>
                  <span>结束日期</span>
                  <input type="date" value={dateTo} onChange={(event) => onDateToChange(event.target.value)} />
                </label>
                <label>
                  <span>时段</span>
                  <select value={sessionCode} onChange={(event) => onSessionCodeChange(event.target.value)}>
                    <option value="">全部时段</option>
                    {(sessionListMeta?.filters.availableSessionCodes || attendance.schedules).map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>场次状态</span>
                  <select value={sessionStatusFilter} onChange={(event) => setSessionStatusFilter(event.target.value as "" | "open" | "closed")}>
                    <option value="">全部状态</option>
                    <option value="open">open</option>
                    <option value="closed">closed</option>
                  </select>
                </label>
                <label>
                  <span>关键词</span>
                  <input
                    type="text"
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder="按日期/时段/状态筛选"
                  />
                </label>
              </div>
              <div className="attendance-summary-strip">
                <div>
                  <span>记录总数</span>
                  <strong>{sessionListMeta?.totals.records ?? 0}</strong>
                </div>
                <div>
                  <span>出勤</span>
                  <strong>{sessionListMeta?.totals.present ?? 0}</strong>
                </div>
                <div>
                  <span>迟到</span>
                  <strong>{sessionListMeta?.totals.late ?? 0}</strong>
                </div>
                <div>
                  <span>缺勤</span>
                  <strong>{sessionListMeta?.totals.absent ?? 0}</strong>
                </div>
                <div>
                  <span>请假</span>
                  <strong>{sessionListMeta?.totals.excused ?? 0}</strong>
                </div>
              </div>
              <div className="schedule-list">
                {filteredSessions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`schedule-row ${item.id === selectedSessionId ? "active" : ""}`}
                    onClick={() => onSelectSession(item.id)}
                  >
                    <div>
                      <strong>{item.sessionName}</strong>
                      <span>
                        {item.sessionDate} · {item.recordCount} 条记录 · 出勤 {item.summary.present} / 迟到{" "}
                        {item.summary.late} / 缺勤 {item.summary.absent} / 请假 {item.summary.excused}
                      </span>
                    </div>
                    <b>{item.status}</b>
                  </button>
                ))}
                {!filteredSessions.length ? <p className="muted">当前筛选条件下没有匹配的考勤场次</p> : null}
              </div>
            </div>

            <div className="attendance-session-detail">
              <div className="panel-header compact">
                <h3>场次明细</h3>
                <span>{sessionDetail ? `${filteredSessionDetailItems.length} / ${sessionDetail.items.length} 人 · ${sessionDetail.session.status}` : "0 人"}</span>
              </div>
              {attendanceWriteMessage ? <p className="success-text">{attendanceWriteMessage}</p> : null}
              {sessionDetail ? (
                <>
                  {canManageAttendance ? (
                    <div className="attendance-batch-toolbar">
                      <span>场次结算</span>
                      <div className="inline-action-row">
                        <button
                          type="button"
                          className="inline-action"
                          disabled={classFrozen || settlingAttendanceSession || sessionDetail.session.status !== "open"}
                          onClick={onSettleAttendanceSession}
                        >
                          {settlingAttendanceSession ? "结算中..." : "结算迟到/缺勤"}
                        </button>
                        <button
                          type="button"
                          className="inline-action"
                          disabled={classFrozen || revertingAttendanceSessionSettlement || sessionDetail.session.status !== "closed"}
                          onClick={onRevertAttendanceSessionSettlement}
                        >
                          {revertingAttendanceSessionSettlement ? "撤销中..." : "撤销最近结算"}
                        </button>
                      </div>
                    </div>
                  ) : null}
                  {canManageAttendance ? (
                    <div className="attendance-batch-toolbar">
                      <span>已勾选 {selectedRecordIds.length} 条</span>
                      <div className="inline-action-row">
                        <button type="button" className="inline-action" onClick={onSelectAllRecords}>
                          全选
                        </button>
                        <button type="button" className="inline-action" onClick={onClearRecordSelection}>
                          清空
                        </button>
                        <button
                          type="button"
                          className="inline-action"
                          disabled={!selectedRecordIds.length || batchRevertingAttendance || classFrozen}
                          onClick={onBatchRevertAttendanceRecords}
                        >
                          {batchRevertingAttendance ? "撤销中..." : "撤销最近批量修正"}
                        </button>
                        <button
                          type="button"
                          className="inline-action"
                          disabled={!selectedRecordIds.length || batchRevertingAttendanceCreate || classFrozen}
                          onClick={onBatchRevertAttendanceCreateRecords}
                        >
                          {batchRevertingAttendanceCreate ? "撤销中..." : "撤销最近批量补录"}
                        </button>
                        {ATTENDANCE_RECORD_STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            className="inline-action"
                            disabled={!selectedRecordIds.length || batchUpdatingAttendance || classFrozen}
                            onClick={() => onBatchUpdateAttendanceRecords(status)}
                          >
                            {batchUpdatingAttendance ? "批量中..." : `批量设为${attendanceStatusLabels[status]}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {canManageAttendance ? (
                    <div className="attendance-batch-toolbar">
                      <span>补录缺失记录</span>
                      <div className="attendance-create-row">
                        <select value={newRecordStudentId} onChange={(event) => setNewRecordStudentId(event.target.value)}>
                          <option value="">选择学生</option>
                          {missingStudents.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name} #{student.legacyId || "-"}
                            </option>
                          ))}
                        </select>
                        <select
                          value={newRecordStatus}
                          onChange={(event) => setNewRecordStatus(event.target.value as AttendanceRecordStatus)}
                        >
                          <option value="present">补录为出勤</option>
                          <option value="late">补录为迟到</option>
                          <option value="absent">补录为缺勤</option>
                          <option value="excused">补录为请假</option>
                        </select>
                        <button
                          type="button"
                          className="inline-action"
                          disabled={!newRecordStudentId || creatingAttendanceRecord || classFrozen}
                          onClick={() =>
                            onCreateAttendanceRecord({
                              studentId: newRecordStudentId,
                              status: newRecordStatus
                            })
                          }
                        >
                          {creatingAttendanceRecord ? "补录中..." : "补录记录"}
                        </button>
                      </div>
                      {missingStudents.length ? (
                        <>
                          <div className="attendance-batch-toolbar">
                            <span>批量补录缺失学生</span>
                            <div className="inline-action-row">
                              <button
                                type="button"
                                className="inline-action"
                                onClick={() => setNewRecordStudentIds(missingStudents.map((student) => student.id))}
                              >
                                全选缺失学生
                              </button>
                              <button
                                type="button"
                                className="inline-action"
                                onClick={() => setNewRecordStudentIds([])}
                              >
                                清空选择
                              </button>
                            </div>
                          </div>
                          <div className="attendance-missing-list">
                            {missingStudents.map((student) => (
                              <label key={student.id} className="selection-toggle">
                                <input
                                  type="checkbox"
                                  checked={newRecordStudentIds.includes(student.id)}
                                  onChange={() => toggleMissingStudentSelection(student.id)}
                                />
                                <span>
                                  {student.name} #{student.legacyId || "-"}
                                </span>
                              </label>
                            ))}
                          </div>
                          <div className="attendance-create-row">
                            <select
                              value={newRecordStatus}
                              onChange={(event) => setNewRecordStatus(event.target.value as AttendanceRecordStatus)}
                            >
                              <option value="present">批量补录为出勤</option>
                              <option value="late">批量补录为迟到</option>
                              <option value="absent">批量补录为缺勤</option>
                              <option value="excused">批量补录为请假</option>
                            </select>
                            <button
                              type="button"
                              className="inline-action"
                              disabled={!newRecordStudentIds.length || creatingAttendanceRecordBatch || classFrozen}
                              onClick={() =>
                                onCreateAttendanceRecordBatch({
                                  studentIds: newRecordStudentIds,
                                  status: newRecordStatus
                                })
                              }
                            >
                              {creatingAttendanceRecordBatch ? "批量补录中..." : `批量补录 ${newRecordStudentIds.length} 人`}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="muted">当前场次已经覆盖全部 active 学生，无需批量补录。</p>
                      )}
                    </div>
                  ) : null}
                  <div className="student-filters">
                    <label>
                      <span>状态筛选</span>
                      <select
                        value={detailStatusFilter}
                        onChange={(event) => setDetailStatusFilter(event.target.value as AttendanceStatusFilter)}
                      >
                        <option value="">全部状态</option>
                        <option value="present">出勤</option>
                        <option value="late">迟到</option>
                        <option value="absent">缺勤</option>
                        <option value="excused">请假</option>
                      </select>
                    </label>
                    <label>
                      <span>学生筛选</span>
                      <input
                        type="text"
                        value={detailStudentSearch}
                        onChange={(event) => setDetailStudentSearch(event.target.value)}
                        placeholder="按姓名/学号/备注筛选"
                      />
                    </label>
                  </div>
                  <div className="attendance-summary-strip detail">
                    <div>
                      <span>总人数</span>
                      <strong>{filteredSessionDetailSummary.total}</strong>
                    </div>
                    <div>
                      <span>出勤</span>
                      <strong>{filteredSessionDetailSummary.present}</strong>
                    </div>
                    <div>
                      <span>迟到</span>
                      <strong>{filteredSessionDetailSummary.late}</strong>
                    </div>
                    <div>
                      <span>缺勤</span>
                      <strong>{filteredSessionDetailSummary.absent}</strong>
                    </div>
                    <div>
                      <span>请假</span>
                      <strong>{filteredSessionDetailSummary.excused}</strong>
                    </div>
                  </div>
                  <div className="attendance-record-list">
                    {filteredSessionDetailItems.map((item) => (
                      <div key={item.id} className="transaction-row">
                        <div>
                          {canManageAttendance ? (
                            <label className="selection-toggle">
                              <input
                                type="checkbox"
                                checked={selectedRecordIds.includes(item.id)}
                                onChange={() => onToggleRecordSelection(item.id)}
                              />
                              <span>选择</span>
                            </label>
                          ) : null}
                          <strong>{item.student.name}</strong>
                          <span>
                            #{item.student.legacyId || "-"} · {attendanceStatusLabels[item.status] || item.status}
                            {attendanceStatusUsesCheckIn(item.status) && item.checkInAt ? ` · ${item.checkInAt.slice(11, 16)}` : ""}
                            {item.note ? ` · ${item.note}` : ""}
                          </span>
                        </div>
                        <div className="transaction-actions">
                          <b>{item.legacyStudentName || item.student.name}</b>
                          {canManageAttendance ? (
                            <div className="inline-action-row">
                              {ATTENDANCE_RECORD_STATUSES.map((status) => (
                                <button
                                  key={status}
                                  type="button"
                                  className="inline-action"
                                  disabled={item.status === status || updatingAttendanceRecordId === item.id || classFrozen}
                                  onClick={() => onUpdateAttendanceRecord(item.id, status)}
                                >
                                  {updatingAttendanceRecordId === item.id && item.status !== status
                                    ? "更新中..."
                                    : attendanceStatusLabels[status]}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {!filteredSessionDetailItems.length ? (
                      <p className="muted">{sessionDetail.items.length ? "当前筛选条件下没有匹配的场次记录" : "当前场次还没有考勤记录"}</p>
                    ) : null}
                  </div>
                </>
              ) : sessions.length ? (
                <p className="muted">选择场次后显示本次考勤记录</p>
              ) : (
                <p className="muted">当前筛选条件下没有考勤场次</p>
              )}
            </div>
          </div>

          <div className="attendance-session-detail">
            <div className="panel-header compact">
              <h3>异常工作台</h3>
              <span>{filteredIssueItems.length} / {attendanceIssues?.items.length ?? 0} 条</span>
            </div>
            {attendanceWriteMessage ? <p className="success-text">{attendanceWriteMessage}</p> : null}
            <p className="muted">复用上方“历史场次”的日期和时段筛选，这里集中处理跨场次的迟到/缺勤/请假记录。</p>
            <div className="attendance-filters">
              <label>
                <span>异常类型</span>
                <select
                  value={issueStatusFilter}
                  onChange={(event) => setIssueStatusFilter(event.target.value as "" | "late" | "absent" | "excused")}
                >
                  <option value="">全部记录</option>
                  <option value="late">迟到</option>
                  <option value="absent">缺勤</option>
                  <option value="excused">请假</option>
                </select>
              </label>
              <label>
                <span>关键词</span>
                <input
                  type="text"
                  value={issueSearch}
                  onChange={(event) => setIssueSearch(event.target.value)}
                  placeholder="按日期/时段/姓名/学号筛选"
                />
              </label>
            </div>
            <div className="attendance-summary-strip">
              <div>
                <span>记录总数</span>
                <strong>{filteredIssueSummary.records}</strong>
              </div>
              <div>
                <span>迟到</span>
                <strong>{filteredIssueSummary.late}</strong>
              </div>
              <div>
                <span>缺勤</span>
                <strong>{filteredIssueSummary.absent}</strong>
              </div>
              <div>
                <span>请假</span>
                <strong>{filteredIssueSummary.excused}</strong>
              </div>
              <div>
                <span>待结算缺勤</span>
                <strong>{filteredIssueSummary.settleableAbsent}</strong>
              </div>
            </div>
            {canManageAttendance ? (
              <div className="attendance-batch-toolbar">
                <span>已勾选 {selectedIssueRecordIds.length} 条异常</span>
                <div className="inline-action-row">
                  <button
                    type="button"
                    className="inline-action"
                    onClick={() => setSelectedIssueRecordIds(filteredIssueItems.map((item) => item.recordId))}
                  >
                    全选当前筛选
                  </button>
                  <button
                    type="button"
                    className="inline-action"
                    onClick={() =>
                      setSelectedIssueRecordIds(
                        filteredIssueItems
                          .filter((item) => item.status === "absent" && !item.pointTransactionId)
                          .map((item) => item.recordId)
                      )
                    }
                  >
                    选中待结算缺勤
                  </button>
                  <button type="button" className="inline-action" onClick={() => setSelectedIssueRecordIds([])}>
                    清空
                  </button>
                  {ATTENDANCE_RECORD_STATUSES.map((status) => (
                    <button
                      key={`issue-${status}`}
                      type="button"
                      className="inline-action"
                      disabled={!selectedIssueRecordIds.length || updatingAttendanceIssues || classFrozen}
                      onClick={() => onUpdateAttendanceIssues(selectedIssueRecordIds, status)}
                    >
                      {updatingAttendanceIssues ? "修正中..." : `批量设为${attendanceStatusLabels[status]}`}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="inline-action"
                    disabled={!selectedSettleableIssueCount || settlingAttendanceIssues || classFrozen}
                    onClick={() => onSettleAttendanceIssues(selectedIssueRecordIds)}
                  >
                    {settlingAttendanceIssues ? "结算中..." : `结算缺勤（${selectedSettleableIssueCount}）`}
                  </button>
                </div>
              </div>
            ) : null}
            {selectedIssueRecordIds.length ? (
              <div className="attendance-summary-strip detail">
                <div>
                  <span>迟到</span>
                  <strong>{selectedIssueSummary.late}</strong>
                </div>
                <div>
                  <span>缺勤</span>
                  <strong>{selectedIssueSummary.absent}</strong>
                </div>
                <div>
                  <span>请假</span>
                  <strong>{selectedIssueSummary.excused}</strong>
                </div>
                <div>
                  <span>待结算缺勤</span>
                  <strong>{selectedIssueSummary.settleableAbsent}</strong>
                </div>
                <div>
                  <span>已结算缺勤</span>
                  <strong>{selectedIssueSummary.settledAbsent}</strong>
                </div>
                <div>
                  <span>涉及场次</span>
                  <strong>{selectedIssueSessionCount}</strong>
                </div>
              </div>
            ) : null}
            {lastAttendanceIssueSettlementPreview ? (
              <p className="muted">
                最近一次缺勤结算：结算 {lastAttendanceIssueSettlementPreview.settledCount} 条
                {lastAttendanceIssueSettlementPreview.skippedCount
                  ? `，跳过 ${lastAttendanceIssueSettlementPreview.skippedCount} 条`
                  : ""}
                ，扣分 {lastAttendanceIssueSettlementPreview.absentPenaltyValue} 分/条，
                {lastAttendanceIssueSettlementPreview.sessionCount <= 1
                  ? lastAttendanceIssueSettlementPreview.firstSessionLabel || "单场次"
                  : `${lastAttendanceIssueSettlementPreview.sessionCount} 个场次`}
                ，筛选 {formatDateRange(lastAttendanceIssueSettlementPreview.dateFrom, lastAttendanceIssueSettlementPreview.dateTo)} /{" "}
                {lastAttendanceIssueSettlementPreview.sessionCode || "全部时段"}。
              </p>
            ) : null}
            <div className="transaction-list">
              {filteredIssueItems.length ? (
                filteredIssueItems.map((item) => (
                  <div key={item.recordId} className="transaction-row">
                    <div>
                      {canManageAttendance ? (
                        <label className="selection-toggle">
                          <input
                            type="checkbox"
                            checked={selectedIssueRecordIds.includes(item.recordId)}
                            onChange={() => toggleIssueSelection(item.recordId)}
                          />
                          <span>选择</span>
                        </label>
                      ) : null}
                      <strong>{item.student.name}</strong>
                      <span>
                        #{item.student.legacyId || "-"} · {item.session.sessionDate} · {item.session.sessionName}
                      </span>
                      <span className="muted">
                        {attendanceStatusLabels[item.status] || item.status}
                        {attendanceStatusUsesCheckIn(item.status) && item.checkInAt ? ` · ${item.checkInAt.slice(11, 16)}` : ""}
                        {item.status === "absent" ? ` · ${item.pointTransactionId ? "已结算" : "待结算"}` : ""}
                        {item.session.status ? ` · 场次 ${item.session.status}` : ""}
                      </span>
                    </div>
                    <div className="transaction-actions">
                      <b>{new Date(item.recordedAt).toLocaleString("zh-CN")}</b>
                      <span className="muted">{item.session.sessionCode}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  {attendanceIssues?.items.length ? "当前筛选条件下没有匹配的工作台记录" : "当前范围内没有迟到/缺勤/请假记录"}
                </p>
              )}
            </div>
          </div>

          {attendance.migration.latestImportJob ? (
            <div className="import-footer">
              <span>最近导入任务</span>
              <strong>{attendance.migration.latestImportJob.status}</strong>
              <span>
                {new Date(
                  attendance.migration.latestImportJob.finishedAt || attendance.migration.latestImportJob.createdAt
                ).toLocaleString("zh-CN")}
              </span>
            </div>
          ) : null}

          <div className="attendance-session-detail">
            <div className="panel-header compact">
              <h3>历史批量操作</h3>
              <span>{filteredBatchHistory.length} / {attendanceBatchHistory.length} 条</span>
            </div>
            <div className="attendance-filters">
              <label>
                <span>操作类型</span>
                <select
                  value={historyOperationFilter}
                  onChange={(event) => setHistoryOperationFilter(event.target.value as "" | "batch_create" | "batch_update")}
                >
                  <option value="">全部操作</option>
                  <option value="batch_create">批量补录</option>
                  <option value="batch_update">批量修正</option>
                </select>
              </label>
              <label>
                <span>目标状态</span>
                <select
                  value={historyStatusFilter}
                  onChange={(event) => setHistoryStatusFilter(event.target.value as AttendanceStatusFilter)}
                >
                  <option value="">全部状态</option>
                  <option value="present">出勤</option>
                  <option value="late">迟到</option>
                  <option value="absent">缺勤</option>
                  <option value="excused">请假</option>
                </select>
              </label>
              <label>
                <span>关键词</span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="按类型/状态/人数/日期/批次筛选"
                />
              </label>
              <label>
                <span>排序方式</span>
                <select value={historySortBy} onChange={(event) => setHistorySortBy(event.target.value as "recordedAt" | "count")}>
                  <option value="recordedAt">按记录时间</option>
                  <option value="count">按影响人数</option>
                </select>
              </label>
            </div>
            {classFrozen ? <p className="muted">当前班级已冻结，历史批量操作仍可查看，但撤销已暂停。</p> : null}
            <div className="transaction-list">
              {filteredBatchHistory.length ? (
                filteredBatchHistory.map((item) => (
                  <div key={item.batchId} className="transaction-row">
                    <div>
                      <strong>{item.operation === "batch_create" ? "批量补录" : "批量修正"}</strong>
                      <span>
                        {attendanceStatusLabels[item.status] || item.status} · {item.count} 人
                      </span>
                      <span className="muted">批次 {item.batchId.slice(0, 8)} · {item.recordedAt.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <div className="transaction-actions">
                      <b>{formatBatchTime(item.recordedAt)}</b>
                      {canManageAttendance ? (
                        <button
                          type="button"
                          className="inline-action"
                          disabled={
                            classFrozen ||
                            revertingAttendanceBatch ||
                            revertingAttendanceBatchId === item.batchId
                          }
                          onClick={() => onRevertAttendanceBatchById(item)}
                          title={classFrozen ? "班级冻结时不可撤销批量考勤操作" : "撤销该批量考勤操作"}
                        >
                          {revertingAttendanceBatchId === item.batchId ? "撤销中..." : "撤销"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">{attendanceBatchHistory.length ? "当前筛选条件下没有匹配的批量操作" : "暂无历史批量操作"}</p>
              )}
            </div>
          </div>

          <div className="attendance-session-detail">
            <div className="panel-header compact">
              <h3>最近操作</h3>
              <span>{filteredRecentAudits.length} / {attendanceAudits?.items.length ?? 0} 条</span>
            </div>
            <div className="student-filters">
              <label>
                <span>操作类型</span>
                <select
                  value={recentAuditTypeFilter}
                  onChange={(event) => setRecentAuditTypeFilter(event.target.value as "" | RecentAttendanceAuditAction)}
                >
                  <option value="">全部</option>
                  {RECENT_ATTENDANCE_AUDIT_TYPES.map((option) => (
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
                  placeholder="按学生/场次/状态/操作人筛选"
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
                <span>单条修正/撤销</span>
                <strong>{filteredRecentAuditSummary.singleUpdate}</strong>
              </div>
              <div>
                <span>批量修正/撤销</span>
                <strong>{filteredRecentAuditSummary.batchUpdate}</strong>
              </div>
              <div>
                <span>新建/补录</span>
                <strong>{filteredRecentAuditSummary.create}</strong>
              </div>
              <div>
                <span>场次结算</span>
                <strong>{filteredRecentAuditSummary.sessionSettle}</strong>
              </div>
              <div>
                <span>缺勤结算</span>
                <strong>{filteredRecentAuditSummary.issueSettle}</strong>
              </div>
              <div>
                <span>当前可撤销</span>
                <strong>{filteredRecentAuditSummary.revertible}</strong>
              </div>
            </div>
            <div className="transaction-list">
              {filteredRecentAudits.map((audit) => (
                <div key={audit.id} className="transaction-row">
                  <div>
                    <strong>{audit.actorUser?.displayName || audit.actorUser?.username || "系统"}</strong>
                    <span>{audit.label}</span>
                    {buildRecentAuditContext(audit) ? <span className="muted">{buildRecentAuditContext(audit)}</span> : null}
                    <span className="muted">{audit.canRevert ? "可撤销" : "不可撤销"}</span>
                  </div>
                  <div className="transaction-actions">
                    <b>{new Date(audit.createdAt).toLocaleString("zh-CN")}</b>
                    {canManageAttendance && audit.canRevert && audit.targetId ? (
                      <button
                        type="button"
                        className="inline-action"
                        disabled={revertingAttendanceAuditId === audit.id || classFrozen}
                        onClick={() => onRevertAttendanceAudit(audit)}
                      >
                        {revertingAttendanceAuditId === audit.id ? "撤销中..." : "撤销"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {!filteredRecentAudits.length ? (
                <p className="muted">
                  {attendanceAudits?.items.length ? "当前筛选条件下没有匹配的考勤操作" : "当前场次还没有写操作记录"}
                </p>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <p className="muted">当前班级暂无考勤概览</p>
      )}
    </article>
  );
}
