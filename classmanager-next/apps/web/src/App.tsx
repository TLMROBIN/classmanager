import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

import { AdminPanel } from "./components/AdminPanel";
import { AttendancePanel } from "./components/AttendancePanel";
import { AttendanceDailyStatsPanel } from "./components/AttendanceDailyStatsPanel";
import { AttendanceStudentStatsPanel } from "./components/AttendanceStudentStatsPanel";
import { ExportPanel } from "./components/ExportPanel";
import { HeroPanel } from "./components/HeroPanel";
import { HomeworkPanel } from "./components/HomeworkPanel";
import { LegacyPanel } from "./components/LegacyPanel";
import { LeaderboardPanel } from "./components/LeaderboardPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatsGrid } from "./components/StatsGrid";
import { StudentDetailPanel } from "./components/StudentDetailPanel";
import { StudentListPanel } from "./components/StudentListPanel";
import { TopStatusBar } from "./components/TopStatusBar";
import { Toolbar } from "./components/Toolbar";
import { ViewTabs } from "./components/ViewTabs";
import {
  ApiError,
  createAdminInvitation,
  createExportJob,
  downloadStructuredExport,
  createStudent,
  deleteStudent,
  createHomeworkRecord,
  createHomeworkBatchRecord,
  correctHomeworkBatchRecord,
  correctPointBatchAdjustment,
  fetchHomeworkBatchHistory,
  revertHomeworkBatchRecord,
  revertHomeworkBatchRecordByBatchId,
  revertHomeworkAudit,
  createPointBatchAdjustment,
  fetchPointBatchAdjustments,
  fetchPointAudits,
  issuePointWage,
  importPointAccountsMaintenance,
  rebuildPointAccountsFromHistory,
  revertPointBatchAdjustment,
  revertPointBatchAdjustmentByBatchId,
  createSettingsReasonTemplate,
  createSettingsReasonTemplatesBatch,
  precheckSettingsReasonTemplatesBatch,
  claimLegacyTask,
  gachaLegacyShop,
  redeemLegacyShopItem,
  deleteSettingsReasonTemplate,
  returnLegacyShopItem,
  settleLegacyBattle,
  reorderSettingsReasonTemplates,
  updateSettingsReasonTemplateCategory,
  updateSettingsClassConfig,
  updateSettingsCountdownEvents,
  updateSettingsDormitories,
  updateSettingsDuty,
  updateSettingsGroups,
  updateSettingsLegacyCompat,
  updateSettingsPositions,
  updateSettingsQuotes,
  updateSettingsScheduleNotes,
  updateSettingsStudentStatuses,
  updateSettingsSubjects,
  updateSettingsWageConfig,
  deleteAdminMember,
  updateSettingsClassFreeze,
  updateSettingsReasonTemplate,
  updateSettingsFeatureFlag,
  updateStudent,
  updateStudentProfile,
  updateStudentOrganization,
  updateStudentPositionsBatch,
  updateStudentOrganizationBatch,
  updateStudentStatusBatch,
  fetchAdminAudits,
  fetchAdminMemberDetail,
  fetchAdminMembers,
  updateAdminMemberPassword,
  fetchAdminRoles,
  fetchAdminSummary,
  updateAdminMemberStatus,
  updateAdminMemberRoles,
  fetchAttendanceOverview,
  fetchAttendanceAudits,
  fetchAttendanceIssues,
  fetchAttendanceMaintenanceExport,
  fetchAttendanceSessionDetail,
  fetchAttendanceSessions,
  fetchAttendanceDailyStats,
  fetchAttendanceStudentStats,
  updateAttendanceSchedules,
  updateAttendancePolicy,
  updateAttendanceRecord,
  updateAttendanceRecordBatch,
  updateAttendanceIssuesStatus,
  revertAttendanceAudit,
  revertAttendanceRecordBatchLatest,
  revertAttendanceRecordBatchCreateLatest,
  fetchAttendanceBatchHistory,
  revertAttendanceRecordBatchById,
  createAttendanceSession,
  settleAttendanceSession,
  settleAttendanceIssuesAbsent,
  createAttendanceRecord,
  createAttendanceRecordsBatch,
  revertAttendanceSessionSettlement,
  revertAttendanceRecordLatest,
  downloadExportJob,
  restoreStructuredFullBackup,
  fetchClasses,
  fetchExportHistory,
  fetchExportSummary,
  createPointAdjustment,
  revertPointAudit,
  revertPointAdjustment,
  revertHomeworkRecord,
  fetchHomeworkDetail,
  fetchHomeworkOverview,
  fetchHomeworkStudentStats,
  fetchLeaderboard,
  fetchPointsSummary,
  fetchSettingsOverview,
  fetchStudentDetail,
  fetchStudents,
  login,
  useLegacyShopItem
} from "./lib/api";
import {
  getFrozenWriteMessage,
  getLegacyBattleErrorMessage,
  getLegacyShopErrorMessage,
  getLegacyTaskErrorMessage
} from "./lib/legacyErrors";
import { buildStudentStatusOptions, isStudentDailyParticipant } from "./lib/studentStatus";
import { readStorage, readStoredSession, STORAGE_KEYS, writeStorage } from "./lib/storage";
import type {
  AdminAudit,
  AdminMember,
  AdminMemberDetailResponse,
  AdminRole,
  AdminSummaryResponse,
  AttendanceOverview,
  AttendanceAuditsResponse,
  AttendanceBatchHistoryItem,
  AttendanceDailyStatsResponse,
  AttendanceIssuesResponse,
  AttendanceRecordStatus,
  AttendanceSessionDetail,
  AttendanceSessionListResponse,
  AttendanceSessionListItem,
  AttendanceStudentStatsResponse,
  ClassItem,
  ExportHistoryResponse,
  ExportSummaryResponse,
  HomeworkBatchRecordCreateResponse,
  HomeworkBatchRecordCorrectResponse,
  HomeworkOverview,
  HomeworkDetail,
  HomeworkStudentStats,
  HomeworkBatchHistoryItem,
  LegacyCompatData,
  LegacyShopGachaResponse,
  LeaderboardItem,
  LoginResponse,
  PointsSummary,
  PointBatchAdjustmentHistoryItem,
  PointAudit,
  SettingsOverview,
  StudentDetail,
  StudentItem
} from "./types";
import type { ViewKey } from "./components/ViewTabs";

function getAdminErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) {
    if (error.status === 403 && error.message.includes("Self role change")) {
      return "当前阶段禁止修改自己的角色，请改为选择其他成员。";
    }
    if (error.status === 403 && error.message.includes("Self status change")) {
      return "当前阶段禁止修改自己的成员状态，请改为选择其他成员。";
    }
    if (error.status === 403 && error.message.includes("Self password change")) {
      return "当前阶段禁止直接修改自己的密码，请选择其他成员。";
    }
    if (error.status === 403 && error.message.includes("Self membership deletion")) {
      return "当前阶段禁止删除自己，请选择其他成员。";
    }
    if (error.status === 403 && error.message.includes("Tenant admin write access")) {
      return "当前账号没有成员管理权限。";
    }
    if (error.status === 403 && error.message.includes("Tenant admin access")) {
      return "当前账号没有后台查看权限。";
    }
    if (error.status === 400 && error.message.includes("Cannot remove the last tenant owner")) {
      return "不能移除最后一个 tenant owner。";
    }
    if (error.status === 400 && error.message.includes("Cannot disable the last tenant owner")) {
      return "不能停用最后一个 tenant owner。";
    }
    if (error.status === 400 && error.message.includes("Invited membership status change")) {
      return "当前阶段仅支持将 invited 成员激活为 active，不支持直接停用 invited 成员。";
    }
    if (error.status === 400 && error.message.includes("Unknown tenant role code")) {
      return "提交的角色代码无效，请刷新后台数据后重试。";
    }
    if (error.status === 400 && error.message.includes("Disabled user cannot be invited")) {
      return "该用户已是全局 disabled 状态，当前阶段不能直接邀请入租户。";
    }
    if (error.status === 400 && error.message.includes("Disabled membership password update")) {
      return "disabled 成员当前阶段不支持直接设置密码，请先恢复成员状态。";
    }
    if (error.status === 400 && error.message.includes("Active membership deletion")) {
      return "当前阶段只允许删除 invited 或 disabled 成员。";
    }
    if (error.status === 409 && error.message.includes("Membership already exists")) {
      return "该用户名或邮箱对应的成员已在当前租户中存在。";
    }
    if (error.status === 404 && error.message.includes("Membership not found")) {
      return "目标成员不存在或已不在当前租户。";
    }
    return error.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

const adminMemberStatusLabels: Record<string, string> = {
  active: "正常",
  disabled: "已停用",
  invited: "待激活"
};

function formatAdminConfirmDateTimeLabel(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function getAdminRoleDisplayLabel(roleCode: string, roles: AdminRole[]) {
  const role = roles.find((item) => item.code === roleCode);
  return role ? `${role.name}（${role.code}）` : roleCode;
}

function formatAdminRolePreview(roleCodes: string[], roles: AdminRole[]) {
  return (
    formatLabelPreview(
      roleCodes.map((code) => getAdminRoleDisplayLabel(code, roles)),
      4,
      "个角色"
    ) || "未分配角色"
  );
}

function getAdminMemberForConfirm(
  membershipId: string,
  detail: AdminMemberDetailResponse | null,
  members: AdminMember[]
) {
  if (detail?.item.id === membershipId) {
    return detail.item;
  }
  return members.find((item) => item.id === membershipId) || null;
}

function buildAdminMemberConfirmMessage(input: {
  title: string;
  member: AdminMember | null;
  roles: AdminRole[];
  activeMembershipId?: string | null;
  nextStatus?: "active" | "disabled";
  nextRoleCodes?: string[];
  extraLines?: string[];
}) {
  const { title, member, roles, activeMembershipId, nextStatus, nextRoleCodes, extraLines = [] } = input;
  if (!member) {
    return [title, ...extraLines].filter(Boolean).join("\n");
  }

  const memberName = member.displayName?.trim() || member.user.displayName?.trim() || member.user.username;
  const normalizedNextRoleCodes = nextRoleCodes ? Array.from(new Set(nextRoleCodes)) : null;
  const addedRoleLabels = normalizedNextRoleCodes
    ? normalizedNextRoleCodes
        .filter((code) => !member.roleCodes.includes(code))
        .map((code) => getAdminRoleDisplayLabel(code, roles))
    : [];
  const removedRoleLabels = normalizedNextRoleCodes
    ? member.roleCodes
        .filter((code) => !normalizedNextRoleCodes.includes(code))
        .map((code) => getAdminRoleDisplayLabel(code, roles))
    : [];

  return [
    title,
    `成员：${memberName}`,
    `账号：${member.user.username}`,
    member.user.email ? `邮箱：${member.user.email}` : "",
    `当前状态：${adminMemberStatusLabels[member.status] || member.status}`,
    `当前角色：${formatAdminRolePreview(member.roleCodes, roles)}`,
    `加入时间：${formatAdminConfirmDateTimeLabel(member.joinedAt)}`,
    member.user.lastLoginAt
      ? `最近登录：${formatAdminConfirmDateTimeLabel(member.user.lastLoginAt)}`
      : "最近登录：从未登录",
    nextStatus ? `目标状态：${adminMemberStatusLabels[nextStatus] || nextStatus}` : "",
    normalizedNextRoleCodes ? `保存后角色：${formatAdminRolePreview(normalizedNextRoleCodes, roles)}` : "",
    normalizedNextRoleCodes && !addedRoleLabels.length && !removedRoleLabels.length
      ? "角色变更：未检测到差异，将按当前配置重新提交。"
      : "",
    ...buildWrappedSummaryLines("新增角色", addedRoleLabels, 3),
    ...buildWrappedSummaryLines("移除角色", removedRoleLabels, 3),
    member.id === activeMembershipId ? "注意：当前选中的就是你自己。" : "",
    ...extraLines
  ]
    .filter(Boolean)
    .join("\n");
}

const attendanceExportStatusLabels: Record<AttendanceRecordStatus, string> = {
  present: "出勤",
  late: "迟到",
  absent: "缺勤",
  excused: "请假"
};

function attendanceStatusUsesCheckIn(status: AttendanceRecordStatus) {
  return status === "present" || status === "late";
}

function formatAttendanceExportTime(value: string | null) {
  if (!value) return "";
  return value.slice(11, 16);
}

function formatAttendanceExportCell(status: AttendanceRecordStatus, checkInAt: string | null, recordedAt: string) {
  const label = attendanceExportStatusLabels[status] || status;
  if (!attendanceStatusUsesCheckIn(status)) {
    return label;
  }
  const time = formatAttendanceExportTime(checkInAt || recordedAt);
  return time ? `${label} ${time}` : label;
}

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

function formatStudentPreview(students: StudentItem[], studentIds: string[], limit = 5) {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const selectedStudents = studentIds
    .map((studentId) => studentMap.get(studentId))
    .filter((student): student is StudentItem => Boolean(student));

  if (!selectedStudents.length) {
    return null;
  }

  const labels = selectedStudents.slice(0, limit).map((student) => `${student.sortOrder}. ${student.name}`);
  return selectedStudents.length > limit ? `${labels.join("、")} 等 ${selectedStudents.length} 人` : labels.join("、");
}

function asPlainObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getNumericSummaryCount(record: Record<string, unknown> | null, key: string) {
  const rawValue = record?.[key];
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

function formatLabelPreview(labels: string[], limit = 5, unit = "项") {
  const normalized = Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter(Boolean)
    )
  );
  if (!normalized.length) {
    return null;
  }

  const preview = normalized.slice(0, limit);
  return normalized.length > limit ? `${preview.join("、")} 等 ${normalized.length} ${unit}` : preview.join("、");
}

function buildWrappedSummaryLines(title: string, labels: string[], chunkSize = 6) {
  if (!labels.length) {
    return [] as string[];
  }

  const lines: string[] = [];
  for (let index = 0; index < labels.length; index += chunkSize) {
    const chunk = labels.slice(index, index + chunkSize).join("；");
    lines.push(`${index === 0 ? title : "其余范围"}：${chunk}`);
  }
  return lines;
}

type MaintenanceConfigPreview = {
  scopeLabels: string[];
  importedStudentRefsCount: number;
  targetFrozenState: boolean | null;
  willTemporarilyUnfreeze: boolean;
};

function summarizeMaintenanceConfigPayload(payload: unknown, currentSettings: SettingsOverview | null): MaintenanceConfigPreview {
  const root = asPlainObject(payload);
  if (!root) {
    return {
      scopeLabels: [],
      importedStudentRefsCount: 0,
      targetFrozenState: null,
      willTemporarilyUnfreeze: false
    };
  }

  const classConfig = asPlainObject(root.classConfig) ?? root;
  const legacyPoints = asPlainObject(root.points);
  const legacyAttendance = asPlainObject(root.attendance);
  const legacyOrganization = asPlainObject(root.organization);
  const legacyEnabledFeatures = asPlainObject(root.enabledFeatures);

  const scopeLabels: string[] = [];
  const quotes = Array.isArray(classConfig.quotes) ? classConfig.quotes.filter((item) => String(item ?? "").trim().length > 0) : [];
  const countdownEvents = Array.isArray(classConfig.countdownEvents)
    ? classConfig.countdownEvents.filter((item) => asPlainObject(item))
    : [];
  const scheduleNotes = asPlainObject(classConfig.scheduleNotes);
  const subjects = Array.isArray(classConfig.subjects)
    ? classConfig.subjects.filter((item) => asPlainObject(item))
    : Array.isArray(root.subjects)
      ? root.subjects.filter((item) => asPlainObject(item))
      : [];
  const groups = Array.isArray(root.groups)
    ? root.groups.filter((item) => asPlainObject(item))
    : Array.isArray(legacyOrganization?.groups)
      ? legacyOrganization.groups.filter((item) => asPlainObject(item))
      : [];
  const dormitories = Array.isArray(root.dormitories)
    ? root.dormitories.filter((item) => asPlainObject(item))
    : Array.isArray(legacyOrganization?.dorms)
      ? legacyOrganization.dorms.filter((item) => asPlainObject(item))
      : [];
  const positions = Array.isArray(root.positions)
    ? root.positions.filter((item) => asPlainObject(item))
    : Array.isArray(legacyOrganization?.commissionerRoles)
      ? legacyOrganization.commissionerRoles.filter((item) => asPlainObject(item))
      : [];
  const reasonTemplates = Array.isArray(root.reasonTemplates)
    ? root.reasonTemplates.filter((item) => asPlainObject(item))
    : Array.isArray(legacyPoints?.reasons)
      ? legacyPoints.reasons.filter((item) => asPlainObject(item))
      : [];
  const attendanceSchedules = Array.isArray(root.attendanceSchedules)
    ? root.attendanceSchedules.filter((item) => asPlainObject(item))
    : Array.isArray(legacyAttendance?.schedule)
      ? legacyAttendance.schedule.filter((item) => asPlainObject(item))
      : [];
  const featureFlagCount = Array.isArray(root.featureFlags)
    ? root.featureFlags.filter((item) => asPlainObject(item)).length
    : legacyEnabledFeatures
      ? Object.keys(legacyEnabledFeatures).length
      : 0;
  const studentCouncilRoles = Array.isArray(classConfig.studentCouncilRoles)
    ? classConfig.studentCouncilRoles.filter((item) => asPlainObject(item))
    : Array.isArray(legacyOrganization?.studentCouncilRoles)
      ? legacyOrganization.studentCouncilRoles.filter((item) => asPlainObject(item))
      : [];
  const rawDailyWageGroupIds = Array.isArray(classConfig.dailyWageGroupIds)
    ? classConfig.dailyWageGroupIds
    : Array.isArray(classConfig.dailyWageGroupLegacyKeys)
      ? classConfig.dailyWageGroupLegacyKeys
      : Array.isArray(legacyPoints?.dailyWageGroups)
        ? legacyPoints.dailyWageGroups
        : [];
  const rawPsychologyCommitteeStudentIds = Array.isArray(classConfig.psychologyCommitteeStudentIds)
    ? classConfig.psychologyCommitteeStudentIds
    : Array.isArray(classConfig.psychologyCommitteeStudentLegacyRefs)
      ? classConfig.psychologyCommitteeStudentLegacyRefs
      : Array.isArray(root.psychologyCommittee)
        ? root.psychologyCommittee
        : [];
  const dutyConfig = asPlainObject(classConfig.duty);
  const attendancePolicy =
    asPlainObject(root.attendancePolicy) ??
    (legacyAttendance && !Array.isArray(legacyAttendance) ? legacyAttendance : null);
  const hasClassConfigUpdate =
    (typeof classConfig.className === "string" && classConfig.className.trim().length > 0) ||
    (typeof classConfig.timezone === "string" && classConfig.timezone.trim().length > 0);

  if (hasClassConfigUpdate) {
    scopeLabels.push("班级基础");
  }
  if (dutyConfig && Object.keys(dutyConfig).length) {
    scopeLabels.push(`值日 ${Object.keys(dutyConfig).length} 天`);
  }
  if (quotes.length) {
    scopeLabels.push(`语录 ${quotes.length} 条`);
  }
  if (countdownEvents.length) {
    scopeLabels.push(`倒计时 ${countdownEvents.length} 条`);
  }
  if (scheduleNotes && Object.keys(scheduleNotes).length) {
    scopeLabels.push(`课程备注 ${Object.keys(scheduleNotes).length} 条`);
  }
  if (subjects.length) {
    scopeLabels.push(`学科 ${subjects.length} 个`);
  }
  if (groups.length) {
    scopeLabels.push(`小组 ${groups.length} 个`);
  }
  if (dormitories.length) {
    scopeLabels.push(`宿舍 ${dormitories.length} 个`);
  }
  if (positions.length) {
    scopeLabels.push(`岗位 ${positions.length} 个`);
  }
  if (featureFlagCount) {
    scopeLabels.push(`功能开关 ${featureFlagCount} 个`);
  }
  if (reasonTemplates.length) {
    scopeLabels.push(`积分模板 ${reasonTemplates.length} 条`);
  }
  if (attendanceSchedules.length) {
    scopeLabels.push(`考勤时段 ${attendanceSchedules.length} 个`);
  }
  if (attendancePolicy) {
    scopeLabels.push("考勤规则");
  }
  if (
    Number.isFinite(Number(classConfig.dailyWageAmount)) ||
    rawDailyWageGroupIds.length > 0 ||
    rawPsychologyCommitteeStudentIds.length > 0 ||
    studentCouncilRoles.length > 0 ||
    Object.prototype.hasOwnProperty.call(classConfig, "lastWageDate")
  ) {
    scopeLabels.push("工资配置");
  }
  if (Object.prototype.hasOwnProperty.call(classConfig, "legacyCompat")) {
    scopeLabels.push("兼容数据");
  }

  const importedStudentRefsCount = Array.isArray(root.students) ? root.students.length : 0;
  const targetFrozenState = typeof classConfig.isFrozen === "boolean" ? classConfig.isFrozen : null;

  return {
    scopeLabels,
    importedStudentRefsCount,
    targetFrozenState,
    willTemporarilyUnfreeze: Boolean(currentSettings?.classConfig?.isFrozen && scopeLabels.length > 0)
  };
}

function buildMaintenanceConfigImportConfirmLines(payload: unknown, currentSettings: SettingsOverview | null) {
  const preview = summarizeMaintenanceConfigPayload(payload, currentSettings);
  return [
    "确认导入该配置包并覆盖当前班级配置？",
    ...buildWrappedSummaryLines("覆盖范围", preview.scopeLabels),
    preview.scopeLabels.length ? "" : "未识别到可导入的配置项，可能只会触发兼容校验。",
    preview.importedStudentRefsCount ? `学生映射样本：${preview.importedStudentRefsCount} 人` : "",
    preview.targetFrozenState === null ? "" : `目标冻结状态：${preview.targetFrozenState ? "冻结" : "未冻结"}`,
    preview.willTemporarilyUnfreeze ? "当前班级已冻结，导入期间会临时解除冻结，完成后再按目标状态恢复。" : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildStructuredBackupRestoreConfirmMessage(backup: unknown) {
  const root = asPlainObject(backup);
  if (!root) {
    return "确认恢复该全量备份？当前班级的配置、学生、积分与考勤数据会被覆盖。";
  }

  const counts = asPlainObject(root.counts);
  const settings = asPlainObject(root.settings);
  const exportType = typeof root.exportType === "string" ? root.exportType.trim() : "";
  const schemaVersion = typeof root.schemaVersion === "string" ? root.schemaVersion.trim() : "";
  const exportedAt = typeof root.exportedAt === "string" ? root.exportedAt.trim() : "";

  const groupsCount =
    getNumericSummaryCount(counts, "groups") ?? (Array.isArray(settings?.groups) ? settings.groups.length : 0);
  const dormitoriesCount =
    getNumericSummaryCount(counts, "dormitories") ?? (Array.isArray(settings?.dormitories) ? settings.dormitories.length : 0);
  const positionsCount =
    getNumericSummaryCount(counts, "positions") ?? (Array.isArray(settings?.positions) ? settings.positions.length : 0);
  const reasonTemplatesCount =
    getNumericSummaryCount(counts, "reasonTemplates") ?? (Array.isArray(settings?.reasonTemplates) ? settings.reasonTemplates.length : 0);
  const attendanceSchedulesCount =
    getNumericSummaryCount(counts, "attendanceSchedules") ??
    (Array.isArray(settings?.attendanceSchedules) ? settings.attendanceSchedules.length : 0);
  const studentsCount = getNumericSummaryCount(counts, "students") ?? (Array.isArray(root.students) ? root.students.length : 0);
  const pointTransactionsCount =
    getNumericSummaryCount(counts, "pointTransactions") ?? (Array.isArray(root.pointTransactions) ? root.pointTransactions.length : 0);
  const attendanceSessionsCount =
    getNumericSummaryCount(counts, "attendanceSessions") ?? (Array.isArray(root.attendanceSessions) ? root.attendanceSessions.length : 0);
  const attendanceRecordsCount =
    getNumericSummaryCount(counts, "attendanceRecords") ?? (Array.isArray(root.attendanceRecords) ? root.attendanceRecords.length : 0);
  const homeworkEventsCount =
    getNumericSummaryCount(counts, "homeworkEvents") ?? (Array.isArray(root.homeworkEvents) ? root.homeworkEvents.length : 0);

  return [
    "确认恢复该全量备份？",
    exportType ? `备份类型：${exportType}` : "",
    schemaVersion ? `Schema：${schemaVersion}` : "",
    exportedAt ? `导出时间：${exportedAt}` : "",
    [groupsCount, dormitoriesCount, positionsCount, reasonTemplatesCount, attendanceSchedulesCount].some((count) => count > 0)
      ? `配置摘要：小组 ${groupsCount} / 宿舍 ${dormitoriesCount} / 岗位 ${positionsCount} / 模板 ${reasonTemplatesCount} / 时段 ${attendanceSchedulesCount}`
      : "",
    studentsCount > 0 ? `学生：${studentsCount} 人` : "",
    pointTransactionsCount > 0 ? `积分流水：${pointTransactionsCount} 条` : "",
    attendanceSessionsCount > 0 || attendanceRecordsCount > 0
      ? `考勤：场次 ${attendanceSessionsCount} / 记录 ${attendanceRecordsCount}`
      : "",
    homeworkEventsCount > 0 ? `作业事件：${homeworkEventsCount} 条` : "",
    exportType && exportType !== "full" ? `注意：当前文件类型是 ${exportType}，接口通常只接受 full 备份恢复。` : "",
    "这会覆盖当前班级的配置、学生、积分与考勤数据。"
  ]
    .filter(Boolean)
    .join("\n");
}

const settingsReasonTemplateTypeLabels: Record<string, string> = {
  bonus: "加分",
  penalty: "扣分",
  reward: "奖励"
};

type SettingsReasonTemplateItem = SettingsOverview["reasonTemplates"][number];
type SettingsFeatureFlagItem = SettingsOverview["featureFlags"][number];
type SettingsCollectionConfirmCurrentItem = {
  id: string;
  label: string;
  isActive: boolean;
  relationCount: number;
  signature: string;
};
type SettingsCollectionConfirmNextItem = {
  id?: string;
  label: string;
  isActive?: boolean;
  signature: string;
};

function formatSettingsReasonTemplateValueLabel(value: string | number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? `${formatPointValue(numericValue)} 分` : `${String(value)} 分`;
}

function formatSettingsFeatureFlagStatusLabel(enabled: boolean) {
  return enabled ? "启用" : "停用";
}

function summarizeSettingsReasonTemplateTypeCounts(
  items: Array<{
    transactionType: "bonus" | "penalty" | "reward";
  }>
) {
  const counts = items.reduce(
    (summary, item) => {
      if (item.transactionType === "bonus") summary.bonus += 1;
      if (item.transactionType === "penalty") summary.penalty += 1;
      if (item.transactionType === "reward") summary.reward += 1;
      return summary;
    },
    {
      bonus: 0,
      penalty: 0,
      reward: 0
    }
  );

  return [
    counts.bonus ? `加分 ${counts.bonus} 条` : "",
    counts.penalty ? `扣分 ${counts.penalty} 条` : "",
    counts.reward ? `奖励 ${counts.reward} 条` : ""
  ].filter(Boolean);
}

function summarizeSettingsConfigKeys(config: Record<string, unknown> | null | undefined) {
  return Array.from(
    new Set(
      Object.keys(config || {})
        .map((key) => key.trim())
        .filter(Boolean)
    )
  );
}

function getSettingsReasonTemplateForConfirm(settings: SettingsOverview | null, templateId: string) {
  return settings?.reasonTemplates.find((item) => item.id === templateId) || null;
}

function getSettingsFeatureFlagForConfirm(settings: SettingsOverview | null, featureFlagId: string) {
  return settings?.featureFlags.find((item) => item.id === featureFlagId) || null;
}

function buildSettingsReasonTemplateCreateConfirmMessage(input: {
  settings: SettingsOverview | null;
  template: {
    name: string;
    value: number;
    transactionType: "bonus" | "penalty" | "reward";
    scene: string;
    category: string;
  };
}) {
  const matchedCategory = input.settings?.reasonTemplateCategories.find(
    (item) => item.scene === input.template.scene && item.category === input.template.category
  );
  const sameNameTemplate = input.settings?.reasonTemplates.find((item) => item.name === input.template.name) || null;

  return [
    "确认新增这个积分模板？",
    `模板：${input.template.name}`,
    `分值：${formatSettingsReasonTemplateValueLabel(input.template.value)}`,
    `类型：${settingsReasonTemplateTypeLabels[input.template.transactionType] || input.template.transactionType}`,
    `分类：${input.template.scene} / ${input.template.category}`,
    matchedCategory ? `当前分类已有：${matchedCategory.count} 个模板` : "当前分类已有：0 个模板",
    input.settings ? `当前模板总数：${input.settings.reasonTemplates.length} 条` : "",
    sameNameTemplate ? `注意：当前已存在同名模板“${sameNameTemplate.name}”，提交后大概率会被后端拦截。` : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsReasonTemplateConfirmMessage(input: {
  title: string;
  template: SettingsReasonTemplateItem | null;
  nextInput?: {
    name?: string;
    value?: number;
    transactionType?: "bonus" | "penalty" | "reward";
    scene?: string;
    category?: string;
    isActive?: boolean;
  };
  extraLines?: string[];
}) {
  const { title, template, nextInput, extraLines = [] } = input;
  if (!template) {
    return [title, ...extraLines].filter(Boolean).join("\n");
  }

  const nextName = typeof nextInput?.name === "string" && nextInput.name.trim() ? nextInput.name.trim() : template.name;
  const nextScene = typeof nextInput?.scene === "string" && nextInput.scene.trim() ? nextInput.scene.trim() : template.scene;
  const nextCategory =
    typeof nextInput?.category === "string" && nextInput.category.trim() ? nextInput.category.trim() : template.category;
  const nextValue = nextInput?.value ?? Number(template.value);
  const nextTransactionType = nextInput?.transactionType ?? template.transactionType;
  const nextIsActive = typeof nextInput?.isActive === "boolean" ? nextInput.isActive : template.isActive;
  const changedFields = [
    nextName !== template.name ? "名称" : "",
    String(nextValue) !== String(template.value) ? "分值" : "",
    nextTransactionType !== template.transactionType ? "类型" : "",
    nextScene !== template.scene || nextCategory !== template.category ? "分类" : "",
    nextIsActive !== template.isActive ? "状态" : ""
  ].filter(Boolean);

  return [
    title,
    `模板：${template.name}`,
    `当前分值：${formatSettingsReasonTemplateValueLabel(template.value)}`,
    String(nextValue) !== String(template.value) ? `目标分值：${formatSettingsReasonTemplateValueLabel(nextValue)}` : "",
    `当前类型：${settingsReasonTemplateTypeLabels[template.transactionType] || template.transactionType}`,
    nextTransactionType !== template.transactionType
      ? `目标类型：${settingsReasonTemplateTypeLabels[nextTransactionType] || nextTransactionType}`
      : "",
    `当前分类：${template.scene} / ${template.category}`,
    nextScene !== template.scene || nextCategory !== template.category ? `目标分类：${nextScene} / ${nextCategory}` : "",
    nextName !== template.name ? `保存后名称：${nextName}` : "",
    typeof nextInput?.isActive === "boolean"
      ? `状态：${formatSettingsFeatureFlagStatusLabel(template.isActive)} -> ${formatSettingsFeatureFlagStatusLabel(nextIsActive)}`
      : `当前状态：${formatSettingsFeatureFlagStatusLabel(template.isActive)}`,
    `模板来源：${template.isEditable ? "可编辑模板" : "系统内置模板"}`,
    changedFields.length ? `变更字段：${changedFields.join(" / ")}` : "未检测到字段差异，将按当前内容重新提交。",
    ...extraLines
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsReasonTemplateBatchConfirmMessage(input: {
  settings: SettingsOverview | null;
  items: Array<{
    name: string;
    value: number;
    transactionType: "bonus" | "penalty" | "reward";
    scene: string;
    category: string;
  }>;
}) {
  const typeLabels = summarizeSettingsReasonTemplateTypeCounts(input.items);
  const categoryLabels = Array.from(new Set(input.items.map((item) => `${item.scene} / ${item.category}`)));
  const templateNames = input.items.map((item) => item.name);
  const totalValue = input.items.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return [
    "确认批量导入这组积分模板？",
    `导入数量：${input.items.length} 条`,
    input.settings ? `当前模板总数：${input.settings.reasonTemplates.length} 条` : "",
    typeLabels.length ? `类型分布：${typeLabels.join("；")}` : "",
    categoryLabels.length ? `分类预览：${formatLabelPreview(categoryLabels, 5, "类")}` : "",
    templateNames.length ? `模板预览：${formatLabelPreview(templateNames, 5, "条")}` : "",
    `分值合计：${formatPointValue(totalValue)}`,
    "导入会按当前顺序批量新增，若存在重名模板将整体取消。"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsCollectionSaveConfirmMessage(input: {
  title: string;
  entityLabel: string;
  relationUnit: string;
  currentItems: SettingsCollectionConfirmCurrentItem[];
  nextItems: SettingsCollectionConfirmNextItem[];
  extraLines?: string[];
}) {
  const currentMap = new Map(input.currentItems.map((item) => [item.id, item]));
  const normalizedNextItems = input.nextItems.map((item) => ({
    ...item,
    label: item.label.trim(),
    isActive: item.isActive !== false
  }));
  const newLabels: string[] = [];
  const renamedLabels: string[] = [];
  const updatedDetailLabels: string[] = [];
  const deactivatedLabels: string[] = [];
  const reactivatedLabels: string[] = [];
  const impactedRelationLabels: string[] = [];

  for (const item of normalizedNextItems) {
    if (!item.id || !currentMap.has(item.id)) {
      if (item.label) {
        newLabels.push(item.label);
      }
      continue;
    }

    const currentItem = currentMap.get(item.id);
    if (!currentItem) continue;

    const labelChanged = currentItem.label !== item.label;
    const statusChanged = currentItem.isActive !== item.isActive;
    const detailChanged = currentItem.signature !== item.signature;

    if (labelChanged) {
      renamedLabels.push(`${currentItem.label} -> ${item.label}`);
    }
    if (!labelChanged && detailChanged) {
      updatedDetailLabels.push(item.label || currentItem.label);
    }
    if (currentItem.isActive && !item.isActive) {
      deactivatedLabels.push(item.label || currentItem.label);
    }
    if (!currentItem.isActive && item.isActive) {
      reactivatedLabels.push(item.label || currentItem.label);
    }
    if ((labelChanged || statusChanged || detailChanged) && currentItem.relationCount > 0) {
      impactedRelationLabels.push(`${currentItem.label} ${currentItem.relationCount}${input.relationUnit}`);
    }
  }

  const currentExistingOrder = input.currentItems
    .map((item) => item.id)
    .filter((id) => normalizedNextItems.some((nextItem) => nextItem.id === id));
  const nextExistingOrder = normalizedNextItems
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id && currentMap.has(id)));
  const orderChanged =
    currentExistingOrder.length === nextExistingOrder.length &&
    currentExistingOrder.some((id, index) => id !== nextExistingOrder[index]);
  const currentActiveCount = input.currentItems.filter((item) => item.isActive).length;
  const nextActiveCount = normalizedNextItems.filter((item) => item.isActive).length;

  return [
    input.title,
    `当前配置：${input.currentItems.length} 项（启用 ${currentActiveCount} / 停用 ${input.currentItems.length - currentActiveCount}）`,
    `保存后：${normalizedNextItems.length} 项（启用 ${nextActiveCount} / 停用 ${normalizedNextItems.length - nextActiveCount}）`,
    orderChanged ? "顺序：已调整现有条目顺序" : "",
    ...buildWrappedSummaryLines(`新增${input.entityLabel}`, newLabels, 4),
    ...buildWrappedSummaryLines(`重命名${input.entityLabel}`, renamedLabels, 3),
    ...buildWrappedSummaryLines(`字段调整${input.entityLabel}`, updatedDetailLabels, 4),
    ...buildWrappedSummaryLines(`停用${input.entityLabel}`, deactivatedLabels, 4),
    ...buildWrappedSummaryLines(`恢复${input.entityLabel}`, reactivatedLabels, 4),
    ...buildWrappedSummaryLines("已有归属预览", impactedRelationLabels, 4),
    ...(input.extraLines || [])
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSettingsStudentOptionPreview(settings: SettingsOverview | null, studentIds: string[], limit = 5) {
  const optionMap = new Map((settings?.studentOptions || []).map((item) => [item.id, `${item.sortOrder}. ${item.name}`]));
  return (
    formatLabelPreview(
      studentIds
        .map((studentId) => optionMap.get(studentId) || "")
        .filter(Boolean),
      limit,
      "人"
    ) || null
  );
}

function formatSettingsGroupPreview(settings: SettingsOverview | null, groupIds: string[], limit = 5) {
  const groupMap = new Map((settings?.groups || []).map((item) => [item.id, `${item.name} ${item.membersCount}人`]));
  return (
    formatLabelPreview(
      groupIds
        .map((groupId) => groupMap.get(groupId) || "")
        .filter(Boolean),
      limit,
      "组"
    ) || null
  );
}

function formatSettingsStudentCouncilRolePreview(
  settings: SettingsOverview | null,
  roles: Array<{
    id: string;
    name: string;
    studentId?: string | null;
  }>,
  limit = 5
) {
  const optionMap = new Map((settings?.studentOptions || []).map((item) => [item.id, `${item.sortOrder}. ${item.name}`]));
  return (
    formatLabelPreview(
      roles
        .filter((item) => item.studentId)
        .map((item) => `${item.name}：${optionMap.get(item.studentId || "") || "未匹配学生"}`),
      limit,
      "项"
    ) || null
  );
}

function buildSettingsWageConfigConfirmMessage(input: {
  settings: SettingsOverview | null;
  nextConfig: {
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string | null;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId?: string | null;
    }>;
  };
}) {
  const currentConfig = input.settings?.classConfig;
  const currentDailyWageAmount = Number(currentConfig?.dailyWageAmount || 0);
  const nextDailyWageAmount = Number(input.nextConfig.dailyWageAmount || 0);
  const currentGroupIds = currentConfig?.dailyWageGroupIds || [];
  const nextGroupIds = input.nextConfig.dailyWageGroupIds || [];
  const currentPsychologyIds = currentConfig?.psychologyCommitteeStudentIds || [];
  const nextPsychologyIds = input.nextConfig.psychologyCommitteeStudentIds || [];
  const currentStudentCouncilRoles = currentConfig?.studentCouncilRoles || [];
  const nextStudentCouncilRoles = input.nextConfig.studentCouncilRoles || [];
  const currentLastWageDate = currentConfig?.lastWageDate || "";
  const nextLastWageDate = input.nextConfig.lastWageDate || "";

  const addedGroupLabels = nextGroupIds.filter((id) => !currentGroupIds.includes(id));
  const removedGroupLabels = currentGroupIds.filter((id) => !nextGroupIds.includes(id));
  const addedPsychologyIds = nextPsychologyIds.filter((id) => !currentPsychologyIds.includes(id));
  const removedPsychologyIds = currentPsychologyIds.filter((id) => !nextPsychologyIds.includes(id));
  const currentCouncilSignatureMap = new Map(
    currentStudentCouncilRoles.map((item) => [item.id, `${item.name}::${item.studentId || ""}`])
  );
  const currentCouncilRoleMap = new Map(currentStudentCouncilRoles.map((item) => [item.id, item]));
  const addedCouncilRoles = nextStudentCouncilRoles.filter((item) => !currentCouncilSignatureMap.has(item.id));
  const updatedCouncilRoles = nextStudentCouncilRoles.filter((item) => {
    const currentSignature = currentCouncilSignatureMap.get(item.id);
    return currentSignature && currentSignature !== `${item.name}::${item.studentId || ""}`;
  });
  const removedCouncilRoles = currentStudentCouncilRoles.filter(
    (item) => !nextStudentCouncilRoles.some((nextItem) => nextItem.id === item.id)
  );
  const changedSections = [
    currentDailyWageAmount !== nextDailyWageAmount ? "基础分" : "",
    JSON.stringify(currentGroupIds) !== JSON.stringify(nextGroupIds) ? "工资小组" : "",
    JSON.stringify(currentPsychologyIds) !== JSON.stringify(nextPsychologyIds) ? "心理委员" : "",
    JSON.stringify(currentStudentCouncilRoles) !== JSON.stringify(nextStudentCouncilRoles) ? "学生会职位" : "",
    currentLastWageDate !== nextLastWageDate ? "最近工资日期" : ""
  ].filter(Boolean);

  return [
    "确认保存当前工资配置？",
    `当前基础分：${formatPointValue(currentDailyWageAmount)} 分`,
    currentDailyWageAmount !== nextDailyWageAmount ? `保存后基础分：${formatPointValue(nextDailyWageAmount)} 分` : "",
    `当前工资小组：${currentGroupIds.length} 组`,
    currentGroupIds.length ? `当前小组预览：${formatSettingsGroupPreview(input.settings, currentGroupIds)}` : "",
    JSON.stringify(currentGroupIds) !== JSON.stringify(nextGroupIds) ? `保存后工资小组：${nextGroupIds.length} 组` : "",
    JSON.stringify(currentGroupIds) !== JSON.stringify(nextGroupIds) && nextGroupIds.length
      ? `保存后小组预览：${formatSettingsGroupPreview(input.settings, nextGroupIds)}`
      : "",
    ...buildWrappedSummaryLines(
      "新增工资小组",
      addedGroupLabels
        .map((id) => formatSettingsGroupPreview(input.settings, [id], 1) || "")
        .filter(Boolean),
      4
    ),
    ...buildWrappedSummaryLines(
      "移除工资小组",
      removedGroupLabels
        .map((id) => formatSettingsGroupPreview(input.settings, [id], 1) || "")
        .filter(Boolean),
      4
    ),
    `当前心理委员：${currentPsychologyIds.length} 人`,
    currentPsychologyIds.length ? `当前心理委员预览：${formatSettingsStudentOptionPreview(input.settings, currentPsychologyIds)}` : "",
    JSON.stringify(currentPsychologyIds) !== JSON.stringify(nextPsychologyIds) ? `保存后心理委员：${nextPsychologyIds.length} 人` : "",
    JSON.stringify(currentPsychologyIds) !== JSON.stringify(nextPsychologyIds) && nextPsychologyIds.length
      ? `保存后心理委员预览：${formatSettingsStudentOptionPreview(input.settings, nextPsychologyIds)}`
      : "",
    ...buildWrappedSummaryLines(
      "新增心理委员",
      addedPsychologyIds
        .map((id) => formatSettingsStudentOptionPreview(input.settings, [id], 1) || "")
        .filter(Boolean),
      4
    ),
    ...buildWrappedSummaryLines(
      "移除心理委员",
      removedPsychologyIds
        .map((id) => formatSettingsStudentOptionPreview(input.settings, [id], 1) || "")
        .filter(Boolean),
      4
    ),
    `当前学生会职位：${currentStudentCouncilRoles.length} 项`,
    currentStudentCouncilRoles.length
      ? `当前职位预览：${formatSettingsStudentCouncilRolePreview(input.settings, currentStudentCouncilRoles)}`
      : "",
    JSON.stringify(currentStudentCouncilRoles) !== JSON.stringify(nextStudentCouncilRoles)
      ? `保存后学生会职位：${nextStudentCouncilRoles.length} 项`
      : "",
    JSON.stringify(currentStudentCouncilRoles) !== JSON.stringify(nextStudentCouncilRoles) && nextStudentCouncilRoles.length
      ? `保存后职位预览：${formatSettingsStudentCouncilRolePreview(input.settings, nextStudentCouncilRoles)}`
      : "",
    ...buildWrappedSummaryLines(
      "新增职位",
      addedCouncilRoles
        .map((item) => formatSettingsStudentCouncilRolePreview(input.settings, [item], 1) || item.name)
        .filter(Boolean),
      4
    ),
    ...buildWrappedSummaryLines(
      "更新职位",
      updatedCouncilRoles
        .map((item) => {
          const currentItem = currentCouncilRoleMap.get(item.id);
          return currentItem
            ? `${currentItem.name} -> ${item.name}${currentItem.studentId !== item.studentId ? "（绑定已调整）" : ""}`
            : item.name;
        })
        .filter(Boolean),
      3
    ),
    ...buildWrappedSummaryLines("移除职位", removedCouncilRoles.map((item) => item.name).filter(Boolean), 4),
    `当前最近工资日期：${currentLastWageDate || "暂无记录"}`,
    currentLastWageDate !== nextLastWageDate ? `保存后最近工资日期：${nextLastWageDate || "清空"}` : "",
    changedSections.length ? `变更范围：${changedSections.join(" / ")}` : "未检测到字段差异，将按当前内容重新提交。"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildIssueDailyWageConfirmMessage(input: {
  settings: SettingsOverview | null;
  today: string;
}) {
  const classConfig = input.settings?.classConfig;
  const dailyWageGroupIds = classConfig?.dailyWageGroupIds || [];
  const psychologyCommitteeStudentIds = classConfig?.psychologyCommitteeStudentIds || [];
  const studentCouncilRoles = (classConfig?.studentCouncilRoles || []).filter((item) => item.studentId);
  const repeated = classConfig?.lastWageDate === input.today;

  return [
    repeated ? "今日工资似乎已发放，确定要再次发放吗？" : "确认按当前已保存的工资配置发放今日工资？",
    `工资日期：${input.today}`,
    `基础分：${formatPointValue(Number(classConfig?.dailyWageAmount || 0))} 分`,
    dailyWageGroupIds.length ? `工资小组：${formatSettingsGroupPreview(input.settings, dailyWageGroupIds)}` : "工资小组：暂无配置",
    psychologyCommitteeStudentIds.length
      ? `心理委员：${formatSettingsStudentOptionPreview(input.settings, psychologyCommitteeStudentIds)}`
      : "心理委员：暂无配置",
    studentCouncilRoles.length
      ? `学生会职位：${formatSettingsStudentCouncilRolePreview(input.settings, studentCouncilRoles)}`
      : "学生会职位：暂无绑定",
    classConfig?.lastWageDate ? `最近发放记录：${classConfig.lastWageDate}` : "最近发放记录：暂无",
    repeated ? "注意：继续操作会在同一天再次发放工资。" : ""
  ]
    .filter(Boolean)
    .join("\n");
}

function formatSettingsSubjectPreview(
  settings: SettingsOverview | null,
  subjects: Array<{
    id: string;
    name: string;
    representativeStudentIds: string[];
  }>,
  limit = 5
) {
  return (
    formatLabelPreview(
      subjects.map((item) => {
        const repsPreview = formatSettingsStudentOptionPreview(settings, item.representativeStudentIds.filter(Boolean), 2);
        return `${item.name}${repsPreview ? `（${repsPreview}）` : ""}`;
      }),
      limit,
      "个学科"
    ) || null
  );
}

function formatSettingsStudentStatusOptionLabel(input: {
  value: string;
  label: string;
  participatesInDailyFlow: boolean;
}) {
  return `${input.label}（${input.value}）· ${input.participatesInDailyFlow ? "参与日常" : "不参与日常"}`;
}

function buildSettingsSubjectConfigConfirmMessage(input: {
  settings: SettingsOverview | null;
  nextSubjects: Array<{
    id: string;
    name: string;
    representativeStudentIds: string[];
  }>;
}) {
  const currentSubjects = input.settings?.classConfig?.subjects || [];
  const currentMap = new Map(currentSubjects.map((item) => [item.id, item]));
  const normalizedNextSubjects = input.nextSubjects.map((item) => ({
    id: item.id.trim(),
    name: item.name.trim(),
    representativeStudentIds: item.representativeStudentIds.map((studentId) => studentId.trim()).filter(Boolean)
  }));
  const newSubjectLabels = normalizedNextSubjects
    .filter((item) => !currentMap.has(item.id))
    .map((item) => formatSettingsSubjectPreview(input.settings, [item], 1) || item.name)
    .filter(Boolean);
  const removedSubjectLabels = currentSubjects
    .filter((item) => !normalizedNextSubjects.some((nextItem) => nextItem.id === item.id))
    .map((item) => formatSettingsSubjectPreview(input.settings, [item], 1) || item.name)
    .filter(Boolean);
  const renamedSubjectLabels = normalizedNextSubjects
    .map((item) => {
      const currentItem = currentMap.get(item.id);
      return currentItem && currentItem.name !== item.name ? `${currentItem.name} -> ${item.name}` : "";
    })
    .filter(Boolean);
  const updatedRepresentativeLabels = normalizedNextSubjects
    .map((item) => {
      const currentItem = currentMap.get(item.id);
      if (!currentItem) return "";
      const currentReps = JSON.stringify(currentItem.representativeStudentIds.filter(Boolean));
      const nextReps = JSON.stringify(item.representativeStudentIds);
      if (currentReps === nextReps) return "";
      const nextPreview = formatSettingsStudentOptionPreview(input.settings, item.representativeStudentIds, 2) || "未设置课代表";
      return `${item.name} -> ${nextPreview}`;
    })
    .filter(Boolean);
  const currentRepresentativeCount = currentSubjects.filter((item) => item.representativeStudentIds.filter(Boolean).length).length;
  const nextRepresentativeCount = normalizedNextSubjects.filter((item) => item.representativeStudentIds.length).length;

  return [
    "确认保存当前学科和课代表配置？",
    `当前学科：${currentSubjects.length} 个`,
    currentSubjects.length ? `当前预览：${formatSettingsSubjectPreview(input.settings, currentSubjects)}` : "",
    `保存后学科：${normalizedNextSubjects.length} 个`,
    normalizedNextSubjects.length ? `保存后预览：${formatSettingsSubjectPreview(input.settings, normalizedNextSubjects)}` : "",
    `当前已配课代表：${currentRepresentativeCount} 个学科`,
    currentRepresentativeCount !== nextRepresentativeCount ? `保存后已配课代表：${nextRepresentativeCount} 个学科` : "",
    ...buildWrappedSummaryLines("新增学科", newSubjectLabels, 3),
    ...buildWrappedSummaryLines("移除学科", removedSubjectLabels, 3),
    ...buildWrappedSummaryLines("重命名学科", renamedSubjectLabels, 3),
    ...buildWrappedSummaryLines("课代表调整", updatedRepresentativeLabels, 3),
    "后续作业批量登记会按此配置自动为课代表加分。"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsStudentStatusConfigConfirmMessage(input: {
  settings: SettingsOverview | null;
  students: StudentItem[];
  nextStatusOptions: Array<{
    value: string;
    label: string;
    participatesInDailyFlow: boolean;
  }>;
}) {
  const currentOptions = input.settings?.classConfig?.studentStatusOptions || [];
  const currentMap = new Map(currentOptions.map((item) => [item.value, item]));
  const normalizedNextOptions = input.nextStatusOptions.map((item) => ({
    value: item.value.trim(),
    label: item.label.trim(),
    participatesInDailyFlow: item.participatesInDailyFlow
  }));
  const nextMap = new Map(normalizedNextOptions.map((item) => [item.value, item]));
  const statusUsage = input.students.reduce<Record<string, number>>((summary, student) => {
    summary[student.status] = (summary[student.status] || 0) + 1;
    return summary;
  }, {});

  const addedLabels = normalizedNextOptions
    .filter((item) => !currentMap.has(item.value))
    .map((item) => formatSettingsStudentStatusOptionLabel(item));
  const removedOptions = currentOptions.filter((item) => !nextMap.has(item.value));
  const removedLabels = removedOptions.map((item) => formatSettingsStudentStatusOptionLabel(item));
  const renamedLabels = normalizedNextOptions
    .map((item) => {
      const currentItem = currentMap.get(item.value);
      return currentItem && currentItem.label !== item.label ? `${currentItem.label}（${item.value}） -> ${item.label}` : "";
    })
    .filter(Boolean);
  const dailyFlowChangedLabels = normalizedNextOptions
    .map((item) => {
      const currentItem = currentMap.get(item.value);
      return currentItem && currentItem.participatesInDailyFlow !== item.participatesInDailyFlow
        ? `${item.label}（${item.value}） -> ${item.participatesInDailyFlow ? "参与日常" : "不参与日常"}`
        : "";
    })
    .filter(Boolean);
  const impactedUsageLabels = [
    ...removedOptions
      .filter((item) => statusUsage[item.value] > 0)
      .map((item) => `${item.label}（${item.value}） ${statusUsage[item.value]} 人`),
    ...normalizedNextOptions
      .filter((item) => {
        const currentItem = currentMap.get(item.value);
        return currentItem && currentItem.participatesInDailyFlow !== item.participatesInDailyFlow && statusUsage[item.value] > 0;
      })
      .map((item) => `${item.label}（${item.value}） ${statusUsage[item.value]} 人`)
  ];
  const currentDailyFlowCount = currentOptions.filter((item) => item.participatesInDailyFlow).length;
  const nextDailyFlowCount = normalizedNextOptions.filter((item) => item.participatesInDailyFlow).length;

  return [
    "确认保存当前学生状态字典？",
    `当前状态：${currentOptions.length} 项（参与日常 ${currentDailyFlowCount} 项）`,
    `保存后状态：${normalizedNextOptions.length} 项（参与日常 ${nextDailyFlowCount} 项）`,
    ...buildWrappedSummaryLines("新增状态", addedLabels, 3),
    ...buildWrappedSummaryLines("移除状态", removedLabels, 3),
    ...buildWrappedSummaryLines("重命名状态", renamedLabels, 3),
    ...buildWrappedSummaryLines("日常标记调整", dailyFlowChangedLabels, 3),
    ...buildWrappedSummaryLines("当前在用影响", impactedUsageLabels, 3),
    "学生筛选、参与日常判断和部分自动写入流程都会读取这组状态语义。"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsFeatureFlagConfirmMessage(input: {
  title: string;
  featureFlag: SettingsFeatureFlagItem | null;
  nextInput?: {
    enabled?: boolean;
    config?: Record<string, unknown>;
  };
  extraLines?: string[];
}) {
  const { title, featureFlag, nextInput, extraLines = [] } = input;
  if (!featureFlag) {
    return [title, ...extraLines].filter(Boolean).join("\n");
  }

  const currentConfigKeys = summarizeSettingsConfigKeys(featureFlag.config);
  const nextConfigKeys =
    nextInput?.config !== undefined ? summarizeSettingsConfigKeys(nextInput.config) : currentConfigKeys;
  const nextEnabled = typeof nextInput?.enabled === "boolean" ? nextInput.enabled : featureFlag.enabled;
  const addedConfigKeys = nextConfigKeys.filter((key) => !currentConfigKeys.includes(key));
  const removedConfigKeys = currentConfigKeys.filter((key) => !nextConfigKeys.includes(key));
  const changedFields = [
    nextEnabled !== featureFlag.enabled ? "状态" : "",
    nextInput?.config !== undefined ? "配置" : ""
  ].filter(Boolean);

  return [
    title,
    `开关：${featureFlag.code}`,
    `当前状态：${formatSettingsFeatureFlagStatusLabel(featureFlag.enabled)}`,
    typeof nextInput?.enabled === "boolean"
      ? `目标状态：${formatSettingsFeatureFlagStatusLabel(nextEnabled)}`
      : "",
    `当前配置：${currentConfigKeys.length} 项`,
    currentConfigKeys.length ? `当前键预览：${formatLabelPreview(currentConfigKeys, 5, "项")}` : "",
    nextInput?.config !== undefined ? `保存后配置：${nextConfigKeys.length} 项` : "",
    nextInput?.config !== undefined && nextConfigKeys.length
      ? `保存后键预览：${formatLabelPreview(nextConfigKeys, 5, "项")}`
      : "",
    ...buildWrappedSummaryLines("新增配置键", addedConfigKeys, 4),
    ...buildWrappedSummaryLines("移除配置键", removedConfigKeys, 4),
    nextInput?.config !== undefined && !addedConfigKeys.length && !removedConfigKeys.length
      ? "配置键名未变化，可能仅调整了值。"
      : "",
    changedFields.length ? `变更内容：${changedFields.join(" / ")}` : "未检测到字段差异，将按当前内容重新提交。",
    ...extraLines
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSettingsReasonTemplateCategoryConfirmMessage(input: {
  title: string;
  settings: SettingsOverview | null;
  currentScene: string;
  currentCategory: string;
  nextScene: string;
  nextCategory: string;
}) {
  const matchedTemplates =
    input.settings?.reasonTemplates.filter(
      (item) => item.scene === input.currentScene && item.category === input.currentCategory
    ) || [];
  const categorySummary =
    input.settings?.reasonTemplateCategories.find(
      (item) => item.scene === input.currentScene && item.category === input.currentCategory
    ) || null;
  const templateNames = matchedTemplates.map((item) => item.name);
  const totalValue = categorySummary
    ? categorySummary.totalValue
    : matchedTemplates.reduce((sum, item) => sum + Number(item.value || 0), 0);

  return [
    input.title,
    `当前分类：${input.currentScene} / ${input.currentCategory}`,
    `目标分类：${input.nextScene} / ${input.nextCategory}`,
    matchedTemplates.length ? `受影响模板：${matchedTemplates.length} 个` : "",
    templateNames.length ? `模板预览：${formatLabelPreview(templateNames, 5, "个模板")}` : "",
    matchedTemplates.length ? `当前分类总分值：${formatPointValue(totalValue)}` : "",
    matchedTemplates.length
      ? "这会整体覆盖该分类下所有模板的场景与类别。"
      : "当前分类下未检索到模板，接口仍会按分类键尝试更新。"
  ]
    .filter(Boolean)
    .join("\n");
}

type LegacyBattleCompatData = NonNullable<LegacyCompatData["battle"]>;

function formatLegacyDateTimeLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("zh-CN");
}

function formatLegacyDateRangeLabel(startTime: string | null, endTime: string | null) {
  const startLabel = startTime ? formatLegacyDateTimeLabel(startTime) : "";
  const endLabel = endTime ? formatLegacyDateTimeLabel(endTime) : "";
  if (startLabel && endLabel) return `${startLabel} ~ ${endLabel}`;
  if (startLabel) return `${startLabel} 起`;
  if (endLabel) return `截至 ${endLabel}`;
  return "不限时间";
}

function getLegacyCompatSummaryLabels(legacyCompat: LegacyCompatData | null | undefined) {
  if (!legacyCompat) {
    return [] as string[];
  }

  const labels = [
    legacyCompat.messages.length ? `留言 ${legacyCompat.messages.length} 条` : "",
    legacyCompat.teacherMessages.length ? `教师留言 ${legacyCompat.teacherMessages.length} 条` : "",
    legacyCompat.tasks.length ? `任务 ${legacyCompat.tasks.length} 项` : "",
    legacyCompat.shop.treasures.length ? `宝物 ${legacyCompat.shop.treasures.length} 件` : "",
    legacyCompat.shop.logs.length ? `商城日志 ${legacyCompat.shop.logs.length} 条` : ""
  ].filter(Boolean);

  if (legacyCompat.battle) {
    labels.push(`双子星第 ${legacyCompat.battle.season} 赛季`);
    if (legacyCompat.battle.teams.length) {
      labels.push(`战队 ${legacyCompat.battle.teams.length} 队`);
    }
    if (legacyCompat.battle.battles.length) {
      labels.push(`挑战 ${legacyCompat.battle.battles.length} 场`);
    }
  }

  return labels;
}

function getLegacyBattleExamName(battle: LegacyBattleCompatData | null | undefined, examId: string | null) {
  if (!battle || !examId) return null;
  const exam = battle.exams.find((item) => {
    const row = asPlainObject(item);
    return row && typeof row.id === "string" && row.id.trim() === examId;
  });
  const row = asPlainObject(exam);
  return row && typeof row.name === "string" && row.name.trim() ? row.name.trim() : null;
}

function getHomeworkEventLabel(eventType: "missing" | "register") {
  return eventType === "missing" ? "未交扣分" : "登记奖励";
}

type HomeworkBatchPreview = {
  batchId: string;
  subjectName: string;
  homeworkDate: string;
  eventType: "missing" | "register";
  value: string;
  count: number;
  representativeCount: number;
  representativeRewardValue: string | null;
  studentPreview: string | null;
  representativePreview: string | null;
};

function summarizeHomeworkBatchPointDelta(input: {
  eventType: "missing" | "register";
  value: number | string;
  count: number;
  representativeCount: number;
  representativeRewardValue?: number | string | null;
  reverse?: boolean;
}) {
  const primaryValue = Math.abs(Number(input.value) || 0);
  const representativeValue = Math.abs(Number(input.representativeRewardValue ?? 0) || 0);
  const reverseMultiplier = input.reverse ? -1 : 1;
  const primaryDirection = input.eventType === "missing" ? -1 : 1;
  const primaryTotalDelta = reverseMultiplier * primaryDirection * primaryValue * input.count;
  const representativeTotalDelta =
    input.eventType === "missing" && input.representativeCount > 0 && representativeValue > 0
      ? reverseMultiplier * representativeValue * input.representativeCount
      : 0;

  return {
    primaryValue: formatPointValue(primaryValue),
    primaryTotalDelta: formatSignedPointDelta(primaryTotalDelta),
    representativeValue: representativeValue > 0 ? formatPointValue(representativeValue) : null,
    representativeTotalDelta:
      input.representativeCount > 0 && representativeValue > 0 ? formatSignedPointDelta(representativeTotalDelta) : null,
    combinedTotalDelta: formatSignedPointDelta(primaryTotalDelta + representativeTotalDelta)
  };
}

function buildHomeworkBatchConfirmLines(input: {
  title: string;
  subjectName: string;
  homeworkDate: string;
  eventType: "missing" | "register";
  value: number | string;
  count: number;
  representativeCount: number;
  representativeRewardValue?: number | string | null;
  studentPreview?: string | null;
  representativePreview?: string | null;
  reason?: string | null;
  reverse?: boolean;
}) {
  const deltaSummary = summarizeHomeworkBatchPointDelta(input);
  const lines = [
    input.title,
    `学科：${input.subjectName || "-"}`,
    `作业日期：${input.homeworkDate || "-"}`,
    `类型：${getHomeworkEventLabel(input.eventType)}`,
    input.reason ? `理由：${input.reason}` : "",
    `学生人数：${input.count} 人`,
    `主分值：${deltaSummary.primaryValue} 分`,
    `${input.reverse ? "主回退总变动" : "主累计变动"}：${deltaSummary.primaryTotalDelta} 分`
  ];

  if (input.representativeCount) {
    lines.push(`课代表人数：${input.representativeCount} 人`);
    if (deltaSummary.representativeValue) {
      lines.push(`课代表奖励：每人 ${deltaSummary.representativeValue} 分`);
    }
    if (deltaSummary.representativeTotalDelta) {
      lines.push(`${input.reverse ? "课代表回退总变动" : "课代表累计变动"}：${deltaSummary.representativeTotalDelta} 分`);
    }
  }

  lines.push(`${input.reverse ? "合计回退变动" : "合计总变动"}：${deltaSummary.combinedTotalDelta} 分`);

  if (input.studentPreview) {
    lines.push(`学生预览：${input.studentPreview}`);
  }
  if (input.representativePreview) {
    lines.push(`课代表预览：${input.representativePreview}`);
  }

  return lines.filter((line): line is string => Boolean(line));
}

function buildHomeworkBatchPreview(
  result: HomeworkBatchRecordCreateResponse | HomeworkBatchRecordCorrectResponse,
  students: StudentItem[]
): HomeworkBatchPreview {
  const primaryStudentIds =
    result.eventType === "missing"
      ? result.items
          .filter((item) => item.transaction.transactionType === "penalty")
          .map((item) => item.student.id)
      : result.items.map((item) => item.student.id);
  const representativeItems =
    result.eventType === "missing" ? result.items.filter((item) => item.transaction.transactionType === "reward") : [];

  return {
    batchId: result.batchId,
    subjectName: result.subjectName,
    homeworkDate: result.homeworkDate,
    eventType: result.eventType,
    value: String(result.value),
    count: result.createdCount - result.representativeCreatedCount,
    representativeCount: result.representativeCreatedCount,
    representativeRewardValue: representativeItems[0]?.transaction.value || null,
    studentPreview: formatStudentPreview(students, primaryStudentIds),
    representativePreview: formatStudentPreview(
      students,
      representativeItems.map((item) => item.student.id)
    )
  };
}

type AttendanceImportCellValue = {
  status: AttendanceRecordStatus;
  checkInAt?: string | null;
};

type AttendanceImportEntry = {
  sessionDate: string;
  sessionCode: string;
  studentId: string;
  studentName: string;
  status: AttendanceRecordStatus;
  checkInAt?: string | null;
};

type PerfectAttendancePreview = {
  batchId: string;
  adjustedCount: number;
  bonusValue: string;
  dateFrom: string;
  dateTo: string;
  sessionCode: string;
};

type AttendanceSessionSettlementPreview = {
  sessionId: string;
  sessionDate: string;
  sessionCode: string;
  sessionName: string;
  settledCount: number;
  skippedCount: number;
  lateCount: number;
  absentCount: number;
  latePenaltyValue: string;
  absentPenaltyValue: string;
};

type AttendanceIssueSettlementPreview = {
  batchId: string;
  requestedCount: number;
  settledCount: number;
  skippedCount: number;
  sessionCount: number;
  firstSessionLabel: string;
  absentPenaltyValue: string;
  dateFrom: string;
  dateTo: string;
  sessionCode: string;
};

function formatAttendanceDateRange(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo) return `${dateFrom} ~ ${dateTo}`;
  if (dateFrom) return `${dateFrom} 起`;
  if (dateTo) return `截至 ${dateTo}`;
  return "全部日期";
}

function normalizeAttendanceImportLabel(value: string) {
  return value.replace(/\s+/g, "").replace(/（/g, "(").replace(/）/g, ")").trim().toLowerCase();
}

function normalizeAttendanceImportDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return "";
    const year = String(parsed.y).padStart(4, "0");
    const month = String(parsed.m).padStart(2, "0");
    const day = String(parsed.d).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const text = String(value || "").trim();
  if (!text) return "";
  const normalized = text.replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function getZonedDateKey(date: Date, timeZone?: string | null) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "1970";
  const month = parts.find((item) => item.type === "month")?.value || "01";
  const day = parts.find((item) => item.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function buildAttendanceImportColumnAliasMap(
  schedules: Array<{
    code: string;
    name: string;
  }>
) {
  const aliasMap = new Map<string, string>();
  const nameCounts = new Map<string, number>();
  for (const schedule of schedules) {
    nameCounts.set(schedule.name, (nameCounts.get(schedule.name) || 0) + 1);
  }

  for (const schedule of schedules) {
    aliasMap.set(normalizeAttendanceImportLabel(schedule.code), schedule.code);
    aliasMap.set(normalizeAttendanceImportLabel(`${schedule.name}(${schedule.code})`), schedule.code);
    if ((nameCounts.get(schedule.name) || 0) === 1) {
      aliasMap.set(normalizeAttendanceImportLabel(schedule.name), schedule.code);
    }
  }

  return aliasMap;
}

function parseAttendanceImportCell(value: unknown, sessionDate: string): AttendanceImportCellValue | null {
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "—" || text === "未记录") {
    return null;
  }

  const lowered = text.toLowerCase();
  let status: AttendanceRecordStatus = "present";
  if (text.includes("迟") || lowered.includes("late")) {
    status = "late";
  } else if (text.includes("请假") || text.includes("病假") || text.includes("事假") || lowered.includes("excused")) {
    status = "excused";
  } else if (text.includes("缺勤") || text.includes("未到") || lowered.includes("absent")) {
    status = "absent";
  } else if (text.includes("❌")) {
    status = text.includes("迟") ? "late" : "absent";
  } else if (
    text.includes("✅") ||
    text.includes("出勤") ||
    text.includes("正常") ||
    lowered.includes("present")
  ) {
    status = "present";
  }

  const timeMatch = text.match(/(^|[^0-9])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/);
  if (!timeMatch) {
    return attendanceStatusUsesCheckIn(status) ? { status } : { status, checkInAt: null };
  }

  const hour = timeMatch[2].padStart(2, "0");
  const minute = timeMatch[3];
  return {
    status,
    checkInAt: attendanceStatusUsesCheckIn(status) ? `${sessionDate}T${hour}:${minute}:00.000Z` : null
  };
}

async function runChunked<T>(items: T[], chunkSize: number, handler: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += chunkSize) {
    await Promise.all(items.slice(index, index + chunkSize).map((item) => handler(item)));
  }
}

function parseMaintenancePointNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const text = String(value).replace(/,/g, "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function App() {
  const [activeView, setActiveView] = useState<ViewKey>("overview");
  const [username, setUsername] = useState(() => readStorage(STORAGE_KEYS.username) || "14ban");
  const [password, setPassword] = useState("ChangeMe123!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [session, setSession] = useState<LoginResponse | null>(() => readStoredSession());
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState(() => readStorage(STORAGE_KEYS.selectedClassId));
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState(() => readStorage(STORAGE_KEYS.selectedStudentId));
  const [selectedBatchStudentIds, setSelectedBatchStudentIds] = useState<string[]>([]);
  const [studentDetail, setStudentDetail] = useState<StudentDetail | null>(null);
  const [creatingStudent, setCreatingStudent] = useState(false);
  const [updatingStudent, setUpdatingStudent] = useState(false);
  const [updatingStudentProfile, setUpdatingStudentProfile] = useState(false);
  const [updatingStudentOrganization, setUpdatingStudentOrganization] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(false);
  const [adjustingPoints, setAdjustingPoints] = useState(false);
  const [batchAdjustingPoints, setBatchAdjustingPoints] = useState(false);
  const [batchRevertingPoints, setBatchRevertingPoints] = useState(false);
  const [revertingTransactionId, setRevertingTransactionId] = useState("");
  const [lastAdjustmentMessage, setLastAdjustmentMessage] = useState("");
  const [lastStudentUpdateMessage, setLastStudentUpdateMessage] = useState("");
  const [lastStudentProfileMessage, setLastStudentProfileMessage] = useState("");
  const [lastStudentOrganizationMessage, setLastStudentOrganizationMessage] = useState("");
  const [studentWriteMessage, setStudentWriteMessage] = useState("");
  const [lastBatchAdjustmentMessage, setLastBatchAdjustmentMessage] = useState("");
  const [lastBatchAdjustmentTransactionIds, setLastBatchAdjustmentTransactionIds] = useState<string[]>([]);
  const [lastBatchAdjustmentPreview, setLastBatchAdjustmentPreview] = useState<{
    batchId: string;
    transactionType: "bonus" | "penalty";
    value: string;
    reason: string;
    scene: string;
    category: string;
    adjustedCount: number;
    studentPreview: string | null;
  } | null>(null);
  const [batchAdjustmentHistory, setBatchAdjustmentHistory] = useState<PointBatchAdjustmentHistoryItem[]>([]);
  const [activePointBatchCorrection, setActivePointBatchCorrection] = useState<PointBatchAdjustmentHistoryItem | null>(null);
  const [pointAudits, setPointAudits] = useState<PointAudit[]>([]);
  const [revertingBatchAdjustmentId, setRevertingBatchAdjustmentId] = useState("");
  const [revertingPointAuditId, setRevertingPointAuditId] = useState("");
  const [batchUpdatingPositions, setBatchUpdatingPositions] = useState(false);
  const [batchPositionMessage, setBatchPositionMessage] = useState("");
  const [batchUpdatingOrganization, setBatchUpdatingOrganization] = useState(false);
  const [batchOrganizationMessage, setBatchOrganizationMessage] = useState("");
  const [batchUpdatingStatus, setBatchUpdatingStatus] = useState(false);
  const [batchStatusMessage, setBatchStatusMessage] = useState("");
  const [summary, setSummary] = useState<PointsSummary | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSessionListItem[]>([]);
  const [attendanceSessionListMeta, setAttendanceSessionListMeta] = useState<AttendanceSessionListResponse | null>(null);
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState("");
  const [attendanceSessionDetail, setAttendanceSessionDetail] = useState<AttendanceSessionDetail | null>(null);
  const [attendanceAudits, setAttendanceAudits] = useState<AttendanceAuditsResponse | null>(null);
  const [attendanceIssues, setAttendanceIssues] = useState<AttendanceIssuesResponse | null>(null);
  const [attendanceBatchHistory, setAttendanceBatchHistory] = useState<AttendanceBatchHistoryItem[]>([]);
  const [attendanceStudentStats, setAttendanceStudentStats] = useState<AttendanceStudentStatsResponse | null>(null);
  const [attendanceDailyStats, setAttendanceDailyStats] = useState<AttendanceDailyStatsResponse | null>(null);
  const [revertingAttendanceAuditId, setRevertingAttendanceAuditId] = useState("");
  const [updatingAttendanceRecordId, setUpdatingAttendanceRecordId] = useState("");
  const [revertingAttendanceRecordId, setRevertingAttendanceRecordId] = useState("");
  const [selectedAttendanceRecordIds, setSelectedAttendanceRecordIds] = useState<string[]>([]);
  const [batchUpdatingAttendance, setBatchUpdatingAttendance] = useState(false);
  const [batchRevertingAttendance, setBatchRevertingAttendance] = useState(false);
  const [batchRevertingAttendanceCreate, setBatchRevertingAttendanceCreate] = useState(false);
  const [revertingAttendanceBatch, setRevertingAttendanceBatch] = useState(false);
  const [revertingAttendanceBatchId, setRevertingAttendanceBatchId] = useState("");
  const [creatingAttendanceSession, setCreatingAttendanceSession] = useState(false);
  const [updatingAttendanceSchedules, setUpdatingAttendanceSchedules] = useState(false);
  const [updatingAttendancePolicy, setUpdatingAttendancePolicy] = useState(false);
  const [updatingAttendanceIssues, setUpdatingAttendanceIssues] = useState(false);
  const [awardingPerfectAttendance, setAwardingPerfectAttendance] = useState(false);
  const [revertingPerfectAttendance, setRevertingPerfectAttendance] = useState(false);
  const [lastPerfectAttendanceTransactionIds, setLastPerfectAttendanceTransactionIds] = useState<string[]>([]);
  const [lastPerfectAttendancePreview, setLastPerfectAttendancePreview] = useState<PerfectAttendancePreview | null>(null);
  const [settlingAttendanceSession, setSettlingAttendanceSession] = useState(false);
  const [lastAttendanceSessionSettlementPreview, setLastAttendanceSessionSettlementPreview] =
    useState<AttendanceSessionSettlementPreview | null>(null);
  const [settlingAttendanceIssues, setSettlingAttendanceIssues] = useState(false);
  const [lastAttendanceIssueSettlementPreview, setLastAttendanceIssueSettlementPreview] =
    useState<AttendanceIssueSettlementPreview | null>(null);
  const [revertingAttendanceSessionSettlement, setRevertingAttendanceSessionSettlement] = useState(false);
  const [creatingAttendanceRecord, setCreatingAttendanceRecord] = useState(false);
  const [creatingAttendanceRecordBatch, setCreatingAttendanceRecordBatch] = useState(false);
  const [attendanceWriteMessage, setAttendanceWriteMessage] = useState("");
  const [homework, setHomework] = useState<HomeworkOverview | null>(null);
  const [homeworkDetail, setHomeworkDetail] = useState<HomeworkDetail | null>(null);
  const [homeworkStudentStats, setHomeworkStudentStats] = useState<HomeworkStudentStats | null>(null);
  const [creatingHomeworkRecord, setCreatingHomeworkRecord] = useState(false);
  const [creatingHomeworkBatchRecord, setCreatingHomeworkBatchRecord] = useState(false);
  const [revertingHomeworkBatchRecord, setRevertingHomeworkBatchRecord] = useState(false);
  const [revertingHomeworkBatchId, setRevertingHomeworkBatchId] = useState("");
  const [revertingHomeworkRecordId, setRevertingHomeworkRecordId] = useState("");
  const [revertingHomeworkAuditId, setRevertingHomeworkAuditId] = useState("");
  const [homeworkWriteMessage, setHomeworkWriteMessage] = useState("");
  const [lastHomeworkBatchTransactionIds, setLastHomeworkBatchTransactionIds] = useState<string[]>([]);
  const [lastHomeworkBatchPreview, setLastHomeworkBatchPreview] = useState<HomeworkBatchPreview | null>(null);
  const [homeworkBatchHistory, setHomeworkBatchHistory] = useState<HomeworkBatchHistoryItem[]>([]);
  const [activeHomeworkBatchCorrection, setActiveHomeworkBatchCorrection] = useState<HomeworkBatchHistoryItem | null>(null);
  const [settings, setSettings] = useState<SettingsOverview | null>(null);
  const [exportSummary, setExportSummary] = useState<ExportSummaryResponse | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportHistoryResponse | null>(null);
  const [creatingExportJob, setCreatingExportJob] = useState(false);
  const [downloadingExportJobId, setDownloadingExportJobId] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [importingStudentRoster, setImportingStudentRoster] = useState(false);
  const [importingMaintenanceConfig, setImportingMaintenanceConfig] = useState(false);
  const [restoringMaintenanceSnapshot, setRestoringMaintenanceSnapshot] = useState(false);
  const [importingPointsExcel, setImportingPointsExcel] = useState(false);
  const [fixingPointAccount, setFixingPointAccount] = useState(false);
  const [exportingAttendanceExcel, setExportingAttendanceExcel] = useState(false);
  const [importingAttendanceExcel, setImportingAttendanceExcel] = useState(false);
  const [downloadingMaintenanceBackup, setDownloadingMaintenanceBackup] = useState(false);
  const [restoringStructuredBackup, setRestoringStructuredBackup] = useState(false);
  const [rebuildingPointAccountsFromHistory, setRebuildingPointAccountsFromHistory] = useState(false);
  const [updatingClassConfig, setUpdatingClassConfig] = useState(false);
  const [updatingDutyConfig, setUpdatingDutyConfig] = useState(false);
  const [updatingQuotes, setUpdatingQuotes] = useState(false);
  const [updatingLegacyCompat, setUpdatingLegacyCompat] = useState(false);
  const [claimingLegacyTaskId, setClaimingLegacyTaskId] = useState("");
  const [redeemingLegacyItemId, setRedeemingLegacyItemId] = useState("");
  const [rollingLegacyGacha, setRollingLegacyGacha] = useState(false);
  const [usingLegacyItemId, setUsingLegacyItemId] = useState("");
  const [returningLegacyItemId, setReturningLegacyItemId] = useState("");
  const [settlingLegacyBattle, setSettlingLegacyBattle] = useState(false);
  const [updatingGroups, setUpdatingGroups] = useState(false);
  const [updatingDormitories, setUpdatingDormitories] = useState(false);
  const [updatingPositions, setUpdatingPositions] = useState(false);
  const [updatingCountdownEvents, setUpdatingCountdownEvents] = useState(false);
  const [updatingScheduleNotes, setUpdatingScheduleNotes] = useState(false);
  const [updatingStudentStatusConfig, setUpdatingStudentStatusConfig] = useState(false);
  const [updatingSubjectConfig, setUpdatingSubjectConfig] = useState(false);
  const [updatingWageConfig, setUpdatingWageConfig] = useState(false);
  const [issuingDailyWage, setIssuingDailyWage] = useState(false);
  const [updatingClassFreeze, setUpdatingClassFreeze] = useState(false);
  const [creatingReasonTemplate, setCreatingReasonTemplate] = useState(false);
  const [creatingReasonTemplateBatch, setCreatingReasonTemplateBatch] = useState(false);
  const [updatingReasonTemplateId, setUpdatingReasonTemplateId] = useState("");
  const [deletingReasonTemplateId, setDeletingReasonTemplateId] = useState("");
  const [updatingReasonTemplateOrder, setUpdatingReasonTemplateOrder] = useState(false);
  const [updatingReasonTemplateCategory, setUpdatingReasonTemplateCategory] = useState(false);
  const [updatingFeatureFlagId, setUpdatingFeatureFlagId] = useState("");
  const [settingsWriteMessage, setSettingsWriteMessage] = useState("");
  const [legacyWriteMessage, setLegacyWriteMessage] = useState("");
  const [latestLegacyGachaResult, setLatestLegacyGachaResult] = useState<LegacyShopGachaResponse | null>(null);
  const [adminMembers, setAdminMembers] = useState<AdminMember[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [adminAudits, setAdminAudits] = useState<AdminAudit[]>([]);
  const [adminSummary, setAdminSummary] = useState<AdminSummaryResponse | null>(null);
  const [selectedAdminMembershipId, setSelectedAdminMembershipId] = useState("");
  const [selectedAdminMemberDetail, setSelectedAdminMemberDetail] = useState<AdminMemberDetailResponse | null>(null);
  const [adminMemberSearch, setAdminMemberSearch] = useState("");
  const [adminMemberStatus, setAdminMemberStatus] = useState<"" | "active" | "disabled" | "invited">("");
  const [adminMemberRoleCode, setAdminMemberRoleCode] = useState("");
  const [adminMemberSortBy, setAdminMemberSortBy] = useState<"status" | "joinedAt" | "lastLoginAt">("status");
  const [adminAuditAction, setAdminAuditAction] = useState<
    | ""
    | "membership.roles.update"
    | "membership.status.disable"
    | "membership.status.enable"
    | "membership.invite.create"
    | "membership.password.set"
    | "membership.delete"
  >("");
  const [loadingAdminData, setLoadingAdminData] = useState(false);
  const [adminErrorMessage, setAdminErrorMessage] = useState("");
  const [updatingAdminRoles, setUpdatingAdminRoles] = useState(false);
  const [updatingAdminStatus, setUpdatingAdminStatus] = useState(false);
  const [updatingAdminPassword, setUpdatingAdminPassword] = useState(false);
  const [deletingAdminMember, setDeletingAdminMember] = useState(false);
  const [creatingAdminInvitation, setCreatingAdminInvitation] = useState(false);
  const [lastAdminMessage, setLastAdminMessage] = useState("");
  const [selectedHomeworkDate, setSelectedHomeworkDate] = useState("");
  const [selectedHomeworkSubject, setSelectedHomeworkSubject] = useState("");
  const [attendanceDateFrom, setAttendanceDateFrom] = useState("");
  const [attendanceDateTo, setAttendanceDateTo] = useState("");
  const [attendanceSessionCode, setAttendanceSessionCode] = useState("");
  const [attendanceStudentSortBy, setAttendanceStudentSortBy] = useState<
    "absent" | "late" | "attendanceRate" | "sortOrder"
  >("absent");
  const [attendanceDailySortBy, setAttendanceDailySortBy] = useState<
    "absent" | "late" | "attendanceRate" | "date"
  >("absent");
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedDorm, setSelectedDorm] = useState("");
  const [selectedStudentStatus, setSelectedStudentStatus] = useState("");

  const activeTenant = session?.memberships[0]?.tenant ?? null;
  const activeMembership = session?.memberships[0] ?? null;
  const classFrozen = Boolean(settings?.classConfig?.isFrozen);
  const token = session?.accessToken ?? "";
  const canReadAdmin = Boolean(
    activeMembership?.roleCodes.some((code) =>
      ["tenant_owner", "tenant_admin", "class_admin", "head_teacher"].includes(code)
    )
  );

  function resetLastPerfectAttendanceAward() {
    setLastPerfectAttendanceTransactionIds([]);
    setLastPerfectAttendancePreview(null);
  }

  function resetLastAttendanceSessionSettlementPreview() {
    setLastAttendanceSessionSettlementPreview(null);
  }

  function resetLastAttendanceIssueSettlementPreview() {
    setLastAttendanceIssueSettlementPreview(null);
  }

  function clearLastPerfectAttendanceAwardByBatchId(batchId?: string | null) {
    if (!batchId || lastPerfectAttendancePreview?.batchId !== batchId) return;
    resetLastPerfectAttendanceAward();
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(username, password);
      setSession(data);
      writeStorage(STORAGE_KEYS.session, JSON.stringify(data));
      writeStorage(STORAGE_KEYS.username, username);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    setSession(null);
    setClasses([]);
    setStudents([]);
    setStudentDetail(null);
    setCreatingStudent(false);
    setUpdatingStudent(false);
    setUpdatingStudentProfile(false);
    setUpdatingStudentOrganization(false);
    setLastAdjustmentMessage("");
    setLastStudentUpdateMessage("");
    setLastStudentProfileMessage("");
    setLastStudentOrganizationMessage("");
    setStudentWriteMessage("");
    setRevertingTransactionId("");
    setSummary(null);
    setLeaderboard([]);
    setPointAudits([]);
    setAttendance(null);
    setAttendanceSessions([]);
    setAttendanceSessionListMeta(null);
    setSelectedAttendanceSessionId("");
    setAttendanceSessionDetail(null);
    setAttendanceStudentStats(null);
    setAttendanceDailyStats(null);
    setUpdatingAttendancePolicy(false);
    setAwardingPerfectAttendance(false);
    setRevertingPerfectAttendance(false);
    resetLastPerfectAttendanceAward();
    resetLastAttendanceSessionSettlementPreview();
    resetLastAttendanceIssueSettlementPreview();
    setSettlingAttendanceSession(false);
    setRevertingAttendanceSessionSettlement(false);
    setHomework(null);
    setHomeworkDetail(null);
    setHomeworkStudentStats(null);
    setCreatingHomeworkRecord(false);
    setHomeworkWriteMessage("");
    setLastHomeworkBatchTransactionIds([]);
    setSettings(null);
    setExportSummary(null);
    setExportHistory(null);
    setCreatingExportJob(false);
    setDownloadingExportJobId("");
    setExportMessage("");
    setImportingStudentRoster(false);
    setImportingMaintenanceConfig(false);
    setRestoringMaintenanceSnapshot(false);
    setDownloadingMaintenanceBackup(false);
    setRestoringStructuredBackup(false);
    setRebuildingPointAccountsFromHistory(false);
    setUpdatingClassConfig(false);
    setUpdatingClassFreeze(false);
    setCreatingReasonTemplate(false);
    setUpdatingReasonTemplateId("");
    setDeletingReasonTemplateId("");
    setUpdatingFeatureFlagId("");
    setSettingsWriteMessage("");
    setUpdatingLegacyCompat(false);
    setUpdatingStudentStatusConfig(false);
    setClaimingLegacyTaskId("");
    setRollingLegacyGacha(false);
    setLegacyWriteMessage("");
    setLatestLegacyGachaResult(null);
    setAdminMembers([]);
    setAdminRoles([]);
    setAdminAudits([]);
    setAdminSummary(null);
    setSelectedAdminMembershipId("");
    setSelectedAdminMemberDetail(null);
    setAdminMemberSearch("");
    setAdminMemberStatus("");
    setLoadingAdminData(false);
    setAdminErrorMessage("");
    setUpdatingAdminRoles(false);
    setUpdatingAdminStatus(false);
    setUpdatingAdminPassword(false);
    setDeletingAdminMember(false);
    setCreatingAdminInvitation(false);
    setLastAdminMessage("");
    setSelectedHomeworkDate("");
    setSelectedHomeworkSubject("");
    setSelectedClassId("");
    setSelectedStudentId("");
    setSelectedBatchStudentIds([]);
    setLastBatchAdjustmentMessage("");
    setLastBatchAdjustmentTransactionIds([]);
    setLastBatchAdjustmentPreview(null);
    setBatchAdjustmentHistory([]);
    setRevertingBatchAdjustmentId("");
    writeStorage(STORAGE_KEYS.session, "");
    writeStorage(STORAGE_KEYS.selectedClassId, "");
    writeStorage(STORAGE_KEYS.selectedStudentId, "");
  }

  useEffect(() => {
    writeStorage(STORAGE_KEYS.username, username);
  }, [username]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.selectedClassId, selectedClassId);
  }, [selectedClassId]);

  useEffect(() => {
    setLatestLegacyGachaResult(null);
  }, [selectedClassId]);

  useEffect(() => {
    resetLastPerfectAttendanceAward();
  }, [selectedClassId]);

  useEffect(() => {
    resetLastAttendanceSessionSettlementPreview();
  }, [selectedClassId]);

  useEffect(() => {
    resetLastAttendanceIssueSettlementPreview();
  }, [selectedClassId]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.selectedStudentId, selectedStudentId);
  }, [selectedStudentId]);

  useEffect(() => {
    if (!session || !activeTenant) return;

    void fetchClasses(token, activeTenant.id)
      .then((data) => {
        setClasses(data.items);
        setSelectedClassId((current) => {
          if (current && data.items.some((item) => item.id === current)) return current;
          return data.items[0]?.id || "";
        });
      })
      .catch(() => {
        handleLogout();
        setError("登录态已失效，请重新登录");
      });
  }, [activeTenant, session, token]);

  useEffect(() => {
    if (!selectedClassId || !token) return;

    void Promise.all([
      fetchStudents(token, selectedClassId),
      fetchPointsSummary(token, selectedClassId),
      fetchLeaderboard(token, selectedClassId, search),
      fetchPointBatchAdjustments(token, selectedClassId, 12),
      fetchPointAudits(token, selectedClassId, 12),
      fetchAttendanceOverview(token, selectedClassId),
      fetchAttendanceAudits(token, selectedClassId, {
        sessionId: selectedAttendanceSessionId || undefined,
        limit: 12
      }),
      fetchAttendanceIssues(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        limit: 200
      }),
      selectedAttendanceSessionId
        ? fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12)
        : Promise.resolve({ items: [] }),
      fetchAttendanceSessions(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined
      }),
      fetchAttendanceStudentStats(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        sortBy: attendanceStudentSortBy
      }),
      fetchAttendanceDailyStats(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        sortBy: attendanceDailySortBy
      }),
      fetchHomeworkOverview(token, selectedClassId),
      fetchHomeworkBatchHistory(token, selectedClassId, 12),
      fetchSettingsOverview(token, selectedClassId)
    ])
      .then(
        ([
          studentData,
          summaryData,
          leaderboardData,
          batchHistoryData,
          pointAuditsData,
          attendanceData,
          attendanceAuditsData,
          attendanceIssuesData,
          attendanceBatchHistoryData,
          attendanceSessionsData,
          attendanceStudentStatsData,
          attendanceDailyStatsData,
          homeworkData,
          homeworkBatchHistoryData,
          settingsData
        ]) => {
          setStudents(studentData.items);
          setSummary(summaryData);
          setLeaderboard(leaderboardData.items);
          setBatchAdjustmentHistory(batchHistoryData.items);
          setPointAudits(pointAuditsData.items);
          setAttendance(attendanceData);
          setAttendanceAudits(attendanceAuditsData);
          setAttendanceIssues(attendanceIssuesData);
          setAttendanceBatchHistory(attendanceBatchHistoryData.items);
          setAttendanceSessionListMeta(attendanceSessionsData);
          setAttendanceSessions(attendanceSessionsData.items);
          setAttendanceStudentStats(attendanceStudentStatsData);
          setAttendanceDailyStats(attendanceDailyStatsData);
          setHomework(homeworkData);
          setHomeworkBatchHistory(homeworkBatchHistoryData.items);
          setSettings(settingsData);
          setSelectedAttendanceSessionId((current) => {
            if (current && attendanceSessionsData.items.some((item) => item.id === current)) return current;
            return attendanceSessionsData.items[0]?.id || "";
          });
          setSelectedStudentId((current) => {
            if (current && studentData.items.some((item) => item.id === current)) return current;
            return studentData.items[0]?.id || "";
          });
        }
      )
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取班级数据失败");
      });
  }, [
    attendanceDateFrom,
    attendanceDateTo,
    attendanceSessionCode,
    attendanceDailySortBy,
    attendanceStudentSortBy,
    selectedClassId,
    search,
    token
  ]);

  useEffect(() => {
    if (!selectedClassId || !token) return;

    void fetchHomeworkDetail(token, selectedClassId, {
      homeworkDate: selectedHomeworkDate || undefined,
      subjectName: selectedHomeworkSubject || undefined,
      days: 30
    })
      .then((data) => {
        setHomeworkDetail(data);
        setSelectedHomeworkDate((current) => current || data.filters.homeworkDate || "");
        setSelectedHomeworkSubject((current) => current || data.filters.subjectName || "");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取作业明细失败");
      });
  }, [selectedClassId, selectedHomeworkDate, selectedHomeworkSubject, token]);

  useEffect(() => {
    if (!selectedClassId || !token) return;

    void Promise.all([fetchExportSummary(token, selectedClassId), fetchExportHistory(token, selectedClassId)])
      .then(([summaryData, historyData]) => {
        setExportSummary(summaryData);
        setExportHistory(historyData);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取导出数据失败");
      });
  }, [selectedClassId, token]);

  async function reloadSelectedClassWorkspace() {
    if (!selectedClassId || !token) return;

    const [
      classesData,
      studentData,
      summaryData,
      leaderboardData,
      batchHistoryData,
      pointAuditsData,
      attendanceData,
      attendanceIssuesData,
      attendanceSessionsData,
      attendanceStudentStatsData,
      attendanceDailyStatsData,
      homeworkData,
      homeworkBatchHistoryData,
      settingsData,
      exportSummaryData,
      exportHistoryData
    ] = await Promise.all([
      activeTenant ? fetchClasses(token, activeTenant.id) : Promise.resolve(null),
      fetchStudents(token, selectedClassId),
      fetchPointsSummary(token, selectedClassId),
      fetchLeaderboard(token, selectedClassId, search),
      fetchPointBatchAdjustments(token, selectedClassId, 12),
      fetchPointAudits(token, selectedClassId, 12),
      fetchAttendanceOverview(token, selectedClassId),
      fetchAttendanceIssues(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        limit: 200
      }),
      fetchAttendanceSessions(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined
      }),
      fetchAttendanceStudentStats(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        sortBy: attendanceStudentSortBy
      }),
      fetchAttendanceDailyStats(token, selectedClassId, {
        dateFrom: attendanceDateFrom || undefined,
        dateTo: attendanceDateTo || undefined,
        sessionCode: attendanceSessionCode || undefined,
        sortBy: attendanceDailySortBy
      }),
      fetchHomeworkOverview(token, selectedClassId),
      fetchHomeworkBatchHistory(token, selectedClassId, 12),
      fetchSettingsOverview(token, selectedClassId),
      fetchExportSummary(token, selectedClassId),
      fetchExportHistory(token, selectedClassId)
    ]);

    if (classesData) {
      setClasses(classesData.items);
    }
    setStudents(studentData.items);
    setSummary(summaryData);
    setLeaderboard(leaderboardData.items);
    setBatchAdjustmentHistory(batchHistoryData.items);
    setPointAudits(pointAuditsData.items);
    setAttendance(attendanceData);
    setAttendanceIssues(attendanceIssuesData);
    setAttendanceSessionListMeta(attendanceSessionsData);
    setAttendanceSessions(attendanceSessionsData.items);
    setAttendanceStudentStats(attendanceStudentStatsData);
    setAttendanceDailyStats(attendanceDailyStatsData);
    setHomework(homeworkData);
    setHomeworkBatchHistory(homeworkBatchHistoryData.items);
    setSettings(settingsData);
    setExportSummary(exportSummaryData);
    setExportHistory(exportHistoryData);

    const nextSelectedStudentId =
      selectedStudentId && studentData.items.some((item) => item.id === selectedStudentId)
        ? selectedStudentId
        : studentData.items[0]?.id || "";
    const nextSelectedAttendanceSessionId =
      selectedAttendanceSessionId && attendanceSessionsData.items.some((item) => item.id === selectedAttendanceSessionId)
        ? selectedAttendanceSessionId
        : attendanceSessionsData.items[0]?.id || "";

    setSelectedStudentId(nextSelectedStudentId);
    setSelectedAttendanceSessionId(nextSelectedAttendanceSessionId);

    const [attendanceAuditsData, attendanceBatchHistoryData, attendanceSessionDetailData, studentDetailData, homeworkDetailData] =
      await Promise.all([
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: nextSelectedAttendanceSessionId || undefined,
          limit: 12
        }),
        nextSelectedAttendanceSessionId
          ? fetchAttendanceBatchHistory(token, selectedClassId, nextSelectedAttendanceSessionId, 12)
          : Promise.resolve({ items: [] }),
        nextSelectedAttendanceSessionId
          ? fetchAttendanceSessionDetail(token, nextSelectedAttendanceSessionId).catch(() => null)
          : Promise.resolve(null),
        nextSelectedStudentId ? fetchStudentDetail(token, nextSelectedStudentId).catch(() => null) : Promise.resolve(null),
        fetchHomeworkDetail(token, selectedClassId, {
          homeworkDate: selectedHomeworkDate || undefined,
          subjectName: selectedHomeworkSubject || undefined,
          days: 30
        })
      ]);

    setAttendanceAudits(attendanceAuditsData);
    setAttendanceBatchHistory(attendanceBatchHistoryData.items);
    setAttendanceSessionDetail(attendanceSessionDetailData);
    setStudentDetail(studentDetailData);
    setHomeworkDetail(homeworkDetailData);
    setSelectedHomeworkDate((current) => current || homeworkDetailData.filters.homeworkDate || "");
    setSelectedHomeworkSubject((current) => current || homeworkDetailData.filters.subjectName || "");
  }

  async function handleUpdateAttendanceRecord(recordId: string, status: AttendanceRecordStatus) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId) return;
    if (!window.confirm(`确认将这条考勤记录修正为“${attendanceExportStatusLabels[status]}”吗？`)) return;

    setUpdatingAttendanceRecordId(recordId);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [sessionsData, sessionDetailData, auditsData, issuesData, studentStatsData, dailyStatsData] = await Promise.all([
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        updateAttendanceRecord(token, selectedClassId, recordId, { status }).then(() =>
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId)
        ),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId,
          limit: 12
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
      ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setAttendanceWriteMessage(`已将考勤记录修正为${attendanceExportStatusLabels[status]}`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤修正写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("status unchanged")) {
        setError("这条考勤记录已经是目标状态。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance record not found")) {
        setError("目标考勤记录不存在。");
      } else {
        setError(err instanceof Error ? err.message : "修正考勤记录失败");
      }
    } finally {
      setUpdatingAttendanceRecordId("");
    }
  }

  async function handleBatchUpdateAttendanceRecords(status: AttendanceRecordStatus) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !selectedAttendanceRecordIds.length) return;
    if (!window.confirm(`确认将当前勾选的 ${selectedAttendanceRecordIds.length} 条记录批量修正为“${attendanceExportStatusLabels[status]}”吗？`)) {
      return;
    }

    setBatchUpdatingAttendance(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [batchResult, sessionsData, sessionDetailData, auditsData, issuesData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
        updateAttendanceRecordBatch(token, selectedClassId, selectedAttendanceSessionId, {
          recordIds: selectedAttendanceRecordIds,
          status
        }),
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId,
          limit: 12
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(
        `已批量修正 ${batchResult.updatedCount} 条记录为${attendanceExportStatusLabels[status]}${
          batchResult.skippedCount ? `，跳过 ${batchResult.skippedCount} 条未变化记录` : ""
        }`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤修正写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch status unchanged")) {
        setError("当前勾选记录已经全部是目标状态。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("batch contains invalid")) {
        setError("勾选的考勤记录中包含无效项，请刷新当前场次后重试。");
      } else {
        setError(err instanceof Error ? err.message : "批量修正考勤记录失败");
      }
    } finally {
      setBatchUpdatingAttendance(false);
    }
  }

  async function handleUpdateAttendanceIssues(recordIds: string[], status: AttendanceRecordStatus) {
    if (!selectedClassId || !token || !recordIds.length) return;
    const { summary, sessionCount, firstSessionLabel, missingCount } = buildSelectedAttendanceIssueSummary(recordIds);
    const confirmLines = [
      `确认将当前勾选异常批量修正为“${attendanceExportStatusLabels[status]}”吗？`,
      `勾选记录：${recordIds.length} 条`,
      `当前状态：迟到 ${summary.late} / 缺勤 ${summary.absent} / 请假 ${summary.excused}`,
      `其中已结算缺勤：${summary.settledAbsent} 条`,
      `涉及场次：${sessionCount <= 1 ? firstSessionLabel || "-" : `${sessionCount} 个场次`}`,
      `筛选范围：${formatAttendanceDateRange(attendanceDateFrom, attendanceDateTo)}`,
      `时段筛选：${attendanceSessionCode || "全部时段"}`,
      summary.settledAbsent ? "已结算缺勤若被改为其他状态，会同步回退或替换原扣分。" : "",
      missingCount ? "部分勾选记录已不在当前异常列表中，提交后会自动跳过。" : ""
    ].filter(Boolean);
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }

    setUpdatingAttendanceIssues(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [
        updateResult,
        issuesData,
        sessionsData,
        sessionDetailData,
        auditsData,
        batchHistoryData,
        studentStatsData,
        dailyStatsData
      ] = await Promise.all([
        updateAttendanceIssuesStatus(token, selectedClassId, {
          recordIds,
          status
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        selectedAttendanceSessionId
          ? fetchAttendanceSessionDetail(token, selectedAttendanceSessionId).catch(() => null)
          : Promise.resolve(null),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId || undefined,
          limit: 12
        }),
        selectedAttendanceSessionId
          ? fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12)
          : Promise.resolve({ items: [] }),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
      ]);

      setAttendanceIssues(issuesData);
      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      if (summary.settledAbsent > 0) {
        resetLastAttendanceIssueSettlementPreview();
        resetLastAttendanceSessionSettlementPreview();
      }
      setAttendanceWriteMessage(
        `已批量修正 ${updateResult.updatedCount} 条异常记录为${attendanceExportStatusLabels[status]}${
          updateResult.skippedCount ? `，跳过 ${updateResult.skippedCount} 条未变化记录` : ""
        }`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤修正写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("issues status unchanged")) {
        setError("当前勾选异常已经全部是目标状态。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("issue batch contains invalid")) {
        setError("勾选的异常记录中包含无效项，请刷新后重试。");
      } else {
        setError(err instanceof Error ? err.message : "批量修正异常记录失败");
      }
    } finally {
      setUpdatingAttendanceIssues(false);
    }
  }

  function buildSelectedAttendanceIssueSummary(recordIds: string[]) {
    const selectedItems = (attendanceIssues?.items || []).filter((item) => recordIds.includes(item.recordId));
    const summary = selectedItems.reduce(
      (totals, item) => {
        if (item.status === "late") totals.late += 1;
        if (item.status === "excused") totals.excused += 1;
        if (item.status === "absent") {
          totals.absent += 1;
          if (item.pointTransactionId) totals.settledAbsent += 1;
          else totals.settleableAbsent += 1;
        }
        return totals;
      },
      { late: 0, absent: 0, excused: 0, settleableAbsent: 0, settledAbsent: 0 }
    );
    const sessionLabels = Array.from(
      new Set(selectedItems.map((item) => [item.session.sessionDate, item.session.sessionCode, item.session.sessionName].filter(Boolean).join(" ")))
    );

    return {
      selectedItems,
      summary,
      sessionCount: sessionLabels.length,
      firstSessionLabel: sessionLabels[0] || "",
      missingCount: Math.max(recordIds.length - selectedItems.length, 0)
    };
  }

  async function handleSettleAttendanceIssues(recordIds: string[]) {
    if (!selectedClassId || !token || !recordIds.length) return;
    const { summary, sessionCount, firstSessionLabel, missingCount } = buildSelectedAttendanceIssueSummary(recordIds);
    const absentPenaltyValue = String(attendance?.policy?.absentPenaltyValue ?? 0);
    const confirmLines = [
      "确认结算当前勾选的缺勤异常吗？",
      `勾选记录：${recordIds.length} 条`,
      `可结算缺勤：${summary.settleableAbsent} 条（${absentPenaltyValue} 分/条）`,
      `已结算缺勤：${summary.settledAbsent} 条`,
      `其他状态：迟到 ${summary.late} / 请假 ${summary.excused}`,
      `涉及场次：${sessionCount <= 1 ? firstSessionLabel || "-" : `${sessionCount} 个场次`}`,
      `筛选范围：${formatAttendanceDateRange(attendanceDateFrom, attendanceDateTo)}`,
      `时段筛选：${attendanceSessionCode || "全部时段"}`,
      missingCount ? "部分勾选记录已不在当前异常列表中，提交后会自动跳过。" : "已结算或非缺勤记录会自动跳过。"
    ];
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }

    setSettlingAttendanceIssues(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [
        settleResult,
        issuesData,
        sessionsData,
        sessionDetailData,
        auditsData,
        batchHistoryData,
        studentStatsData,
        dailyStatsData,
        summaryData,
        leaderboardData
      ] = await Promise.all([
        settleAttendanceIssuesAbsent(token, selectedClassId, {
          recordIds
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        selectedAttendanceSessionId
          ? fetchAttendanceSessionDetail(token, selectedAttendanceSessionId).catch(() => null)
          : Promise.resolve(null),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId || undefined,
          limit: 12
        }),
        selectedAttendanceSessionId
          ? fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12)
          : Promise.resolve({ items: [] }),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        }),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search)
      ]);

      setAttendanceIssues(issuesData);
      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setLastAttendanceIssueSettlementPreview({
        batchId: settleResult.batchId,
        requestedCount: settleResult.requestedCount,
        settledCount: settleResult.settledCount,
        skippedCount: settleResult.skippedCount,
        sessionCount: new Set(settleResult.items.map((item) => item.session.id)).size,
        firstSessionLabel: settleResult.items[0]
          ? [
              settleResult.items[0].session.sessionDate,
              settleResult.items[0].session.sessionCode,
              settleResult.items[0].session.sessionName
            ]
              .filter(Boolean)
              .join(" ")
          : "",
        absentPenaltyValue,
        dateFrom: attendanceDateFrom,
        dateTo: attendanceDateTo,
        sessionCode: attendanceSessionCode
      });
      setAttendanceWriteMessage(
        `已结算 ${settleResult.settledCount} 条缺勤异常${settleResult.skippedCount ? `，跳过 ${settleResult.skippedCount} 条无需结算记录` : ""}`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤结算写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance policy not found")) {
        setError("当前班级缺少考勤规则，无法结算异常缺勤。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("absent settle has no eligible")) {
        setError("当前勾选记录里没有可结算的缺勤异常。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("issue batch contains invalid")) {
        setError("勾选的异常记录中包含无效项，请刷新后重试。");
      } else {
        setError(err instanceof Error ? err.message : "结算异常缺勤失败");
      }
    } finally {
      setSettlingAttendanceIssues(false);
    }
  }

  function buildSelectedAttendanceRecordSummary() {
    const selectedRecords = (attendanceSessionDetail?.items || []).filter((item) => selectedAttendanceRecordIds.includes(item.id));
    const summary = selectedRecords.reduce(
      (totals, item) => {
        if (item.status === "present") totals.present += 1;
        if (item.status === "late") totals.late += 1;
        if (item.status === "absent") totals.absent += 1;
        if (item.status === "excused") totals.excused += 1;
        return totals;
      },
      { present: 0, late: 0, absent: 0, excused: 0 }
    );

    return {
      selectedRecords,
      summary
    };
  }

  async function handleBatchRevertAttendanceRecords() {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !selectedAttendanceRecordIds.length) return;
    const { selectedRecords, summary } = buildSelectedAttendanceRecordSummary();
    const sessionDate = attendanceSessionDetail?.session.sessionDate || "";
    const sessionName = attendanceSessionDetail?.session.sessionName || "";
    const confirmLines = [
      `确认撤销当前勾选记录的最近一次批量修正吗？`,
      `场次：${[sessionDate, sessionName].filter(Boolean).join(" ") || "-"}`,
      `勾选记录：${selectedAttendanceRecordIds.length} 条`,
      `当前状态：出勤 ${summary.present} / 迟到 ${summary.late} / 缺勤 ${summary.absent} / 请假 ${summary.excused}`,
      selectedRecords.length === selectedAttendanceRecordIds.length
        ? "仅会回退这些记录最近一次对应的批量修正。"
        : "部分勾选记录当前未出现在场次明细中，提交后会自动跳过。"
    ];
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }

    setBatchRevertingAttendance(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [
        revertResult,
        sessionsData,
        sessionDetailData,
        auditsData,
        batchHistoryData,
        studentStatsData,
        dailyStatsData
      ] = await Promise.all([
          revertAttendanceRecordBatchLatest(token, selectedClassId, selectedAttendanceSessionId, {
            recordIds: selectedAttendanceRecordIds
          }),
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(
        `已撤销 ${revertResult.revertedCount} 条记录的最近批量修正${revertResult.skippedCount ? `，跳过 ${revertResult.skippedCount} 条不可撤销记录` : ""}`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤修正写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch revert has no revertible")) {
        setError("当前勾选记录没有可撤销的最近批量修正。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("batch contains invalid")) {
        setError("勾选的考勤记录中包含无效项，请刷新当前场次后重试。");
      } else {
        setError(err instanceof Error ? err.message : "批量撤销考勤修正失败");
      }
    } finally {
      setBatchRevertingAttendance(false);
    }
  }

  async function handleBatchRevertAttendanceCreateRecords() {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !selectedAttendanceRecordIds.length) return;
    const { selectedRecords, summary } = buildSelectedAttendanceRecordSummary();
    const sessionDate = attendanceSessionDetail?.session.sessionDate || "";
    const sessionName = attendanceSessionDetail?.session.sessionName || "";
    const confirmLines = [
      `确认撤销当前勾选记录的最近一次批量补录吗？`,
      `场次：${[sessionDate, sessionName].filter(Boolean).join(" ") || "-"}`,
      `勾选记录：${selectedAttendanceRecordIds.length} 条`,
      `当前状态：出勤 ${summary.present} / 迟到 ${summary.late} / 缺勤 ${summary.absent} / 请假 ${summary.excused}`,
      selectedRecords.length === selectedAttendanceRecordIds.length
        ? "仅会回退这些记录最近一次对应的批量补录。"
        : "部分勾选记录当前未出现在场次明细中，提交后会自动跳过。"
    ];
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }

    setBatchRevertingAttendanceCreate(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const [
        revertResult,
        sessionsData,
        sessionDetailData,
        auditsData,
        batchHistoryData,
        studentStatsData,
        dailyStatsData
      ] = await Promise.all([
          revertAttendanceRecordBatchCreateLatest(token, selectedClassId, selectedAttendanceSessionId, {
            recordIds: selectedAttendanceRecordIds
          }),
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(
        `已撤销 ${revertResult.revertedCount} 条记录的最近批量补录${revertResult.skippedCount ? `，跳过 ${revertResult.skippedCount} 条不可撤销记录` : ""}`
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch create revert has no revertible")) {
        setError("当前勾选记录没有可撤销的最近批量补录。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("batch contains invalid")) {
        setError("勾选的考勤记录中包含无效项，请刷新当前场次后重试。");
      } else {
        setError(err instanceof Error ? err.message : "批量撤销补录失败");
      }
    } finally {
      setBatchRevertingAttendanceCreate(false);
    }
  }

  async function handleRevertAttendanceBatchById(item: AttendanceBatchHistoryItem) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !item.batchId) return;
    const sessionDate = attendanceSessionDetail?.session.sessionDate || "";
    const sessionName = attendanceSessionDetail?.session.sessionName || "";
    const operationLabel = item.operation === "batch_create" ? "批量补录" : "批量修正";
    const statusLabel = attendanceExportStatusLabels[item.status] || item.status;
    const confirmLines = [
      "确认撤销这条批量考勤操作吗？",
      `类型：${operationLabel}`,
      `目标状态：${statusLabel}`,
      `影响人数：${item.count} 人`,
      `场次：${sessionDate || "-"} ${sessionName || "-"}`.trim(),
      `批次：${item.batchId.slice(0, 8)}`
    ];
    if (!window.confirm(confirmLines.join("\n"))) return;

    setRevertingAttendanceBatch(true);
    setRevertingAttendanceBatchId(item.batchId);
    setAttendanceWriteMessage("");
    setError("");
    try {
      await revertAttendanceRecordBatchById(token, selectedClassId, selectedAttendanceSessionId, item.batchId);
      const [sessionsData, sessionDetailData, auditsData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(`已撤销${operationLabel}，回退 ${item.count} 条记录`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance batch not found")) {
        setError("目标批量考勤操作不存在或已失效。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch update has no revertible")) {
        setError("该批量修正当前不能撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch data is inconsistent")) {
        setError("该批量考勤操作数据异常，请刷新后重试。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销批量考勤操作失败");
      }
    } finally {
      setRevertingAttendanceBatch(false);
      setRevertingAttendanceBatchId("");
    }
  }

  async function handleSettleAttendanceSession() {
    if (!selectedClassId || !token || !selectedAttendanceSessionId) return;
    const sessionDate = attendanceSessionDetail?.session.sessionDate || "";
    const sessionCode = attendanceSessionDetail?.session.sessionCode || "";
    const sessionName = attendanceSessionDetail?.session.sessionName || "";
    const lateCount = attendanceSessionDetail?.summary.late || 0;
    const absentCount = attendanceSessionDetail?.summary.absent || 0;
    const latePenaltyValue = String(attendance?.policy?.latePenaltyValue ?? 0);
    const absentPenaltyValue = String(attendance?.policy?.absentPenaltyValue ?? 0);
    const confirmLines = [
      "确认结算当前场次的迟到/缺勤记录为积分吗？",
      `场次：${[sessionDate, sessionCode, sessionName].filter(Boolean).join(" ") || "-"}`,
      `迟到：${lateCount} 人（${latePenaltyValue} 分/人）`,
      `缺勤：${absentCount} 人（${absentPenaltyValue} 分/人）`,
      "请假不会参与本轮结算，本轮也不会自动发放全勤奖。"
    ];
    if (!window.confirm(confirmLines.join("\n"))) return;

    setSettlingAttendanceSession(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const settleResult = await settleAttendanceSession(token, selectedClassId, selectedAttendanceSessionId);
      const settledSummary = settleResult.items.reduce(
        (totals, item) => {
          if (item.status === "late") totals.late += 1;
          if (item.status === "absent") totals.absent += 1;
          return totals;
        },
        { late: 0, absent: 0 }
      );
      const [sessionsData, sessionDetailData, auditsData, issuesData, studentStatsData, dailyStatsData, summaryData, leaderboardData] =
        await Promise.all([
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceIssues(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            limit: 200
          }),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          }),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search)
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setLastAttendanceSessionSettlementPreview({
        sessionId: settleResult.session.id,
        sessionDate: settleResult.session.sessionDate,
        sessionCode,
        sessionName: settleResult.session.sessionName,
        settledCount: settleResult.settledCount,
        skippedCount: settleResult.skippedCount,
        lateCount: settledSummary.late,
        absentCount: settledSummary.absent,
        latePenaltyValue,
        absentPenaltyValue
      });
      setAttendanceWriteMessage(
        `已结算 ${settleResult.settledCount} 条迟到/缺勤记录${settleResult.skippedCount ? `，跳过 ${settleResult.skippedCount} 条无需结算记录` : ""}`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance session is not open")) {
        setError("当前场次不是 open 状态，不能重复结算。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance policy not found")) {
        setError("当前班级缺少考勤规则，无法结算。");
      } else {
        setError(err instanceof Error ? err.message : "结算考勤场次失败");
      }
    } finally {
      setSettlingAttendanceSession(false);
    }
  }

  async function handleUpdateAttendancePolicy(input: {
    latePenaltyValue: number;
    absentPenaltyValue: number;
    perfectAttendanceBonusValue: number;
    weekendRules: Record<string, string[]>;
    specialRules: Record<string, unknown>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前考勤规则吗？这会影响后续考勤积分结算和周全勤奖发放。")) return;

    setUpdatingAttendancePolicy(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const overviewData = await updateAttendancePolicy(token, selectedClassId, input).then(() =>
        fetchAttendanceOverview(token, selectedClassId)
      );
      setAttendance(overviewData);
      setAttendanceWriteMessage("已更新考勤规则");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤规则写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance policy not found")) {
        setError("当前班级缺少考勤规则，暂时无法更新。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance policy unchanged")) {
        setError("考勤规则未变化，不需要重复保存。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("latePenaltyValue")) {
        setError("迟到扣分必须小于或等于 0。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("absentPenaltyValue")) {
        setError("缺勤扣分必须小于或等于 0。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("perfectAttendanceBonusValue")) {
        setError("周全勤奖必须大于或等于 0。");
      } else {
        setError(err instanceof Error ? err.message : "更新考勤规则失败");
      }
    } finally {
      setUpdatingAttendancePolicy(false);
    }
  }

  async function handleUpdateAttendanceSchedules(input: {
    items: Array<{
      id?: string;
      code: string;
      name: string;
      startTime: string;
      endTime: string;
      lateTime: string;
      isActive?: boolean;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前考勤时段配置吗？这会影响后续场次创建和周规则映射。")) return;

    setUpdatingAttendanceSchedules(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const overviewData = await updateAttendanceSchedules(token, selectedClassId, input).then(() =>
        fetchAttendanceOverview(token, selectedClassId)
      );
      setAttendance(overviewData);
      setAttendanceWriteMessage("已更新考勤时段配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤时段写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance schedule contains invalid items")) {
        setError("提交的考勤时段里包含已失效的项目，请刷新后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance schedule contains duplicate codes")) {
        setError("考勤时段编码不能重复。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance schedule conflicts with archived items")) {
        setError("提交的考勤时段与历史归档时段编码冲突，请直接编辑原时段或换一个编码。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance schedules unchanged")) {
        setError("考勤时段未变化，不需要重复保存。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance schedule time range invalid")) {
        setError("考勤时段开始/结束时间无效，结束时间必须晚于开始时间。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Attendance schedule late time invalid")) {
        setError("迟到时间必须落在开始和结束时间之间。");
      } else {
        setError(err instanceof Error ? err.message : "更新考勤时段失败");
      }
    } finally {
      setUpdatingAttendanceSchedules(false);
    }
  }

  async function handleRevertAttendanceSessionSettlement() {
    if (!selectedClassId || !token || !selectedAttendanceSessionId) return;
    const activeSettlementPreview =
      lastAttendanceSessionSettlementPreview?.sessionId === selectedAttendanceSessionId
        ? lastAttendanceSessionSettlementPreview
        : null;
    const confirmMessage = activeSettlementPreview
      ? [
          "确认撤销当前场次最近一次结算吗？",
          `场次：${[activeSettlementPreview.sessionDate, activeSettlementPreview.sessionCode, activeSettlementPreview.sessionName]
            .filter(Boolean)
            .join(" ") || "-"}`,
          `已结算：${activeSettlementPreview.settledCount} 条`,
          `迟到：${activeSettlementPreview.lateCount} 人（${activeSettlementPreview.latePenaltyValue} 分/人）`,
          `缺勤：${activeSettlementPreview.absentCount} 人（${activeSettlementPreview.absentPenaltyValue} 分/人）`,
          activeSettlementPreview.skippedCount ? `跳过：${activeSettlementPreview.skippedCount} 条` : "",
          "这会回退对应积分，并将场次恢复为 open。"
        ]
          .filter(Boolean)
          .join("\n")
      : "确认撤销当前场次最近一次结算吗？这会回退已写入的考勤积分，并将场次恢复为 open。";
    if (!window.confirm(confirmMessage)) return;

    setRevertingAttendanceSessionSettlement(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const revertResult = await revertAttendanceSessionSettlement(token, selectedClassId, selectedAttendanceSessionId);
      const [sessionsData, sessionDetailData, auditsData, issuesData, studentStatsData, dailyStatsData, summaryData, leaderboardData] =
        await Promise.all([
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceIssues(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            limit: 200
          }),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          }),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search)
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      resetLastAttendanceSessionSettlementPreview();
      setAttendanceWriteMessage(`已撤销最近一次场次结算，回退 ${revertResult.revertedCount} 条积分结算`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("no revertible settlement")) {
        setError("当前场次没有可撤销的最近结算。");
      } else {
        setError(err instanceof Error ? err.message : "撤销考勤结算失败");
      }
    } finally {
      setRevertingAttendanceSessionSettlement(false);
    }
  }

  async function handleAwardPerfectAttendance() {
    if (!selectedClassId || !token || !perfectAttendanceStudentIds.length) return;
    const bonusValue = Number(attendance?.policy?.perfectAttendanceBonusValue || 10);
    const confirmMessage = [
      `确认给当前筛选范围内的 ${perfectAttendanceStudentIds.length} 名全勤学生发放周全勤奖吗？`,
      `分值：+${bonusValue} 分`,
      `日期范围：${formatAttendanceDateRange(attendanceDateFrom, attendanceDateTo)}`,
      `时段筛选：${attendanceSessionCode || "全部时段"}`,
      "这会写入一批积分加分记录。"
    ].join("\n");
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setAwardingPerfectAttendance(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const result = await createPointBatchAdjustment(token, selectedClassId, {
        studentIds: perfectAttendanceStudentIds,
        transactionType: "bonus",
        value: bonusValue,
        reason: "周全勤奖",
        scene: "班级",
        category: "出勤"
      });
      const [summaryData, leaderboardData, detailData] = await Promise.all([
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLastPerfectAttendanceTransactionIds(result.items.map((item) => item.transaction.id));
      setLastPerfectAttendancePreview({
        batchId: result.batchId,
        adjustedCount: result.adjustedCount,
        bonusValue: result.value,
        dateFrom: attendanceDateFrom,
        dateTo: attendanceDateTo,
        sessionCode: attendanceSessionCode
      });
      setAttendanceWriteMessage(`已为 ${result.adjustedCount} 名学生发放周全勤奖`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else {
        setError(err instanceof Error ? err.message : "发放周全勤奖失败");
      }
    } finally {
      setAwardingPerfectAttendance(false);
    }
  }

  async function handleRevertPerfectAttendance() {
    if (!selectedClassId || !token || !lastPerfectAttendanceTransactionIds.length) return;
    const confirmMessage = lastPerfectAttendancePreview
      ? [
          "确认撤销最近一次周全勤奖发放吗？",
          `影响人数：${lastPerfectAttendancePreview.adjustedCount} 人`,
          `分值：+${lastPerfectAttendancePreview.bonusValue} 分`,
          `日期范围：${formatAttendanceDateRange(lastPerfectAttendancePreview.dateFrom, lastPerfectAttendancePreview.dateTo)}`,
          `时段筛选：${lastPerfectAttendancePreview.sessionCode || "全部时段"}`,
          "这会回退对应积分。"
        ].join("\n")
      : `确认撤销最近一次周全勤奖发放吗？涉及 ${lastPerfectAttendanceTransactionIds.length} 条流水，这会回退对应积分。`;
    if (!window.confirm(confirmMessage)) return;

    setRevertingPerfectAttendance(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      await revertPointBatchAdjustment(token, selectedClassId, {
        transactionIds: lastPerfectAttendanceTransactionIds
      });
      const [summaryData, leaderboardData, detailData] = await Promise.all([
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      resetLastPerfectAttendanceAward();
      setAttendanceWriteMessage("已撤销最近一次周全勤奖发放");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else {
        setError(err instanceof Error ? err.message : "撤销周全勤奖失败");
      }
    } finally {
      setRevertingPerfectAttendance(false);
    }
  }

  async function handleRevertAttendanceAudit(audit: AttendanceAuditsResponse["items"][number]) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !audit.targetId) return;

    const actionLabel = audit.label || "操作";
    const afterData = audit.afterData || {};
    const studentName = typeof afterData.studentName === "string" ? afterData.studentName : "";
    const sessionDate = typeof afterData.sessionDate === "string" ? afterData.sessionDate : "";
    const sessionName = typeof afterData.sessionName === "string" ? afterData.sessionName : "";
    const status =
      typeof afterData.status === "string" && afterData.status in attendanceExportStatusLabels
        ? (afterData.status as AttendanceRecordStatus)
        : null;
    const batchSize = typeof audit.metadata?.batchSize === "number" ? audit.metadata.batchSize : null;
    const confirmLines = [
      `确认撤销这条“${actionLabel}”记录吗？`,
      `动作：${actionLabel}`
    ];
    if (studentName) {
      confirmLines.push(`学生：${studentName}`);
    }
    if (status) {
      confirmLines.push(`状态：${attendanceExportStatusLabels[status]}`);
    }
    if (sessionDate || sessionName) {
      confirmLines.push(`场次：${[sessionDate, sessionName].filter(Boolean).join(" ")}`);
    }
    if (batchSize) {
      confirmLines.push(`批量影响：${batchSize} 人`);
    }
    if (!window.confirm(confirmLines.join("\n"))) return;

    setRevertingAttendanceAuditId(audit.id);
    setAttendanceWriteMessage("");
    setError("");
    try {
      await revertAttendanceAudit(token, selectedClassId, audit.id);

      const [sessionsData, sessionDetailData, auditsData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
          fetchAttendanceSessions(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined
          }),
          fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
          fetchAttendanceAudits(token, selectedClassId, {
            sessionId: selectedAttendanceSessionId,
            limit: 12
          }),
          fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
          fetchAttendanceStudentStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceStudentSortBy
          }),
          fetchAttendanceDailyStats(token, selectedClassId, {
            dateFrom: attendanceDateFrom || undefined,
            dateTo: attendanceDateTo || undefined,
            sessionCode: attendanceSessionCode || undefined,
            sortBy: attendanceDailySortBy
          })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(`已从操作历史撤销“${actionLabel}”`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("no revertible update")) {
        setError("这条单条修正当前不能直接撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch revert has no revertible")) {
        setError("这条批量修正当前不能直接撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch create revert has no revertible")) {
        setError("这条批量补录当前不能直接撤销。");
      } else {
        setError(err instanceof Error ? err.message : "从操作历史撤销失败");
      }
    } finally {
      setRevertingAttendanceAuditId("");
    }
  }

  async function handleCreateAttendanceSession(input: {
    sessionDate: string;
    sessionCode: string;
    initialStatus: AttendanceRecordStatus;
  }) {
    if (!selectedClassId || !token) return;
    if (
      !window.confirm(
        `确认新建 ${input.sessionDate} 的考勤场次，并以“${attendanceExportStatusLabels[input.initialStatus]}”生成默认参与日常的学生记录吗？`
      )
    ) {
      return;
    }

    setCreatingAttendanceSession(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const result = await createAttendanceSession(token, selectedClassId, input);
      const [
        overviewData,
        issuesData,
        sessionsData,
        sessionDetailData,
        auditsData,
        batchHistoryData,
        studentStatsData,
        dailyStatsData
      ] = await Promise.all([
        fetchAttendanceOverview(token, selectedClassId),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        fetchAttendanceSessionDetail(token, result.session.id),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: result.session.id,
          limit: 12
        }),
        fetchAttendanceBatchHistory(token, selectedClassId, result.session.id, 12),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
      ]);

      setAttendance(overviewData);
      setAttendanceIssues(issuesData);
      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setSelectedAttendanceSessionId(result.session.id);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(`已创建 ${result.session.sessionName} 场次，并生成 ${result.seeded.studentCount} 条记录`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Attendance session already exists")) {
        setError("该日期和时段的考勤场次已经存在。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance schedule not found")) {
        setError("目标考勤时段不存在或已停用。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else {
        setError(err instanceof Error ? err.message : "创建考勤场次失败");
      }
    } finally {
      setCreatingAttendanceSession(false);
    }
  }

  async function handleCreateAttendanceRecord(input: {
    studentId: string;
    status: AttendanceRecordStatus;
  }) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId) return;
    if (!window.confirm("确认向当前场次补录这名学生的考勤记录吗？")) return;

    setCreatingAttendanceRecord(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const result = await createAttendanceRecord(token, selectedClassId, selectedAttendanceSessionId, input);
      const [sessionsData, sessionDetailData, auditsData, issuesData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId,
          limit: 12
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(`已为 ${result.student.name} 补录考勤记录`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Attendance record already exists")) {
        setError("该学生在当前场次里已经有考勤记录。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("目标学生不存在或不是当前班级的 active 学生。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance session not found")) {
        setError("目标考勤场次不存在。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else {
        setError(err instanceof Error ? err.message : "补录考勤记录失败");
      }
    } finally {
      setCreatingAttendanceRecord(false);
    }
  }

  async function handleCreateAttendanceRecordBatch(input: {
    studentIds: string[];
    status: AttendanceRecordStatus;
  }) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId || !input.studentIds.length) return;
    if (!window.confirm(`确认向当前场次批量补录 ${input.studentIds.length} 名学生的考勤记录吗？`)) return;

    setCreatingAttendanceRecordBatch(true);
    setAttendanceWriteMessage("");
    setError("");
    try {
      const result = await createAttendanceRecordsBatch(token, selectedClassId, selectedAttendanceSessionId, input);
      const [sessionsData, sessionDetailData, auditsData, issuesData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId,
          limit: 12
        }),
        fetchAttendanceIssues(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          limit: 200
        }),
        fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceIssues(issuesData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setSelectedAttendanceRecordIds([]);
      setAttendanceWriteMessage(
        `已批量补录 ${result.createdCount} 名学生${result.skippedCount ? `，跳过 ${result.skippedCount} 名已有记录学生` : ""}`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("batch create has no missing students")) {
        setError("当前所选学生都已经有考勤记录，不需要重复补录。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("batch contains invalid students")) {
        setError("批量补录目标里包含无效学生，请刷新当前场次后重试。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance session not found")) {
        setError("目标考勤场次不存在。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else {
        setError(err instanceof Error ? err.message : "批量补录考勤记录失败");
      }
    } finally {
      setCreatingAttendanceRecordBatch(false);
    }
  }

  async function handleRevertAttendanceRecord(recordId: string) {
    if (!selectedClassId || !token || !selectedAttendanceSessionId) return;
    if (!window.confirm("确认撤销这条考勤修正，恢复到上一次状态吗？")) return;

    setRevertingAttendanceRecordId(recordId);
    setAttendanceWriteMessage("");
    setError("");
    try {
      await revertAttendanceRecordLatest(token, selectedClassId, recordId);
      const [sessionsData, sessionDetailData, auditsData, batchHistoryData, studentStatsData, dailyStatsData] =
        await Promise.all([
        fetchAttendanceSessions(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined
        }),
        fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
        fetchAttendanceAudits(token, selectedClassId, {
          sessionId: selectedAttendanceSessionId,
          limit: 12
        }),
        fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12),
        fetchAttendanceStudentStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceStudentSortBy
        }),
        fetchAttendanceDailyStats(token, selectedClassId, {
          dateFrom: attendanceDateFrom || undefined,
          dateTo: attendanceDateTo || undefined,
          sessionCode: attendanceSessionCode || undefined,
          sortBy: attendanceDailySortBy
        })
        ]);

      setAttendanceSessionListMeta(sessionsData);
      setAttendanceSessions(sessionsData.items);
      setAttendanceSessionDetail(sessionDetailData);
      setAttendanceAudits(auditsData);
      setAttendanceBatchHistory(batchHistoryData.items);
      setAttendanceStudentStats(studentStatsData);
      setAttendanceDailyStats(dailyStatsData);
      setAttendanceWriteMessage("已撤销最近一次单条考勤修正");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("no revertible update")) {
        setError("这条考勤记录当前没有可撤销的单条修正。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("changed since latest update")) {
        setError("这条考勤记录在最新修正后又被修改过，当前不能直接撤销。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销考勤修正失败");
      }
    } finally {
      setRevertingAttendanceRecordId("");
    }
  }

  useEffect(() => {
    if (!selectedClassId || !token) return;

    void fetchHomeworkStudentStats(token, selectedClassId, {
      homeworkDate: selectedHomeworkDate || undefined,
      subjectName: selectedHomeworkSubject || undefined,
      days: 30
    })
      .then(setHomeworkStudentStats)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取作业学生统计失败");
      });
  }, [selectedClassId, selectedHomeworkDate, selectedHomeworkSubject, token]);

  useEffect(() => {
    setActivePointBatchCorrection(null);
  }, [selectedClassId]);

  useEffect(() => {
    setActiveHomeworkBatchCorrection(null);
    setLastHomeworkBatchPreview(null);
  }, [selectedClassId]);

  async function handleCreateHomeworkRecord(input: {
    studentId: string;
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }) {
    if (!selectedClassId || !token) return;
    const label =
      input.eventType === "missing"
        ? `确认登记 ${input.subjectName} 作业未交并扣除 ${input.value} 分？`
        : `确认登记 ${input.subjectName} 作业奖励并增加 ${input.value} 分？`;
    if (!window.confirm(label)) return;

    setCreatingHomeworkRecord(true);
    setError("");
    setHomeworkWriteMessage("");
    try {
      const [, summaryData, leaderboardData, homeworkData, homeworkDetailData, homeworkStudentStatsData, studentData, detailData] =
        await Promise.all([
          createHomeworkRecord(token, selectedClassId, input),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchHomeworkOverview(token, selectedClassId),
          fetchHomeworkDetail(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || input.homeworkDate,
            subjectName: selectedHomeworkSubject || input.subjectName
          }),
          fetchHomeworkStudentStats(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || input.homeworkDate,
            subjectName: selectedHomeworkSubject || input.subjectName
          }),
          fetchStudents(token, selectedClassId),
          selectedStudentId === input.studentId ? fetchStudentDetail(token, input.studentId) : Promise.resolve(null)
        ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(homeworkDetailData);
      setHomeworkStudentStats(homeworkStudentStatsData);
      setStudents(studentData.items);
      setSelectedHomeworkDate(homeworkDetailData.filters.homeworkDate || input.homeworkDate);
      setSelectedHomeworkSubject(homeworkDetailData.filters.subjectName || input.subjectName);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setHomeworkWriteMessage(
        input.eventType === "missing"
          ? `已登记 ${input.subjectName} 作业未交`
          : `已登记 ${input.subjectName} 作业奖励`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Homework record already exists")) {
        setError("该学生在该日期和学科下的作业记录已存在。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : "登记作业事件失败");
      }
    } finally {
      setCreatingHomeworkRecord(false);
    }
  }

  async function handleCreateHomeworkBatchRecord(input: {
    studentIds: string[];
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }) {
    if (!selectedClassId || !token) return;
    const correctionDraft = activeHomeworkBatchCorrection;
    const configuredSubject = settings?.classConfig?.subjects.find((item) => item.name === input.subjectName.trim()) || null;
    const representativeStudentIds =
      input.eventType === "missing" ? configuredSubject?.representativeStudentIds || [] : [];
    if (!input.studentIds.length && !representativeStudentIds.length) return;
    const representativePreview = formatStudentPreview(students, representativeStudentIds);
    const confirmationLines = correctionDraft
      ? [
          "确认修正这条批量作业登记？",
          `原批次：${correctionDraft.subjectName || "-"} · ${correctionDraft.homeworkDate || "-"}`,
          `原类型：${getHomeworkEventLabel(correctionDraft.eventType)}`,
          `原学生人数：${correctionDraft.count} 人${
            correctionDraft.representativeCount ? `，课代表 ${correctionDraft.representativeCount} 人` : ""
          }`,
          "以下会按当前勾选结果重建：",
          ...buildHomeworkBatchConfirmLines({
            title: "新批次预览：",
            subjectName: input.subjectName,
            homeworkDate: input.homeworkDate,
            eventType: input.eventType,
            value: input.value,
            count: input.studentIds.length,
            representativeCount: representativeStudentIds.length,
            representativeRewardValue: representativeStudentIds.length ? 1 : null,
            studentPreview: formatStudentPreview(students, input.studentIds),
            representativePreview
          }),
          "提交后会先撤销原批次，再按当前勾选结果重新登记。"
        ]
      : buildHomeworkBatchConfirmLines({
          title: "确认批量登记这组作业事件？",
          subjectName: input.subjectName,
          homeworkDate: input.homeworkDate,
          eventType: input.eventType,
          value: input.value,
          count: input.studentIds.length,
          representativeCount: representativeStudentIds.length,
          representativeRewardValue: representativeStudentIds.length ? 1 : null,
          studentPreview: formatStudentPreview(students, input.studentIds),
          representativePreview
        });
    if (!window.confirm(confirmationLines.filter(Boolean).join("\n"))) return;
    setCreatingHomeworkBatchRecord(true);
    setError("");
    setHomeworkWriteMessage("");
    setLastHomeworkBatchTransactionIds([]);
    setLastHomeworkBatchPreview(null);

    try {
      const [result, summaryData, leaderboardData, homeworkData, detailData, statsData, studentData, batchHistoryData] = await Promise.all([
        correctionDraft
          ? correctHomeworkBatchRecord(token, selectedClassId, correctionDraft.batchId, {
              ...input,
              representativeStudentIds
            })
          : createHomeworkBatchRecord(token, selectedClassId, {
              ...input,
              representativeStudentIds
            }),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchHomeworkOverview(token, selectedClassId),
        fetchHomeworkDetail(token, selectedClassId, {
          homeworkDate: selectedHomeworkDate || input.homeworkDate,
          subjectName: selectedHomeworkSubject || input.subjectName
        }),
        fetchHomeworkStudentStats(token, selectedClassId, {
          homeworkDate: selectedHomeworkDate || input.homeworkDate,
          subjectName: selectedHomeworkSubject || input.subjectName
        }),
        fetchStudents(token, selectedClassId),
        fetchHomeworkBatchHistory(token, selectedClassId, 12)
      ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(detailData);
      setHomeworkStudentStats(statsData);
      setStudents(studentData.items);
      setHomeworkBatchHistory(batchHistoryData.items);
      setSelectedBatchStudentIds([]);
      setLastHomeworkBatchTransactionIds(result.items.map((item) => item.transaction.id));
      setLastHomeworkBatchPreview(buildHomeworkBatchPreview(result, studentData.items));
      setActiveHomeworkBatchCorrection(null);
      setHomeworkWriteMessage(
        correctionDraft
          ? `已修正 ${result.createdCount - result.representativeCreatedCount} 名学生的作业事件${
              result.representativeCreatedCount ? `，并同步为 ${result.representativeCreatedCount} 名课代表加分` : ""
            }`
          : `已批量登记 ${result.createdCount - result.representativeCreatedCount} 名学生的作业事件${
              result.representativeCreatedCount ? `，并为 ${result.representativeCreatedCount} 名课代表加分` : ""
            }`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Homework correction conflicts")) {
        setError("修正目标里已有同日同学科作业记录，请先清理冲突记录后再重试。");
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Homework batch already exists")) {
        setError("当前勾选学生都已经登记过这组作业事件。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Homework batch targets required")) {
        setError("请先勾选未交学生，或为当前学科设置课代表。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Homework batch already reverted")) {
        setActiveHomeworkBatchCorrection(null);
        setError("原批量作业登记已经撤销，请刷新历史列表后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Homework representative config changed")) {
        setError("当前学科课代表配置已变化，请刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Homework batch not found")) {
        setActiveHomeworkBatchCorrection(null);
        setError("原批量作业登记不存在或已失效，请刷新历史列表后重试。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Homework batch contains invalid")) {
        setError("批量作业目标里包含无效学生或缺少积分账户。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : correctionDraft ? "修正批量作业登记失败" : "批量作业登记失败");
      }
    } finally {
      setCreatingHomeworkBatchRecord(false);
    }
  }

  async function handleRevertHomeworkBatchRecord() {
    if (!selectedClassId || !token || !lastHomeworkBatchTransactionIds.length) return;
    const confirmMessage = lastHomeworkBatchPreview
      ? [
          ...buildHomeworkBatchConfirmLines({
            title: "确认撤销最近一次批量作业登记？",
            subjectName: lastHomeworkBatchPreview.subjectName,
            homeworkDate: lastHomeworkBatchPreview.homeworkDate,
            eventType: lastHomeworkBatchPreview.eventType,
            value: lastHomeworkBatchPreview.value,
            count: lastHomeworkBatchPreview.count,
            representativeCount: lastHomeworkBatchPreview.representativeCount,
            representativeRewardValue: lastHomeworkBatchPreview.representativeRewardValue,
            studentPreview: lastHomeworkBatchPreview.studentPreview,
            representativePreview: lastHomeworkBatchPreview.representativePreview,
            reverse: true
          }),
          "这会回退对应积分并刷新作业统计。"
        ].join("\n")
      : `确认撤销最近一次批量作业登记？涉及 ${lastHomeworkBatchTransactionIds.length} 条记录，且会回退对应积分并刷新作业统计。`;
    if (
      !window.confirm(confirmMessage)
    ) {
      return;
    }

    setRevertingHomeworkBatchRecord(true);
    setError("");
    try {
      const [, summaryData, leaderboardData, homeworkData, detailData, statsData, studentData, detailStudentData, batchHistoryData] =
        await Promise.all([
          revertHomeworkBatchRecord(token, selectedClassId, {
            transactionIds: lastHomeworkBatchTransactionIds
          }),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchHomeworkOverview(token, selectedClassId),
          fetchHomeworkDetail(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchHomeworkStudentStats(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchStudents(token, selectedClassId),
          selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null),
          fetchHomeworkBatchHistory(token, selectedClassId, 12)
        ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(detailData);
      setHomeworkStudentStats(statsData);
      setStudents(studentData.items);
      setHomeworkBatchHistory(batchHistoryData.items);
      setSelectedHomeworkDate((current) => current || detailData.filters.homeworkDate || "");
      setSelectedHomeworkSubject((current) => current || detailData.filters.subjectName || "");
      if (detailStudentData) {
        setStudentDetail(detailStudentData);
      }
      setLastHomeworkBatchTransactionIds([]);
      setLastHomeworkBatchPreview(null);
      if (activeHomeworkBatchCorrection?.batchId === lastHomeworkBatchPreview?.batchId) {
        setActiveHomeworkBatchCorrection(null);
      }
      setHomeworkWriteMessage("已撤销最近一次批量作业登记");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Homework batch revert target contains invalid")) {
        setError("最近一次批量作业登记已失效，无法继续撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("最近一次批量作业登记已撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Only homework batch records")) {
        setError("当前仅支持撤销最近一次批量作业登记。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销批量作业登记失败");
      }
    } finally {
      setRevertingHomeworkBatchRecord(false);
    }
  }

  async function handleRevertHomeworkBatchRecordById(input: HomeworkBatchHistoryItem) {
    if (!selectedClassId || !token || !input.batchId) return;
    if (
      !window.confirm(
        [
          ...buildHomeworkBatchConfirmLines({
            title: "确认撤销这条批量作业登记？",
            subjectName: input.subjectName,
            homeworkDate: input.homeworkDate,
            eventType: input.eventType,
            value: input.value,
            count: input.count,
            representativeCount: input.representativeCount,
            representativeRewardValue: input.representativeRewardValue,
            reason: input.reason,
            reverse: true
          }),
          "这会回退对应积分并刷新作业统计。"
        ].join("\n")
      )
    ) {
      return;
    }

    setRevertingHomeworkBatchRecord(true);
    setRevertingHomeworkBatchId(input.batchId);
    setError("");
    try {
      await revertHomeworkBatchRecordByBatchId(token, selectedClassId, input.batchId);
      const [summaryData, leaderboardData, homeworkData, detailData, statsData, studentData, batchHistoryData, detailStudentData] =
        await Promise.all([
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchHomeworkOverview(token, selectedClassId),
          fetchHomeworkDetail(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchHomeworkStudentStats(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchStudents(token, selectedClassId),
          fetchHomeworkBatchHistory(token, selectedClassId, 12),
          selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
        ]);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(detailData);
      setHomeworkStudentStats(statsData);
      setStudents(studentData.items);
      setHomeworkBatchHistory(batchHistoryData.items);
      if (activeHomeworkBatchCorrection?.batchId === input.batchId) {
        setActiveHomeworkBatchCorrection(null);
      }
      if (lastHomeworkBatchPreview?.batchId === input.batchId) {
        setLastHomeworkBatchTransactionIds([]);
        setLastHomeworkBatchPreview(null);
      }
      if (detailStudentData) {
        setStudentDetail(detailStudentData);
      }
      setHomeworkWriteMessage("已撤销批量作业登记");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Homework batch not found")) {
        setError("目标批量作业登记不存在或已失效。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("该批量作业登记已撤销。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销批量作业登记失败");
      }
    } finally {
      setRevertingHomeworkBatchRecord(false);
      setRevertingHomeworkBatchId("");
    }
  }

  async function handleCreateSettingsReasonTemplate(input: {
    name: string;
    value: number;
    transactionType: "bonus" | "penalty" | "reward";
    scene: string;
    category: string;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm(buildSettingsReasonTemplateCreateConfirmMessage({ settings, template: input }))) {
      return;
    }
    setCreatingReasonTemplate(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await createSettingsReasonTemplate(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage(`已新增积分模板“${input.name}”`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Reason template already exists")) {
        setError("同名积分模板已存在。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings reason template permission")) {
        setError("当前账号没有设置写权限。");
      } else {
        setError(err instanceof Error ? err.message : "新增积分模板失败");
      }
    } finally {
      setCreatingReasonTemplate(false);
    }
  }

  async function handleCreateSettingsReasonTemplateBatch(
    items: Array<{
      name: string;
      value: number;
      transactionType: "bonus" | "penalty" | "reward";
      scene: string;
      category: string;
    }>
  ) {
    if (!selectedClassId || !token || !items.length) return;
    setCreatingReasonTemplateBatch(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const precheck = await precheckSettingsReasonTemplatesBatch(token, selectedClassId, {
        names: items.map((item) => item.name)
      });
      if (precheck.existingNames.length) {
        setError(`存在重名模板：${precheck.existingNames.slice(0, 5).join(" / ")}`);
        return;
      }
      if (!window.confirm(buildSettingsReasonTemplateBatchConfirmMessage({ settings, items }))) {
        return;
      }
      const settingsData = await createSettingsReasonTemplatesBatch(token, selectedClassId, {
        items
      }).then(() => fetchSettingsOverview(token, selectedClassId));
      setSettings(settingsData);
      setSettingsWriteMessage(`已批量新增 ${items.length} 条积分模板`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Reason template already exists")) {
        setError("存在重名模板，批量导入已取消。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("duplicate names")
      ) {
        setError("批量导入中存在重复模板名称。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("precheck contains duplicate")
      ) {
        setError("批量导入中存在重复模板名称。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings reason template permission")
      ) {
        setError("当前账号没有积分模板管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "批量导入积分模板失败");
      }
    } finally {
      setCreatingReasonTemplateBatch(false);
    }
  }

  async function handleUpdateClassFreeze(isFrozen: boolean) {
    if (!selectedClassId || !token) return;
    const actionLabel = isFrozen ? "冻结" : "解除冻结";
    if (!window.confirm(`确认${actionLabel}当前班级？冻结后将拦截积分、作业、考勤和设置写操作。`)) return;

    setUpdatingClassFreeze(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsClassFreeze(token, selectedClassId, {
        isFrozen
      }).then(() => fetchSettingsOverview(token, selectedClassId));
      setSettings(settingsData);
      setSettingsWriteMessage(`已${actionLabel}当前班级`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新冻结状态。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Class frozen state unchanged")) {
        setError("班级冻结状态未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings class freeze permission")) {
        setError("当前账号没有班级冻结管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新班级冻结状态失败");
      }
    } finally {
      setUpdatingClassFreeze(false);
    }
  }

  async function handleUpdateClassConfig(input: { className: string; timezone: string }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前班级名称和时区？")) return;

    setUpdatingClassConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsClassConfig(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新班级基础配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Class config timezone is invalid")) {
        setError("时区不是有效的 IANA 标识，例如 Asia/Shanghai。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新基础配置。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Class config unchanged")) {
        setError("班级基础配置未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings class config permission")) {
        setError("当前账号没有班级基础配置写权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新班级基础配置失败");
      }
    } finally {
      setUpdatingClassConfig(false);
    }
  }

  async function handleUpdateDutyConfig(input: { duty: Record<string, string[]> }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前值日安排？")) return;

    setUpdatingDutyConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsDuty(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新值日安排");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新值日安排。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Duty config unchanged")) {
        setError("值日安排未变化。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Duty config contains invalid student items")) {
        setError("值日安排中的学生引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings duty config permission")) {
        setError("当前账号没有值日安排写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate students")) {
        setError("同一天的值日安排中不能重复选择同一名学生。");
      } else {
        setError(err instanceof Error ? err.message : "更新值日安排失败");
      }
    } finally {
      setUpdatingDutyConfig(false);
    }
  }

  async function handleUpdateQuotes(input: { quotes: string[] }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前语录配置？")) return;

    setUpdatingQuotes(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsQuotes(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新语录配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新语录配置。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Quotes unchanged")) {
        setError("语录配置未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings quotes permission")) {
        setError("当前账号没有语录配置写权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新语录配置失败");
      }
    } finally {
      setUpdatingQuotes(false);
    }
  }

  async function handleImportStudentRoster(input: {
    mode: "merge" | "overwrite";
    skipConfirm?: boolean;
    items: Array<{
      name: string;
      gender?: string | null;
      status?: string | null;
      sortOrder?: number | null;
      groupName?: string | null;
      dormName?: string | null;
    }>;
  }) {
    if (!selectedClassId || !token) return false;
    const validItems = input.items
      .map((item) => ({
        ...item,
        name: item.name.trim(),
        gender: item.gender ? item.gender : null,
        status: item.status?.trim() || null,
        sortOrder: item.sortOrder != null && Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : null,
        groupName: item.groupName?.trim() || null,
        dormName: item.dormName?.trim() || null
      }))
      .filter((item) => item.name.length > 0);

    if (!validItems.length) {
      setError("导入内容为空，未找到可用的学生记录。");
      return false;
    }

    const actionLabel = input.mode === "overwrite" ? "覆盖导入" : "增量导入";
    const importedNames = new Set(validItems.map((item) => item.name.trim()).filter(Boolean));
    const archiveCandidateCount =
      input.mode === "overwrite"
        ? students.filter(
            (student) =>
              isStudentDailyParticipant(student.status, settings?.classConfig?.studentStatusOptions) &&
              !importedNames.has(student.name.trim())
          ).length
        : 0;
    const importStudentPreview = formatLabelPreview(validItems.map((item) => item.name), 5, "人");
    if (
      !input.skipConfirm &&
      !window.confirm(
        [
          `确认执行学生名单${actionLabel}？`,
          `处理记录：${validItems.length} 条`,
          `导入模式：${actionLabel}`,
          validItems.some((item) => item.status) ? `显式状态：${validItems.filter((item) => item.status).length} 条` : "",
          validItems.some((item) => item.groupName) ? `包含小组：${validItems.filter((item) => item.groupName).length} 条` : "",
          validItems.some((item) => item.dormName) ? `包含宿舍：${validItems.filter((item) => item.dormName).length} 条` : "",
          importStudentPreview ? `学生预览：${importStudentPreview}` : "",
          archiveCandidateCount ? `预计归档当前未出现在表格中的参与日常学生：${archiveCandidateCount} 人` : "",
          input.mode === "overwrite" ? "这会按表格结果覆盖现有学生资料与组织归属。" : "这会按姓名合并现有学生资料。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    ) {
      return false;
    }

    setImportingStudentRoster(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const currentStudents = [...students];
      const existingByName = new Map(currentStudents.map((student) => [student.name.trim(), student]));
      const groupIdMap = new Map<string, string>();
      const dormitoryIdMap = new Map<string, string>();

      (settings?.groups || []).forEach((group) => {
        groupIdMap.set(group.id, group.id);
        groupIdMap.set(group.name.trim(), group.id);
        if (group.legacyKey?.trim()) {
          groupIdMap.set(group.legacyKey.trim(), group.id);
        }
      });
      (settings?.dormitories || []).forEach((dormitory) => {
        dormitoryIdMap.set(dormitory.id, dormitory.id);
        dormitoryIdMap.set(dormitory.name.trim(), dormitory.id);
        if (dormitory.legacyKey?.trim()) {
          dormitoryIdMap.set(dormitory.legacyKey.trim(), dormitory.id);
        }
      });

      const resolveGroupId = (value: string | null, mode: "merge" | "overwrite") => {
        if (!value) return mode === "overwrite" ? null : undefined;
        return groupIdMap.get(value) ?? undefined;
      };
      const resolveDormitoryId = (value: string | null, mode: "merge" | "overwrite") => {
        if (!value) return mode === "overwrite" ? null : undefined;
        return dormitoryIdMap.get(value) ?? undefined;
      };

      let createdCount = 0;
      let updatedCount = 0;
      let archivedCount = 0;
      let nextSortOrder = Math.max(0, ...currentStudents.map((student) => Number(student.sortOrder) || 0)) + 1;
      for (const item of validItems) {
        const existing = existingByName.get(item.name);
        const targetSortOrder = item.sortOrder ?? existing?.sortOrder ?? nextSortOrder++;
        const targetStatus = item.status || existing?.status || "active";
        const targetGender =
          item.gender !== null ? item.gender : input.mode === "overwrite" ? null : (existing?.gender ?? null);
        const targetGroupId = resolveGroupId(item.groupName, input.mode);
        const targetDormitoryId = resolveDormitoryId(item.dormName, input.mode);

        if (existing) {
          const needsBasicUpdate =
            existing.name !== item.name ||
            (existing.gender ?? null) !== targetGender ||
            existing.status !== targetStatus ||
            Number(existing.sortOrder) !== Number(targetSortOrder);
          const needsOrganizationUpdate =
            (targetGroupId !== undefined && (existing.primaryGroup?.id || null) !== targetGroupId) ||
            (targetDormitoryId !== undefined && (existing.primaryDorm?.id || null) !== targetDormitoryId);

          if (needsBasicUpdate) {
            await updateStudent(token, existing.id, {
              name: item.name,
              gender: targetGender,
              status: targetStatus,
              sortOrder: targetSortOrder
            });
          }
          if (needsOrganizationUpdate) {
            await updateStudentOrganization(token, existing.id, {
              ...(targetGroupId !== undefined ? { groupId: targetGroupId } : {}),
              ...(targetDormitoryId !== undefined ? { dormitoryId: targetDormitoryId } : {})
            });
          }
          if (needsBasicUpdate || needsOrganizationUpdate) {
            updatedCount += 1;
          }
          continue;
        }

        const created = await createStudent(token, selectedClassId, {
          name: item.name,
          gender: targetGender,
          status: targetStatus,
          sortOrder: targetSortOrder
        });
        if (targetGroupId !== undefined || targetDormitoryId !== undefined) {
          await updateStudentOrganization(token, created.student.id, {
            ...(targetGroupId !== undefined ? { groupId: targetGroupId } : {}),
            ...(targetDormitoryId !== undefined ? { dormitoryId: targetDormitoryId } : {})
          });
        }
        createdCount += 1;
      }

      if (input.mode === "overwrite") {
        const missingStudentIds = currentStudents
          .filter(
            (student) =>
              isStudentDailyParticipant(student.status, settings?.classConfig?.studentStatusOptions) &&
              !importedNames.has(student.name.trim())
          )
          .map((student) => student.id);
        if (missingStudentIds.length > 0) {
          await updateStudentStatusBatch(token, selectedClassId, {
            studentIds: missingStudentIds,
            status: "archived"
          });
          archivedCount = missingStudentIds.length;
        }
      }

      const [studentData, settingsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchSettingsOverview(token, selectedClassId),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId).catch(() => null) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      setSettings(settingsData);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setSettingsWriteMessage(`已完成学生名单${actionLabel}：新增 ${createdCount}，更新 ${updatedCount}，归档 ${archivedCount}`);
      return true;
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student")) {
        setError("当前账号没有学生维护写权限。");
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Student number already exists")) {
        setError("导入失败：存在重复学号。");
      } else {
        setError(err instanceof Error ? err.message : "导入学生名单失败");
      }
      return false;
    } finally {
      setImportingStudentRoster(false);
    }
  }

  async function handleImportMaintenanceConfig(input: {
    config: unknown;
    skipConfirm?: boolean;
    deferFreeze?: boolean;
  }) {
    if (!selectedClassId || !token || !settings) return false;

    const payload =
      input.config && typeof input.config === "object" && !Array.isArray(input.config)
        ? (input.config as Record<string, unknown>)
        : null;
    if (!payload) {
      setError("配置导入内容无效，需要 JSON 对象。");
      return false;
    }

    if (!input.skipConfirm && !window.confirm(buildMaintenanceConfigImportConfirmLines(payload, settings))) {
      return false;
    }

    const ignoreNoop = async (action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (err) {
        if (err instanceof ApiError && err.status === 400 && err.message.toLowerCase().includes("unchanged")) {
          return;
        }
        throw err;
      }
    };

    setImportingMaintenanceConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const classConfig =
        payload.classConfig && typeof payload.classConfig === "object" && !Array.isArray(payload.classConfig)
          ? (payload.classConfig as Record<string, unknown>)
          : payload;
      const legacyPoints =
        payload.points && typeof payload.points === "object" && !Array.isArray(payload.points)
          ? (payload.points as Record<string, unknown>)
          : null;
      const legacyAttendance =
        payload.attendance && typeof payload.attendance === "object" && !Array.isArray(payload.attendance)
          ? (payload.attendance as Record<string, unknown>)
          : null;
      const legacyOrganization =
        payload.organization && typeof payload.organization === "object" && !Array.isArray(payload.organization)
          ? (payload.organization as Record<string, unknown>)
          : null;
      const legacyEnabledFeatures =
        payload.enabledFeatures && typeof payload.enabledFeatures === "object" && !Array.isArray(payload.enabledFeatures)
          ? (payload.enabledFeatures as Record<string, unknown>)
          : null;
      const importedStudents = Array.isArray(payload.students) ? payload.students : [];
      const isUuid = (value: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
      const className = typeof classConfig.className === "string" ? classConfig.className.trim() : "";
      const timezone = typeof classConfig.timezone === "string" ? classConfig.timezone.trim() : "";
      const quotes = Array.isArray(classConfig.quotes) ? classConfig.quotes : [];
      const countdownEvents = Array.isArray(classConfig.countdownEvents) ? classConfig.countdownEvents : [];
      const scheduleNotes =
        classConfig.scheduleNotes && typeof classConfig.scheduleNotes === "object" && !Array.isArray(classConfig.scheduleNotes)
          ? (classConfig.scheduleNotes as Record<string, unknown>)
          : null;
      const subjects = Array.isArray(classConfig.subjects)
        ? classConfig.subjects
        : Array.isArray(payload.subjects)
          ? payload.subjects
          : [];
      const groups = Array.isArray(payload.groups)
        ? payload.groups
        : Array.isArray(legacyOrganization?.groups)
          ? legacyOrganization.groups
          : [];
      const legacyDailyWageGroups = Array.isArray(legacyPoints?.dailyWageGroups) ? legacyPoints.dailyWageGroups : [];
      const rawDailyWageGroupIds = Array.isArray(classConfig.dailyWageGroupIds)
        ? classConfig.dailyWageGroupIds
        : Array.isArray(classConfig.dailyWageGroupLegacyKeys)
          ? classConfig.dailyWageGroupLegacyKeys
          : legacyDailyWageGroups;
      const legacyDefaultDailyWageGroupIds = Array.isArray(classConfig.dailyWageGroupIds)
        ? []
        : Array.from(
            new Set(
              groups
                .filter(
                  (item: unknown): item is Record<string, unknown> =>
                    Boolean(item) && typeof item === "object" && !Array.isArray(item)
                )
                .map((row) => {
                  const id = typeof row.id === "string" ? row.id.trim() : "";
                  const legacyKey = row.legacyKey == null ? "" : String(row.legacyKey).trim();
                  if (!id || (legacyKey !== "discipline" && legacyKey !== "hygiene")) {
                    return "";
                  }
                  return id;
                })
                .filter(Boolean)
            )
          );
      const currentGroupIdMap = new Map<string, string>();
      (settings.groups || []).forEach((group) => {
        currentGroupIdMap.set(group.id, group.id);
        currentGroupIdMap.set(group.name.trim(), group.id);
        if (group.legacyKey?.trim()) {
          currentGroupIdMap.set(group.legacyKey.trim(), group.id);
        }
      });
      const importedGroupRows = Array.isArray(payload.groups) ? payload.groups : [];
      const importedGroupResolver = new Map<string, string[]>();
      importedGroupRows
        .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .forEach((row) => {
          const tokens = [
            typeof row.id === "string" ? row.id.trim() : "",
            row.legacyKey == null ? "" : String(row.legacyKey).trim(),
            typeof row.name === "string" ? row.name.trim() : ""
          ].filter(Boolean);
          if (!tokens.length) return;
          importedGroupResolver.set(tokens[0], tokens);
          tokens.forEach((token) => importedGroupResolver.set(token, tokens));
        });
      const resolveImportedGroupId = (value: unknown) => {
        const token = value == null ? "" : String(value).trim();
        if (!token) return "";
        const direct = currentGroupIdMap.get(token);
        if (direct) return direct;
        const relatedTokens = importedGroupResolver.get(token) || [];
        for (const candidate of relatedTokens) {
          const resolved = currentGroupIdMap.get(candidate);
          if (resolved) return resolved;
        }
        return "";
      };
      const dailyWageGroupIds =
        rawDailyWageGroupIds.length > 0
          ? Array.from(new Set(rawDailyWageGroupIds.map((item: unknown) => resolveImportedGroupId(item)).filter(Boolean)))
          : legacyDefaultDailyWageGroupIds;
      const currentStudentIdMap = new Map<string, string>();
      students.forEach((student) => {
        currentStudentIdMap.set(student.id, student.id);
        currentStudentIdMap.set(student.name.trim(), student.id);
        if (student.legacyId?.trim()) {
          currentStudentIdMap.set(student.legacyId.trim(), student.id);
          currentStudentIdMap.set(`student:${student.legacyId.trim()}`, student.id);
        }
      });
      const importedStudentResolver = new Map<string, string[]>();
      importedStudents
        .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
        .forEach((row) => {
          const tokens = [
            typeof row.id === "string" || typeof row.id === "number" ? String(row.id).trim() : "",
            typeof row.legacyId === "string" || typeof row.legacyId === "number" ? String(row.legacyId).trim() : "",
            typeof row.legacyRef === "string" ? row.legacyRef.trim() : "",
            typeof row.name === "string" ? row.name.trim() : ""
          ].filter(Boolean);
          if (!tokens.length) return;
          importedStudentResolver.set(tokens[0], tokens);
          tokens.forEach((token) => importedStudentResolver.set(token, tokens));
        });
      const resolveImportedStudentId = (value: unknown) => {
        const token = value == null ? "" : String(value).trim();
        if (!token) return "";
        const direct = currentStudentIdMap.get(token);
        if (direct) return direct;
        const relatedTokens = importedStudentResolver.get(token) || [];
        for (const candidate of relatedTokens) {
          const resolved = currentStudentIdMap.get(candidate);
          if (resolved) return resolved;
          if (!candidate.startsWith("student:")) {
            const legacyResolved = currentStudentIdMap.get(`student:${candidate}`);
            if (legacyResolved) return legacyResolved;
          }
        }
        return "";
      };
      const rawPsychologyCommitteeStudentIds = Array.isArray(classConfig.psychologyCommitteeStudentIds)
        ? classConfig.psychologyCommitteeStudentIds
        : Array.isArray(classConfig.psychologyCommitteeStudentLegacyRefs)
          ? classConfig.psychologyCommitteeStudentLegacyRefs
          : Array.isArray(payload.psychologyCommittee)
            ? payload.psychologyCommittee
            : [];
      const psychologyCommitteeStudentIds = Array.from(
        new Set(rawPsychologyCommitteeStudentIds.map((item: unknown) => resolveImportedStudentId(item)).filter(Boolean))
      );
      const hasLastWageDate = Object.prototype.hasOwnProperty.call(classConfig, "lastWageDate");
      const importedLastWageDate =
        typeof classConfig.lastWageDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(classConfig.lastWageDate.trim())
          ? classConfig.lastWageDate.trim()
          : null;
      const studentCouncilRoles = Array.isArray(classConfig.studentCouncilRoles)
        ? classConfig.studentCouncilRoles
        : Array.isArray(legacyOrganization?.studentCouncilRoles)
          ? legacyOrganization.studentCouncilRoles
          : [];
      const dailyWageAmount = Number.isFinite(Number(classConfig.dailyWageAmount))
        ? Number(classConfig.dailyWageAmount)
        : Number.isFinite(Number(legacyPoints?.dailyWageAmount))
          ? Number(legacyPoints?.dailyWageAmount)
          : null;
      const dormitories = Array.isArray(payload.dormitories)
        ? payload.dormitories
        : Array.isArray(legacyOrganization?.dorms)
          ? legacyOrganization.dorms
          : [];
      const positions = Array.isArray(payload.positions)
        ? payload.positions
        : Array.isArray(legacyOrganization?.commissionerRoles)
          ? legacyOrganization.commissionerRoles
          : [];
      const featureFlags = Array.isArray(payload.featureFlags)
        ? payload.featureFlags
        : legacyEnabledFeatures
          ? Object.entries(legacyEnabledFeatures).map(([code, enabled]) => ({
              code,
              enabled: Boolean(enabled)
            }))
          : [];
      const reasonTemplates = Array.isArray(payload.reasonTemplates)
        ? payload.reasonTemplates
        : Array.isArray(legacyPoints?.reasons)
          ? legacyPoints.reasons
          : [];
      const attendanceSchedules = Array.isArray(payload.attendanceSchedules)
        ? payload.attendanceSchedules
        : Array.isArray(legacyAttendance?.schedule)
          ? legacyAttendance.schedule
          : [];
      const attendancePolicy =
        payload.attendancePolicy && typeof payload.attendancePolicy === "object" && !Array.isArray(payload.attendancePolicy)
          ? (payload.attendancePolicy as Record<string, unknown>)
          : legacyAttendance;

      const hasClassConfigUpdate = Boolean(className && timezone);
      const hasDutyUpdate = Boolean(classConfig.duty && typeof classConfig.duty === "object" && !Array.isArray(classConfig.duty));
      const hasQuotesUpdate = Array.isArray(classConfig.quotes);
      const hasLegacyCompatUpdate = Object.prototype.hasOwnProperty.call(classConfig, "legacyCompat");
      const hasCountdownEventsUpdate = Array.isArray(classConfig.countdownEvents);
      const hasScheduleNotesUpdate = Boolean(scheduleNotes);
      const hasSubjectsUpdate = Array.isArray(classConfig.subjects) || Array.isArray(payload.subjects);
      const hasWageConfigUpdate =
        dailyWageAmount !== null && (rawDailyWageGroupIds.length > 0 || legacyDefaultDailyWageGroupIds.length > 0);
      const hasAttendanceScheduleUpdate = Array.isArray(payload.attendanceSchedules) || Array.isArray(legacyAttendance?.schedule);
      const hasAttendancePolicyUpdate = Boolean(
        (payload.attendancePolicy && typeof payload.attendancePolicy === "object" && !Array.isArray(payload.attendancePolicy)) ||
          legacyAttendance
      );
      const hasGroupUpdate = Array.isArray(payload.groups) || Array.isArray(legacyOrganization?.groups);
      const hasDormitoryUpdate = Array.isArray(payload.dormitories) || Array.isArray(legacyOrganization?.dorms);
      const hasPositionUpdate = Array.isArray(payload.positions) || Array.isArray(legacyOrganization?.commissionerRoles);
      const hasFeatureFlagUpdate = Array.isArray(payload.featureFlags) || Object.prototype.hasOwnProperty.call(payload, "enabledFeatures");
      const hasReasonTemplateUpdate = Array.isArray(payload.reasonTemplates) || Array.isArray(legacyPoints?.reasons);
      const hasNonFreezeUpdates = [
        hasClassConfigUpdate,
        hasDutyUpdate,
        hasQuotesUpdate,
        hasLegacyCompatUpdate,
        hasCountdownEventsUpdate,
        hasScheduleNotesUpdate,
        hasSubjectsUpdate,
        hasWageConfigUpdate,
        hasAttendanceScheduleUpdate,
        hasAttendancePolicyUpdate,
        hasGroupUpdate,
        hasDormitoryUpdate,
        hasPositionUpdate,
        hasFeatureFlagUpdate,
        hasReasonTemplateUpdate
      ].some(Boolean);

      let effectiveFrozenState = Boolean(settings.classConfig?.isFrozen);
      const targetFrozenState =
        typeof classConfig.isFrozen === "boolean" ? classConfig.isFrozen : effectiveFrozenState;

      if (effectiveFrozenState && hasNonFreezeUpdates) {
        await ignoreNoop(() =>
          updateSettingsClassFreeze(token, selectedClassId, {
            isFrozen: false
          })
        );
        effectiveFrozenState = false;
      }

      if (hasClassConfigUpdate) {
        await ignoreNoop(() =>
          updateSettingsClassConfig(token, selectedClassId, {
            className,
            timezone
          })
        );
      }

      if (hasDutyUpdate) {
        await ignoreNoop(() =>
          updateSettingsDuty(token, selectedClassId, {
            duty: classConfig.duty as Record<string, string[]>
          })
        );
      }

      if (hasQuotesUpdate) {
        await ignoreNoop(() =>
          updateSettingsQuotes(token, selectedClassId, {
            quotes: quotes.map((item: unknown) => String(item).trim()).filter(Boolean)
          })
        );
      }

      if (hasLegacyCompatUpdate) {
        await ignoreNoop(() =>
          updateSettingsLegacyCompat(token, selectedClassId, {
            legacyCompat: classConfig.legacyCompat
          })
        );
      }

      if (hasCountdownEventsUpdate) {
        await ignoreNoop(() =>
          updateSettingsCountdownEvents(token, selectedClassId, {
            countdownEvents: countdownEvents
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                return {
                  id: typeof row.id === "string" ? row.id : undefined,
                  title: String(row.title || "").trim(),
                  date: row.date == null ? null : String(row.date).trim() || null,
                  note: row.note == null ? null : String(row.note).trim() || null
                };
              })
              .filter((item) => item.title)
          })
        );
      }

      if (hasScheduleNotesUpdate) {
        await ignoreNoop(() =>
          updateSettingsScheduleNotes(token, selectedClassId, {
            scheduleNotes: Object.fromEntries(
              Object.entries(scheduleNotes as Record<string, unknown>).map(([key, value]) => [
                key,
                value == null ? "" : String(value)
              ])
            )
          })
        );
      }

      if (hasSubjectsUpdate) {
        await ignoreNoop(() =>
          updateSettingsSubjects(token, selectedClassId, {
            subjects: subjects
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row, index) => {
                const rawRepresentativeStudentIds = Array.isArray(row.representativeStudentIds)
                  ? row.representativeStudentIds
                  : Array.isArray(row.representatives)
                    ? row.representatives
                    : [];
                return {
                  id: typeof row.id === "string" && row.id.trim() ? row.id.trim() : `subject-import-${index + 1}`,
                  name: String(row.name || "").trim(),
                  representativeStudentIds: Array.from(
                    new Set(rawRepresentativeStudentIds.map((studentId: unknown) => resolveImportedStudentId(studentId)).filter(Boolean))
                  )
                };
              })
              .filter((item) => item.name)
          })
        );
      }

      if (hasWageConfigUpdate) {
        await ignoreNoop(() =>
          updateSettingsWageConfig(token, selectedClassId, {
            dailyWageAmount: dailyWageAmount ?? 5,
            dailyWageGroupIds,
            psychologyCommitteeStudentIds,
            ...(hasLastWageDate ? { lastWageDate: importedLastWageDate } : {}),
            studentCouncilRoles: studentCouncilRoles
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                return {
                  id: String(row.id || "").trim(),
                  name: String(row.name || "").trim(),
                  studentId: row.studentId == null ? null : resolveImportedStudentId(row.studentId) || null
                };
              })
              .filter((item) => item.id && item.name)
          })
        );
      }

      if (hasAttendanceScheduleUpdate) {
        await ignoreNoop(() =>
          updateAttendanceSchedules(token, selectedClassId, {
            items: attendanceSchedules
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                const rawId = typeof row.id === "string" ? row.id.trim() : "";
                return {
                  id: rawId && isUuid(rawId) ? rawId : undefined,
                  code: String(row.code || rawId).trim(),
                  name: String(row.name || "").trim(),
                  startTime: String(row.startTime || row.start || "").trim(),
                  endTime: String(row.endTime || row.end || "").trim(),
                  lateTime: String(row.lateTime || "").trim(),
                  isActive: row.isActive == null ? true : Boolean(row.isActive)
                };
              })
              .filter((item) => item.code && item.name && item.startTime && item.endTime && item.lateTime)
          })
        );
      }

      if (hasAttendancePolicyUpdate && attendancePolicy) {
        const attendanceScheduleCodeByIndex = attendanceSchedules
          .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
          .map((row) => String(row.code || row.id || "").trim());
        const rawWeekendRules =
          attendancePolicy.weekendRules && typeof attendancePolicy.weekendRules === "object" && !Array.isArray(attendancePolicy.weekendRules)
            ? (attendancePolicy.weekendRules as Record<string, unknown>)
            : {};
        const normalizedWeekendRules = Object.fromEntries(
          Object.entries(rawWeekendRules).map(([weekday, value]) => [
            weekday,
            Array.isArray(value)
              ? Array.from(
                  new Set(
                    value
                      .map((item) => {
                        if (typeof item === "number" && Number.isInteger(item) && item >= 0) {
                          return attendanceScheduleCodeByIndex[item] || "";
                        }
                        const token = String(item ?? "").trim();
                        if (!token) return "";
                        if (/^\d+$/.test(token)) {
                          return attendanceScheduleCodeByIndex[Number(token)] || token;
                        }
                        return token;
                      })
                      .filter(Boolean)
                  )
                )
              : []
          ])
        );
        const payloadSpecialRules =
          attendancePolicy.specialRules && typeof attendancePolicy.specialRules === "object" && !Array.isArray(attendancePolicy.specialRules)
            ? (attendancePolicy.specialRules as Record<string, unknown>)
            : null;
        const legacySundaySpecialLateTime =
          legacyAttendance?.sundaySpecialLateTime &&
          typeof legacyAttendance.sundaySpecialLateTime === "object" &&
          !Array.isArray(legacyAttendance.sundaySpecialLateTime)
            ? (legacyAttendance.sundaySpecialLateTime as Record<string, unknown>)
            : null;
        const payloadSundaySpecialLateTime =
          payloadSpecialRules?.sundaySpecialLateTime &&
          typeof payloadSpecialRules.sundaySpecialLateTime === "object" &&
          !Array.isArray(payloadSpecialRules.sundaySpecialLateTime)
            ? (payloadSpecialRules.sundaySpecialLateTime as Record<string, unknown>)
            : null;
        const normalizedPayloadSpecialRules = payloadSpecialRules
          ? {
              ...payloadSpecialRules,
              ...(payloadSundaySpecialLateTime
                ? {
                    sundaySpecialLateTime: Object.fromEntries(
                      Object.entries(payloadSundaySpecialLateTime)
                        .map(([key, value]) => {
                          const token = String(key || "").trim();
                          if (!token || value == null) return null;
                          const normalizedKey =
                            /^\d+$/.test(token) && attendanceScheduleCodeByIndex[Number(token)]
                              ? attendanceScheduleCodeByIndex[Number(token)]
                              : token;
                          return normalizedKey ? [normalizedKey, String(value).trim()] : null;
                        })
                        .filter(Boolean) as Array<[string, string]>
                    )
                  }
                : {})
            }
          : null;
        const normalizedSpecialRules = normalizedPayloadSpecialRules
          ? normalizedPayloadSpecialRules
          : legacySundaySpecialLateTime
            ? {
                sundaySpecialLateTime: Object.fromEntries(
                  Object.entries(legacySundaySpecialLateTime)
                    .map(([key, value]) => {
                      const token = String(key || "").trim();
                      if (!token || value == null) return null;
                      const normalizedKey =
                        /^\d+$/.test(token) && attendanceScheduleCodeByIndex[Number(token)]
                          ? attendanceScheduleCodeByIndex[Number(token)]
                          : token;
                      return normalizedKey ? [normalizedKey, String(value).trim()] : null;
                    })
                    .filter(Boolean) as Array<[string, string]>
                )
              }
            : {};

        await ignoreNoop(() =>
          updateAttendancePolicy(token, selectedClassId, {
            latePenaltyValue: Number(
              attendancePolicy.latePenaltyValue ??
                (attendancePolicy.penaltyRules &&
                typeof attendancePolicy.penaltyRules === "object" &&
                !Array.isArray(attendancePolicy.penaltyRules)
                  ? (attendancePolicy.penaltyRules as Record<string, unknown>).late
                  : undefined) ??
                -1
            ),
            absentPenaltyValue: Number(
              attendancePolicy.absentPenaltyValue ??
                (attendancePolicy.penaltyRules &&
                typeof attendancePolicy.penaltyRules === "object" &&
                !Array.isArray(attendancePolicy.penaltyRules)
                  ? (attendancePolicy.penaltyRules as Record<string, unknown>).absent
                  : undefined) ??
                -5
            ),
            perfectAttendanceBonusValue: Number(
              attendancePolicy.perfectAttendanceBonusValue ??
                (attendancePolicy.penaltyRules &&
                typeof attendancePolicy.penaltyRules === "object" &&
                !Array.isArray(attendancePolicy.penaltyRules)
                  ? (attendancePolicy.penaltyRules as Record<string, unknown>).perfectAttendance
                  : undefined) ??
                10
            ),
            weekendRules: normalizedWeekendRules,
            specialRules: normalizedSpecialRules
          })
        );
      }

      if (hasGroupUpdate) {
        await ignoreNoop(() =>
          updateSettingsGroups(token, selectedClassId, {
            groups: groups
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                const rawId = typeof row.id === "string" ? row.id.trim() : "";
                return {
                  id: rawId && isUuid(rawId) ? rawId : undefined,
                  legacyKey:
                    row.legacyKey == null
                      ? rawId && !isUuid(rawId)
                        ? rawId
                        : null
                      : String(row.legacyKey).trim() || null,
                  name: String(row.name || "").trim(),
                  colorToken:
                    row.colorToken == null
                      ? row.color == null
                        ? null
                        : String(row.color).trim() || null
                      : String(row.colorToken).trim() || null,
                  isActive: row.isActive == null ? true : Boolean(row.isActive)
                };
              })
              .filter((item) => item.name)
          })
        );
      }

      if (hasDormitoryUpdate) {
        await ignoreNoop(() =>
          updateSettingsDormitories(token, selectedClassId, {
            dormitories: dormitories
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                const rawId = typeof row.id === "string" ? row.id.trim() : "";
                return {
                  id: rawId && isUuid(rawId) ? rawId : undefined,
                  legacyKey:
                    row.legacyKey == null
                      ? rawId && !isUuid(rawId)
                        ? rawId
                        : null
                      : String(row.legacyKey).trim() || null,
                  name: String(row.name || "").trim(),
                  building: row.building == null ? null : String(row.building).trim() || null,
                  genderScope: row.genderScope == null ? null : String(row.genderScope).trim() || null,
                  isActive: row.isActive == null ? true : Boolean(row.isActive)
                };
              })
              .filter((item) => item.name)
          })
        );
      }

      if (hasPositionUpdate) {
        await ignoreNoop(() =>
          updateSettingsPositions(token, selectedClassId, {
            positions: positions
              .filter((item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
              .map((row) => {
                const rawId = typeof row.id === "string" ? row.id.trim() : "";
                return {
                  id: rawId && isUuid(rawId) ? rawId : undefined,
                  code: String(row.code || rawId).trim(),
                  name: String(row.name || "").trim(),
                  category: String(row.category || "commissioner").trim() || "commissioner",
                  isActive: row.isActive == null ? true : Boolean(row.isActive)
                };
              })
              .filter((item) => item.code && item.name)
          })
        );
      }

      const currentFeatureFlagsByCode = new Map(settings.featureFlags.map((item) => [item.code, item]));
      if (hasFeatureFlagUpdate) {
        for (const item of featureFlags) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const row = item as Record<string, unknown>;
          const code = String(row.code || "").trim();
          const currentFlag = code ? currentFeatureFlagsByCode.get(code) : null;
          if (!currentFlag) continue;

          await ignoreNoop(() =>
            updateSettingsFeatureFlag(token, selectedClassId, currentFlag.id, {
              enabled: row.enabled == null ? currentFlag.enabled : Boolean(row.enabled),
              config:
                row.config && typeof row.config === "object" && !Array.isArray(row.config)
                  ? (row.config as Record<string, unknown>)
                  : currentFlag.config
            })
          );
        }
      }

      const editableTemplates = new Map(settings.reasonTemplates.filter((item) => item.isEditable).map((item) => [item.name, item]));
      const importedTemplateNames: string[] = [];
      if (hasReasonTemplateUpdate) {
        for (const item of reasonTemplates) {
          if (!item || typeof item !== "object" || Array.isArray(item)) continue;
          const row = item as Record<string, unknown>;
          const name = String(row.name || "").trim();
          const rawTransactionType = String(row.transactionType || row.type || "").trim();
          const transactionType =
            rawTransactionType === "penalty" ? "penalty" : rawTransactionType === "reward" ? "reward" : "bonus";
          const scene = String(row.scene || "班级").trim();
          const category = String(row.category || "待定").trim();
          const value = Number(row.value ?? row.val);
          if (!name || !scene || !category || !["bonus", "penalty", "reward"].includes(transactionType) || !Number.isFinite(value)) {
            continue;
          }

          importedTemplateNames.push(name);
          const existingTemplate = editableTemplates.get(name);
          if (existingTemplate) {
            await ignoreNoop(() =>
              updateSettingsReasonTemplate(token, selectedClassId, existingTemplate.id, {
                name,
                value,
                transactionType,
                scene,
                category,
                isActive: row.isActive == null ? existingTemplate.isActive : Boolean(row.isActive)
              })
            );
          } else {
            const created = await createSettingsReasonTemplate(token, selectedClassId, {
              name,
              value,
              transactionType,
              scene,
              category
            });
            editableTemplates.set(name, created.item);
            if (row.isActive === false) {
              await ignoreNoop(() =>
                updateSettingsReasonTemplate(token, selectedClassId, created.item.id, {
                  isActive: false
                })
              );
            }
          }
        }
      }

      if (importedTemplateNames.length > 1) {
        const freshSettings = await fetchSettingsOverview(token, selectedClassId);
        const importedSet = new Set(importedTemplateNames);
        const importedIds = freshSettings.reasonTemplates
          .filter((item) => importedSet.has(item.name))
          .sort((left, right) => importedTemplateNames.indexOf(left.name) - importedTemplateNames.indexOf(right.name))
          .map((item) => item.id);
        const remainingIds = freshSettings.reasonTemplates
          .filter((item) => !importedSet.has(item.name))
          .map((item) => item.id);
        if (importedIds.length > 1) {
          await ignoreNoop(() =>
            reorderSettingsReasonTemplates(token, selectedClassId, {
              templateIds: [...importedIds, ...remainingIds]
            })
          );
        }
      }

      if (!input.deferFreeze && targetFrozenState !== effectiveFrozenState) {
        await ignoreNoop(() =>
          updateSettingsClassFreeze(token, selectedClassId, {
            isFrozen: targetFrozenState
          })
        );
        effectiveFrozenState = targetFrozenState;
      }

      const [settingsData, studentData, detailData, attendanceData] = await Promise.all([
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId).catch(() => null) : Promise.resolve(null),
        hasAttendancePolicyUpdate || hasAttendanceScheduleUpdate
          ? fetchAttendanceOverview(token, selectedClassId).catch(() => null)
          : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      if (attendanceData) {
        setAttendance(attendanceData);
      }
      setSettingsWriteMessage("已导入班级配置包");
      return true;
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings")) {
        setError("当前账号没有维护配置导入权限。");
      } else {
        setError(err instanceof Error ? err.message : "导入配置包失败");
      }
      return false;
    } finally {
      setImportingMaintenanceConfig(false);
    }
  }

  async function handleRestoreMaintenanceSnapshot(input: {
    config: unknown;
    students: Array<{
      name: string;
      gender?: string | null;
      status?: string | null;
      sortOrder?: number | null;
      groupName?: string | null;
      dormName?: string | null;
    }>;
    skipConfirm?: boolean;
  }) {
    if (!selectedClassId || !token) return false;

    const snapshotStudentNames = input.students.map((item) => item.name.trim()).filter(Boolean);
    const snapshotStudentPreview = formatLabelPreview(snapshotStudentNames, 5, "人");
    const snapshotStudentNameSet = new Set(snapshotStudentNames);
    const snapshotArchiveCandidateCount = students.filter(
      (student) =>
        isStudentDailyParticipant(student.status, settings?.classConfig?.studentStatusOptions) &&
        !snapshotStudentNameSet.has(student.name.trim())
    ).length;
    const snapshotConfigPreview = summarizeMaintenanceConfigPayload(input.config, settings);
    if (
      !input.skipConfirm &&
      !window.confirm(
        [
          "确认恢复该本地快照？",
          `学生快照：${snapshotStudentNames.length} 人`,
          snapshotStudentPreview ? `学生预览：${snapshotStudentPreview}` : "",
          ...buildWrappedSummaryLines("配置范围", snapshotConfigPreview.scopeLabels),
          snapshotConfigPreview.targetFrozenState === null
            ? ""
            : `目标冻结状态：${snapshotConfigPreview.targetFrozenState ? "冻结" : "未冻结"}`,
          snapshotArchiveCandidateCount
            ? `预计归档当前未出现在快照中的参与日常学生：${snapshotArchiveCandidateCount} 人`
            : "",
          snapshotConfigPreview.willTemporarilyUnfreeze
            ? "当前班级已冻结，恢复期间会临时解除冻结，完成后再按快照状态恢复。"
            : "",
          "会先回滚班级配置，再以覆盖模式恢复学生名单。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    ) {
      return false;
    }

    setRestoringMaintenanceSnapshot(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const payload =
        input.config && typeof input.config === "object" && !Array.isArray(input.config)
          ? (input.config as Record<string, unknown>)
          : null;
      const classConfig =
        payload?.classConfig && typeof payload.classConfig === "object" && !Array.isArray(payload.classConfig)
          ? (payload.classConfig as Record<string, unknown>)
          : payload;
      const targetFrozenState =
        classConfig && typeof classConfig.isFrozen === "boolean"
          ? classConfig.isFrozen
          : Boolean(settings?.classConfig?.isFrozen);

      const restoreFrozenState = async () => {
        if (!targetFrozenState) return;
        try {
          await updateSettingsClassFreeze(token, selectedClassId, {
            isFrozen: true
          });
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 400 && err.message.toLowerCase().includes("unchanged"))) {
            throw err;
          }
        }
      };

      const configOk = await handleImportMaintenanceConfig({
        config: input.config,
        skipConfirm: true,
        deferFreeze: true
      });
      if (!configOk) {
        await restoreFrozenState().catch(() => undefined);
        return false;
      }

      const studentsOk = await handleImportStudentRoster({
        mode: "overwrite",
        skipConfirm: true,
        items: input.students
      });
      if (!studentsOk) {
        await restoreFrozenState().catch(() => undefined);
        return false;
      }

      await restoreFrozenState();
      const settingsData = await fetchSettingsOverview(token, selectedClassId);
      setSettings(settingsData);
      setSettingsWriteMessage("已恢复本地快照");
      return true;
    } finally {
      setRestoringMaintenanceSnapshot(false);
    }
  }

  async function handleUpdateLegacyCompat(input: { legacyCompat: unknown }) {
    if (!selectedClassId || !token) return;
    const compatSummaryLabels = getLegacyCompatSummaryLabels(input.legacyCompat as LegacyCompatData | null | undefined);
    if (
      !window.confirm(
        [
          "确认保存旧系统兼容数据？",
          ...buildWrappedSummaryLines("兼容范围", compatSummaryLabels),
          compatSummaryLabels.length ? "" : "当前兼容数据为空或仅包含少量元信息。",
          "这会整体覆盖当前兼容区运行态数据。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setUpdatingLegacyCompat(true);
    setSettingsWriteMessage("");
    setLegacyWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsLegacyCompat(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新旧系统兼容数据");
      setLegacyWriteMessage("已更新旧系统兼容数据");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新旧系统兼容数据。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Legacy compat unchanged")) {
        setError("旧系统兼容数据未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings legacy compat permission")) {
        setError("当前账号没有旧系统兼容数据写权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新旧系统兼容数据失败");
      }
    } finally {
      setUpdatingLegacyCompat(false);
    }
  }

  async function handleClaimLegacyTask(input: { taskId: string; studentId: string }) {
    if (!selectedClassId || !token) return;
    const compat = settings?.classConfig?.legacyCompat;
    const task = compat?.tasks.find((item) => item.id === input.taskId) || null;
    const student = students.find((item) => item.id === input.studentId) || null;
    const claimedPreview = task ? formatStudentPreview(students, task.claimedByStudentIds) : null;
    if (
      !window.confirm(
        [
          "确认领取这项任务？",
          `任务：${task?.title || input.taskId}`,
          `学生：${student?.name || input.studentId}`,
          task ? `奖励：${formatSignedPointDelta(task.points)} 分` : "",
          student?.account ? `当前余额：${student.account.balancePoints} 分` : "",
          task ? `任务时间：${formatLegacyDateRangeLabel(task.startTime, task.endTime)}` : "",
          task ? `已领取：${task.claimedByStudentIds.length} 人` : "",
          claimedPreview ? `已领预览：${claimedPreview}` : "",
          "这会为对应学生发放积分，并写入兼容区领取状态。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setClaimingLegacyTaskId(input.taskId);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        claimLegacyTask(token, selectedClassId, input.taskId, {
          studentId: input.studentId
        }),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId ? fetchStudentDetail(token, input.studentId === selectedStudentId ? input.studentId : selectedStudentId) : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLegacyWriteMessage(`已为 ${result.student.name} 领取任务“${result.task.title}”，发放 ${result.task.points} 分`);
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const taskMessage = getLegacyTaskErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (taskMessage) {
        setError(taskMessage);
      } else {
        setError(err instanceof Error ? err.message : "领取旧任务失败");
      }
    } finally {
      setClaimingLegacyTaskId("");
    }
  }

  async function handleRedeemLegacyShopItem(input: { studentId: string; itemId: string }) {
    if (!selectedClassId || !token) return;
    const compat = settings?.classConfig?.legacyCompat;
    const treasure = compat?.shop.treasures.find((item) => item.id === input.itemId) || null;
    const student = students.find((item) => item.id === input.studentId) || null;
    const currentStorageCount = compat?.shop.storage?.[input.studentId]?.[input.itemId] || 0;
    const dailyRedeemCount = compat?.shop.dailyRedemptionCounts?.[input.studentId]?.[input.itemId] || 0;
    const totalRedeemCount = compat?.shop.redemptionHistory?.[input.studentId]?.[input.itemId] || 0;
    const currentBalance = student?.account ? Number(student.account.balancePoints) : null;
    const afterBalance = currentBalance !== null && treasure ? currentBalance - treasure.price : null;
    if (
      !window.confirm(
        [
          "确认兑换这件宝物？",
          `学生：${student?.name || input.studentId}`,
          `宝物：${treasure?.name || input.itemId}${treasure?.rarity ? ` · ${treasure.rarity}` : ""}`,
          treasure ? `价格：${formatSignedPointDelta(-treasure.price)} 分` : "",
          currentBalance !== null ? `当前余额：${formatPointValue(currentBalance)} 分` : "",
          afterBalance !== null ? `兑换后余额：${formatPointValue(afterBalance)} 分` : "",
          treasure ? `当前库存：${treasure.stock} 件` : "",
          `当前持有：${currentStorageCount} 件`,
          treasure?.dailyLimit ? `今日已兑：${dailyRedeemCount} / ${treasure.dailyLimit} 次` : dailyRedeemCount ? `今日已兑：${dailyRedeemCount} 次` : "",
          totalRedeemCount ? `累计兑换：${totalRedeemCount} 次` : "",
          "这会同步扣减学生余额，并写入兼容区库存与兑换日志。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setRedeemingLegacyItemId(input.itemId);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        redeemLegacyShopItem(token, selectedClassId, input),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId
          ? fetchStudentDetail(token, input.studentId === selectedStudentId ? input.studentId : selectedStudentId)
          : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLegacyWriteMessage(
        `已为 ${result.student.name} 兑换“${result.item.name}”，${typeof result.price === "number" ? `扣减 ${result.price} 分，` : ""}库存剩余 ${result.item.stock}`
      );
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const legacyMessage = getLegacyShopErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (legacyMessage) {
        setError(legacyMessage);
      } else {
        setError(err instanceof Error ? err.message : "兑换旧版宝物失败");
      }
    } finally {
      setRedeemingLegacyItemId("");
    }
  }

  async function handleGachaLegacyShop(input: { studentId: string; times: 1 | 10 }) {
    if (!selectedClassId || !token) return null;
    const cost = input.times === 10 ? 120 : 15;
    const compat = settings?.classConfig?.legacyCompat;
    const student = students.find((item) => item.id === input.studentId) || null;
    const currentBalance = student?.account ? Number(student.account.balancePoints) : null;
    const afterBalance = currentBalance !== null ? currentBalance - cost : null;
    if (
      !window.confirm(
        [
          `确认执行${input.times === 10 ? "10 连" : "1 次"}祈愿？`,
          `学生：${student?.name || input.studentId}`,
          `祈愿次数：${input.times} 次`,
          `消耗：${formatSignedPointDelta(-cost)} 分`,
          currentBalance !== null ? `当前余额：${formatPointValue(currentBalance)} 分` : "",
          afterBalance !== null ? `祈愿后余额：${formatPointValue(afterBalance)} 分` : "",
          compat?.shop.treasures.length ? `奖池物品：${compat.shop.treasures.length} 件` : "",
          "这会扣减学生余额，并按兼容奖池写入祈愿结果。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return null;

    setRollingLegacyGacha(true);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        gachaLegacyShop(token, selectedClassId, input),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId
          ? fetchStudentDetail(token, input.studentId === selectedStudentId ? input.studentId : selectedStudentId)
          : Promise.resolve(null)
      ]);
      const groupedResults = Array.from(
        result.results.reduce((accumulator, item) => {
          accumulator.set(item.name, (accumulator.get(item.name) || 0) + 1);
          return accumulator;
        }, new Map<string, number>())
      )
        .map(([name, count]) => `${name}${count > 1 ? ` x${count}` : ""}`)
        .join(" / ");

      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLatestLegacyGachaResult(result);
      setLegacyWriteMessage(
        `已为 ${result.student.name} 完成${result.times === 10 ? "10 连" : "1 次"}祈愿，扣减 ${result.cost} 分，获得 ${groupedResults || "宝物"}`
      );
      return result;
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const legacyMessage = getLegacyShopErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (legacyMessage) {
        setError(legacyMessage);
      } else {
        setError(err instanceof Error ? err.message : "执行旧版祈愿失败");
      }
      return null;
    } finally {
      setRollingLegacyGacha(false);
    }
  }

  async function handleUseLegacyShopItem(input: { studentId: string; itemId: string }) {
    if (!selectedClassId || !token) return;
    const compat = settings?.classConfig?.legacyCompat;
    const treasure = compat?.shop.treasures.find((item) => item.id === input.itemId) || null;
    const student = students.find((item) => item.id === input.studentId) || null;
    const currentStorageCount = compat?.shop.storage?.[input.studentId]?.[input.itemId] || 0;
    const dailyUsageCount = compat?.shop.dailyUsageCounts?.[input.studentId]?.[input.itemId] || 0;
    if (
      !window.confirm(
        [
          "确认使用这件宝物？",
          `学生：${student?.name || input.studentId}`,
          `宝物：${treasure?.name || input.itemId}${treasure?.rarity ? ` · ${treasure.rarity}` : ""}`,
          `当前持有：${currentStorageCount} 件`,
          currentStorageCount > 0 ? `使用后持有：${Math.max(0, currentStorageCount - 1)} 件` : "",
          dailyUsageCount ? `今日已用：${dailyUsageCount} 次` : "",
          "这会减少兼容区储物箱数量，并写入使用日志。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setUsingLegacyItemId(input.itemId);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        useLegacyShopItem(token, selectedClassId, input),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId
          ? fetchStudentDetail(token, input.studentId === selectedStudentId ? input.studentId : selectedStudentId)
          : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLegacyWriteMessage(
        `已为 ${result.student.name} 使用“${result.item.name}”，储物箱剩余 ${result.item.storageCount} 件`
      );
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const legacyMessage = getLegacyShopErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (legacyMessage) {
        setError(legacyMessage);
      } else {
        setError(err instanceof Error ? err.message : "使用旧版宝物失败");
      }
    } finally {
      setUsingLegacyItemId("");
    }
  }

  async function handleReturnLegacyShopItem(input: { studentId: string; itemId: string }) {
    if (!selectedClassId || !token) return;
    const compat = settings?.classConfig?.legacyCompat;
    const treasure = compat?.shop.treasures.find((item) => item.id === input.itemId) || null;
    const student = students.find((item) => item.id === input.studentId) || null;
    const currentStorageCount = compat?.shop.storage?.[input.studentId]?.[input.itemId] || 0;
    if (
      !window.confirm(
        [
          "确认退回这件宝物？",
          `学生：${student?.name || input.studentId}`,
          `宝物：${treasure?.name || input.itemId}${treasure?.rarity ? ` · ${treasure.rarity}` : ""}`,
          `当前持有：${currentStorageCount} 件`,
          currentStorageCount > 0 ? `退回后持有：${Math.max(0, currentStorageCount - 1)} 件` : "",
          treasure ? `当前库存：${treasure.stock} 件` : "",
          student?.account ? `当前余额：${student.account.balancePoints} 分` : "",
          "这会回收兼容区储物箱物品，并同步返还学生余额。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setReturningLegacyItemId(input.itemId);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        returnLegacyShopItem(token, selectedClassId, input),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId
          ? fetchStudentDetail(token, input.studentId === selectedStudentId ? input.studentId : selectedStudentId)
          : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLegacyWriteMessage(
        `已为 ${result.student.name} 退回“${result.item.name}”，${typeof result.refundPrice === "number" ? `返还 ${result.refundPrice} 分，` : ""}库存现为 ${result.item.stock}`
      );
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const legacyMessage = getLegacyShopErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (legacyMessage) {
        setError(legacyMessage);
      } else {
        setError(err instanceof Error ? err.message : "退回旧版宝物失败");
      }
    } finally {
      setReturningLegacyItemId("");
    }
  }

  async function handleSettleLegacyBattle() {
    if (!selectedClassId || !token) return;
    const battle = settings?.classConfig?.legacyCompat?.battle || null;
    const teamPreview = battle
      ? formatLabelPreview(
          battle.teams
            .map((team) => `${team.name} ${formatPointValue(team.points)} 分`)
            .filter(Boolean),
          4,
          "队"
        )
      : null;
    if (
      !window.confirm(
        [
          "确认执行双子星结算？",
          battle ? `赛季：第 ${battle.season} 赛季` : "",
          battle ? `待结算对局：${battle.battles.length} 场` : "",
          battle ? `战队：${battle.teams.length} 队` : "",
          battle ? `共鸣小队：${battle.squads.length} 组` : "",
          battle && battle.teamBaseExamId
            ? `组队基准考试：${getLegacyBattleExamName(battle, battle.teamBaseExamId) || battle.teamBaseExamId}`
            : "",
          battle && battle.settleExamId
            ? `结算考试：${getLegacyBattleExamName(battle, battle.settleExamId) || battle.settleExamId}`
            : "",
          teamPreview ? `战队预览：${teamPreview}` : "",
          "这会同步更新兼容区战队积分与学生积分，并写入结算记录。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    )
      return;

    setSettlingLegacyBattle(true);
    setLegacyWriteMessage("");
    setError("");
    try {
      const [result, settingsData, studentData, summaryData, leaderboardData, detailData] = await Promise.all([
        settleLegacyBattle(token, selectedClassId),
        fetchSettingsOverview(token, selectedClassId),
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLegacyWriteMessage(
        `已完成双子星结算：${result.settlement.summaryText || "已更新战队结果"}，同步 ${result.adjustments.length} 条学生积分变动`
      );
    } catch (err) {
      const frozenMessage = getFrozenWriteMessage(err);
      const legacyMessage = getLegacyBattleErrorMessage(err);
      if (frozenMessage) {
        setError(frozenMessage);
      } else if (legacyMessage) {
        setError(legacyMessage);
      } else {
        setError(err instanceof Error ? err.message : "双子星结算失败");
      }
    } finally {
      setSettlingLegacyBattle(false);
    }
  }

  async function handleUpdateGroups(input: {
    groups: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      colorToken?: string | null;
      isActive?: boolean;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (
      !window.confirm(
        buildSettingsCollectionSaveConfirmMessage({
          title: "确认保存当前小组配置？",
          entityLabel: "小组",
          relationUnit: "人",
          currentItems: (settings?.groups || []).map((item) => ({
            id: item.id,
            label: item.name,
            isActive: item.isActive,
            relationCount: item.membersCount,
            signature: JSON.stringify([item.name, item.legacyKey || "", item.colorToken || "", item.isActive])
          })),
          nextItems: input.groups.map((item) => ({
            id: item.id,
            label: item.name,
            isActive: item.isActive,
            signature: JSON.stringify([item.name.trim(), item.legacyKey?.trim() || "", item.colorToken?.trim() || "", item.isActive !== false])
          })),
          extraLines: ["已分配成员不会丢失，旧条目可直接停用。"]
        })
      )
    )
      return;

    setUpdatingGroups(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsGroups(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新小组配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Group config contains invalid items")) {
        setError("小组配置引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Group config unchanged")) {
        setError("小组配置未变化。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("archived items")) {
        setError("小组名称或旧键与已停用项目冲突，请直接编辑已有条目。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings group config permission")) {
        setError("当前账号没有小组配置写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate ids")) {
        setError("小组配置存在重复条目。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate names")) {
        setError("小组名称不能重复。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate legacy keys")) {
        setError("小组旧键不能重复。");
      } else {
        setError(err instanceof Error ? err.message : "更新小组配置失败");
      }
    } finally {
      setUpdatingGroups(false);
    }
  }

  async function handleUpdateDormitories(input: {
    dormitories: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      building?: string | null;
      genderScope?: string | null;
      isActive?: boolean;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (
      !window.confirm(
        buildSettingsCollectionSaveConfirmMessage({
          title: "确认保存当前宿舍配置？",
          entityLabel: "宿舍",
          relationUnit: "人",
          currentItems: (settings?.dormitories || []).map((item) => ({
            id: item.id,
            label: item.name,
            isActive: item.isActive,
            relationCount: item.membersCount,
            signature: JSON.stringify([item.name, item.legacyKey || "", item.building || "", item.genderScope || "", item.isActive])
          })),
          nextItems: input.dormitories.map((item) => ({
            id: item.id,
            label: item.name,
            isActive: item.isActive,
            signature: JSON.stringify([
              item.name.trim(),
              item.legacyKey?.trim() || "",
              item.building?.trim() || "",
              item.genderScope?.trim() || "",
              item.isActive !== false
            ])
          })),
          extraLines: ["已有宿舍归属不会丢失，旧条目可继续直接停用。"]
        })
      )
    )
      return;

    setUpdatingDormitories(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsDormitories(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新宿舍配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.message.includes("Dormitory config contains invalid items")
      ) {
        setError("宿舍配置引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Dormitory config unchanged")) {
        setError("宿舍配置未变化。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("archived items")) {
        setError("宿舍名称或旧键与已停用项目冲突，请直接编辑已有条目。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings dormitory config permission")) {
        setError("当前账号没有宿舍配置写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate ids")) {
        setError("宿舍配置存在重复条目。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate names")) {
        setError("宿舍名称不能重复。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate legacy keys")) {
        setError("宿舍旧键不能重复。");
      } else {
        setError(err instanceof Error ? err.message : "更新宿舍配置失败");
      }
    } finally {
      setUpdatingDormitories(false);
    }
  }

  async function handleUpdatePositions(input: {
    positions: Array<{
      id?: string;
      code: string;
      name: string;
      category: string;
      isActive?: boolean;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (
      !window.confirm(
        buildSettingsCollectionSaveConfirmMessage({
          title: "确认保存当前岗位配置？",
          entityLabel: "岗位",
          relationUnit: "人",
          currentItems: (settings?.positions || []).map((item) => ({
            id: item.id,
            label: `${item.name}（${item.code}）`,
            isActive: item.isActive,
            relationCount: item.holdersCount,
            signature: JSON.stringify([item.code, item.name, item.category, item.isActive])
          })),
          nextItems: input.positions.map((item) => ({
            id: item.id,
            label: `${item.name.trim()}（${item.code.trim()}）`,
            isActive: item.isActive,
            signature: JSON.stringify([item.code.trim(), item.name.trim(), item.category.trim(), item.isActive !== false])
          })),
          extraLines: ["岗位停用后不会清空现有任职记录。"]
        })
      )
    )
      return;

    setUpdatingPositions(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsPositions(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新岗位配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Position config contains invalid items")) {
        setError("岗位配置引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Position config unchanged")) {
        setError("岗位配置未变化。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("archived items")) {
        setError("岗位编码与已停用项目冲突，请直接编辑已有条目。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings position config permission")) {
        setError("当前账号没有岗位配置写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate ids")) {
        setError("岗位配置存在重复条目。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate codes")) {
        setError("岗位编码不能重复。");
      } else {
        setError(err instanceof Error ? err.message : "更新岗位配置失败");
      }
    } finally {
      setUpdatingPositions(false);
    }
  }

  async function handleUpdateWageConfig(input: {
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string | null;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId?: string | null;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm(buildSettingsWageConfigConfirmMessage({ settings, nextConfig: input }))) return;

    setUpdatingWageConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsWageConfig(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新工资配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新工资配置。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Wage config unchanged")) {
        setError("工资配置未变化。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Wage groups contains invalid items")) {
        setError("工资小组配置中有无效项，建议刷新设置后重试。");
      } else if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.message.includes("Wage config contains invalid student items")
      ) {
        setError("工资配置中的学生引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings wage config permission denied")) {
        setError("当前账号没有工资配置写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Psychology committee contains duplicates")) {
        setError("心理委员配置存在重复学生。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Wage groups contains duplicates")) {
        setError("工资小组配置存在重复项。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Student council roles contains duplicate ids")
      ) {
        setError("学生会职位标识存在重复项。");
      } else {
        setError(err instanceof Error ? err.message : "更新工资配置失败");
      }
    } finally {
      setUpdatingWageConfig(false);
    }
  }

  async function handleUpdateSubjectConfig(input: {
    subjects: Array<{
      id: string;
      name: string;
      representativeStudentIds: string[];
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm(buildSettingsSubjectConfigConfirmMessage({ settings, nextSubjects: input.subjects }))) return;

    setUpdatingSubjectConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsSubjects(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新学科配置");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新学科配置。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Subject config unchanged")) {
        setError("学科配置未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 404 &&
        err.message.includes("Subject config contains invalid student items")
      ) {
        setError("学科配置中的课代表引用已失效，建议刷新设置后重试。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings subject config permission denied")) {
        setError("当前账号没有学科配置写权限。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate ids")) {
        setError("学科配置存在重复 id。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate names")) {
        setError("学科配置存在重复名称。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("duplicate representatives")) {
        setError("同一学科的课代表不能重复。");
      } else {
        setError(err instanceof Error ? err.message : "更新学科配置失败");
      }
    } finally {
      setUpdatingSubjectConfig(false);
    }
  }

  async function handleUpdateStudentStatusConfig(input: {
    studentStatusOptions: Array<{
      value: string;
      label: string;
      participatesInDailyFlow: boolean;
    }>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm(buildSettingsStudentStatusConfigConfirmMessage({ settings, students, nextStatusOptions: input.studentStatusOptions }))) return;

    setUpdatingStudentStatusConfig(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsStudentStatuses(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新学生状态字典");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新学生状态字典。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student status config unchanged")) {
        setError("学生状态字典未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings student status config permission denied")
      ) {
        setError("当前账号没有学生状态字典写权限。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Student status config contains duplicate values")
      ) {
        setError("学生状态编码存在重复项。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Student status config missing used statuses")
      ) {
        setError("仍有学生在使用被移除的状态，请先调整学生状态后再修改字典。");
      } else {
        setError(err instanceof Error ? err.message : "更新学生状态字典失败");
      }
    } finally {
      setUpdatingStudentStatusConfig(false);
    }
  }

  async function handleIssueDailyWage() {
    if (!selectedClassId || !token) return;
    const today = getZonedDateKey(new Date(), settings?.classConfig?.timezone);
    const wageConfirmMessage = buildIssueDailyWageConfirmMessage({
      settings,
      today
    });
    if (!window.confirm(wageConfirmMessage)) return;

    setIssuingDailyWage(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const result = await issuePointWage(token, selectedClassId);
      const [settingsData, studentData, summaryData, leaderboardData, batchHistoryData, pointAuditsData, detailData] =
        await Promise.all([
          fetchSettingsOverview(token, selectedClassId),
          fetchStudents(token, selectedClassId),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchPointBatchAdjustments(token, selectedClassId, 12),
          fetchPointAudits(token, selectedClassId, 12),
          selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
        ]);
      setSettings(settingsData);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setBatchAdjustmentHistory(batchHistoryData.items);
      setPointAudits(pointAuditsData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setLastBatchAdjustmentTransactionIds(result.items.map((item) => item.transaction.id));
      setLastBatchAdjustmentMessage(`已发放工资 ${result.issuedCount} 条`);
      const notes = [
        result.summary.dailyWageTargets ? `工资 ${result.summary.dailyWageTargets} 人` : "",
        result.summary.psychologyCommitteeTargets ? `心理委员 ${result.summary.psychologyCommitteeTargets} 人` : "",
        result.summary.studentCouncilTargets ? `学生会 ${result.summary.studentCouncilTargets} 项` : ""
      ].filter(Boolean);
      setSettingsWriteMessage(`已发放今日工资${notes.length ? `（${notes.join("，")}）` : ""}`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法发放工资。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("No wage targets configured")) {
        setError("当前工资配置没有可发放对象，请先保存工资配置。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission denied")) {
        setError("当前账号没有工资发放权限。");
      } else {
        setError(err instanceof Error ? err.message : "发放今日工资失败");
      }
    } finally {
      setIssuingDailyWage(false);
    }
  }

  async function handleUpdateScheduleNotes(input: { scheduleNotes: Record<string, string> }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前课程备注？这会整体覆盖现有备注键值。")) return;

    setUpdatingScheduleNotes(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsScheduleNotes(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新课程备注");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新课程备注。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Schedule notes unchanged")) {
        setError("课程备注未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Settings schedule notes permission")) {
        setError("当前账号没有课程备注写权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新课程备注失败");
      }
    } finally {
      setUpdatingScheduleNotes(false);
    }
  }

  async function handleUpdateCountdownEvents(input: {
    countdownEvents: Array<{ id?: string; title: string; date?: string | null; note?: string | null }>;
  }) {
    if (!selectedClassId || !token) return;
    if (!window.confirm("确认保存当前倒计时事件？这会整体覆盖现有事件列表。")) return;

    setUpdatingCountdownEvents(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsCountdownEvents(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新倒计时事件");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Class config not found")) {
        setError("班级配置不存在，无法更新倒计时事件。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Countdown event date is invalid")) {
        setError("倒计时事件日期无效，请使用 YYYY-MM-DD。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Countdown events unchanged")) {
        setError("倒计时事件未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings countdown events permission")
      ) {
        setError("当前账号没有倒计时事件写权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新倒计时事件失败");
      }
    } finally {
      setUpdatingCountdownEvents(false);
    }
  }

  async function handleCreateExportJob(input: {
    exportType: "full" | "settings" | "students" | "points" | "attendance" | "homework";
    dateFrom?: string;
    dateTo?: string;
  }) {
    if (!selectedClassId || !token) return;

    setCreatingExportJob(true);
    setExportMessage("");
    setError("");
    try {
      const job = await createExportJob(token, selectedClassId, input);
      const [summaryData, historyData] = await Promise.all([
        fetchExportSummary(token, selectedClassId),
        fetchExportHistory(token, selectedClassId)
      ]);
      setExportSummary(summaryData);
      setExportHistory(historyData);
      setExportMessage(`已完成${job.exportType}导出任务，当前状态为${job.status}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Export job permission")) {
        setError("当前账号没有导出写权限。");
      } else {
        setError(err instanceof Error ? err.message : "创建导出任务失败");
      }
    } finally {
      setCreatingExportJob(false);
    }
  }

  async function handleImportPointsExcel(file: File) {
    if (!selectedClassId || !token) return;

    setImportingPointsExcel(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets["积分表"] || workbook.Sheets["积分数据"] || workbook.Sheets[workbook.SheetNames[0] || ""];
      if (!sheet) {
        throw new Error("未识别到可导入的积分工作表。");
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false
      });
      if (!rows.length) {
        throw new Error("积分 Excel 为空，无法导入。");
      }

      const studentsByName = new Map<string, StudentItem[]>();
      for (const student of students) {
        const key = student.name.trim();
        if (!key) continue;
        const current = studentsByName.get(key) || [];
        current.push(student);
        studentsByName.set(key, current);
      }

      const errors: string[] = [];
      const itemsByStudentId = new Map<
        string,
        {
          studentId: string;
          studentName: string;
          totalPoints: number;
          balancePoints: number;
          penaltyPoints: number;
        }
      >();

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const studentName = String(row["姓名"] ?? "").trim();
        if (!studentName) {
          errors.push(`第 ${rowNumber} 行缺少“姓名”`);
          return;
        }

        const matchedStudents = studentsByName.get(studentName) || [];
        if (!matchedStudents.length) {
          errors.push(`第 ${rowNumber} 行学生“${studentName}”不存在`);
          return;
        }
        if (matchedStudents.length > 1) {
          errors.push(`第 ${rowNumber} 行学生“${studentName}”重名，当前无法自动导入`);
          return;
        }

        const student = matchedStudents[0];
        const currentTotalPoints = Number(student.account?.totalPoints || 0);
        const currentBalancePoints = Number(student.account?.balancePoints || 0);
        const currentPenaltyPoints = Number(student.account?.penaltyPoints || 0);

        const parsedTotalPoints = parseMaintenancePointNumber(row["自在值"] ?? row["总分"] ?? row["总积分"]);
        const parsedBalancePoints = parseMaintenancePointNumber(row["余额"] ?? row["余额积分"]);
        const parsedPenaltyPoints = parseMaintenancePointNumber(row["不自在值"] ?? row["罚分"] ?? row["罚积分"]);

        if (Number.isNaN(parsedTotalPoints) || Number.isNaN(parsedBalancePoints) || Number.isNaN(parsedPenaltyPoints)) {
          errors.push(`第 ${rowNumber} 行存在无效积分数字`);
          return;
        }

        if (parsedTotalPoints === null && parsedBalancePoints === null && parsedPenaltyPoints === null) {
          return;
        }

        const nextItem = {
          studentId: student.id,
          studentName: student.name,
          totalPoints: parsedTotalPoints === null ? currentTotalPoints : parsedTotalPoints,
          balancePoints: parsedBalancePoints === null ? currentBalancePoints : parsedBalancePoints,
          penaltyPoints: parsedPenaltyPoints === null ? currentPenaltyPoints : parsedPenaltyPoints
        };

        if (nextItem.penaltyPoints < 0) {
          errors.push(`第 ${rowNumber} 行“不自在值/罚分”不能为负数`);
          return;
        }

        const previous = itemsByStudentId.get(student.id);
        if (
          previous &&
          (previous.totalPoints !== nextItem.totalPoints ||
            previous.balancePoints !== nextItem.balancePoints ||
            previous.penaltyPoints !== nextItem.penaltyPoints)
        ) {
          errors.push(`第 ${rowNumber} 行与前文存在重复但不一致的学生“${student.name}”`);
          return;
        }

        itemsByStudentId.set(student.id, nextItem);
      });

      if (errors.length) {
        throw new Error(errors.slice(0, 8).join("；") + (errors.length > 8 ? `；另有 ${errors.length - 8} 项` : ""));
      }

      const items = Array.from(itemsByStudentId.values()).map((item) => ({
        studentId: item.studentId,
        totalPoints: item.totalPoints,
        balancePoints: item.balancePoints,
        penaltyPoints: item.penaltyPoints
      }));
      if (!items.length) {
        throw new Error("表格中没有解析到可更新的积分数据。");
      }

      const pointImportPreview = formatLabelPreview(
        Array.from(itemsByStudentId.values()).map((item) => item.studentName),
        5,
        "人"
      );
      if (
        !window.confirm(
          [
            "确认导入积分 Excel？",
            `原始行数：${rows.length} 行`,
            `覆盖账户：${items.length} 人`,
            pointImportPreview ? `学生预览：${pointImportPreview}` : "",
            "这会直接覆盖这些学生当前积分账户，不会补写或回滚历史流水。"
          ]
            .filter(Boolean)
            .join("\n")
        )
      ) {
        return;
      }

      const result = await importPointAccountsMaintenance(token, selectedClassId, {
        items
      });
      await reloadSelectedClassWorkspace();
      const summaryParts = [
        `导入 ${result.importedCount} 人`,
        result.updatedCount ? `更新 ${result.updatedCount} 人` : "",
        result.createdCount ? `补建 ${result.createdCount} 人` : "",
        `未变更 ${result.unchangedCount} 人`
      ].filter(Boolean);
      setSettingsWriteMessage(`已导入积分 Excel（${summaryParts.join("，")}）`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分导入权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("导入过程中发现部分学生不存在或已被变更，请刷新后重试。");
      } else {
        setError(err instanceof Error ? err.message : "导入积分 Excel 失败");
      }
    } finally {
      setImportingPointsExcel(false);
    }
  }

  async function handleFixPointAccount(input: {
    studentId: string;
    totalPoints: number;
    balancePoints: number;
    penaltyPoints: number;
  }) {
    if (!selectedClassId || !token) return false;

    const student = students.find((item) => item.id === input.studentId);
    if (!student) {
      setError("目标学生不存在，请刷新后重试。");
      return false;
    }

    if (
      !window.confirm(
        [
          `确认修正 ${student.name} 的积分账户？`,
          `当前：总分 ${student.account?.totalPoints || "0"} · 余额 ${student.account?.balancePoints || "0"} · 罚分 ${
            student.account?.penaltyPoints || "0"
          }`,
          `目标：总分 ${input.totalPoints} · 余额 ${input.balancePoints} · 罚分 ${input.penaltyPoints}`,
          `变化：总分 ${formatSignedPointDelta(input.totalPoints - Number(student.account?.totalPoints || 0))} · 余额 ${formatSignedPointDelta(
            input.balancePoints - Number(student.account?.balancePoints || 0)
          )} · 罚分 ${formatSignedPointDelta(input.penaltyPoints - Number(student.account?.penaltyPoints || 0))}`,
          "这会直接覆盖当前账户分数，不会补写历史流水。"
        ].join("\n")
      )
    ) {
      return false;
    }

    setFixingPointAccount(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const result = await importPointAccountsMaintenance(token, selectedClassId, {
        items: [
          {
            studentId: input.studentId,
            totalPoints: input.totalPoints,
            balancePoints: input.balancePoints,
            penaltyPoints: input.penaltyPoints
          }
        ]
      });
      await reloadSelectedClassWorkspace();
      const actionLabel = result.updatedCount ? "已修正" : result.createdCount ? "已补建并写入" : "无需变更";
      setSettingsWriteMessage(`${actionLabel}${student.name}的积分账户`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分修复权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("目标学生不存在或已被变更，请刷新后重试。");
      } else {
        setError(err instanceof Error ? err.message : "手动修正积分失败");
      }
      return false;
    } finally {
      setFixingPointAccount(false);
    }
  }

  async function handleRebuildPointAccountsFromHistory() {
    if (!selectedClassId || !token) return false;
    if (
      !window.confirm(
        [
          "确认按当前未撤销积分流水重建全班积分账户？",
          `学生范围：${summary?.studentCount ?? students.length} 人`,
          summary?.transactionCount ? `当前流水：${summary.transactionCount} 条` : "",
          summary ? `当前总分：${summary.totals.totalPoints} · 余额 ${summary.totals.balancePoints} · 罚分 ${summary.totals.penaltyPoints}` : "",
          "这会覆盖现有账户分数，但不会删除历史流水。"
        ]
          .filter(Boolean)
          .join("\n")
      )
    ) {
      return false;
    }

    setRebuildingPointAccountsFromHistory(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const result = await rebuildPointAccountsFromHistory(token, selectedClassId);
      await reloadSelectedClassWorkspace();
      const summaryParts = [
        `修正 ${result.updatedCount} 人`,
        result.createdCount ? `补建 ${result.createdCount} 人` : "",
        `未变更 ${result.unchangedCount} 人`,
        `流水 ${result.transactionCount} 条`
      ].filter(Boolean);
      setSettingsWriteMessage(`已按积分流水恢复分数（${summaryParts.join("，")}）`);
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分修复权限。");
      } else {
        setError(err instanceof Error ? err.message : "从积分流水恢复分数失败");
      }
      return false;
    } finally {
      setRebuildingPointAccountsFromHistory(false);
    }
  }

  async function handleExportAttendanceExcel() {
    if (!selectedClassId || !token) return;

    setExportingAttendanceExcel(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const result = await fetchAttendanceMaintenanceExport(token, selectedClassId);
      const scheduleNameByCode = new Map<string, string>();
      for (const schedule of result.schedules) {
        if (!scheduleNameByCode.has(schedule.code)) {
          scheduleNameByCode.set(schedule.code, schedule.name);
        }
      }
      for (const session of result.sessions) {
        if (!scheduleNameByCode.has(session.sessionCode)) {
          scheduleNameByCode.set(session.sessionCode, session.sessionName);
        }
      }

      const nameCounts = new Map<string, number>();
      for (const name of scheduleNameByCode.values()) {
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }

      const sessionCodesInUse = Array.from(new Set(result.sessions.map((item) => item.sessionCode).filter(Boolean)));
      const knownScheduleCodes = result.schedules.map((item) => item.code);
      const orderedSessionCodes = [
        ...knownScheduleCodes.filter((code, index) => knownScheduleCodes.indexOf(code) === index && sessionCodesInUse.includes(code)),
        ...sessionCodesInUse.filter((code) => !knownScheduleCodes.includes(code)).sort((left, right) => left.localeCompare(right))
      ];
      const sessionLabelByCode = new Map(
        orderedSessionCodes.map((code) => {
          const name = scheduleNameByCode.get(code) || code;
          const label = (nameCounts.get(name) || 0) > 1 ? `${name}(${code})` : name;
          return [code, label];
        })
      );

      const sortedItems = [...result.items].sort((left, right) => {
        if (left.sessionDate !== right.sessionDate) return left.sessionDate.localeCompare(right.sessionDate);
        if (left.studentSortOrder !== right.studentSortOrder) return left.studentSortOrder - right.studentSortOrder;
        if (left.studentName !== right.studentName) return left.studentName.localeCompare(right.studentName, "zh-CN");
        return left.sessionCode.localeCompare(right.sessionCode, "zh-CN");
      });

      const summaryBySessionId = new Map<
        string,
        {
          recordCount: number;
          present: number;
          late: number;
          absent: number;
          excused: number;
        }
      >();
      for (const item of result.items) {
        const current = summaryBySessionId.get(item.sessionId) || {
          recordCount: 0,
          present: 0,
          late: 0,
          absent: 0,
          excused: 0
        };
        current.recordCount += 1;
        if (item.status === "present") current.present += 1;
        if (item.status === "late") current.late += 1;
        if (item.status === "absent") current.absent += 1;
        if (item.status === "excused") current.excused += 1;
        summaryBySessionId.set(item.sessionId, current);
      }

      const rowsByKey = new Map<string, Record<string, string | number>>();
      for (const item of sortedItems) {
        const rowKey = `${item.sessionDate}:${item.studentId}`;
        const sessionLabel = sessionLabelByCode.get(item.sessionCode) || item.sessionName || item.sessionCode;
        if (!rowsByKey.has(rowKey)) {
          const baseRow: Record<string, string | number> = {
            日期: item.sessionDate,
            姓名: item.studentName,
            排序: item.studentSortOrder
          };
          for (const code of orderedSessionCodes) {
            baseRow[sessionLabelByCode.get(code) || code] = "-";
          }
          rowsByKey.set(rowKey, baseRow);
        }
        rowsByKey.get(rowKey)![sessionLabel] = formatAttendanceExportCell(item.status, item.checkInAt, item.recordedAt);
      }

      const attendanceRows = Array.from(rowsByKey.values());
      const detailRows = sortedItems.map((item) => ({
        日期: item.sessionDate,
        时段编码: item.sessionCode,
        时段: sessionLabelByCode.get(item.sessionCode) || item.sessionName || item.sessionCode,
        场次状态: item.sessionStatus,
        姓名: item.studentName,
        排序: item.studentSortOrder,
        考勤状态: attendanceExportStatusLabels[item.status] || item.status,
        签到时间: formatAttendanceExportTime(item.checkInAt) || "",
        记录时间: item.recordedAt.slice(0, 16).replace("T", " "),
        来源: item.source,
        备注: item.note || "",
        兼容姓名: item.legacyStudentName || ""
      }));
      const sessionRows = [...result.sessions]
        .sort((left, right) => {
          if (left.sessionDate !== right.sessionDate) return left.sessionDate.localeCompare(right.sessionDate);
          const leftIndex = orderedSessionCodes.indexOf(left.sessionCode);
          const rightIndex = orderedSessionCodes.indexOf(right.sessionCode);
          if (leftIndex !== rightIndex) return leftIndex - rightIndex;
          return left.sessionCode.localeCompare(right.sessionCode, "zh-CN");
        })
        .map((item) => {
          const summary = summaryBySessionId.get(item.id) || {
            recordCount: 0,
            present: 0,
            late: 0,
            absent: 0,
            excused: 0
          };
          return {
            日期: item.sessionDate,
            时段编码: item.sessionCode,
            时段: sessionLabelByCode.get(item.sessionCode) || item.sessionName || item.sessionCode,
            场次状态: item.status,
            记录数: summary.recordCount,
            出勤: summary.present,
            迟到: summary.late,
            缺勤: summary.absent,
            请假: summary.excused
          };
        });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(attendanceRows), "考勤记录");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(detailRows), "考勤明细");
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sessionRows), "考勤场次");

      const className = classes.find((item) => item.id === selectedClassId)?.name || "班级";
      const safeClassName = className.replace(/[\\/:*?"<>|]/g, "_");
      XLSX.writeFile(workbook, `考勤记录_${safeClassName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      setSettingsWriteMessage(`已导出考勤 Excel（场次 ${result.sessions.length}，记录 ${result.items.length}）`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出考勤 Excel 失败");
    } finally {
      setExportingAttendanceExcel(false);
    }
  }

  async function handleImportAttendanceExcel(file: File) {
    if (!selectedClassId || !token) return;

    setImportingAttendanceExcel(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets["考勤记录"] || workbook.Sheets[workbook.SheetNames[0] || ""];
      if (!sheet) {
        throw new Error("未识别到可导入的工作表。");
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
        raw: false
      });
      if (!rows.length) {
        throw new Error("考勤 Excel 为空，无法导入。");
      }

      const overviewData = attendance?.schedules.length ? attendance : await fetchAttendanceOverview(token, selectedClassId);
      if (!overviewData.schedules.length) {
        throw new Error("当前班级还没有配置考勤时段，无法导入。");
      }
      if (!attendance?.schedules.length) {
        setAttendance(overviewData);
      }

      const scheduleAliasMap = buildAttendanceImportColumnAliasMap(
        overviewData.schedules.map((item) => ({
          code: item.code,
          name: item.name
        }))
      );
      const recognizedColumns = Object.keys(rows[0] || {}).filter((key) =>
        scheduleAliasMap.has(normalizeAttendanceImportLabel(key))
      );
      if (!recognizedColumns.length) {
        throw new Error("表格中没有识别到可导入的考勤时段列。");
      }

      const studentsByName = new Map<string, StudentItem[]>();
      for (const student of students) {
        const key = student.name.trim();
        if (!key) continue;
        const current = studentsByName.get(key) || [];
        current.push(student);
        studentsByName.set(key, current);
      }

      const validationErrors: string[] = [];
      const entryByKey = new Map<string, AttendanceImportEntry>();
      const sessionKeyOf = (sessionDate: string, sessionCode: string) => `${sessionDate}::${sessionCode}`;
      const recordKeyOf = (sessionDate: string, sessionCode: string, studentId: string) =>
        `${sessionDate}::${sessionCode}::${studentId}`;

      rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const sessionDate = normalizeAttendanceImportDate(row["日期"]);
        const studentName = String(row["姓名"] ?? "").trim();

        if (!sessionDate) {
          validationErrors.push(`第 ${rowNumber} 行缺少有效“日期”`);
          return;
        }
        if (!studentName) {
          validationErrors.push(`第 ${rowNumber} 行缺少“姓名”`);
          return;
        }

        const matchedStudents = studentsByName.get(studentName) || [];
        if (!matchedStudents.length) {
          validationErrors.push(`第 ${rowNumber} 行学生“${studentName}”不存在`);
          return;
        }
        if (matchedStudents.length > 1) {
          validationErrors.push(`第 ${rowNumber} 行学生“${studentName}”重名，当前无法自动导入`);
          return;
        }

        for (const [columnName, cellValue] of Object.entries(row)) {
          const sessionCode = scheduleAliasMap.get(normalizeAttendanceImportLabel(columnName));
          if (!sessionCode) continue;
          const parsedCell = parseAttendanceImportCell(cellValue, sessionDate);
          if (!parsedCell) continue;

          const entryKey = recordKeyOf(sessionDate, sessionCode, matchedStudents[0].id);
          const nextEntry: AttendanceImportEntry = {
            sessionDate,
            sessionCode,
            studentId: matchedStudents[0].id,
            studentName,
            status: parsedCell.status,
            checkInAt: parsedCell.checkInAt
          };
          const previous = entryByKey.get(entryKey);
          if (
            previous &&
            (previous.status !== nextEntry.status || previous.checkInAt !== nextEntry.checkInAt)
          ) {
            validationErrors.push(`第 ${rowNumber} 行与前文存在重复但不一致的考勤单元：${studentName} ${sessionDate} ${columnName}`);
            continue;
          }
          entryByKey.set(entryKey, nextEntry);
        }
      });

      if (validationErrors.length) {
        throw new Error(
          validationErrors.slice(0, 8).join("；") + (validationErrors.length > 8 ? `；另有 ${validationErrors.length - 8} 项` : "")
        );
      }

      const entries = Array.from(entryByKey.values());
      if (!entries.length) {
        throw new Error("表格中没有解析到可写入的考勤记录。");
      }

      const sessionKeys = Array.from(new Set(entries.map((item) => sessionKeyOf(item.sessionDate, item.sessionCode))));
      if (
        !window.confirm(
          `解析到 ${rows.length} 行、${entries.length} 条考勤记录、${sessionKeys.length} 个场次，确认合并导入到当前班级吗？`
        )
      ) {
        return;
      }

      const sortedDates = Array.from(new Set(entries.map((item) => item.sessionDate))).sort((left, right) =>
        left.localeCompare(right)
      );
      const existingData = await fetchAttendanceMaintenanceExport(token, selectedClassId, {
        dateFrom: sortedDates[0],
        dateTo: sortedDates[sortedDates.length - 1]
      });

      const sessionByKey = new Map(
        existingData.sessions.map((item) => [sessionKeyOf(item.sessionDate, item.sessionCode), item])
      );
      const recordByKey = new Map(
        existingData.items.map((item) => [
          recordKeyOf(item.sessionDate, item.sessionCode, item.studentId),
          {
            recordId: item.recordId,
            status: item.status,
            checkInAt: item.checkInAt
          }
        ])
      );

      let createdSessions = 0;
      for (const currentSessionKey of sessionKeys.sort((left, right) => left.localeCompare(right))) {
        if (sessionByKey.has(currentSessionKey)) continue;
        const separatorIndex = currentSessionKey.indexOf("::");
        const sessionDate = currentSessionKey.slice(0, separatorIndex);
        const sessionCode = currentSessionKey.slice(separatorIndex + 2);
        const created = await createAttendanceSession(token, selectedClassId, {
          sessionDate,
          sessionCode,
          initialStatus: "absent",
          seedDailyParticipantStudents: false,
          allowInactiveSchedule: true
        });
        sessionByKey.set(currentSessionKey, created.session);
        createdSessions += 1;
      }

      const createOps: Array<AttendanceImportEntry & { sessionId: string }> = [];
      const updateOps: Array<AttendanceImportEntry & { sessionId: string; recordId: string }> = [];
      for (const entry of entries) {
        const session = sessionByKey.get(sessionKeyOf(entry.sessionDate, entry.sessionCode));
        if (!session) {
          throw new Error(`缺少场次：${entry.sessionDate} ${entry.sessionCode}`);
        }

        const existingRecord = recordByKey.get(recordKeyOf(entry.sessionDate, entry.sessionCode, entry.studentId));
        if (!existingRecord) {
          createOps.push({
            ...entry,
            sessionId: session.id
          });
          continue;
        }

        const sameStatus = existingRecord.status === entry.status;
        const sameCheckInAt = entry.checkInAt === undefined ? true : existingRecord.checkInAt === entry.checkInAt;
        if (sameStatus && sameCheckInAt) {
          continue;
        }

        updateOps.push({
          ...entry,
          sessionId: session.id,
          recordId: existingRecord.recordId
        });
      }

      let createdRecords = 0;
      await runChunked(createOps, 6, async (item) => {
        const result = await createAttendanceRecord(token, selectedClassId, item.sessionId, {
          studentId: item.studentId,
          status: item.status,
          checkInAt: item.checkInAt,
          allowNonDailyParticipant: true
        });
        recordByKey.set(recordKeyOf(item.sessionDate, item.sessionCode, item.studentId), {
          recordId: result.record.id,
          status: result.record.status,
          checkInAt: result.record.checkInAt
        });
        createdRecords += 1;
      });

      let updatedRecords = 0;
      await runChunked(updateOps, 6, async (item) => {
        const result = await updateAttendanceRecord(token, selectedClassId, item.recordId, {
          status: item.status,
          checkInAt: item.checkInAt
        });
        recordByKey.set(recordKeyOf(item.sessionDate, item.sessionCode, item.studentId), {
          recordId: result.record.id,
          status: result.record.status,
          checkInAt: result.record.checkInAt
        });
        updatedRecords += 1;
      });

      const skippedRecords = entries.length - createOps.length - updateOps.length;
      await reloadSelectedClassWorkspace();
      setSettingsWriteMessage(
        `已导入考勤 Excel（新建场次 ${createdSessions}，新增记录 ${createdRecords}，修正记录 ${updatedRecords}，跳过 ${skippedRecords}）`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Attendance record permission")) {
        setError("当前账号没有考勤导入权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Attendance schedule not found")) {
        setError("表格里包含当前班级不存在的考勤时段，或该时段已被删除。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("表格里包含当前班级不存在的学生，或学生已不在当前班级。");
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Attendance session already exists")) {
        setError("导入过程中发现同名场次已被其他操作创建，请重试。");
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Attendance record already exists")) {
        setError("导入过程中发现部分考勤记录已被其他操作写入，请重试。");
      } else {
        setError(err instanceof Error ? err.message : "导入考勤 Excel 失败");
      }
    } finally {
      setImportingAttendanceExcel(false);
    }
  }

  async function handleDownloadMaintenanceBackup() {
    if (!selectedClassId || !token) return;

    setDownloadingMaintenanceBackup(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const { blob, filename } = await downloadStructuredExport(token, selectedClassId, {
        exportType: "full"
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setSettingsWriteMessage("已下载全量备份 JSON");
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Structured export permission")) {
        setError("当前账号没有全量备份导出权限。");
      } else {
        setError(err instanceof Error ? err.message : "下载全量备份失败");
      }
    } finally {
      setDownloadingMaintenanceBackup(false);
    }
  }

  async function handleRestoreStructuredBackup(input: { backup: unknown }) {
    if (!selectedClassId || !token) return false;
    if (!window.confirm(buildStructuredBackupRestoreConfirmMessage(input.backup))) {
      return false;
    }

    setRestoringStructuredBackup(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const result = await restoreStructuredFullBackup(token, selectedClassId, input.backup);
      await reloadSelectedClassWorkspace();
      setSettingsWriteMessage(
        `已恢复全量备份：学生 ${String(result.counts.students || 0)}，积分流水 ${String(result.counts.pointTransactions || 0)}，考勤记录 ${String(result.counts.attendanceRecords || 0)}`
      );
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 403 && err.message.includes("Structured full restore permission")) {
        setError("当前账号没有全量备份恢复权限。");
      } else {
        setError(err instanceof Error ? err.message : "恢复全量备份失败");
      }
      return false;
    } finally {
      setRestoringStructuredBackup(false);
    }
  }

  async function handleDownloadExportJob(jobId: string) {
    if (!token) return;

    setDownloadingExportJobId(jobId);
    setExportMessage("");
    setError("");
    try {
      const { blob, filename } = await downloadExportJob(token, jobId);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(objectUrl);
      setExportMessage(`已开始下载 ${filename}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 410 && err.message.includes("Export job expired")) {
        setError("导出文件已过期，请重新创建导出任务。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Export download permission")) {
        setError("当前账号只能下载自己创建的导出任务，或由有权限的管理成员下载。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Export file not found")) {
        setError("导出文件不存在，可能已被清理，请重新创建导出任务。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Export job file unavailable")) {
        setError("当前任务还没有可下载文件，请等待成功后再下载。");
      } else {
        setError(err instanceof Error ? err.message : "下载导出文件失败");
      }
    } finally {
      setDownloadingExportJobId("");
    }
  }

  async function handleUpdateSettingsReasonTemplate(
    templateId: string,
    input: {
      name?: string;
      value?: number;
      transactionType?: "bonus" | "penalty" | "reward";
      scene?: string;
      category?: string;
      isActive?: boolean;
    }
  ) {
    if (!selectedClassId || !token) return;
    const template = getSettingsReasonTemplateForConfirm(settings, templateId);
    const onlyToggle = typeof input.isActive === "boolean" && Object.keys(input).length === 1;
    const actionLabel = input.isActive ? "启用" : "停用";
    if (
      !window.confirm(
        buildSettingsReasonTemplateConfirmMessage({
          title: onlyToggle ? `确认${actionLabel}这个积分模板？` : "确认保存这个积分模板的修改？",
          template,
          nextInput: input,
          extraLines: onlyToggle ? [] : ["保存后会直接覆盖当前模板的核心字段。"]
        })
      )
    )
      return;

    setUpdatingReasonTemplateId(templateId);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsReasonTemplate(token, selectedClassId, templateId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage(onlyToggle ? `已${actionLabel}积分模板` : "已更新积分模板");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Reason template not found")) {
        setError("目标积分模板不存在，可能已被其他操作更新。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Reason template active state unchanged")
      ) {
        setError(onlyToggle ? "积分模板状态未变化。" : "积分模板内容未变化。");
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Reason template already exists")) {
        setError("同名积分模板已存在。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings reason template permission")
      ) {
        setError("当前账号没有积分模板管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新积分模板失败");
      }
    } finally {
      setUpdatingReasonTemplateId("");
    }
  }

  async function handleUpdateSettingsFeatureFlag(
    featureFlagId: string,
    input: {
      enabled?: boolean;
      config?: Record<string, unknown>;
    }
  ) {
    if (!selectedClassId || !token) return;
    const featureFlag = getSettingsFeatureFlagForConfirm(settings, featureFlagId);
    const actionLabel =
      input.enabled !== undefined ? (input.enabled ? "启用" : "停用") : "更新";
    const confirmTitle =
      input.config !== undefined && input.enabled !== undefined
        ? `确认保存这个功能开关配置并${actionLabel}状态？`
        : input.config !== undefined
          ? "确认保存这个功能开关配置？"
          : `确认${actionLabel}这个功能开关？`;
    if (
      !window.confirm(
        buildSettingsFeatureFlagConfirmMessage({
          title: confirmTitle,
          featureFlag,
          nextInput: input,
          extraLines:
            input.enabled !== undefined && input.config === undefined
              ? [`操作后该功能开关将变为${formatSettingsFeatureFlagStatusLabel(Boolean(input.enabled))}状态。`]
              : input.config !== undefined
                ? ["简单键值会按当前 JSON 整体覆盖保存。"]
                : []
        })
      )
    )
      return;

    setUpdatingFeatureFlagId(featureFlagId);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsFeatureFlag(token, selectedClassId, featureFlagId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage(input.config ? `已更新功能开关配置${input.enabled !== undefined ? `并${actionLabel}状态` : ""}` : `已${actionLabel}功能开关`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Feature flag not found")) {
        setError("目标功能开关不存在，可能已被其他操作更新。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("Feature flag settings unchanged")
      ) {
        setError("功能开关配置或状态未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings feature flag permission")
      ) {
        setError("当前账号没有功能开关管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新功能开关失败");
      }
    } finally {
      setUpdatingFeatureFlagId("");
    }
  }

  async function handleDeleteSettingsReasonTemplate(templateId: string) {
    if (!selectedClassId || !token) return;
    const template = getSettingsReasonTemplateForConfirm(settings, templateId);
    if (
      !window.confirm(
        buildSettingsReasonTemplateConfirmMessage({
          title: "确认删除这个积分模板？",
          template,
          extraLines: ["当前阶段仅允许删除可编辑模板，删除后不可恢复。"]
        })
      )
    )
      return;

    setDeletingReasonTemplateId(templateId);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await deleteSettingsReasonTemplate(token, selectedClassId, templateId).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已删除积分模板");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Reason template not found")) {
        setError("目标积分模板不存在，可能已被其他操作更新。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Reason template is not editable")) {
        setError("当前模板不可删除。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings reason template permission")
      ) {
        setError("当前账号没有积分模板管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "删除积分模板失败");
      }
    } finally {
      setDeletingReasonTemplateId("");
    }
  }

  async function handleReorderReasonTemplates(templateIds: string[]) {
    if (!selectedClassId || !token || !templateIds.length) return;
    setUpdatingReasonTemplateOrder(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await reorderSettingsReasonTemplates(token, selectedClassId, {
        templateIds
      }).then(() => fetchSettingsOverview(token, selectedClassId));
      setSettings(settingsData);
      setSettingsWriteMessage("已更新积分模板排序");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("order unchanged")) {
        setError("积分模板排序未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("reorder list contains invalid")
      ) {
        setError("模板列表已变更，建议刷新设置后重试。");
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.message.includes("duplicates")
      ) {
        setError("模板排序列表存在重复项。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings reason template permission")
      ) {
        setError("当前账号没有积分模板管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新积分模板排序失败");
      }
    } finally {
      setUpdatingReasonTemplateOrder(false);
    }
  }

  async function handleUpdateReasonTemplateCategory(input: {
    scene: string;
    category: string;
    nextScene: string;
    nextCategory: string;
  }) {
    if (!selectedClassId || !token) return;
    if (
      !window.confirm(
        buildSettingsReasonTemplateCategoryConfirmMessage({
          title: "确认更新这组积分模板分类？",
          settings,
          currentScene: input.scene,
          currentCategory: input.category,
          nextScene: input.nextScene,
          nextCategory: input.nextCategory
        })
      )
    ) {
      return;
    }
    setUpdatingReasonTemplateCategory(true);
    setSettingsWriteMessage("");
    setError("");
    try {
      const settingsData = await updateSettingsReasonTemplateCategory(token, selectedClassId, input).then(() =>
        fetchSettingsOverview(token, selectedClassId)
      );
      setSettings(settingsData);
      setSettingsWriteMessage("已更新积分模板分类");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("category unchanged")) {
        setError("积分模板分类未变化。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("category not found")) {
        setError("目标分类不存在，建议刷新设置后重试。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Settings reason template permission")
      ) {
        setError("当前账号没有积分模板管理权限。");
      } else {
        setError(err instanceof Error ? err.message : "更新积分模板分类失败");
      }
    } finally {
      setUpdatingReasonTemplateCategory(false);
    }
  }

  async function handleRevertHomeworkRecord(input: {
    transactionId: string;
    subjectName: string;
    homeworkDate: string;
    studentName: string;
    eventType: "missing" | "register";
  }) {
    if (!selectedClassId || !token) return;
    const actionLabel = input.eventType === "missing" ? "未交扣分" : "登记奖励";
    if (
      !window.confirm(
        `确认撤销这条作业记录？\n学生：${input.studentName}\n学科：${input.subjectName}\n作业日期：${input.homeworkDate}\n类型：${actionLabel}`
      )
    ) {
      return;
    }

    setRevertingHomeworkRecordId(input.transactionId);
    setError("");
    setHomeworkWriteMessage("");
    try {
      const [, summaryData, leaderboardData, homeworkData, homeworkDetailData, homeworkStudentStatsData, studentData, detailData] =
        await Promise.all([
          revertHomeworkRecord(token, selectedClassId, input.transactionId),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchHomeworkOverview(token, selectedClassId),
          fetchHomeworkDetail(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchHomeworkStudentStats(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchStudents(token, selectedClassId),
          selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
        ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(homeworkDetailData);
      setHomeworkStudentStats(homeworkStudentStatsData);
      setStudents(studentData.items);
      setSelectedHomeworkDate((current) => current || homeworkDetailData.filters.homeworkDate || "");
      setSelectedHomeworkSubject((current) => current || homeworkDetailData.filters.subjectName || "");
      if (detailData) {
        setStudentDetail(detailData);
      }
      setHomeworkWriteMessage("已撤销作业记录");
    } catch (err) {
      if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("这条作业记录已经撤销过了。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Only homework records")) {
        setError("当前仅支持撤销作业登记产生的积分流水。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销作业记录失败");
      }
    } finally {
      setRevertingHomeworkRecordId("");
    }
  }

  async function handleRevertHomeworkAudit(input: {
    auditId: string;
    label: string;
    subjectName: string;
    homeworkDate: string;
    studentName: string;
    eventType: "missing" | "register" | "";
    batchId?: string;
  }) {
    if (!selectedClassId || !token || !input.auditId) return;
    const actionLabel =
      input.eventType === "missing" ? "未交扣分" : input.eventType === "register" ? "登记奖励" : input.label;
    if (
      !window.confirm(
        `确认撤销这条作业操作？\n动作：${input.label}\n学生：${input.studentName || "-"}\n学科：${input.subjectName || "-"}\n作业日期：${input.homeworkDate || "-"}\n类型：${actionLabel}`
      )
    ) {
      return;
    }

    setRevertingHomeworkAuditId(input.auditId);
    setError("");
    setHomeworkWriteMessage("");
    try {
      const [, summaryData, leaderboardData, homeworkData, homeworkDetailData, homeworkStudentStatsData, studentData, detailData] =
        await Promise.all([
          revertHomeworkAudit(token, selectedClassId, input.auditId),
          fetchPointsSummary(token, selectedClassId),
          fetchLeaderboard(token, selectedClassId, search),
          fetchHomeworkOverview(token, selectedClassId),
          fetchHomeworkDetail(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchHomeworkStudentStats(token, selectedClassId, {
            homeworkDate: selectedHomeworkDate || undefined,
            subjectName: selectedHomeworkSubject || undefined
          }),
          fetchStudents(token, selectedClassId),
          selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
        ]);

      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setHomework(homeworkData);
      setHomeworkDetail(homeworkDetailData);
      setHomeworkStudentStats(homeworkStudentStatsData);
      setStudents(studentData.items);
      setSelectedHomeworkDate((current) => current || homeworkDetailData.filters.homeworkDate || "");
      setSelectedHomeworkSubject((current) => current || homeworkDetailData.filters.subjectName || "");
      if (input.batchId) {
        if (activeHomeworkBatchCorrection?.batchId === input.batchId) {
          setActiveHomeworkBatchCorrection(null);
        }
        if (lastHomeworkBatchPreview?.batchId === input.batchId) {
          setLastHomeworkBatchTransactionIds([]);
          setLastHomeworkBatchPreview(null);
        }
      }
      if (detailData) {
        setStudentDetail(detailData);
      }
      setHomeworkWriteMessage("已撤销作业操作");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Homework audit not found")) {
        setError("目标作业操作不存在或已失效。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("这条作业操作已经撤销过了。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Only homework records")) {
        setError("当前只支持撤销作业登记产生的操作。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Homework record permission")) {
        setError("当前账号没有作业登记写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销作业操作失败");
      }
    } finally {
      setRevertingHomeworkAuditId("");
    }
  }

  useEffect(() => {
    if (!selectedStudentId || !token) return;
    setLastAdjustmentMessage("");

    void fetchStudentDetail(token, selectedStudentId)
      .then(setStudentDetail)
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取学生详情失败");
      });
  }, [selectedStudentId, token]);

  useEffect(() => {
    if (!activeTenant || !token || !canReadAdmin) {
      setAdminMembers([]);
      setAdminRoles([]);
      setAdminAudits([]);
      setAdminSummary(null);
      setSelectedAdminMembershipId("");
      setSelectedAdminMemberDetail(null);
      setAdminErrorMessage("");
      setLoadingAdminData(false);
      if (activeView === "admin") {
        setActiveView("overview");
      }
      return;
    }

    setLoadingAdminData(true);
    void Promise.all([
      fetchAdminMembers(token, activeTenant.id, {
        search: adminMemberSearch || undefined,
        status: adminMemberStatus || undefined,
        roleCode: adminMemberRoleCode || undefined,
        sortBy: adminMemberSortBy
      }),
      fetchAdminSummary(token, activeTenant.id),
      fetchAdminRoles(token, activeTenant.id),
      fetchAdminAudits(token, activeTenant.id, {
        membershipId: selectedAdminMembershipId || undefined,
        action: adminAuditAction || undefined
      })
    ])
      .then(([membersData, summaryData, rolesData, auditsData]) => {
        setAdminMembers(membersData.items);
        setAdminSummary(summaryData);
        setAdminRoles(rolesData.items);
        setAdminAudits(auditsData.items);
        setLastAdminMessage("");
        setAdminErrorMessage("");
        setSelectedAdminMembershipId((current) => {
          if (current && membersData.items.some((item) => item.id === current)) return current;
          return membersData.items[0]?.id || "";
        });
      })
      .catch((err) => {
        setAdminErrorMessage(getAdminErrorMessage(err, "读取管理后台数据失败"));
      })
      .finally(() => {
        setLoadingAdminData(false);
      });
  }, [activeTenant, adminMemberSearch, adminMemberStatus, adminMemberRoleCode, adminMemberSortBy, adminAuditAction, canReadAdmin, token, activeView, selectedAdminMembershipId]);

  useEffect(() => {
    if (!activeTenant || !token || !selectedAdminMembershipId || !canReadAdmin) {
      setSelectedAdminMemberDetail(null);
      return;
    }

    void fetchAdminMemberDetail(token, activeTenant.id, selectedAdminMembershipId)
      .then((detail) => {
        setSelectedAdminMemberDetail(detail);
        setAdminErrorMessage("");
      })
      .catch((err) => {
        setAdminErrorMessage(getAdminErrorMessage(err, "读取成员详情失败"));
      });
  }, [activeTenant, canReadAdmin, selectedAdminMembershipId, token]);

  async function handleUpdateAdminRoles(roleCodes: string[]) {
    if (!activeTenant || !selectedAdminMembershipId || !token) return;
    const member = getAdminMemberForConfirm(selectedAdminMembershipId, selectedAdminMemberDetail, adminMembers);
    if (
      !window.confirm(
        buildAdminMemberConfirmMessage({
          title: "确认保存当前角色分配？",
          member,
          roles: adminRoles,
          activeMembershipId: activeMembership?.id,
          nextRoleCodes: roleCodes,
          extraLines: ["仍受后端保护限制：不能修改本人角色，也不能移除最后一个 tenant owner。"]
        })
      )
    ) {
      return;
    }
    setUpdatingAdminRoles(true);
    setAdminErrorMessage("");
    setLastAdminMessage("");

    try {
      const [, membersData, detailData, rolesData, auditsData] = await Promise.all([
        updateAdminMemberRoles(token, activeTenant.id, selectedAdminMembershipId, roleCodes),
        fetchAdminMembers(token, activeTenant.id, {
          search: adminMemberSearch || undefined,
          status: adminMemberStatus || undefined,
          roleCode: adminMemberRoleCode || undefined,
          sortBy: adminMemberSortBy
        }),
        fetchAdminMemberDetail(token, activeTenant.id, selectedAdminMembershipId),
        fetchAdminRoles(token, activeTenant.id),
        fetchAdminAudits(token, activeTenant.id, {
          membershipId: selectedAdminMembershipId,
          action: adminAuditAction || undefined
        })
      ]);

      setAdminMembers(membersData.items);
      setSelectedAdminMemberDetail(detailData);
      setAdminRoles(rolesData.items);
      setAdminAudits(auditsData.items);
      setLastAdminMessage("成员角色已更新");
    } catch (err) {
      setAdminErrorMessage(getAdminErrorMessage(err, "更新成员角色失败"));
    } finally {
      setUpdatingAdminRoles(false);
    }
  }

  async function handleUpdateAdminStatus(status: "active" | "disabled") {
    if (!activeTenant || !selectedAdminMembershipId || !token) return;
    const member = getAdminMemberForConfirm(selectedAdminMembershipId, selectedAdminMemberDetail, adminMembers);
    const confirmed = window.confirm(
      buildAdminMemberConfirmMessage({
        title:
          status === "disabled"
            ? "确认停用当前成员？"
            : member?.status === "invited"
              ? "确认激活当前 invited 成员？"
              : "确认恢复当前成员为 active？",
        member,
        roles: adminRoles,
        activeMembershipId: activeMembership?.id,
        nextStatus: status,
        extraLines: [
          status === "disabled"
            ? "停用后该成员将失去当前租户访问能力。"
            : member?.status === "invited"
              ? "激活后该成员可按当前角色进入租户。"
              : "恢复后该成员将重新获得当前租户访问能力。"
        ]
      })
    );
    if (!confirmed) return;
    setUpdatingAdminStatus(true);
    setAdminErrorMessage("");
    setLastAdminMessage("");

    try {
      const [, membersData, summaryData, detailData, auditsData] = await Promise.all([
        updateAdminMemberStatus(token, activeTenant.id, selectedAdminMembershipId, status),
        fetchAdminMembers(token, activeTenant.id, {
          search: adminMemberSearch || undefined,
          status: adminMemberStatus || undefined,
          roleCode: adminMemberRoleCode || undefined,
          sortBy: adminMemberSortBy
        }),
        fetchAdminSummary(token, activeTenant.id),
        fetchAdminMemberDetail(token, activeTenant.id, selectedAdminMembershipId),
        fetchAdminAudits(token, activeTenant.id, {
          membershipId: selectedAdminMembershipId,
          action: adminAuditAction || undefined
        })
      ]);

      setAdminMembers(membersData.items);
      setAdminSummary(summaryData);
      setSelectedAdminMemberDetail(detailData);
      setAdminAudits(auditsData.items);
      setLastAdminMessage(status === "disabled" ? "成员已停用" : "成员状态已更新为 active");
    } catch (err) {
      setAdminErrorMessage(getAdminErrorMessage(err, status === "disabled" ? "停用成员失败" : "恢复成员失败"));
    } finally {
      setUpdatingAdminStatus(false);
    }
  }

  async function handleCreateAdminInvitation(input: {
    username: string;
    displayName: string;
    email?: string;
    roleCodes: string[];
  }) {
    if (!activeTenant || !token) return;
    setCreatingAdminInvitation(true);
    setAdminErrorMessage("");
    setLastAdminMessage("");

    try {
      const [created, membersData, summaryData, rolesData] = await Promise.all([
        createAdminInvitation(token, activeTenant.id, input),
        fetchAdminMembers(token, activeTenant.id, {
          search: adminMemberSearch || undefined,
          status: adminMemberStatus || undefined,
          roleCode: adminMemberRoleCode || undefined,
          sortBy: adminMemberSortBy
        }),
        fetchAdminSummary(token, activeTenant.id),
        fetchAdminRoles(token, activeTenant.id)
      ]);

      setAdminMembers(membersData.items);
      setAdminSummary(summaryData);
      setAdminRoles(rolesData.items);
      setSelectedAdminMembershipId((current) => {
        if (membersData.items.some((item) => item.id === created.item.id)) {
          return created.item.id;
        }
        return current || membersData.items[0]?.id || "";
      });
      setLastAdminMessage(
        membersData.items.some((item) => item.id === created.item.id)
          ? "已创建 invited 成员，并自动定位到该成员"
          : "已创建 invited 成员；当前筛选条件下未显示该成员"
      );
    } catch (err) {
      setAdminErrorMessage(getAdminErrorMessage(err, "创建 invited 成员失败"));
    } finally {
      setCreatingAdminInvitation(false);
    }
  }

  async function handleUpdateAdminPassword(password: string) {
    if (!activeTenant || !selectedAdminMembershipId || !token) return;
    const member = getAdminMemberForConfirm(selectedAdminMembershipId, selectedAdminMemberDetail, adminMembers);
    const confirmed = window.confirm(
      buildAdminMemberConfirmMessage({
        title: "确认直接为当前成员设置新密码？",
        member,
        roles: adminRoles,
        activeMembershipId: activeMembership?.id,
        extraLines: ["这会立即覆盖该成员旧密码。"]
      })
    );
    if (!confirmed) return;

    setUpdatingAdminPassword(true);
    setAdminErrorMessage("");
    setLastAdminMessage("");
    try {
      const [, membersData, summaryData, detailData, auditsData] = await Promise.all([
        updateAdminMemberPassword(token, activeTenant.id, selectedAdminMembershipId, password),
        fetchAdminMembers(token, activeTenant.id, {
          search: adminMemberSearch || undefined,
          status: adminMemberStatus || undefined,
          roleCode: adminMemberRoleCode || undefined,
          sortBy: adminMemberSortBy
        }),
        fetchAdminSummary(token, activeTenant.id),
        fetchAdminMemberDetail(token, activeTenant.id, selectedAdminMembershipId),
        fetchAdminAudits(token, activeTenant.id, {
          membershipId: selectedAdminMembershipId,
          action: adminAuditAction || undefined
        })
      ]);

      setAdminMembers(membersData.items);
      setAdminSummary(summaryData);
      setSelectedAdminMemberDetail(detailData);
      setAdminAudits(auditsData.items);
      setLastAdminMessage("已为当前成员设置新密码。");
    } catch (err) {
      setAdminErrorMessage(getAdminErrorMessage(err, "设置成员密码失败"));
    } finally {
      setUpdatingAdminPassword(false);
    }
  }

  async function handleDeleteAdminMember() {
    if (!activeTenant || !selectedAdminMembershipId || !token) return;
    const member = getAdminMemberForConfirm(selectedAdminMembershipId, selectedAdminMemberDetail, adminMembers);
    const confirmed = window.confirm(
      buildAdminMemberConfirmMessage({
        title: "确认删除当前成员？",
        member,
        roles: adminRoles,
        activeMembershipId: activeMembership?.id,
        extraLines: ["当前阶段只允许删除 invited 或 disabled 成员，删除后不可恢复。"]
      })
    );
    if (!confirmed) return;

    setDeletingAdminMember(true);
    setAdminErrorMessage("");
    setLastAdminMessage("");

    try {
      await deleteAdminMember(token, activeTenant.id, selectedAdminMembershipId);
      const [membersData, summaryData, rolesData, auditsData] = await Promise.all([
        fetchAdminMembers(token, activeTenant.id, {
          search: adminMemberSearch || undefined,
          status: adminMemberStatus || undefined,
          roleCode: adminMemberRoleCode || undefined,
          sortBy: adminMemberSortBy
        }),
        fetchAdminSummary(token, activeTenant.id),
        fetchAdminRoles(token, activeTenant.id),
        fetchAdminAudits(token, activeTenant.id, {
          membershipId: undefined,
          action: adminAuditAction || undefined
        })
      ]);

      setAdminMembers(membersData.items);
      setAdminSummary(summaryData);
      setAdminRoles(rolesData.items);
      setAdminAudits(auditsData.items);
      setSelectedAdminMembershipId((current) => {
        if (current && membersData.items.some((item) => item.id === current)) return current;
        return membersData.items[0]?.id || "";
      });
      setSelectedAdminMemberDetail(null);
      setLastAdminMessage("成员已删除");
    } catch (err) {
      setAdminErrorMessage(getAdminErrorMessage(err, "删除成员失败"));
    } finally {
      setDeletingAdminMember(false);
    }
  }

  async function handleAdjustPoints(input: {
    studentId: string;
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }) {
    if (!selectedClassId || !token) return;
    setAdjustingPoints(true);
    setError("");
    setLastAdjustmentMessage("");
    try {
      const result = await createPointAdjustment(token, selectedClassId, input);
      const [studentData, summaryData, leaderboardData, pointAuditsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointAudits(token, selectedClassId, 12),
        fetchStudentDetail(token, input.studentId)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      setLastAdjustmentMessage(
        `${result.student.name} ${result.transaction.transactionType === "penalty" ? "扣除" : "增加"} ${result.transaction.value} 分`
      );
    } catch (err) {
      setError(getFrozenWriteMessage(err) || (err instanceof Error ? err.message : "积分调整失败"));
    } finally {
      setAdjustingPoints(false);
    }
  }

  async function handleCreateStudent(input: {
    studentNo: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder?: number;
  }) {
    if (!selectedClassId || !token) return;
    setCreatingStudent(true);
    setError("");
    setStudentWriteMessage("");
    try {
      const result = await createStudent(token, selectedClassId, input);
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchStudentDetail(token, result.student.id)
      ]);
      setStudents(studentData.items);
      setSelectedStudentId(result.student.id);
      setStudentDetail(detailData);
      setStudentWriteMessage(`已新增学生 ${result.student.name}`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Student number already exists")) {
        setError("同班级下学号已存在。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student create permission")) {
        setError("当前账号没有学生新增权限。");
      } else {
        setError(err instanceof Error ? err.message : "新增学生失败");
      }
    } finally {
      setCreatingStudent(false);
    }
  }

  async function handleUpdateStudent(input: {
    studentNo: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder: number;
  }) {
    if (!selectedClassId || !token || !selectedStudentId) return;
    setUpdatingStudent(true);
    setError("");
    setLastStudentUpdateMessage("");
    try {
      const result = await updateStudent(token, selectedStudentId, input);
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchStudentDetail(token, selectedStudentId)
      ]);
      setStudents(studentData.items);
      setStudentDetail(detailData);
      setLastStudentUpdateMessage(`已更新 ${result.student.name} 的基础资料`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 409 && err.message.includes("Student number already exists")) {
        setError("同班级下学号已存在。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student unchanged")) {
        setError("学生基础资料未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student update permission")) {
        setError("当前账号没有学生资料写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("目标学生不存在。");
      } else {
        setError(err instanceof Error ? err.message : "更新学生资料失败");
      }
    } finally {
      setUpdatingStudent(false);
    }
  }

  async function handleUpdateStudentOrganization(input: {
    groupId?: string | null;
    dormitoryId?: string | null;
    positionIds?: string[];
  }) {
    if (!selectedClassId || !token || !selectedStudentId) return;
    setUpdatingStudentOrganization(true);
    setError("");
    setLastStudentOrganizationMessage("");
    try {
      await updateStudentOrganization(token, selectedStudentId, input);
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchStudentDetail(token, selectedStudentId)
      ]);
      setStudents(studentData.items);
      setStudentDetail(detailData);
      setLastStudentOrganizationMessage("已更新学生组织归属");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student organization unchanged")) {
        setError("学生组织归属未变化。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Student organization update permission")
      ) {
        setError("当前账号没有组织归属写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Group not found")) {
        setError("目标小组不存在或已停用。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Dormitory not found")) {
        setError("目标宿舍不存在或已停用。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Position not found")) {
        setError("目标岗位不存在或已停用。");
      } else {
        setError(err instanceof Error ? err.message : "更新学生组织归属失败");
      }
    } finally {
      setUpdatingStudentOrganization(false);
    }
  }

  async function handleDeleteStudent() {
    if (!selectedClassId || !token || !selectedStudentId || !studentDetail) return;
    if (!studentDetail.deleteGuard.canDelete) {
      setError("当前学生仍有关联历史或兼容引用，不能直接删除。请优先改为归档。");
      return;
    }

    const cleanupText = studentDetail.deleteGuard.cleanupMessages.length
      ? `，并自动清理${studentDetail.deleteGuard.cleanupMessages.join("、")}`
      : "";
    const confirmed = window.confirm(
      `确认删除学生“${studentDetail.student.name}”吗？该操作会移除其基础资料、档案与组织归属${cleanupText}，删除后不可恢复。`
    );
    if (!confirmed) return;

    setDeletingStudent(true);
    setError("");
    setStudentWriteMessage("");
    try {
      const result = await deleteStudent(token, selectedStudentId);
      const studentData = await fetchStudents(token, selectedClassId);
      setStudents(studentData.items);
      setSelectedStudentId("");
      setStudentDetail(null);
      setLastStudentUpdateMessage("");
      setLastStudentProfileMessage("");
      setLastStudentOrganizationMessage("");
      setStudentWriteMessage(`已删除学生 ${result.studentName}`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student delete blocked")) {
        const nextDeleteGuard =
          err.payload &&
          typeof err.payload === "object" &&
          !Array.isArray(err.payload) &&
          "deleteGuard" in err.payload
            ? (err.payload as { deleteGuard?: StudentDetail["deleteGuard"] }).deleteGuard
            : null;
        if (nextDeleteGuard && studentDetail) {
          setStudentDetail({
            ...studentDetail,
            deleteGuard: nextDeleteGuard
          });
        }
        setError("当前学生仍有关联历史或兼容引用，不能直接删除。请优先改为归档。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student delete permission")) {
        setError("当前账号没有学生删除权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("目标学生不存在。");
        setSelectedStudentId("");
        setStudentDetail(null);
      } else {
        setError(err instanceof Error ? err.message : "删除学生失败");
      }
    } finally {
      setDeletingStudent(false);
    }
  }

  async function handleUpdateStudentProfile(input: {
    titleLeft?: string | null;
    titleRight?: string | null;
    notes?: string | null;
    avatarHappyData?: string | null;
    avatarNormalData?: string | null;
    avatarSadData?: string | null;
  }) {
    if (!selectedStudentId || !token) return;
    setUpdatingStudentProfile(true);
    setError("");
    setLastStudentProfileMessage("");
    try {
      await updateStudentProfile(token, selectedStudentId, input);
      const detailData = await fetchStudentDetail(token, selectedStudentId);
      setStudentDetail(detailData);
      setLastStudentProfileMessage("已更新学生档案资料");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student profile unchanged")) {
        setError("学生档案资料未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student profile update permission")) {
        setError("当前账号没有学生档案写权限。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student not found")) {
        setError("目标学生不存在。");
      } else {
        setError(err instanceof Error ? err.message : "更新学生档案资料失败");
      }
    } finally {
      setUpdatingStudentProfile(false);
    }
  }

  async function handleBatchAdjustPoints(input: {
    studentIds: string[];
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }) {
    if (!selectedClassId || !token || !input.studentIds.length) return;
    const correctionDraft = activePointBatchCorrection;
    setBatchAdjustingPoints(true);
    setError("");
    setLastBatchAdjustmentMessage("");
    setLastBatchAdjustmentTransactionIds([]);
    try {
      const result = correctionDraft
        ? await correctPointBatchAdjustment(token, selectedClassId, correctionDraft.batchId, input)
        : await createPointBatchAdjustment(token, selectedClassId, input);
      const [studentData, summaryData, leaderboardData, batchHistoryData, pointAuditsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointBatchAdjustments(token, selectedClassId, 12),
        fetchPointAudits(token, selectedClassId, 12),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setBatchAdjustmentHistory(batchHistoryData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      setSelectedBatchStudentIds([]);
      setLastBatchAdjustmentTransactionIds(result.items.map((item) => item.transaction.id));
      setLastBatchAdjustmentPreview({
        batchId: result.batchId,
        transactionType: result.transactionType,
        value: String(result.value),
        reason: result.reason,
        scene: input.scene,
        category: input.category,
        adjustedCount: result.adjustedCount,
        studentPreview: formatStudentPreview(students, input.studentIds)
      });
      if (correctionDraft?.batchId) {
        clearLastPerfectAttendanceAwardByBatchId(correctionDraft.batchId);
      }
      setActivePointBatchCorrection(null);
      setLastBatchAdjustmentMessage(
        correctionDraft
          ? `已修正 ${result.adjustedCount} 名学生的批量积分调整，改为${result.transactionType === "penalty" ? "扣除" : "增加"} ${input.value} 分`
          : `已为 ${result.adjustedCount} 名学生${result.transactionType === "penalty" ? "扣除" : "增加"} ${result.value} 分`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student account batch contains invalid")) {
        setError("批量积分目标里包含无效学生或缺少积分账户。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Batch adjustment not found")) {
        setActivePointBatchCorrection(null);
        setError("原批量积分调整不存在或已失效，请刷新历史列表后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Batch adjustment already reverted")) {
        setActivePointBatchCorrection(null);
        setError("原批量积分调整已经撤销，请刷新历史列表后重试。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分写权限。");
      } else {
        setError(err instanceof Error ? err.message : correctionDraft ? "修正批量积分调整失败" : "批量积分调整失败");
      }
    } finally {
      setBatchAdjustingPoints(false);
    }
  }

  async function handleBatchUpdateStudentPositions(input: { studentIds: string[]; positionIds: string[] }) {
    if (!selectedClassId || !token || !input.studentIds.length) return;
    setBatchUpdatingPositions(true);
    setBatchPositionMessage("");
    setError("");
    try {
      await updateStudentPositionsBatch(token, selectedClassId, {
        studentIds: input.studentIds,
        positionIds: input.positionIds
      });
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setBatchPositionMessage(`已更新 ${input.studentIds.length} 名学生的岗位归属`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student batch contains invalid")) {
        setError("勾选的学生中包含无效项，请刷新后重试。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Position not found")) {
        setError("目标岗位不存在或已停用。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student organization update permission")) {
        setError("当前账号没有组织归属写权限。");
      } else {
        setError(err instanceof Error ? err.message : "批量更新岗位失败");
      }
    } finally {
      setBatchUpdatingPositions(false);
    }
  }

  async function handleBatchUpdateStudentOrganization(input: {
    studentIds: string[];
    groupId?: string | null;
    dormitoryId?: string | null;
  }) {
    if (!selectedClassId || !token || !input.studentIds.length) return;
    setBatchUpdatingOrganization(true);
    setBatchOrganizationMessage("");
    setError("");
    try {
      await updateStudentOrganizationBatch(token, selectedClassId, {
        studentIds: input.studentIds,
        groupId: input.groupId,
        dormitoryId: input.dormitoryId
      });
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setBatchOrganizationMessage(`已更新 ${input.studentIds.length} 名学生的组织归属`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student batch contains invalid")) {
        setError("勾选的学生中包含无效项，请刷新后重试。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Group not found")) {
        setError("目标小组不存在或已停用。");
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Dormitory not found")) {
        setError("目标宿舍不存在或已停用。");
      } else if (
        err instanceof ApiError &&
        err.status === 403 &&
        err.message.includes("Student organization update permission")
      ) {
        setError("当前账号没有组织归属写权限。");
      } else {
        setError(err instanceof Error ? err.message : "批量更新组织归属失败");
      }
    } finally {
      setBatchUpdatingOrganization(false);
    }
  }

  async function handleBatchUpdateStudentStatus(input: { studentIds: string[]; status: string }) {
    if (!selectedClassId || !token || !input.studentIds.length) return;
    setBatchUpdatingStatus(true);
    setBatchStatusMessage("");
    setError("");
    try {
      const result = await updateStudentStatusBatch(token, selectedClassId, {
        studentIds: input.studentIds,
        status: input.status
      });
      const [studentData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      if (detailData) {
        setStudentDetail(detailData);
      }
      setBatchStatusMessage(
        `已批量更新 ${result.updatedCount} 名学生状态${result.skippedCount ? `，跳过 ${result.skippedCount} 名未变化学生` : ""}`
      );
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Student batch contains invalid")) {
        setError("勾选的学生中包含无效项，请刷新后重试。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Student status unchanged")) {
        setError("当前勾选学生状态未变化。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Student update permission")) {
        setError("当前账号没有学生资料写权限。");
      } else {
        setError(err instanceof Error ? err.message : "批量更新学生状态失败");
      }
    } finally {
      setBatchUpdatingStatus(false);
    }
  }

  async function handleRevertLatestBatchAdjustPoints() {
    if (!selectedClassId || !token || !lastBatchAdjustmentTransactionIds.length) return;
    const confirmMessage = lastBatchAdjustmentPreview
      ? [
          "确认撤销最近一次批量积分调整？",
          `类型：${lastBatchAdjustmentPreview.transactionType === "penalty" ? "扣分" : "加分"}`,
          `分值：${lastBatchAdjustmentPreview.value}`,
          `理由：${lastBatchAdjustmentPreview.reason}`,
          `场景：${lastBatchAdjustmentPreview.scene} · ${lastBatchAdjustmentPreview.category}`,
          `影响人数：${lastBatchAdjustmentPreview.adjustedCount} 人`,
          `总回退变动：${formatSignedPointDelta(
            (lastBatchAdjustmentPreview.transactionType === "penalty" ? 1 : -1) *
              Math.abs(Number(lastBatchAdjustmentPreview.value)) *
              lastBatchAdjustmentPreview.adjustedCount
          )} 分`,
          lastBatchAdjustmentPreview.studentPreview ? `学生预览：${lastBatchAdjustmentPreview.studentPreview}` : "",
          "这会同步回退对应学生的总分与余额。"
        ]
          .filter(Boolean)
          .join("\n")
      : `确认撤销最近一次批量积分调整？涉及 ${lastBatchAdjustmentTransactionIds.length} 条流水。`;
    if (!window.confirm(confirmMessage)) return;

    setBatchRevertingPoints(true);
    setError("");
    try {
      const result = await revertPointBatchAdjustment(token, selectedClassId, {
        transactionIds: lastBatchAdjustmentTransactionIds
      });
      const [studentData, summaryData, leaderboardData, batchHistoryData, pointAuditsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointBatchAdjustments(token, selectedClassId, 12),
        fetchPointAudits(token, selectedClassId, 12),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setBatchAdjustmentHistory(batchHistoryData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      setLastBatchAdjustmentTransactionIds([]);
      setLastBatchAdjustmentPreview(null);
      if (activePointBatchCorrection?.batchId === lastBatchAdjustmentPreview?.batchId) {
        setActivePointBatchCorrection(null);
      }
      setLastBatchAdjustmentMessage(`已撤销最近一次批量积分调整，共回退 ${result.revertedCount} 条流水`);
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Batch adjustment revert target contains invalid")) {
        setError("最近一次批量积分调整已失效，无法继续撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("最近一次批量积分调整已撤销。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Only batch manual adjustments")) {
        setError("当前仅支持撤销最近一次批量手工积分调整。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销批量积分调整失败");
      }
    } finally {
      setBatchRevertingPoints(false);
    }
  }

  async function handleRevertBatchAdjustPoints(input: PointBatchAdjustmentHistoryItem) {
    if (!selectedClassId || !token || !input.batchId) return;
    if (
      !window.confirm(
        [
          "确认撤销这条批量积分调整？",
          `批次：${input.batchId.slice(0, 8)}`,
          `类型：${input.transactionType === "penalty" ? "扣分" : "加分"}`,
          `分值：${input.value}`,
          `理由：${input.reason}`,
          `场景：${input.scene} · ${input.category}`,
          `影响人数：${input.count} 人`,
          `总回退变动：${formatSignedPointDelta(
            (input.transactionType === "penalty" ? 1 : -1) * Math.abs(Number(input.value)) * input.count
          )} 分`,
          "这会同步回退对应学生的总分与余额。"
        ].join("\n")
      )
    ) {
      return;
    }

    setBatchRevertingPoints(true);
    setRevertingBatchAdjustmentId(input.batchId);
    setError("");
    try {
      await revertPointBatchAdjustmentByBatchId(token, selectedClassId, input.batchId);
      const [studentData, summaryData, leaderboardData, batchHistoryData, pointAuditsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointBatchAdjustments(token, selectedClassId, 12),
        fetchPointAudits(token, selectedClassId, 12),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setBatchAdjustmentHistory(batchHistoryData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      if (activePointBatchCorrection?.batchId === input.batchId) {
        setActivePointBatchCorrection(null);
      }
      if (lastBatchAdjustmentPreview?.batchId === input.batchId) {
        setLastBatchAdjustmentTransactionIds([]);
        setLastBatchAdjustmentPreview(null);
      }
      clearLastPerfectAttendanceAwardByBatchId(input.batchId);
      setLastBatchAdjustmentMessage("已撤销批量积分调整");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Batch adjustment not found")) {
        setError("目标批量积分调整不存在或已失效。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("该批量积分调整已撤销。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销批量积分调整失败");
      }
    } finally {
      setBatchRevertingPoints(false);
      setRevertingBatchAdjustmentId("");
    }
  }

  async function handleRevertPoints(transactionId: string) {
    if (!selectedClassId || !token || !selectedStudentId) return;
    const transaction = studentDetail?.recentTransactions.find((item) => item.id === transactionId) ?? null;
    setRevertingTransactionId(transactionId);
    setError("");
    setLastAdjustmentMessage("");
    try {
      const result = transaction?.auditId
        ? await revertPointAudit(token, selectedClassId, transaction.auditId)
        : await revertPointAdjustment(token, selectedClassId, transactionId);
      const [studentData, summaryData, leaderboardData, pointAuditsData, detailData] = await Promise.all([
        fetchStudents(token, selectedClassId),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointAudits(token, selectedClassId, 12),
        fetchStudentDetail(token, selectedStudentId)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      setLastAdjustmentMessage(`${result.student.name} 已撤销最近一次手工积分调整`);
    } catch (err) {
      setError(getFrozenWriteMessage(err) || (err instanceof Error ? err.message : "撤销积分失败"));
    } finally {
      setRevertingTransactionId("");
    }
  }

  async function handleRevertPointAudit(audit: PointAudit) {
    if (!selectedClassId || !token || !audit.id) return;
    const studentName = typeof audit.afterData?.studentName === "string" ? audit.afterData.studentName : "-";
    const reason = typeof audit.afterData?.reason === "string" ? audit.afterData.reason : "-";
    const value = audit.afterData?.value != null ? String(audit.afterData.value) : "-";
    const scene = typeof audit.afterData?.scene === "string" ? audit.afterData.scene : "-";
    const category = typeof audit.afterData?.category === "string" ? audit.afterData.category : "-";
    const batchSize = typeof audit.metadata?.batchSize === "number" ? audit.metadata.batchSize : null;
    const auditBatchId = typeof audit.metadata?.batchId === "string" ? audit.metadata.batchId : "";
    const confirmLines = [
      `确认撤销这条积分操作？`,
      `动作：${audit.label}`,
      `学生：${studentName}`,
      `分值：${value}`,
      `理由：${reason}`,
      `场景：${scene} · ${category}`
    ];
    if (batchSize) {
      confirmLines.push(`批量影响：${batchSize} 人`);
    }
    if (!window.confirm(confirmLines.join("\n"))) return;

    setRevertingPointAuditId(audit.id);
    setError("");
    setLastAdjustmentMessage("");
    setLastBatchAdjustmentMessage("");
    try {
      const [studentData, summaryData, leaderboardData, batchHistoryData, pointAuditsData, detailData] = await Promise.all([
        revertPointAudit(token, selectedClassId, audit.id).then(() => fetchStudents(token, selectedClassId)),
        fetchPointsSummary(token, selectedClassId),
        fetchLeaderboard(token, selectedClassId, search),
        fetchPointBatchAdjustments(token, selectedClassId, 12),
        fetchPointAudits(token, selectedClassId, 12),
        selectedStudentId ? fetchStudentDetail(token, selectedStudentId) : Promise.resolve(null)
      ]);
      setStudents(studentData.items);
      setSummary(summaryData);
      setLeaderboard(leaderboardData.items);
      setBatchAdjustmentHistory(batchHistoryData.items);
      setPointAudits(pointAuditsData.items);
      setStudentDetail(detailData);
      if (auditBatchId) {
        if (activePointBatchCorrection?.batchId === auditBatchId) {
          setActivePointBatchCorrection(null);
        }
        if (lastBatchAdjustmentPreview?.batchId === auditBatchId) {
          setLastBatchAdjustmentTransactionIds([]);
          setLastBatchAdjustmentPreview(null);
        }
        clearLastPerfectAttendanceAwardByBatchId(auditBatchId);
      }
      setLastAdjustmentMessage("已撤销积分操作");
    } catch (err) {
      if (getFrozenWriteMessage(err)) {
        setError(getFrozenWriteMessage(err));
      } else if (err instanceof ApiError && err.status === 404 && err.message.includes("Point audit not found")) {
        setError("目标积分操作不存在或已失效。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("already reverted")) {
        setError("这条积分操作已经撤销过了。");
      } else if (err instanceof ApiError && err.status === 400 && err.message.includes("Only manual adjustments")) {
        setError("当前只支持撤销手工积分操作。");
      } else if (err instanceof ApiError && err.status === 403 && err.message.includes("Point adjustment permission")) {
        setError("当前账号没有积分写权限。");
      } else {
        setError(err instanceof Error ? err.message : "撤销积分操作失败");
      }
    } finally {
      setRevertingPointAuditId("");
    }
  }

  useEffect(() => {
    if (!selectedAttendanceSessionId || !selectedClassId || !token) {
      setAttendanceSessionDetail(null);
      setAttendanceAudits(null);
      setAttendanceBatchHistory([]);
      setSelectedAttendanceRecordIds([]);
      return;
    }

    void Promise.all([
      fetchAttendanceSessionDetail(token, selectedAttendanceSessionId),
      fetchAttendanceAudits(token, selectedClassId, {
        sessionId: selectedAttendanceSessionId,
        limit: 12
      }),
      fetchAttendanceBatchHistory(token, selectedClassId, selectedAttendanceSessionId, 12)
    ])
      .then(([detailData, auditsData, batchHistoryData]) => {
        setAttendanceSessionDetail(detailData);
        setAttendanceAudits(auditsData);
        setAttendanceBatchHistory(batchHistoryData.items);
        setSelectedAttendanceRecordIds([]);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "读取考勤场次失败");
      });
  }, [selectedAttendanceSessionId, selectedClassId, token]);

  useEffect(() => {
    if (!attendanceSessionDetail) {
      setSelectedAttendanceRecordIds([]);
      return;
    }

    setSelectedAttendanceRecordIds((current) =>
      current.filter((id) => attendanceSessionDetail.items.some((item) => item.id === id))
    );
  }, [attendanceSessionDetail]);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) ?? null,
    [selectedStudentId, students]
  );

  const studentGroups = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => student.primaryGroup?.name).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [students]
  );

  const studentDorms = useMemo(
    () =>
      Array.from(
        new Set(students.map((student) => student.primaryDorm?.name).filter((value): value is string => Boolean(value)))
      ).sort((a, b) => a.localeCompare(b, "zh-CN")),
    [students]
  );

  const studentStatusOptions = useMemo(
    () => buildStudentStatusOptions(settings?.classConfig?.studentStatusOptions, students.map((student) => student.status)),
    [settings?.classConfig?.studentStatusOptions, students]
  );

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const byName =
        !studentSearch || student.name.includes(studentSearch) || (student.legacyId || "").includes(studentSearch);
      const byGroup = !selectedGroup || student.primaryGroup?.name === selectedGroup;
      const byDorm = !selectedDorm || student.primaryDorm?.name === selectedDorm;
      const byStatus = !selectedStudentStatus || student.status === selectedStudentStatus;
      return byName && byGroup && byDorm && byStatus;
    });
  }, [selectedDorm, selectedGroup, selectedStudentStatus, studentSearch, students]);

  const filteredGroupCount = useMemo(
    () =>
      new Set(filteredStudents.map((student) => student.primaryGroup?.name || `ungrouped:${student.id}`)).size,
    [filteredStudents]
  );
  const hasLegacyCompatData = useMemo(() => {
    const legacyCompat = settings?.classConfig?.legacyCompat;
    if (!legacyCompat) return false;
    const strategyDates = legacyCompat.strategyDates;
    return (
      Boolean(strategyDates?.lastPeriodicTaskDate) ||
      Boolean(strategyDates?.lastPenaltyReductionDate) ||
      legacyCompat.messages.length > 0 ||
      legacyCompat.teacherMessages.length > 0 ||
      legacyCompat.tasks.length > 0 ||
      legacyCompat.shop.treasures.length > 0 ||
      Object.keys(legacyCompat.shop.storage).length > 0 ||
      legacyCompat.shop.logs.length > 0 ||
      Object.keys(legacyCompat.shop.redemptionHistory).length > 0 ||
      Object.keys(legacyCompat.shop.dailyRedemptionCounts).length > 0 ||
      Object.keys(legacyCompat.shop.dailyUsageCounts).length > 0 ||
      Boolean(legacyCompat.battle)
    );
  }, [settings?.classConfig?.legacyCompat]);

  const perfectAttendanceStudentIds = useMemo(
    () =>
      (attendanceStudentStats?.items || [])
        .filter((item) => item.total > 0 && item.late === 0 && item.absent === 0 && item.excused === 0)
        .map((item) => item.student.id),
    [attendanceStudentStats]
  );

  useEffect(() => {
    if (!filteredStudents.length) {
      setSelectedStudentId("");
      return;
    }
    if (filteredStudents.some((student) => student.id === selectedStudentId)) return;
    setSelectedStudentId(filteredStudents[0].id);
  }, [filteredStudents, selectedStudentId]);

  useEffect(() => {
    const filteredIds = new Set(filteredStudents.map((student) => student.id));
    setSelectedBatchStudentIds((current) => current.filter((id) => filteredIds.has(id)));
  }, [filteredStudents]);

  const activeViewLabel =
    activeView === "overview"
      ? "概览"
      : activeView === "students"
        ? "学生"
        : activeView === "attendance"
          ? "考勤"
          : activeView === "homework"
            ? "作业"
            : activeView === "legacy"
              ? "旧功能"
            : activeView === "exports"
              ? "导出"
            : activeView === "settings"
              ? "设置"
              : "管理";
  const selectedClassName = classes.find((item) => item.id === selectedClassId)?.name || "";
  const activeQuote = useMemo(() => {
    const quotes = settings?.classConfig?.quotes || [];
    if (!quotes.length) return "";
    const today = new Date();
    const dayIndex = Math.floor(
      (Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(today.getFullYear(), 0, 1)) /
        86400000
    );
    return quotes[dayIndex % quotes.length] || "";
  }, [settings?.classConfig?.quotes]);
  const viewItems = useMemo(
    () =>
      [
        { key: "overview", label: "概览", description: "积分总览与排行榜" },
        { key: "students", label: "学生", description: "学生列表与详情" },
        { key: "attendance", label: "考勤", description: "只读考勤概览与迁移状态" },
        { key: "homework", label: "作业", description: "作业学科总览与最近记录" },
        ...(hasLegacyCompatData
          ? [{ key: "legacy", label: "旧功能", description: "留言、任务与兼容数据" } as const]
          : []),
        { key: "exports", label: "导出", description: "结构化导出任务与历史" },
        { key: "settings", label: "设置", description: "班级配置与规则清单" },
        ...(canReadAdmin
          ? [{ key: "admin", label: "管理", description: "成员、角色与后台审计" } as const]
          : [])
      ] satisfies Array<{ key: ViewKey; label: string; description: string }>,
    [canReadAdmin, hasLegacyCompatData]
  );

  return (
    <div className="app-shell">
      <HeroPanel
        session={session}
        username={username}
        password={password}
        loading={loading}
        error={error}
        activeTenantName={activeTenant?.name || ""}
        activeQuote={activeQuote}
        quoteCount={settings?.classConfig?.quotes.length || 0}
        onUsernameChange={setUsername}
        onPasswordChange={setPassword}
        onLogin={handleLogin}
        onLogout={handleLogout}
      />

      <main className="workspace">
        <TopStatusBar
          activeViewLabel={activeViewLabel}
          className={selectedClassName}
          tenantName={activeTenant?.name || ""}
          studentCount={students.length}
          classFrozen={classFrozen}
          pendingAttendanceSessions={attendance?.migration.pendingSessions ?? 0}
          pendingAttendanceRecords={attendance?.migration.pendingRecords ?? 0}
        />
        <Toolbar
          classes={classes}
          selectedClassId={selectedClassId}
          search={search}
          onClassChange={setSelectedClassId}
          onSearchChange={setSearch}
        />
        <ViewTabs activeView={activeView} onChange={setActiveView} items={viewItems} />

        {activeView === "overview" ? (
          <>
            <StatsGrid summary={summary} />
            <section className="content-grid overview-grid">
              <LeaderboardPanel leaderboard={leaderboard} />
              <AttendancePanel
                attendance={attendance}
                sessionListMeta={attendanceSessionListMeta}
                sessions={attendanceSessions}
                selectedSessionId={selectedAttendanceSessionId}
                sessionDetail={attendanceSessionDetail}
                attendanceAudits={attendanceAudits}
                attendanceIssues={attendanceIssues}
                attendanceBatchHistory={attendanceBatchHistory}
                canManageAttendance={activeMembership?.permissions.canManagePoints ?? false}
                classFrozen={classFrozen}
                revertingAttendanceAuditId={revertingAttendanceAuditId}
                updatingAttendanceRecordId={updatingAttendanceRecordId}
                revertingAttendanceRecordId={revertingAttendanceRecordId}
                selectedRecordIds={selectedAttendanceRecordIds}
                batchUpdatingAttendance={batchUpdatingAttendance}
                batchRevertingAttendance={batchRevertingAttendance}
                batchRevertingAttendanceCreate={batchRevertingAttendanceCreate}
                revertingAttendanceBatch={revertingAttendanceBatch}
                revertingAttendanceBatchId={revertingAttendanceBatchId}
                creatingAttendanceSession={creatingAttendanceSession}
                updatingAttendanceSchedules={updatingAttendanceSchedules}
                updatingAttendancePolicy={updatingAttendancePolicy}
                updatingAttendanceIssues={updatingAttendanceIssues}
                awardingPerfectAttendance={awardingPerfectAttendance}
                revertingPerfectAttendance={revertingPerfectAttendance}
                canRevertPerfectAttendance={lastPerfectAttendanceTransactionIds.length > 0}
                perfectStudentsCount={perfectAttendanceStudentIds.length}
                settlingAttendanceSession={settlingAttendanceSession}
                settlingAttendanceIssues={settlingAttendanceIssues}
                revertingAttendanceSessionSettlement={revertingAttendanceSessionSettlement}
                lastAttendanceIssueSettlementPreview={lastAttendanceIssueSettlementPreview}
                creatingAttendanceRecord={creatingAttendanceRecord}
                creatingAttendanceRecordBatch={creatingAttendanceRecordBatch}
                attendanceWriteMessage={attendanceWriteMessage}
                students={students}
                dateFrom={attendanceDateFrom}
                dateTo={attendanceDateTo}
                sessionCode={attendanceSessionCode}
                onDateFromChange={setAttendanceDateFrom}
                onDateToChange={setAttendanceDateTo}
                onSessionCodeChange={setAttendanceSessionCode}
                onSelectSession={setSelectedAttendanceSessionId}
                onUpdateAttendanceRecord={handleUpdateAttendanceRecord}
                onRevertAttendanceRecord={handleRevertAttendanceRecord}
                onCreateAttendanceSession={handleCreateAttendanceSession}
                onUpdateAttendanceSchedules={handleUpdateAttendanceSchedules}
                onUpdateAttendancePolicy={handleUpdateAttendancePolicy}
                onAwardPerfectAttendance={handleAwardPerfectAttendance}
                onRevertPerfectAttendance={handleRevertPerfectAttendance}
                onSettleAttendanceSession={handleSettleAttendanceSession}
                onRevertAttendanceSessionSettlement={handleRevertAttendanceSessionSettlement}
                onCreateAttendanceRecord={handleCreateAttendanceRecord}
                onCreateAttendanceRecordBatch={handleCreateAttendanceRecordBatch}
                onRevertAttendanceAudit={handleRevertAttendanceAudit}
                onToggleRecordSelection={(recordId) =>
                  setSelectedAttendanceRecordIds((current) =>
                    current.includes(recordId) ? current.filter((item) => item !== recordId) : [...current, recordId]
                  )
                }
                onSelectAllRecords={() =>
                  setSelectedAttendanceRecordIds(attendanceSessionDetail?.items.map((item) => item.id) || [])
                }
                onClearRecordSelection={() => setSelectedAttendanceRecordIds([])}
                onBatchUpdateAttendanceRecords={handleBatchUpdateAttendanceRecords}
                onBatchRevertAttendanceRecords={handleBatchRevertAttendanceRecords}
                onBatchRevertAttendanceCreateRecords={handleBatchRevertAttendanceCreateRecords}
                onRevertAttendanceBatchById={handleRevertAttendanceBatchById}
                onUpdateAttendanceIssues={handleUpdateAttendanceIssues}
                onSettleAttendanceIssues={handleSettleAttendanceIssues}
              />
            </section>
          </>
        ) : null}

        {activeView === "students" ? (
          <section className="content-grid">
            <StudentListPanel
              students={filteredStudents}
              selectedStudentId={selectedStudentId}
              selectedBatchStudentIds={selectedBatchStudentIds}
              studentSearch={studentSearch}
              selectedGroup={selectedGroup}
              selectedDorm={selectedDorm}
              selectedStatus={selectedStudentStatus}
              groups={studentGroups}
              dorms={studentDorms}
              statusOptions={studentStatusOptions}
              groupedCount={filteredGroupCount}
              filteredCount={filteredStudents.length}
              creatingStudent={creatingStudent}
              batchAdjusting={batchAdjustingPoints}
              batchReverting={batchRevertingPoints}
              batchAdjustMessage={lastBatchAdjustmentMessage}
              studentWriteMessage={studentWriteMessage}
              batchAdjustmentHistory={batchAdjustmentHistory}
              activePointBatchCorrection={activePointBatchCorrection}
              pointAudits={pointAudits}
              revertingBatchAdjustmentId={revertingBatchAdjustmentId}
              revertingPointAuditId={revertingPointAuditId}
              batchUpdatingPositions={batchUpdatingPositions}
              batchPositionMessage={batchPositionMessage}
              positions={settings?.positions || []}
              batchUpdatingOrganization={batchUpdatingOrganization}
              batchOrganizationMessage={batchOrganizationMessage}
              availableGroups={settings?.groups || []}
              availableDormitories={settings?.dormitories || []}
              batchUpdatingStatus={batchUpdatingStatus}
              batchStatusMessage={batchStatusMessage}
              canRevertLatestBatchAdjustment={lastBatchAdjustmentTransactionIds.length > 0}
              canManagePoints={activeMembership?.permissions.canManagePoints ?? false}
              classFrozen={classFrozen}
              onStudentSearchChange={setStudentSearch}
              onGroupChange={setSelectedGroup}
              onDormChange={setSelectedDorm}
              onStatusChange={setSelectedStudentStatus}
              onSelect={setSelectedStudentId}
              onToggleBatchStudent={(studentId) =>
                setSelectedBatchStudentIds((current) =>
                  current.includes(studentId) ? current.filter((item) => item !== studentId) : [...current, studentId]
                )
              }
              onSelectAllFilteredStudents={() => setSelectedBatchStudentIds(filteredStudents.map((student) => student.id))}
              onClearBatchStudents={() => setSelectedBatchStudentIds([])}
              onCreateStudent={handleCreateStudent}
              onBatchAdjust={handleBatchAdjustPoints}
              onBatchUpdatePositions={handleBatchUpdateStudentPositions}
              onBatchUpdateOrganization={handleBatchUpdateStudentOrganization}
              onBatchUpdateStatus={handleBatchUpdateStudentStatus}
              onRevertLatestBatchAdjust={handleRevertLatestBatchAdjustPoints}
              onRevertBatchAdjustById={handleRevertBatchAdjustPoints}
              onStartPointBatchCorrection={setActivePointBatchCorrection}
              onCancelPointBatchCorrection={() => setActivePointBatchCorrection(null)}
              onRevertPointAudit={handleRevertPointAudit}
            />
            <StudentDetailPanel
              selectedStudent={selectedStudent}
              studentDetail={studentDetail}
              settings={settings}
              adjusting={adjustingPoints}
              updatingStudent={updatingStudent}
              updatingStudentProfile={updatingStudentProfile}
              updatingStudentOrganization={updatingStudentOrganization}
              deletingStudent={deletingStudent}
              lastAdjustmentMessage={lastAdjustmentMessage}
              lastStudentUpdateMessage={lastStudentUpdateMessage}
              lastStudentProfileMessage={lastStudentProfileMessage}
              lastStudentOrganizationMessage={lastStudentOrganizationMessage}
              revertingTransactionId={revertingTransactionId}
              canManagePoints={activeMembership?.permissions.canManagePoints ?? false}
              classFrozen={classFrozen}
              statusOptions={studentStatusOptions}
              onAdjust={handleAdjustPoints}
              onRevert={handleRevertPoints}
              onUpdateStudent={handleUpdateStudent}
              onUpdateStudentProfile={handleUpdateStudentProfile}
              onUpdateStudentOrganization={handleUpdateStudentOrganization}
              onDeleteStudent={handleDeleteStudent}
            />
            <LeaderboardPanel leaderboard={leaderboard} />
          </section>
        ) : null}

        {activeView === "attendance" ? (
          <section className="content-grid single-column">
            <AttendancePanel
              attendance={attendance}
              sessionListMeta={attendanceSessionListMeta}
              sessions={attendanceSessions}
              selectedSessionId={selectedAttendanceSessionId}
              sessionDetail={attendanceSessionDetail}
              attendanceAudits={attendanceAudits}
              attendanceIssues={attendanceIssues}
              attendanceBatchHistory={attendanceBatchHistory}
              canManageAttendance={activeMembership?.permissions.canManagePoints ?? false}
              classFrozen={classFrozen}
              revertingAttendanceAuditId={revertingAttendanceAuditId}
              updatingAttendanceRecordId={updatingAttendanceRecordId}
              revertingAttendanceRecordId={revertingAttendanceRecordId}
              selectedRecordIds={selectedAttendanceRecordIds}
              batchUpdatingAttendance={batchUpdatingAttendance}
              batchRevertingAttendance={batchRevertingAttendance}
              batchRevertingAttendanceCreate={batchRevertingAttendanceCreate}
              revertingAttendanceBatch={revertingAttendanceBatch}
              revertingAttendanceBatchId={revertingAttendanceBatchId}
              creatingAttendanceSession={creatingAttendanceSession}
              updatingAttendanceSchedules={updatingAttendanceSchedules}
              updatingAttendancePolicy={updatingAttendancePolicy}
              updatingAttendanceIssues={updatingAttendanceIssues}
              awardingPerfectAttendance={awardingPerfectAttendance}
              revertingPerfectAttendance={revertingPerfectAttendance}
              canRevertPerfectAttendance={lastPerfectAttendanceTransactionIds.length > 0}
              perfectStudentsCount={perfectAttendanceStudentIds.length}
              settlingAttendanceSession={settlingAttendanceSession}
              settlingAttendanceIssues={settlingAttendanceIssues}
              revertingAttendanceSessionSettlement={revertingAttendanceSessionSettlement}
              lastAttendanceIssueSettlementPreview={lastAttendanceIssueSettlementPreview}
              creatingAttendanceRecord={creatingAttendanceRecord}
              creatingAttendanceRecordBatch={creatingAttendanceRecordBatch}
              attendanceWriteMessage={attendanceWriteMessage}
              students={students}
              dateFrom={attendanceDateFrom}
              dateTo={attendanceDateTo}
              sessionCode={attendanceSessionCode}
              onDateFromChange={setAttendanceDateFrom}
              onDateToChange={setAttendanceDateTo}
              onSessionCodeChange={setAttendanceSessionCode}
              onSelectSession={setSelectedAttendanceSessionId}
              onUpdateAttendanceRecord={handleUpdateAttendanceRecord}
              onRevertAttendanceRecord={handleRevertAttendanceRecord}
              onCreateAttendanceSession={handleCreateAttendanceSession}
              onUpdateAttendanceSchedules={handleUpdateAttendanceSchedules}
              onUpdateAttendancePolicy={handleUpdateAttendancePolicy}
              onAwardPerfectAttendance={handleAwardPerfectAttendance}
              onRevertPerfectAttendance={handleRevertPerfectAttendance}
              onSettleAttendanceSession={handleSettleAttendanceSession}
              onRevertAttendanceSessionSettlement={handleRevertAttendanceSessionSettlement}
              onCreateAttendanceRecord={handleCreateAttendanceRecord}
              onCreateAttendanceRecordBatch={handleCreateAttendanceRecordBatch}
              onRevertAttendanceAudit={handleRevertAttendanceAudit}
              onToggleRecordSelection={(recordId) =>
                setSelectedAttendanceRecordIds((current) =>
                  current.includes(recordId) ? current.filter((item) => item !== recordId) : [...current, recordId]
                )
              }
              onSelectAllRecords={() =>
                setSelectedAttendanceRecordIds(attendanceSessionDetail?.items.map((item) => item.id) || [])
              }
              onClearRecordSelection={() => setSelectedAttendanceRecordIds([])}
              onBatchUpdateAttendanceRecords={handleBatchUpdateAttendanceRecords}
              onBatchRevertAttendanceRecords={handleBatchRevertAttendanceRecords}
              onBatchRevertAttendanceCreateRecords={handleBatchRevertAttendanceCreateRecords}
              onRevertAttendanceBatchById={handleRevertAttendanceBatchById}
              onUpdateAttendanceIssues={handleUpdateAttendanceIssues}
              onSettleAttendanceIssues={handleSettleAttendanceIssues}
            />
            <AttendanceStudentStatsPanel
              stats={attendanceStudentStats}
              sortBy={attendanceStudentSortBy}
              onSortByChange={setAttendanceStudentSortBy}
            />
            <AttendanceDailyStatsPanel
              stats={attendanceDailyStats}
              sortBy={attendanceDailySortBy}
              onSortByChange={setAttendanceDailySortBy}
            />
          </section>
        ) : null}

        {activeView === "homework" ? (
          <section className="content-grid single-column">
            <HomeworkPanel
            homework={homework}
            homeworkDetail={homeworkDetail}
            homeworkStudentStats={homeworkStudentStats}
            students={students}
            configuredSubjects={settings?.classConfig?.subjects || []}
            selectedBatchStudentIds={selectedBatchStudentIds}
            canManageHomework={activeMembership?.permissions.canManagePoints ?? false}
            classFrozen={classFrozen}
            creatingHomeworkRecord={creatingHomeworkRecord}
            creatingHomeworkBatchRecord={creatingHomeworkBatchRecord}
            revertingHomeworkBatchRecord={revertingHomeworkBatchRecord}
            canRevertLatestHomeworkBatch={lastHomeworkBatchTransactionIds.length > 0}
            revertingHomeworkRecordId={revertingHomeworkRecordId}
            revertingHomeworkAuditId={revertingHomeworkAuditId}
            revertingHomeworkBatchId={revertingHomeworkBatchId}
            homeworkWriteMessage={homeworkWriteMessage}
            homeworkBatchHistory={homeworkBatchHistory}
            activeHomeworkBatchCorrection={activeHomeworkBatchCorrection}
            onCreateHomeworkRecord={handleCreateHomeworkRecord}
            onCreateHomeworkBatchRecord={handleCreateHomeworkBatchRecord}
            onRevertHomeworkBatchRecord={handleRevertHomeworkBatchRecord}
            onRevertHomeworkBatchRecordById={handleRevertHomeworkBatchRecordById}
            onStartHomeworkBatchCorrection={setActiveHomeworkBatchCorrection}
            onCancelHomeworkBatchCorrection={() => setActiveHomeworkBatchCorrection(null)}
            onRevertHomeworkRecord={handleRevertHomeworkRecord}
            onRevertHomeworkAudit={handleRevertHomeworkAudit}
            selectedHomeworkDate={selectedHomeworkDate}
            selectedHomeworkSubject={selectedHomeworkSubject}
            onHomeworkDateChange={setSelectedHomeworkDate}
            onHomeworkSubjectChange={setSelectedHomeworkSubject}
          />
          </section>
        ) : null}

        {activeView === "legacy" ? (
          <section className="content-grid single-column">
            <LegacyPanel
              legacyCompat={settings?.classConfig?.legacyCompat || null}
              students={students}
              statusOptions={studentStatusOptions}
              canManageLegacy={activeMembership?.permissions.canManagePoints ?? false}
              classFrozen={classFrozen}
              updatingLegacyCompat={updatingLegacyCompat}
              claimingTaskId={claimingLegacyTaskId}
              redeemingItemId={redeemingLegacyItemId}
              rollingGacha={rollingLegacyGacha}
              usingItemId={usingLegacyItemId}
              returningItemId={returningLegacyItemId}
              settlingBattle={settlingLegacyBattle}
              legacyWriteMessage={legacyWriteMessage}
              latestGachaResult={latestLegacyGachaResult}
              onUpdateLegacyCompat={handleUpdateLegacyCompat}
              onClaimTask={handleClaimLegacyTask}
              onRedeemItem={handleRedeemLegacyShopItem}
              onGacha={handleGachaLegacyShop}
              onUseItem={handleUseLegacyShopItem}
              onReturnItem={handleReturnLegacyShopItem}
              onSettleBattle={handleSettleLegacyBattle}
            />
          </section>
        ) : null}

        {activeView === "exports" ? (
          <ExportPanel
            summary={exportSummary}
            history={exportHistory}
            currentUserId={session?.user.id || ""}
            canManageExports={activeMembership?.permissions.canManagePoints ?? false}
            creatingExportJob={creatingExportJob}
            downloadingExportJobId={downloadingExportJobId}
            exportMessage={exportMessage}
            onCreateExportJob={handleCreateExportJob}
            onDownloadExportJob={handleDownloadExportJob}
          />
        ) : null}

        {activeView === "settings" ? (
          <section className="content-grid single-column">
            <SettingsPanel
              settings={settings}
              students={students}
              canManageSettings={activeMembership?.permissions.canManagePoints ?? false}
              classFrozen={classFrozen}
              importingStudentRoster={importingStudentRoster}
              importingMaintenanceConfig={importingMaintenanceConfig}
              restoringMaintenanceSnapshot={restoringMaintenanceSnapshot}
              importingPointsExcel={importingPointsExcel}
              fixingPointAccount={fixingPointAccount}
              exportingAttendanceExcel={exportingAttendanceExcel}
              importingAttendanceExcel={importingAttendanceExcel}
              downloadingMaintenanceBackup={downloadingMaintenanceBackup}
              restoringStructuredBackup={restoringStructuredBackup}
              rebuildingPointAccountsFromHistory={rebuildingPointAccountsFromHistory}
              updatingClassConfig={updatingClassConfig}
              updatingDutyConfig={updatingDutyConfig}
              updatingQuotes={updatingQuotes}
              updatingLegacyCompat={updatingLegacyCompat}
              updatingGroups={updatingGroups}
              updatingDormitories={updatingDormitories}
              updatingPositions={updatingPositions}
              updatingCountdownEvents={updatingCountdownEvents}
              updatingScheduleNotes={updatingScheduleNotes}
              updatingStudentStatusConfig={updatingStudentStatusConfig}
              updatingSubjectConfig={updatingSubjectConfig}
              updatingWageConfig={updatingWageConfig}
              issuingDailyWage={issuingDailyWage}
              updatingClassFreeze={updatingClassFreeze}
              creatingReasonTemplate={creatingReasonTemplate}
              updatingReasonTemplateId={updatingReasonTemplateId}
              deletingReasonTemplateId={deletingReasonTemplateId}
              updatingReasonTemplateOrder={updatingReasonTemplateOrder}
              updatingReasonTemplateCategory={updatingReasonTemplateCategory}
              creatingReasonTemplateBatch={creatingReasonTemplateBatch}
              updatingFeatureFlagId={updatingFeatureFlagId}
              settingsWriteMessage={settingsWriteMessage}
              onUpdateClassConfig={handleUpdateClassConfig}
              onUpdateDutyConfig={handleUpdateDutyConfig}
              onUpdateQuotes={handleUpdateQuotes}
              onUpdateLegacyCompat={handleUpdateLegacyCompat}
              onUpdateGroups={handleUpdateGroups}
              onUpdateDormitories={handleUpdateDormitories}
              onUpdatePositions={handleUpdatePositions}
              onUpdateCountdownEvents={handleUpdateCountdownEvents}
              onUpdateScheduleNotes={handleUpdateScheduleNotes}
              onUpdateStudentStatusConfig={handleUpdateStudentStatusConfig}
              onUpdateSubjectConfig={handleUpdateSubjectConfig}
              onUpdateWageConfig={handleUpdateWageConfig}
              onIssueDailyWage={handleIssueDailyWage}
              onUpdateClassFreeze={handleUpdateClassFreeze}
              onCreateReasonTemplate={handleCreateSettingsReasonTemplate}
              onCreateReasonTemplateBatch={handleCreateSettingsReasonTemplateBatch}
              onUpdateReasonTemplate={handleUpdateSettingsReasonTemplate}
              onDeleteReasonTemplate={handleDeleteSettingsReasonTemplate}
              onReorderReasonTemplates={handleReorderReasonTemplates}
              onUpdateReasonTemplateCategory={handleUpdateReasonTemplateCategory}
              onUpdateFeatureFlag={handleUpdateSettingsFeatureFlag}
              onImportStudentRoster={handleImportStudentRoster}
              onImportMaintenanceConfig={handleImportMaintenanceConfig}
              onRestoreMaintenanceSnapshot={handleRestoreMaintenanceSnapshot}
              onImportPointsExcel={handleImportPointsExcel}
              onFixPointAccount={handleFixPointAccount}
              onExportAttendanceExcel={handleExportAttendanceExcel}
              onImportAttendanceExcel={handleImportAttendanceExcel}
              onDownloadMaintenanceBackup={handleDownloadMaintenanceBackup}
              onRestoreStructuredBackup={handleRestoreStructuredBackup}
              onRebuildPointAccountsFromHistory={handleRebuildPointAccountsFromHistory}
            />
          </section>
        ) : null}

        {activeView === "admin" ? (
          <AdminPanel
            summary={adminSummary}
            members={adminMembers}
            roles={adminRoles}
            audits={adminAudits}
            selectedMembershipId={selectedAdminMembershipId}
            selectedMemberDetail={selectedAdminMemberDetail}
            activeMembershipId={activeMembership?.id || ""}
            updatingRoles={updatingAdminRoles}
            updatingStatus={updatingAdminStatus}
            updatingPassword={updatingAdminPassword}
            deletingMember={deletingAdminMember}
            creatingInvitation={creatingAdminInvitation}
            loadingAdminData={loadingAdminData}
            adminErrorMessage={adminErrorMessage}
            lastAdminMessage={lastAdminMessage}
            memberSearch={adminMemberSearch}
            memberStatus={adminMemberStatus}
            memberRoleCode={adminMemberRoleCode}
            memberSortBy={adminMemberSortBy}
            auditAction={adminAuditAction}
            onMemberSearchChange={setAdminMemberSearch}
            onMemberStatusChange={setAdminMemberStatus}
            onMemberRoleCodeChange={setAdminMemberRoleCode}
            onMemberSortByChange={setAdminMemberSortBy}
            onAuditActionChange={setAdminAuditAction}
            onSelectMembership={setSelectedAdminMembershipId}
            onUpdateRoles={handleUpdateAdminRoles}
            onUpdateStatus={handleUpdateAdminStatus}
            onUpdatePassword={handleUpdateAdminPassword}
            onDeleteMember={handleDeleteAdminMember}
            onCreateInvitation={handleCreateAdminInvitation}
          />
        ) : null}
      </main>
    </div>
  );
}
