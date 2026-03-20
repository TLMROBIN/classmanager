import { useEffect, useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import * as XLSX from "xlsx";

import { getStudentStatusLabel, isStudentStatusPreset } from "../lib/studentStatus";
import { readStorage, STORAGE_KEYS, writeStorage } from "../lib/storage";
import type { LegacyCompatData, SettingsOverview, StudentItem, StudentStatusOptionItem } from "../types";

type SettingsPanelProps = {
  settings: SettingsOverview | null;
  students: StudentItem[];
  canManageSettings: boolean;
  classFrozen: boolean;
  importingStudentRoster: boolean;
  importingMaintenanceConfig: boolean;
  restoringMaintenanceSnapshot: boolean;
  importingPointsExcel: boolean;
  fixingPointAccount: boolean;
  exportingAttendanceExcel: boolean;
  importingAttendanceExcel: boolean;
  downloadingMaintenanceBackup: boolean;
  restoringStructuredBackup: boolean;
  rebuildingPointAccountsFromHistory: boolean;
  updatingClassConfig: boolean;
  updatingDutyConfig: boolean;
  updatingQuotes: boolean;
  updatingLegacyCompat: boolean;
  updatingGroups: boolean;
  updatingDormitories: boolean;
  updatingPositions: boolean;
  updatingCountdownEvents: boolean;
  updatingScheduleNotes: boolean;
  updatingStudentStatusConfig: boolean;
  updatingSubjectConfig: boolean;
  updatingWageConfig: boolean;
  issuingDailyWage: boolean;
  updatingClassFreeze: boolean;
  creatingReasonTemplate: boolean;
  updatingReasonTemplateId: string;
  deletingReasonTemplateId: string;
  updatingReasonTemplateOrder: boolean;
  updatingReasonTemplateCategory: boolean;
  creatingReasonTemplateBatch: boolean;
  updatingFeatureFlagId: string;
  settingsWriteMessage: string;
  onUpdateClassConfig: (input: { className: string; timezone: string }) => void;
  onUpdateDutyConfig: (input: { duty: Record<string, string[]> }) => void;
  onUpdateQuotes: (input: { quotes: string[] }) => void;
  onUpdateLegacyCompat: (input: { legacyCompat: unknown }) => Promise<void> | void;
  onUpdateGroups: (input: {
    groups: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      colorToken?: string | null;
      isActive?: boolean;
    }>;
  }) => void;
  onUpdateDormitories: (input: {
    dormitories: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      building?: string | null;
      genderScope?: string | null;
      isActive?: boolean;
    }>;
  }) => void;
  onUpdatePositions: (input: {
    positions: Array<{
      id?: string;
      code: string;
      name: string;
      category: string;
      isActive?: boolean;
    }>;
  }) => void;
  onUpdateCountdownEvents: (input: {
    countdownEvents: Array<{ id?: string; title: string; date?: string | null; note?: string | null }>;
  }) => void;
  onUpdateScheduleNotes: (input: { scheduleNotes: Record<string, string> }) => void;
  onUpdateStudentStatusConfig: (input: {
    studentStatusOptions: StudentStatusOptionItem[];
  }) => void;
  onUpdateSubjectConfig: (input: {
    subjects: Array<{
      id: string;
      name: string;
      representativeStudentIds: string[];
    }>;
  }) => void;
  onUpdateWageConfig: (input: {
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string | null;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId?: string | null;
    }>;
  }) => void;
  onIssueDailyWage: () => void;
  onUpdateClassFreeze: (isFrozen: boolean) => void;
  onCreateReasonTemplate: (input: {
    name: string;
    value: number;
    transactionType: "bonus" | "penalty" | "reward";
    scene: string;
    category: string;
  }) => void;
  onUpdateReasonTemplate: (
    templateId: string,
    input: {
      name?: string;
      value?: number;
      transactionType?: "bonus" | "penalty" | "reward";
      scene?: string;
      category?: string;
      isActive?: boolean;
    }
  ) => void;
  onDeleteReasonTemplate: (templateId: string) => void;
  onReorderReasonTemplates: (templateIds: string[]) => void;
  onUpdateReasonTemplateCategory: (input: {
    scene: string;
    category: string;
    nextScene: string;
    nextCategory: string;
  }) => void;
  onCreateReasonTemplateBatch: (
    items: ReasonTemplateBatchItem[]
  ) => void;
  onUpdateFeatureFlag: (featureFlagId: string, input: { enabled?: boolean; config?: Record<string, unknown> }) => void;
  onImportStudentRoster: (input: {
    mode: "merge" | "overwrite";
    items: Array<{
      name: string;
      gender?: string | null;
      status?: string | null;
      sortOrder?: number | null;
      groupName?: string | null;
      dormName?: string | null;
    }>;
  }) => void;
  onImportMaintenanceConfig: (input: { config: unknown; skipConfirm?: boolean }) => Promise<boolean> | boolean;
  onRestoreMaintenanceSnapshot: (input: {
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
  }) => Promise<boolean> | boolean;
  onImportPointsExcel: (file: File) => Promise<void> | void;
  onFixPointAccount: (input: {
    studentId: string;
    totalPoints: number;
    balancePoints: number;
    penaltyPoints: number;
  }) => Promise<boolean> | boolean;
  onExportAttendanceExcel: () => Promise<void> | void;
  onImportAttendanceExcel: (file: File) => Promise<void> | void;
  onDownloadMaintenanceBackup: () => void;
  onRestoreStructuredBackup: (input: { backup: unknown }) => Promise<boolean> | boolean;
  onRebuildPointAccountsFromHistory: () => Promise<boolean> | boolean;
};

type ReasonTemplateBatchItem = {
  name: string;
  value: number;
  transactionType: "bonus" | "penalty" | "reward";
  scene: string;
  category: string;
};

type BatchTemplateReview = {
  items: ReasonTemplateBatchItem[];
  errors: string[];
  preview: ReasonTemplateBatchItem[];
};

type MaintenanceStudentSnapshotItem = {
  name: string;
  gender?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  groupName?: string | null;
  dormName?: string | null;
};

type MaintenanceSnapshotRecord = {
  id: string;
  label: string;
  createdAt: string;
  config: unknown;
  students: MaintenanceStudentSnapshotItem[];
};

type CountdownEventEditorItem = {
  id: string;
  title: string;
  date: string;
  note: string;
};

type ScheduleNoteEditorItem = {
  key: string;
  value: string;
};

type StudentCouncilRoleDraft = {
  id: string;
  name: string;
  studentId: string;
};

type SubjectDraft = {
  id: string;
  name: string;
  representativeStudentIds: [string, string];
};

type StudentStatusDraft = StudentStatusOptionItem & {
  isPreset: boolean;
};

type GroupDraft = {
  id: string;
  legacyKey: string;
  name: string;
  colorToken: string;
  isActive: boolean;
  membersCount: number;
};

type DormitoryDraft = {
  id: string;
  legacyKey: string;
  name: string;
  building: string;
  genderScope: string;
  isActive: boolean;
  membersCount: number;
};

type PositionDraft = {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  holdersCount: number;
};

type DutyDayCode = "mon" | "tue" | "wed" | "thu" | "fri";

type FeatureFlagConfigPrimitiveType = "string" | "number" | "boolean" | "null";

type FeatureFlagConfigEntry = {
  key: string;
  type: FeatureFlagConfigPrimitiveType;
  value: string;
};

type FeatureFlagConfigDraftEntry = {
  key: string;
  type: FeatureFlagConfigPrimitiveType | null;
  value: string;
};

const COMMON_TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Singapore",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles"
] as const;

function createEmptyLegacyCompatData(): LegacyCompatData {
  return {
    strategyDates: null,
    messages: [],
    teacherMessages: [],
    tasks: [],
    shop: {
      treasures: [],
      storage: {},
      logs: [],
      redemptionHistory: {},
      dailyRedemptionCounts: {},
      dailyUsageCounts: {}
    },
    battle: null
  };
}

function cloneLegacyCompatData(value: LegacyCompatData | null | undefined) {
  return JSON.parse(JSON.stringify(value ?? createEmptyLegacyCompatData())) as LegacyCompatData;
}

const MIN_PSYCHOLOGY_COMMITTEE_SLOTS = 4;
const DUTY_DAY_ORDER: DutyDayCode[] = ["mon", "tue", "wed", "thu", "fri"];
const DUTY_DAY_LABELS: Record<DutyDayCode, string> = {
  mon: "周一",
  tue: "周二",
  wed: "周三",
  thu: "周四",
  fri: "周五"
};

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getCountdownStatusLabel(value: string) {
  if (!value || !isValidIsoDate(value)) {
    return "未设置日期";
  }

  const today = new Date();
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const targetDate = new Date(`${value}T00:00:00Z`);
  const target = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate());
  const diffDays = Math.round((target - current) / 86400000);

  if (diffDays < 0) {
    return `已过 ${Math.abs(diffDays)} 天`;
  }
  if (diffDays === 0) {
    return "今天";
  }
  return `还有 ${diffDays} 天`;
}

function detectFeatureFlagValueType(value: unknown): FeatureFlagConfigPrimitiveType | null {
  if (value == null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "number" && Number.isFinite(value)) return "number";
  if (typeof value === "boolean") return "boolean";
  return null;
}

function stringifyFeatureFlagValue(type: FeatureFlagConfigPrimitiveType, value: unknown) {
  if (type === "boolean") {
    return value ? "true" : "false";
  }
  if (type === "null") {
    return "";
  }
  return value == null ? "" : String(value);
}

function parseFeatureFlagConfigDraft(value: string) {
  const parsed = JSON.parse(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("功能开关配置必须是 JSON 对象。");
  }

  const entries = Object.entries(parsed as Record<string, unknown>).map(([key, item]) => {
    const type = detectFeatureFlagValueType(item);
    if (!type) {
      return {
        key,
        type: null,
        value: JSON.stringify(item)
      };
    }
    return {
      key,
      type,
      value: stringifyFeatureFlagValue(type, item)
    };
  });

  return {
    parsed: parsed as Record<string, unknown>,
    entries
  };
}

function moveDraftItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [current] = next.splice(index, 1);
  next.splice(nextIndex, 0, current);
  return next;
}

function moveDraftItemToIndex<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [current] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, current);
  return next;
}

function createStudentStatusDrafts(items: StudentStatusOptionItem[] | null | undefined): StudentStatusDraft[] {
  return (items || []).map((item) => ({
    value: item.value,
    label: item.label,
    participatesInDailyFlow: item.participatesInDailyFlow,
    isPreset: isStudentStatusPreset(item.value)
  }));
}

export function SettingsPanel({
  settings,
  students,
  canManageSettings,
  classFrozen,
  importingStudentRoster,
  importingMaintenanceConfig,
  restoringMaintenanceSnapshot,
  importingPointsExcel,
  fixingPointAccount,
  exportingAttendanceExcel,
  importingAttendanceExcel,
  downloadingMaintenanceBackup,
  restoringStructuredBackup,
  rebuildingPointAccountsFromHistory,
  updatingClassConfig,
  updatingDutyConfig,
  updatingQuotes,
  updatingLegacyCompat,
  updatingGroups,
  updatingDormitories,
  updatingPositions,
  updatingCountdownEvents,
  updatingScheduleNotes,
  updatingStudentStatusConfig,
  updatingSubjectConfig,
  updatingWageConfig,
  issuingDailyWage,
  updatingClassFreeze,
  creatingReasonTemplate,
  updatingReasonTemplateId,
  deletingReasonTemplateId,
  updatingReasonTemplateOrder,
  updatingReasonTemplateCategory,
  creatingReasonTemplateBatch,
  updatingFeatureFlagId,
  settingsWriteMessage,
  onUpdateClassConfig,
  onUpdateDutyConfig,
  onUpdateQuotes,
  onUpdateLegacyCompat,
  onUpdateGroups,
  onUpdateDormitories,
  onUpdatePositions,
  onUpdateCountdownEvents,
  onUpdateScheduleNotes,
  onUpdateStudentStatusConfig,
  onUpdateSubjectConfig,
  onUpdateWageConfig,
  onIssueDailyWage,
  onUpdateClassFreeze,
  onCreateReasonTemplate,
  onUpdateReasonTemplate,
  onDeleteReasonTemplate,
  onReorderReasonTemplates,
  onUpdateReasonTemplateCategory,
  onCreateReasonTemplateBatch,
  onUpdateFeatureFlag,
  onImportStudentRoster,
  onImportMaintenanceConfig,
  onRestoreMaintenanceSnapshot,
  onImportPointsExcel,
  onFixPointAccount,
  onExportAttendanceExcel,
  onImportAttendanceExcel,
  onDownloadMaintenanceBackup,
  onRestoreStructuredBackup,
  onRebuildPointAccountsFromHistory
}: SettingsPanelProps) {
  const [templateName, setTemplateName] = useState("");
  const [templateValue, setTemplateValue] = useState("1");
  const [templateTransactionType, setTemplateTransactionType] = useState<"bonus" | "penalty" | "reward">("bonus");
  const [templateScene, setTemplateScene] = useState("班级");
  const [templateCategory, setTemplateCategory] = useState("班务");
  const [classNameDraft, setClassNameDraft] = useState(settings?.classConfig?.className || "");
  const [timezoneDraft, setTimezoneDraft] = useState(settings?.classConfig?.timezone || "Asia/Shanghai");
  const [classConfigError, setClassConfigError] = useState("");
  const [dutyDraft, setDutyDraft] = useState<Record<DutyDayCode, string[]>>({
    mon: settings?.classConfig?.duty?.mon || ["", ""],
    tue: settings?.classConfig?.duty?.tue || [""],
    wed: settings?.classConfig?.duty?.wed || [""],
    thu: settings?.classConfig?.duty?.thu || [""],
    fri: settings?.classConfig?.duty?.fri || [""]
  });
  const [dutyConfigError, setDutyConfigError] = useState("");
  const [quotesDraft, setQuotesDraft] = useState((settings?.classConfig?.quotes || []).join("\n"));
  const [quotesConfigError, setQuotesConfigError] = useState("");
  const [maintenanceToolsError, setMaintenanceToolsError] = useState("");
  const [studentImportMode, setStudentImportMode] = useState<"merge" | "overwrite">("merge");
  const [snapshotRecords, setSnapshotRecords] = useState<MaintenanceSnapshotRecord[]>([]);
  const [selectedSnapshotId, setSelectedSnapshotId] = useState("");
  const [maintenanceTestMode, setMaintenanceTestMode] = useState(false);
  const [legacyCompatDraft, setLegacyCompatDraft] = useState(
    JSON.stringify(settings?.classConfig?.legacyCompat || null, null, 2)
  );
  const [legacyCompatError, setLegacyCompatError] = useState("");
  const [groupDrafts, setGroupDrafts] = useState<GroupDraft[]>(
    (settings?.groups || []).map((item) => ({
      id: item.id,
      legacyKey: item.legacyKey || "",
      name: item.name,
      colorToken: item.colorToken || "",
      isActive: item.isActive,
      membersCount: item.membersCount
    }))
  );
  const [groupConfigError, setGroupConfigError] = useState("");
  const [dormitoryDrafts, setDormitoryDrafts] = useState<DormitoryDraft[]>(
    (settings?.dormitories || []).map((item) => ({
      id: item.id,
      legacyKey: item.legacyKey || "",
      name: item.name,
      building: item.building || "",
      genderScope: item.genderScope || "",
      isActive: item.isActive,
      membersCount: item.membersCount
    }))
  );
  const [dormitoryConfigError, setDormitoryConfigError] = useState("");
  const [positionDrafts, setPositionDrafts] = useState<PositionDraft[]>(
    (settings?.positions || []).map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      isActive: item.isActive,
      holdersCount: item.holdersCount
    }))
  );
  const [positionConfigError, setPositionConfigError] = useState("");
  const [subjectDrafts, setSubjectDrafts] = useState<SubjectDraft[]>(
    (settings?.classConfig?.subjects || []).map((item) => ({
      id: item.id,
      name: item.name,
      representativeStudentIds: [item.representativeStudentIds[0] || "", item.representativeStudentIds[1] || ""]
    }))
  );
  const [studentStatusDrafts, setStudentStatusDrafts] = useState<StudentStatusDraft[]>(
    createStudentStatusDrafts(settings?.classConfig?.studentStatusOptions)
  );
  const [studentStatusConfigError, setStudentStatusConfigError] = useState("");
  const [subjectConfigError, setSubjectConfigError] = useState("");
  const [dailyWageAmountDraft, setDailyWageAmountDraft] = useState(String(settings?.classConfig?.dailyWageAmount ?? 5));
  const [dailyWageGroupIdsDraft, setDailyWageGroupIdsDraft] = useState<string[]>(
    settings?.classConfig?.dailyWageGroupIds || []
  );
  const [psychologyCommitteeDraft, setPsychologyCommitteeDraft] = useState<string[]>(
    Array.from(
      {
        length: Math.max(
          MIN_PSYCHOLOGY_COMMITTEE_SLOTS,
          settings?.classConfig?.psychologyCommitteeStudentIds?.length || 0
        )
      },
      (_, index) => settings?.classConfig?.psychologyCommitteeStudentIds?.[index] || ""
    )
  );
  const [studentCouncilRolesDraft, setStudentCouncilRolesDraft] = useState<StudentCouncilRoleDraft[]>(
    (settings?.classConfig?.studentCouncilRoles || []).map((item) => ({
      id: item.id,
      name: item.name,
      studentId: item.studentId || ""
    }))
  );
  const [wageConfigError, setWageConfigError] = useState("");
  const [countdownEventsDraft, setCountdownEventsDraft] = useState(
    JSON.stringify(settings?.classConfig?.countdownEvents || [], null, 2)
  );
  const [countdownEventsError, setCountdownEventsError] = useState("");
  const [newCountdownEventId, setNewCountdownEventId] = useState("");
  const [newCountdownEventTitle, setNewCountdownEventTitle] = useState("");
  const [newCountdownEventDate, setNewCountdownEventDate] = useState("");
  const [newCountdownEventNote, setNewCountdownEventNote] = useState("");
  const [draggingCountdownEventIndex, setDraggingCountdownEventIndex] = useState<number | null>(null);
  const [dragOverCountdownEventIndex, setDragOverCountdownEventIndex] = useState<number | null>(null);
  const [scheduleNotesDraft, setScheduleNotesDraft] = useState(
    JSON.stringify(settings?.classConfig?.scheduleNotes || {}, null, 2)
  );
  const [scheduleNotesError, setScheduleNotesError] = useState("");
  const [newScheduleNoteKey, setNewScheduleNoteKey] = useState("");
  const [newScheduleNoteValue, setNewScheduleNoteValue] = useState("");
  const [draggingScheduleNoteIndex, setDraggingScheduleNoteIndex] = useState<number | null>(null);
  const [dragOverScheduleNoteIndex, setDragOverScheduleNoteIndex] = useState<number | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [editingFeatureFlagId, setEditingFeatureFlagId] = useState("");
  const [featureFlagConfigDraft, setFeatureFlagConfigDraft] = useState("{}");
  const [featureFlagConfigError, setFeatureFlagConfigError] = useState("");
  const [newFeatureFlagConfigKey, setNewFeatureFlagConfigKey] = useState("");
  const [newFeatureFlagConfigType, setNewFeatureFlagConfigType] = useState<FeatureFlagConfigPrimitiveType>("string");
  const [newFeatureFlagConfigValue, setNewFeatureFlagConfigValue] = useState("");
  const [editingCategoryKey, setEditingCategoryKey] = useState("");
  const [categorySceneDraft, setCategorySceneDraft] = useState("");
  const [categoryCategoryDraft, setCategoryCategoryDraft] = useState("");
  const [categoryFormError, setCategoryFormError] = useState("");
  const [batchTemplateDraft, setBatchTemplateDraft] = useState("[]");
  const [batchTemplateFormat, setBatchTemplateFormat] = useState<"json" | "csv" | "tsv">("json");
  const [batchTemplateErrors, setBatchTemplateErrors] = useState<string[]>([]);
  const [batchTemplatePreview, setBatchTemplatePreview] = useState<ReasonTemplateBatchItem[]>([]);
  const [batchTemplateHasHeader, setBatchTemplateHasHeader] = useState(true);
  const [batchTemplateColumns, setBatchTemplateColumns] = useState<string[]>([]);
  const [batchTemplateColumnMap, setBatchTemplateColumnMap] = useState({
    name: "",
    value: "",
    transactionType: "",
    scene: "",
    category: ""
  });
  const [templateTypeFilter, setTemplateTypeFilter] = useState<"" | "bonus" | "penalty" | "reward">("");
  const [templateStatusFilter, setTemplateStatusFilter] = useState<"" | "active" | "disabled">("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [featureFlagStatusFilter, setFeatureFlagStatusFilter] = useState<"" | "enabled" | "disabled">("");
  const [featureFlagSearch, setFeatureFlagSearch] = useState("");
  const [countdownSearch, setCountdownSearch] = useState("");
  const [scheduleNoteSearch, setScheduleNoteSearch] = useState("");
  const [pointFixStudentId, setPointFixStudentId] = useState(students[0]?.id || "");
  const [pointFixTotalPoints, setPointFixTotalPoints] = useState(students[0]?.account?.totalPoints || "0");
  const [pointFixBalancePoints, setPointFixBalancePoints] = useState(students[0]?.account?.balancePoints || "0");
  const [pointFixPenaltyPoints, setPointFixPenaltyPoints] = useState(students[0]?.account?.penaltyPoints || "0");
  const [pointFixError, setPointFixError] = useState("");
  const studentOptions = settings?.studentOptions ?? [];
  const reasonTemplates = settings?.reasonTemplates ?? [];
  const reasonTemplateCategories = settings?.reasonTemplateCategories ?? [];
  const enabledFeatureCodes = settings?.featureFlags.filter((item) => item.enabled).map((item) => item.code) || [];
  const filteredReasonTemplates = reasonTemplates.filter((item) => {
    const matchesType = !templateTypeFilter || item.transactionType === templateTypeFilter;
    const matchesStatus = !templateStatusFilter || (templateStatusFilter === "active" ? item.isActive : !item.isActive);
    const keyword = templateSearch.trim();
    const matchesSearch =
      !keyword || [item.name, item.scene, item.category, item.value, item.transactionType].some((value) => String(value).includes(keyword));
    return matchesType && matchesStatus && matchesSearch;
  });
  const filteredReasonTemplateSummary = filteredReasonTemplates.reduce(
    (totals, item) => {
      if (item.transactionType === "bonus") totals.bonus += 1;
      if (item.transactionType === "penalty") totals.penalty += 1;
      if (item.transactionType === "reward") totals.reward += 1;
      if (item.isActive) totals.active += 1;
      return totals;
    },
    { bonus: 0, penalty: 0, reward: 0, active: 0 }
  );
  const filteredFeatureFlags = (settings?.featureFlags ?? []).filter((item) => {
    const matchesStatus = !featureFlagStatusFilter || (featureFlagStatusFilter === "enabled" ? item.enabled : !item.enabled);
    const keyword = featureFlagSearch.trim();
    const matchesSearch =
      !keyword || [item.code, JSON.stringify(item.config || {})].some((value) => String(value).includes(keyword));
    return matchesStatus && matchesSearch;
  });
  const filteredCountdownItems = (settings?.classConfig?.countdownEventItems || []).filter((item) => {
    const keyword = countdownSearch.trim();
    return !keyword || [item.title, item.note || "", item.date || ""].some((value) => value.includes(keyword));
  });
  const filteredScheduleNoteItems = (settings?.classConfig?.scheduleNoteItems || []).filter((item) => {
    const keyword = scheduleNoteSearch.trim();
    return !keyword || [item.key, item.value || ""].some((value) => value.includes(keyword));
  });
  const legacyCompatSummary = useMemo(() => {
    const legacyCompat = settings?.classConfig?.legacyCompat;
    const strategyDates = legacyCompat?.strategyDates;
    const strategyDateCount = [strategyDates?.lastPeriodicTaskDate, strategyDates?.lastPenaltyReductionDate].filter(
      Boolean
    ).length;
    return {
      messages: legacyCompat?.messages.length || 0,
      teacherMessages: legacyCompat?.teacherMessages.length || 0,
      tasks: legacyCompat?.tasks.length || 0,
      treasures: legacyCompat?.shop.treasures.length || 0,
      storageStudents: Object.keys(legacyCompat?.shop.storage || {}).length,
      shopLogs: legacyCompat?.shop.logs.length || 0,
      redemptionStudents: Object.keys(legacyCompat?.shop.redemptionHistory || {}).length,
      battleTeams: legacyCompat?.battle?.teams.length || 0,
      battleMatches: legacyCompat?.battle?.battles.length || 0,
      strategyDateCount,
      lastPeriodicTaskDate: strategyDates?.lastPeriodicTaskDate || null,
      lastPenaltyReductionDate: strategyDates?.lastPenaltyReductionDate || null
    };
  }, [settings?.classConfig?.legacyCompat]);
  const hygieneDutyStudentOptions = useMemo(() => {
    const hygieneStudents = studentOptions.filter(
      (item) =>
        item.primaryGroupLegacyKey === "hygiene" ||
        item.primaryGroupName?.includes("卫生") ||
        item.primaryGroupName?.includes("值日")
    );
    return hygieneStudents.length ? hygieneStudents : studentOptions;
  }, [studentOptions]);
  const positionCategoryOptions = useMemo(
    () => Array.from(new Set((settings?.positions || []).map((item) => item.category).filter(Boolean))),
    [settings?.positions]
  );
  const studentStatusCountMap = useMemo(
    () =>
      students.reduce((acc, student) => {
        const normalizedStatus = student.status.trim();
        if (!normalizedStatus) {
          return acc;
        }
        acc.set(normalizedStatus, (acc.get(normalizedStatus) || 0) + 1);
        return acc;
      }, new Map<string, number>()),
    [students]
  );
  const studentOptionLabelMap = useMemo(
    () =>
      new Map(
        studentOptions.map((item) => [
          item.id,
          `${item.sortOrder}. ${item.name} · ${getStudentStatusLabel(item.status, settings?.classConfig?.studentStatusOptions)}`
        ])
      ),
    [settings?.classConfig?.studentStatusOptions, studentOptions]
  );
  const exportedMaintenanceConfig = useMemo(
    () =>
      settings
        ? {
            classConfig: settings.classConfig,
            groups: settings.groups,
            dormitories: settings.dormitories,
            positions: settings.positions,
            reasonTemplates: settings.reasonTemplates,
            featureFlags: settings.featureFlags,
            exportedAt: new Date().toISOString()
          }
        : null,
    [settings]
  );
  const exportedMaintenanceStudents = useMemo<MaintenanceStudentSnapshotItem[]>(
    () =>
      students.map((student) => ({
        name: student.name,
        gender: student.gender,
        status: student.status,
        sortOrder: student.sortOrder,
        groupName: student.primaryGroup?.name || null,
        dormName: student.primaryDorm?.name || null
      })),
    [students]
  );
  const savedWageGroupNames = (settings?.classConfig?.dailyWageGroupIds || [])
    .map((groupId) => settings?.groups.find((item) => item.id === groupId)?.name || "")
    .filter(Boolean);
  const savedPsychologyMembers = (settings?.classConfig?.psychologyCommitteeStudentIds || [])
    .map((studentId) => studentOptionLabelMap.get(studentId) || "")
    .filter(Boolean);
  const configuredStudentCouncilRoles = (settings?.classConfig?.studentCouncilRoles || []).filter((item) => item.studentId);

  useEffect(() => {
    try {
      const rawSnapshots = readStorage(STORAGE_KEYS.maintenanceSnapshots);
      if (rawSnapshots) {
        const parsed = JSON.parse(rawSnapshots);
        if (Array.isArray(parsed)) {
          setSnapshotRecords(parsed as MaintenanceSnapshotRecord[]);
        }
      }
    } catch {
      setSnapshotRecords([]);
    }

    try {
      setMaintenanceTestMode(readStorage(STORAGE_KEYS.maintenanceTestMode) === "1");
    } catch {
      setMaintenanceTestMode(false);
    }
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.maintenanceSnapshots, snapshotRecords.length ? JSON.stringify(snapshotRecords) : "");
  }, [snapshotRecords]);

  useEffect(() => {
    setSelectedSnapshotId((current) => {
      if (current && snapshotRecords.some((item) => item.id === current)) {
        return current;
      }
      return snapshotRecords[0]?.id || "";
    });
  }, [snapshotRecords]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.maintenanceTestMode, maintenanceTestMode ? "1" : "");
  }, [maintenanceTestMode]);
  useEffect(() => {
    setPointFixStudentId((current) => {
      if (current && students.some((item) => item.id === current)) {
        return current;
      }
      return students[0]?.id || "";
    });
  }, [students]);

  useEffect(() => {
    const selectedStudent = students.find((item) => item.id === pointFixStudentId) || null;
    setPointFixTotalPoints(selectedStudent?.account?.totalPoints || "0");
    setPointFixBalancePoints(selectedStudent?.account?.balancePoints || "0");
    setPointFixPenaltyPoints(selectedStudent?.account?.penaltyPoints || "0");
    setPointFixError("");
  }, [pointFixStudentId, students]);
  const hasSavedWageTargets =
    savedWageGroupNames.length > 0 || savedPsychologyMembers.length > 0 || configuredStudentCouncilRoles.length > 0;
  const selectedSnapshot = snapshotRecords.find((item) => item.id === selectedSnapshotId) || null;

  const editingTemplate =
    settings?.reasonTemplates.find((item) => item.id === editingTemplateId) || null;
  const countdownEventEditorItems = useMemo(() => {
    try {
      const parsed = JSON.parse(countdownEventsDraft);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => {
          if (!item || typeof item !== "object" || Array.isArray(item)) {
            return null;
          }
          const row = item as Record<string, unknown>;
          return {
            id: row.id == null ? "" : String(row.id),
            title: row.title == null ? "" : String(row.title),
            date: row.date == null ? "" : String(row.date),
            note: row.note == null ? "" : String(row.note)
          };
        })
        .filter((item): item is CountdownEventEditorItem => Boolean(item));
    } catch {
      return [];
    }
  }, [countdownEventsDraft]);
  const scheduleNoteEditorItems = useMemo(() => {
    try {
      const parsed = JSON.parse(scheduleNotesDraft);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return [];
      }
      return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: value == null ? "" : String(value)
      }));
    } catch {
      return [];
    }
  }, [scheduleNotesDraft]);
  const featureFlagConfigRows = useMemo(() => {
    try {
      return parseFeatureFlagConfigDraft(featureFlagConfigDraft).entries;
    } catch {
      return [];
    }
  }, [featureFlagConfigDraft]);

  function writeCountdownEventsDraft(items: CountdownEventEditorItem[]) {
    setCountdownEventsDraft(
      JSON.stringify(
        items.map((item) => ({
          ...(item.id.trim() ? { id: item.id.trim() } : {}),
          title: item.title.trim(),
          ...(item.date.trim() ? { date: item.date.trim() } : {}),
          ...(item.note.trim() ? { note: item.note.trim() } : {})
        })),
        null,
        2
      )
    );
    if (countdownEventsError) {
      setCountdownEventsError("");
    }
  }

  function writeScheduleNotesDraft(items: ScheduleNoteEditorItem[]) {
    setScheduleNotesDraft(
      JSON.stringify(
        Object.fromEntries(items.map((item) => [item.key.trim(), item.value])),
        null,
        2
      )
    );
    if (scheduleNotesError) {
      setScheduleNotesError("");
    }
  }

  function writeFeatureFlagConfigDraft(entries: FeatureFlagConfigEntry[]) {
    const config = Object.fromEntries(
      entries.map((item) => {
        if (item.type === "number") {
          return [item.key.trim(), Number(item.value)];
        }
        if (item.type === "boolean") {
          return [item.key.trim(), item.value === "true"];
        }
        if (item.type === "null") {
          return [item.key.trim(), null];
        }
        return [item.key.trim(), item.value];
      })
    );
    setFeatureFlagConfigDraft(JSON.stringify(config, null, 2));
    if (featureFlagConfigError) {
      setFeatureFlagConfigError("");
    }
  }

  function reviewBatchTemplates(input: string, format: "json" | "csv" | "tsv"): BatchTemplateReview {
    const { items, errors } = parseBatchTemplates(input, format);
    const nextErrors = [...errors];
    const seenNames = new Set<string>();
    const duplicateNames = new Set<string>();
    const existingNames = new Set(reasonTemplates.map((item) => item.name));
    const existingDuplicateNames = new Set<string>();
    let missingFieldRow = 0;
    let invalidTypeRow = 0;

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (seenNames.has(item.name)) {
        duplicateNames.add(item.name);
      } else {
        seenNames.add(item.name);
      }
      if (item.name && existingNames.has(item.name)) {
        existingDuplicateNames.add(item.name);
      }
      if (
        !missingFieldRow &&
        (!item.name || !item.scene || !item.category || !item.transactionType || !Number.isFinite(item.value))
      ) {
        missingFieldRow = index + 1;
      }
      if (
        !invalidTypeRow &&
        item.transactionType &&
        !["bonus", "penalty", "reward"].includes(item.transactionType)
      ) {
        invalidTypeRow = index + 1;
      }
    }

    if (!items.length && input.trim()) {
      nextErrors.push("没有可导入的模板。");
    }
    if (duplicateNames.size) {
      nextErrors.push(`导入内容存在重复模板名称：${Array.from(duplicateNames).slice(0, 5).join(" / ")}`);
    }
    if (existingDuplicateNames.size) {
      nextErrors.push(`与现有模板重名：${Array.from(existingDuplicateNames).slice(0, 5).join(" / ")}`);
    }
    if (missingFieldRow) {
      nextErrors.push(`第 ${missingFieldRow} 行缺少必要字段或分值无效。`);
    }
    if (invalidTypeRow) {
      nextErrors.push(`第 ${invalidTypeRow} 行类型无效，仅支持 bonus / penalty / reward。`);
    }

    return {
      items,
      errors: nextErrors,
      preview: items.slice(0, 5)
    };
  }

  function resetTemplateForm() {
    setEditingTemplateId("");
    setTemplateName("");
    setTemplateValue("1");
    setTemplateTransactionType("bonus");
    setTemplateScene("班级");
    setTemplateCategory("班务");
  }

  function submitTemplate() {
    if (!templateName.trim() || !Number(templateValue) || !templateScene.trim() || !templateCategory.trim()) return;
    if (editingTemplateId) {
      onUpdateReasonTemplate(editingTemplateId, {
        name: templateName.trim(),
        value: Number(templateValue),
        transactionType: templateTransactionType,
        scene: templateScene.trim(),
        category: templateCategory.trim()
      });
      return;
    }

    onCreateReasonTemplate({
      name: templateName.trim(),
      value: Number(templateValue),
      transactionType: templateTransactionType,
      scene: templateScene.trim(),
      category: templateCategory.trim()
    });
  }

  function submitClassConfig() {
    const nextClassName = classNameDraft.trim();
    const nextTimezone = timezoneDraft.trim();
    if (!nextClassName || !nextTimezone) {
      return;
    }
    if (!isValidTimeZone(nextTimezone)) {
      setClassConfigError("时区不是有效的 IANA 标识，例如 Asia/Shanghai。");
      return;
    }
    setClassConfigError("");
    onUpdateClassConfig({
      className: nextClassName,
      timezone: nextTimezone
    });
  }

  function updateDutySlot(dayCode: DutyDayCode, index: number, studentId: string) {
    setDutyDraft((current) => ({
      ...current,
      [dayCode]: current[dayCode].map((item, itemIndex) => (itemIndex === index ? studentId : item))
    }));
    if (dutyConfigError) {
      setDutyConfigError("");
    }
  }

  function appendDutySlot(dayCode: DutyDayCode) {
    setDutyDraft((current) => ({
      ...current,
      [dayCode]: [...current[dayCode], ""]
    }));
    if (dutyConfigError) {
      setDutyConfigError("");
    }
  }

  function removeDutySlot(dayCode: DutyDayCode, index: number) {
    setDutyDraft((current) => ({
      ...current,
      [dayCode]: current[dayCode].filter((_, itemIndex) => itemIndex !== index)
    }));
    if (dutyConfigError) {
      setDutyConfigError("");
    }
  }

  function submitDutyConfig() {
    const normalizedDuty = Object.fromEntries(
      DUTY_DAY_ORDER.map((dayCode) => [
        dayCode,
        dutyDraft[dayCode].map((studentId) => studentId.trim()).filter(Boolean)
      ])
    ) as Record<DutyDayCode, string[]>;

    const hasDuplicate = DUTY_DAY_ORDER.some(
      (dayCode) => new Set(normalizedDuty[dayCode]).size !== normalizedDuty[dayCode].length
    );
    if (hasDuplicate) {
      setDutyConfigError("同一天内不能重复安排同一名学生。");
      return;
    }

    setDutyConfigError("");
    onUpdateDutyConfig({
      duty: normalizedDuty
    });
  }

  function validateAndSubmitQuotes(quotes: string[]) {
    if (quotes.length > 500) {
      setQuotesConfigError("语录最多保留 500 条。");
      return;
    }

    if (quotes.some((item) => item.length > 300)) {
      setQuotesConfigError("单条语录不能超过 300 个字符。");
      return;
    }

    setQuotesConfigError("");
    onUpdateQuotes({
      quotes
    });
  }

  function submitQuotesConfig() {
    const quotes = quotesDraft
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    validateAndSubmitQuotes(quotes);
  }

  function downloadJsonFile(filename: string, payload: unknown) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8"
    });
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(objectUrl);
  }

  function handleExportStudentsExcel() {
    const rows = students.map((student) => ({
      姓名: student.name,
      性别: student.gender === "M" ? "男" : student.gender === "F" ? "女" : "",
      状态: student.status,
      排序: student.sortOrder,
      小组: student.primaryGroup?.name || "",
      宿舍: student.primaryDorm?.name || ""
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "学生名单");
    XLSX.writeFile(workbook, `学生名单_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportPointsExcel() {
    const rows = students.map((student) => ({
      姓名: student.name,
      状态: student.status,
      排序: student.sortOrder,
      小组: student.primaryGroup?.name || "",
      宿舍: student.primaryDorm?.name || "",
      总分: student.account?.totalPoints || "0",
      余额: student.account?.balancePoints || "0",
      罚分: student.account?.penaltyPoints || "0"
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "积分数据");
    XLSX.writeFile(workbook, `积分数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportLegacyTreasureExcel() {
    const legacyCompat = settings?.classConfig?.legacyCompat ?? createEmptyLegacyCompatData();
    const treasureRows = legacyCompat.shop.treasures.map((item) => ({
      ID: item.id,
      名称: item.name,
      稀有度: item.rarity,
      价格: item.price,
      库存: item.stock,
      描述: item.desc,
      阶梯价格: item.ladderPrices.join("/"),
      每日限购: item.dailyLimit
    }));
    const storageRows = Object.entries(legacyCompat.shop.storage || {}).flatMap(([studentId, itemMap]) => {
      const studentName = students.find((student) => student.id === studentId)?.name || studentId;
      return Object.entries(itemMap || {}).map(([treasureId, count]) => ({
        学生: studentName,
        物品: legacyCompat.shop.treasures.find((item) => item.id === treasureId)?.name || treasureId,
        数量: count
      }));
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(treasureRows), "宝物库存");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(storageRows), "学生储物箱");
    XLSX.writeFile(workbook, `藏宝阁数据_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleImportLegacyTreasureExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const currentLegacyCompat = cloneLegacyCompatData(settings?.classConfig?.legacyCompat);
      const hasTreasureSheet = workbook.SheetNames.includes("宝物库存");
      const hasStorageSheet = workbook.SheetNames.includes("学生储物箱");

      if (!hasTreasureSheet && !hasStorageSheet) {
        setLegacyCompatError("未识别到“宝物库存”或“学生储物箱”工作表。");
        return;
      }

      let nextTreasures = currentLegacyCompat.shop.treasures;
      let importedTreasureCount = 0;
      if (hasTreasureSheet) {
        const treasureRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["宝物库存"]);
        const existingIdByName = new Map(currentLegacyCompat.shop.treasures.map((item) => [item.name.trim(), item.id]));
        nextTreasures = treasureRows
          .map((row, index) => {
            const name = String(row["名称"] ?? row["name"] ?? "").trim();
            if (!name) return null;
            const explicitId = String(row["ID"] ?? row["id"] ?? "").trim();
            const ladderPricesRaw = row["阶梯价格"] ?? row["ladderPrices"] ?? "";
            const ladderPrices = Array.isArray(ladderPricesRaw)
              ? ladderPricesRaw
              : String(ladderPricesRaw)
                  .split(/[\/,，\s]+/)
                  .map((item) => item.trim())
                  .filter(Boolean);
            return {
              id: explicitId || existingIdByName.get(name) || `legacy-treasure-${Date.now()}-${index}`,
              name,
              rarity: String(row["稀有度"] ?? row["rarity"] ?? "N").trim() || "N",
              price: Number(row["价格"] ?? row["price"] ?? 0) || 0,
              stock: Number(row["库存"] ?? row["stock"] ?? 0) || 0,
              desc: String(row["描述"] ?? row["desc"] ?? "").trim(),
              ladderPrices: ladderPrices.map((item) => Number(item)).filter((item) => Number.isFinite(item)),
              dailyLimit: Number(row["每日限购"] ?? row["dailyLimit"] ?? 0) || 0
            };
          })
          .filter(
            (
              item
            ): item is {
              id: string;
              name: string;
              rarity: string;
              price: number;
              stock: number;
              desc: string;
              ladderPrices: number[];
              dailyLimit: number;
            } => Boolean(item)
          );
        importedTreasureCount = nextTreasures.length;
      }

      const validTreasureIds = new Set(nextTreasures.map((item) => item.id));
      let nextStorage = currentLegacyCompat.shop.storage;
      let importedStorageCount = 0;
      if (hasStorageSheet) {
        const storageRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["学生储物箱"]);
        const studentIdByName = new Map(students.map((student) => [student.name.trim(), student.id]));
        const treasureIdByName = new Map(nextTreasures.map((item) => [item.name.trim(), item.id]));
        nextStorage = {};
        for (const row of storageRows) {
          const studentId = studentIdByName.get(String(row["学生"] ?? row["student"] ?? "").trim());
          const treasureId = treasureIdByName.get(String(row["物品"] ?? row["item"] ?? "").trim());
          const count = Number(row["数量"] ?? row["count"] ?? 0);
          if (!studentId || !treasureId || !Number.isFinite(count) || count <= 0) continue;
          if (!nextStorage[studentId]) nextStorage[studentId] = {};
          nextStorage[studentId][treasureId] = count;
          importedStorageCount += 1;
        }
      } else if (hasTreasureSheet) {
        nextStorage = Object.fromEntries(
          Object.entries(currentLegacyCompat.shop.storage || {})
            .map(([studentId, itemMap]) => [
              studentId,
              Object.fromEntries(Object.entries(itemMap || {}).filter(([treasureId]) => validTreasureIds.has(treasureId)))
            ])
            .filter(([, itemMap]) => Object.keys(itemMap).length > 0)
        );
      }

      const filterCountMaps = (source: Record<string, Record<string, number>>) =>
        Object.fromEntries(
          Object.entries(source || {})
            .map(([outerKey, itemMap]) => [
              outerKey,
              Object.fromEntries(
                Object.entries(itemMap || {}).filter(
                  ([treasureId, count]) => validTreasureIds.has(treasureId) && Number.isFinite(Number(count))
                )
              )
            ])
            .filter(([, itemMap]) => Object.keys(itemMap).length > 0)
        );

      const nextLegacyCompat: LegacyCompatData = {
        ...currentLegacyCompat,
        shop: {
          ...currentLegacyCompat.shop,
          treasures: nextTreasures,
          storage: nextStorage,
          redemptionHistory: filterCountMaps(currentLegacyCompat.shop.redemptionHistory),
          dailyRedemptionCounts: filterCountMaps(currentLegacyCompat.shop.dailyRedemptionCounts),
          dailyUsageCounts: filterCountMaps(currentLegacyCompat.shop.dailyUsageCounts)
        }
      };

      setLegacyCompatError("");
      await onUpdateLegacyCompat({
        legacyCompat: nextLegacyCompat
      });
      setMaintenanceToolsError(
        `已解析藏宝阁 Excel：宝物 ${importedTreasureCount || nextTreasures.length} 条，储物箱 ${importedStorageCount} 条`
      );
    } catch (error) {
      setLegacyCompatError(error instanceof Error ? `解析藏宝阁 Excel 失败：${error.message}` : "解析藏宝阁 Excel 失败。");
    }
  }

  async function handleImportAttendanceExcelFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await onImportAttendanceExcel(file);
  }

  async function handleImportPointsExcelFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    await onImportPointsExcel(file);
  }

  function handleExportQuotesExcel() {
    const rows = (settings?.classConfig?.quotes || []).map((item) => ({
      内容: item
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, "励志语录");
    XLSX.writeFile(workbook, `励志语录_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function handleExportSystemConfigJson() {
    if (!exportedMaintenanceConfig) return;
    downloadJsonFile(`system_config_${new Date().toISOString().slice(0, 10)}.json`, exportedMaintenanceConfig);
  }

  async function handleImportSystemConfigJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      setMaintenanceToolsError("");
      await onImportMaintenanceConfig({
        config: parsed
      });
    } catch (error) {
      setMaintenanceToolsError(error instanceof Error ? `解析配置 JSON 失败：${error.message}` : "解析配置 JSON 失败。");
    }
  }

  async function handleRestoreStructuredBackupJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      setMaintenanceToolsError("");
      await onRestoreStructuredBackup({
        backup: parsed
      });
    } catch (error) {
      setMaintenanceToolsError(error instanceof Error ? `解析全量备份 JSON 失败：${error.message}` : "解析全量备份 JSON 失败。");
    }
  }

  function handleRebuildPointAccounts() {
    setMaintenanceToolsError("");
    void onRebuildPointAccountsFromHistory();
  }

  function handleFixPointAccount() {
    if (!pointFixStudentId) {
      setPointFixError("请先选择要修正的学生。");
      return;
    }

    const totalPoints = Number(pointFixTotalPoints);
    const balancePoints = Number(pointFixBalancePoints);
    const penaltyPoints = Number(pointFixPenaltyPoints);
    if (!Number.isFinite(totalPoints) || !Number.isFinite(balancePoints) || !Number.isFinite(penaltyPoints)) {
      setPointFixError("请输入有效数字。");
      return;
    }
    if (penaltyPoints < 0) {
      setPointFixError("罚分不能为负数。");
      return;
    }

    setPointFixError("");
    void onFixPointAccount({
      studentId: pointFixStudentId,
      totalPoints,
      balancePoints,
      penaltyPoints
    });
  }

  function buildCurrentSnapshotRecord(label: string): MaintenanceSnapshotRecord | null {
    if (!exportedMaintenanceConfig) return null;
    return {
      id: `maintenance-snapshot-${Date.now()}`,
      label,
      createdAt: new Date().toISOString(),
      config: exportedMaintenanceConfig,
      students: exportedMaintenanceStudents
    };
  }

  function handleCreateMaintenanceSnapshot() {
    const label = (window.prompt("请输入快照名称", `手动快照 ${new Date().toLocaleString("zh-CN")}`) || "").trim();
    if (!label) return;
    const nextRecord = buildCurrentSnapshotRecord(label);
    if (!nextRecord) {
      setMaintenanceToolsError("当前没有可保存的配置数据。");
      return;
    }
    setSnapshotRecords((current) => [nextRecord, ...current].slice(0, 10));
    setSelectedSnapshotId(nextRecord.id);
    setMaintenanceToolsError("");
  }

  async function handleRestoreSelectedSnapshot() {
    const snapshot = snapshotRecords.find((item) => item.id === selectedSnapshotId);
    if (!snapshot) {
      setMaintenanceToolsError("请先选择一个快照。");
      return;
    }
    setMaintenanceToolsError("");
    await onRestoreMaintenanceSnapshot({
      config: snapshot.config,
      students: snapshot.students
    });
  }

  async function handleToggleMaintenanceTestMode() {
    if (!maintenanceTestMode) {
      const snapshot = buildCurrentSnapshotRecord(`测试模式入口 ${new Date().toLocaleString("zh-CN")}`);
      if (!snapshot) {
        setMaintenanceToolsError("当前没有可保存的配置数据，无法进入测试模式。");
        return;
      }
      writeStorage(STORAGE_KEYS.maintenanceTestSnapshot, JSON.stringify(snapshot));
      setMaintenanceTestMode(true);
      setMaintenanceToolsError("");
      return;
    }

    const rawSnapshot = readStorage(STORAGE_KEYS.maintenanceTestSnapshot);
    if (!rawSnapshot) {
      setMaintenanceTestMode(false);
      writeStorage(STORAGE_KEYS.maintenanceTestSnapshot, "");
      return;
    }

    try {
      const snapshot = JSON.parse(rawSnapshot) as MaintenanceSnapshotRecord;
      const restored = await onRestoreMaintenanceSnapshot({
        config: snapshot.config,
        students: snapshot.students,
        skipConfirm: true
      });
      if (restored) {
        setMaintenanceTestMode(false);
        writeStorage(STORAGE_KEYS.maintenanceTestSnapshot, "");
        setMaintenanceToolsError("");
      }
    } catch (error) {
      setMaintenanceToolsError(error instanceof Error ? `退出测试模式失败：${error.message}` : "退出测试模式失败。");
    }
  }

  function normalizeImportedGender(value: unknown) {
    const raw = value == null ? "" : String(value).trim();
    if (!raw) return null;
    if (raw === "男" || raw.toUpperCase() === "M") return "M";
    if (raw === "女" || raw.toUpperCase() === "F") return "F";
    return null;
  }

  function parseImportedStudentRows(rows: Record<string, unknown>[]) {
    if (!rows.length) {
      return [];
    }
    const headers = Object.keys(rows[0] || {});
    const nameKey = headers.find((key) => key.includes("姓名") || key.toLowerCase().includes("name"));
    const genderKey = headers.find((key) => key.includes("性别") || key.toLowerCase().includes("gender"));
    const statusKey = headers.find((key) => key.includes("状态") || key.toLowerCase().includes("status"));
    const sortOrderKey = headers.find(
      (key) => key.includes("排序") || key.includes("序号") || key.toLowerCase().includes("sort")
    );
    const groupKey = headers.find((key) => key.includes("小组") || key.toLowerCase().includes("group"));
    const dormKey = headers.find((key) => key.includes("宿舍") || key.toLowerCase().includes("dorm"));

    if (!nameKey) {
      throw new Error("表头中缺少“姓名”列");
    }

    return rows
      .map((row, index) => {
        const name = row[nameKey] == null ? "" : String(row[nameKey]).trim();
        if (!name) return null;
        const sortOrderRaw = sortOrderKey ? Number(row[sortOrderKey]) : Number.NaN;
        return {
          name,
          gender: genderKey ? normalizeImportedGender(row[genderKey]) : null,
          status: statusKey ? (row[statusKey] == null ? null : String(row[statusKey]).trim() || null) : null,
          sortOrder: Number.isFinite(sortOrderRaw) ? sortOrderRaw : index + 1,
          groupName: groupKey ? (row[groupKey] == null ? null : String(row[groupKey]).trim() || null) : null,
          dormName: dormKey ? (row[dormKey] == null ? null : String(row[dormKey]).trim() || null) : null
        };
      })
      .filter(
        (
          item
        ): item is {
          name: string;
          gender: string | null;
          status: string | null;
          sortOrder: number;
          groupName: string | null;
          dormName: string | null;
        } => Boolean(item)
      );
  }

  async function handleImportStudentsExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const items = parseImportedStudentRows(rows);
      if (!items.length) {
        setMaintenanceToolsError("学生表为空，未找到可导入记录。");
        return;
      }
      const duplicateNames = items
        .map((item) => item.name)
        .filter((name, index, list) => list.indexOf(name) !== index);
      if (duplicateNames.length > 0) {
        setMaintenanceToolsError(`导入失败：存在重复学生姓名 ${Array.from(new Set(duplicateNames)).slice(0, 5).join(" / ")}`);
        return;
      }
      setMaintenanceToolsError("");
      onImportStudentRoster({
        mode: studentImportMode,
        items
      });
    } catch (error) {
      setMaintenanceToolsError(error instanceof Error ? `解析学生表失败：${error.message}` : "解析学生表失败。");
    }
  }

  async function handleImportQuotesExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) {
        setMaintenanceToolsError("语录表为空，未找到可导入内容。");
        return;
      }
      const headers = Object.keys(rows[0] || {});
      const contentKey = headers.find((key) => key.includes("内容") || key.toLowerCase().includes("content")) || headers[0];
      const quotes = rows
        .map((row) => (contentKey ? String(row[contentKey] ?? "").trim() : ""))
        .filter((item) => item.length > 0);
      if (!quotes.length) {
        setMaintenanceToolsError("语录表为空，未找到可导入内容。");
        return;
      }
      setMaintenanceToolsError("");
      setQuotesDraft(quotes.join("\n"));
      validateAndSubmitQuotes(quotes);
    } catch (error) {
      setMaintenanceToolsError(error instanceof Error ? `解析语录表失败：${error.message}` : "解析语录表失败。");
    }
  }

  function submitLegacyCompat() {
    try {
      const parsed = JSON.parse(legacyCompatDraft);
      if (parsed !== null && (typeof parsed !== "object" || Array.isArray(parsed))) {
        setLegacyCompatError("旧系统兼容数据必须是 JSON 对象或 null。");
        return;
      }

      setLegacyCompatError("");
      onUpdateLegacyCompat({
        legacyCompat: parsed
      });
    } catch {
      setLegacyCompatError("旧系统兼容数据不是有效的 JSON。");
    }
  }

  function updateGroupDraft(index: number, patch: Partial<GroupDraft>) {
    setGroupDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    if (groupConfigError) {
      setGroupConfigError("");
    }
  }

  function appendGroupDraft() {
    setGroupDrafts((current) => [
      ...current,
      {
        id: "",
        legacyKey: "",
        name: "新小组",
        colorToken: "",
        isActive: true,
        membersCount: 0
      }
    ]);
    if (groupConfigError) {
      setGroupConfigError("");
    }
  }

  function moveGroupDraft(index: number, direction: -1 | 1) {
    setGroupDrafts((current) => moveDraftItem(current, index, direction));
    if (groupConfigError) {
      setGroupConfigError("");
    }
  }

  function removeNewGroupDraft(index: number) {
    setGroupDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (groupConfigError) {
      setGroupConfigError("");
    }
  }

  function submitGroups() {
    const groups = groupDrafts
      .map((item) => ({
        id: item.id.trim(),
        legacyKey: item.legacyKey.trim(),
        name: item.name.trim(),
        colorToken: item.colorToken.trim(),
        isActive: item.isActive
      }))
      .filter((item) => item.id || item.legacyKey || item.name || item.colorToken);

    if (groups.some((item) => !item.name)) {
      setGroupConfigError("小组名称不能为空。");
      return;
    }
    if (new Set(groups.map((item) => item.name)).size !== groups.length) {
      setGroupConfigError("小组名称不能重复。");
      return;
    }

    const legacyKeys = groups.map((item) => item.legacyKey).filter(Boolean);
    if (new Set(legacyKeys).size !== legacyKeys.length) {
      setGroupConfigError("小组旧键不能重复。");
      return;
    }

    setGroupConfigError("");
    onUpdateGroups({
      groups: groups.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        legacyKey: item.legacyKey || null,
        name: item.name,
        colorToken: item.colorToken || null,
        isActive: item.isActive
      }))
    });
  }

  function updateDormitoryDraft(index: number, patch: Partial<DormitoryDraft>) {
    setDormitoryDrafts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
    if (dormitoryConfigError) {
      setDormitoryConfigError("");
    }
  }

  function appendDormitoryDraft() {
    setDormitoryDrafts((current) => [
      ...current,
      {
        id: "",
        legacyKey: "",
        name: "新宿舍",
        building: "",
        genderScope: "",
        isActive: true,
        membersCount: 0
      }
    ]);
    if (dormitoryConfigError) {
      setDormitoryConfigError("");
    }
  }

  function moveDormitoryDraft(index: number, direction: -1 | 1) {
    setDormitoryDrafts((current) => moveDraftItem(current, index, direction));
    if (dormitoryConfigError) {
      setDormitoryConfigError("");
    }
  }

  function removeNewDormitoryDraft(index: number) {
    setDormitoryDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (dormitoryConfigError) {
      setDormitoryConfigError("");
    }
  }

  function submitDormitories() {
    const dormitories = dormitoryDrafts
      .map((item) => ({
        id: item.id.trim(),
        legacyKey: item.legacyKey.trim(),
        name: item.name.trim(),
        building: item.building.trim(),
        genderScope: item.genderScope.trim(),
        isActive: item.isActive
      }))
      .filter((item) => item.id || item.legacyKey || item.name || item.building || item.genderScope);

    if (dormitories.some((item) => !item.name)) {
      setDormitoryConfigError("宿舍名称不能为空。");
      return;
    }
    if (new Set(dormitories.map((item) => item.name)).size !== dormitories.length) {
      setDormitoryConfigError("宿舍名称不能重复。");
      return;
    }

    const legacyKeys = dormitories.map((item) => item.legacyKey).filter(Boolean);
    if (new Set(legacyKeys).size !== legacyKeys.length) {
      setDormitoryConfigError("宿舍旧键不能重复。");
      return;
    }

    setDormitoryConfigError("");
    onUpdateDormitories({
      dormitories: dormitories.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        legacyKey: item.legacyKey || null,
        name: item.name,
        building: item.building || null,
        genderScope: item.genderScope || null,
        isActive: item.isActive
      }))
    });
  }

  function updatePositionDraft(index: number, patch: Partial<PositionDraft>) {
    setPositionDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    if (positionConfigError) {
      setPositionConfigError("");
    }
  }

  function appendPositionDraft() {
    setPositionDrafts((current) => [
      ...current,
      {
        id: "",
        code: `position_${Date.now()}_${current.length + 1}`,
        name: "新岗位",
        category: positionCategoryOptions[0] || "commissioner",
        isActive: true,
        holdersCount: 0
      }
    ]);
    if (positionConfigError) {
      setPositionConfigError("");
    }
  }

  function movePositionDraft(index: number, direction: -1 | 1) {
    setPositionDrafts((current) => moveDraftItem(current, index, direction));
    if (positionConfigError) {
      setPositionConfigError("");
    }
  }

  function removeNewPositionDraft(index: number) {
    setPositionDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (positionConfigError) {
      setPositionConfigError("");
    }
  }

  function submitPositions() {
    const positions = positionDrafts
      .map((item) => ({
        id: item.id.trim(),
        code: item.code.trim(),
        name: item.name.trim(),
        category: item.category.trim(),
        isActive: item.isActive
      }))
      .filter((item) => item.id || item.code || item.name || item.category);

    if (positions.some((item) => !item.code || !item.name || !item.category)) {
      setPositionConfigError("岗位编码、名称和分类不能为空。");
      return;
    }
    if (new Set(positions.map((item) => item.code)).size !== positions.length) {
      setPositionConfigError("岗位编码不能重复。");
      return;
    }

    setPositionConfigError("");
    onUpdatePositions({
      positions: positions.map((item) => ({
        ...(item.id ? { id: item.id } : {}),
        code: item.code,
        name: item.name,
        category: item.category,
        isActive: item.isActive
      }))
    });
  }

  function updateStudentStatusDraft(index: number, patch: Partial<StudentStatusDraft>) {
    setStudentStatusDrafts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
    if (studentStatusConfigError) {
      setStudentStatusConfigError("");
    }
  }

  function moveStudentStatusDraft(index: number, direction: -1 | 1) {
    setStudentStatusDrafts((current) => moveDraftItem(current, index, direction));
    if (studentStatusConfigError) {
      setStudentStatusConfigError("");
    }
  }

  function appendStudentStatusDraft() {
    setStudentStatusDrafts((current) => [
      ...current,
      {
        value: `custom_status_${Date.now()}_${current.length + 1}`,
        label: "新状态",
        participatesInDailyFlow: false,
        isPreset: false
      }
    ]);
    if (studentStatusConfigError) {
      setStudentStatusConfigError("");
    }
  }

  function removeStudentStatusDraft(index: number) {
    const target = studentStatusDrafts[index];
    if (!target || target.isPreset) {
      return;
    }
    const currentCount = studentStatusCountMap.get(target.value.trim()) || 0;
    if (currentCount > 0) {
      setStudentStatusConfigError("仍有学生正在使用该状态，请先调整学生状态后再删除字典项。");
      return;
    }
    setStudentStatusDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (studentStatusConfigError) {
      setStudentStatusConfigError("");
    }
  }

  function submitStudentStatusConfig() {
    const studentStatusOptions = studentStatusDrafts
      .map((item) => ({
        value: item.value.trim(),
        label: item.label.trim(),
        participatesInDailyFlow: item.participatesInDailyFlow
      }))
      .filter((item) => item.value || item.label);

    if (!studentStatusOptions.length) {
      setStudentStatusConfigError("至少需要保留 1 个学生状态。");
      return;
    }
    if (studentStatusOptions.some((item) => !item.value || !item.label)) {
      setStudentStatusConfigError("学生状态编码和显示名称不能为空。");
      return;
    }
    if (new Set(studentStatusOptions.map((item) => item.value)).size !== studentStatusOptions.length) {
      setStudentStatusConfigError("学生状态编码不能重复。");
      return;
    }

    setStudentStatusConfigError("");
    onUpdateStudentStatusConfig({
      studentStatusOptions
    });
  }

  function updateSubjectDraft(index: number, patch: Partial<SubjectDraft>) {
    setSubjectDrafts((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
    if (subjectConfigError) {
      setSubjectConfigError("");
    }
  }

  function updateSubjectRepresentative(index: number, slot: 0 | 1, studentId: string) {
    setSubjectDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              representativeStudentIds:
                slot === 0
                  ? [studentId, item.representativeStudentIds[1]]
                  : [item.representativeStudentIds[0], studentId]
            }
          : item
      )
    );
    if (subjectConfigError) {
      setSubjectConfigError("");
    }
  }

  function appendSubjectDraft() {
    setSubjectDrafts((current) => [
      ...current,
      {
        id: `subject_${Date.now()}_${current.length + 1}`,
        name: "新学科",
        representativeStudentIds: ["", ""]
      }
    ]);
    if (subjectConfigError) {
      setSubjectConfigError("");
    }
  }

  function removeSubjectDraft(index: number) {
    setSubjectDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (subjectConfigError) {
      setSubjectConfigError("");
    }
  }

  function submitSubjectConfig() {
    const subjects = subjectDrafts
      .map((item) => ({
        id: item.id.trim(),
        name: item.name.trim(),
        representativeStudentIds: item.representativeStudentIds.map((studentId) => studentId.trim()).filter(Boolean)
      }))
      .filter((item) => item.id || item.name || item.representativeStudentIds.length);

    if (subjects.some((item) => !item.id || !item.name)) {
      setSubjectConfigError("学科 id 和名称不能为空。");
      return;
    }

    if (new Set(subjects.map((item) => item.id)).size !== subjects.length) {
      setSubjectConfigError("学科 id 不能重复。");
      return;
    }

    if (new Set(subjects.map((item) => item.name)).size !== subjects.length) {
      setSubjectConfigError("学科名称不能重复。");
      return;
    }

    if (subjects.some((item) => item.representativeStudentIds.length > 2)) {
      setSubjectConfigError("每个学科最多设置 2 名课代表。");
      return;
    }

    if (
      subjects.some(
        (item) => new Set(item.representativeStudentIds).size !== item.representativeStudentIds.length
      )
    ) {
      setSubjectConfigError("同一学科的课代表不能重复。");
      return;
    }

    setSubjectConfigError("");
    onUpdateSubjectConfig({
      subjects
    });
  }

  function toggleWageGroup(groupId: string, checked: boolean) {
    setDailyWageGroupIdsDraft((current) =>
      checked ? Array.from(new Set([...current, groupId])) : current.filter((item) => item !== groupId)
    );
    if (wageConfigError) {
      setWageConfigError("");
    }
  }

  function updatePsychologyCommitteeSlot(index: number, studentId: string) {
    setPsychologyCommitteeDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? studentId : item))
    );
    if (wageConfigError) {
      setWageConfigError("");
    }
  }

  function updateStudentCouncilRole(index: number, patch: Partial<StudentCouncilRoleDraft>) {
    setStudentCouncilRolesDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
    if (wageConfigError) {
      setWageConfigError("");
    }
  }

  function appendStudentCouncilRole() {
    setStudentCouncilRolesDraft((current) => [
      ...current,
      {
        id: `student_council_${Date.now()}_${current.length + 1}`,
        name: "新职位",
        studentId: ""
      }
    ]);
    if (wageConfigError) {
      setWageConfigError("");
    }
  }

  function removeStudentCouncilRole(index: number) {
    setStudentCouncilRolesDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
    if (wageConfigError) {
      setWageConfigError("");
    }
  }

  function submitWageConfig() {
    const dailyWageAmount = Number(dailyWageAmountDraft);
    if (!Number.isFinite(dailyWageAmount) || dailyWageAmount < 0 || dailyWageAmount > 1000) {
      setWageConfigError("每日工资基础分必须是 0 到 1000 之间的数字。");
      return;
    }

    const psychologyCommitteeStudentIds = psychologyCommitteeDraft.map((item) => item.trim()).filter(Boolean);
    if (new Set(psychologyCommitteeStudentIds).size !== psychologyCommitteeStudentIds.length) {
      setWageConfigError("心理委员配置中不能重复选择同一名学生。");
      return;
    }

    const studentCouncilRoles = studentCouncilRolesDraft
      .map((item) => ({
        id: item.id.trim(),
        name: item.name.trim(),
        studentId: item.studentId.trim() || null
      }))
      .filter((item) => item.id || item.name || item.studentId);

    if (studentCouncilRoles.some((item) => !item.id || !item.name)) {
      setWageConfigError("学生会职位的 id 和名称不能为空。");
      return;
    }

    if (new Set(studentCouncilRoles.map((item) => item.id)).size !== studentCouncilRoles.length) {
      setWageConfigError("学生会职位 id 不能重复。");
      return;
    }

    setWageConfigError("");
    onUpdateWageConfig({
      dailyWageAmount,
      dailyWageGroupIds: dailyWageGroupIdsDraft,
      psychologyCommitteeStudentIds,
      studentCouncilRoles
    });
  }

  function submitScheduleNotes() {
    try {
      const parsed = JSON.parse(scheduleNotesDraft);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        setScheduleNotesError("课程备注必须是 JSON 对象，格式如 {\"morning\":\"语文早读\"}。");
        return;
      }

      if (Object.values(parsed).some((value) => typeof value !== "string")) {
        setScheduleNotesError("课程备注的每个值都必须是字符串。");
        return;
      }

      const parsedNotes = parsed as Record<string, string>;
      const normalizedEntries = Object.entries(parsedNotes).map(([key, value]) => [key.trim(), value.trim()] as const);
      const normalized = Object.fromEntries(normalizedEntries);

      if (Object.keys(normalized).some((key) => !key)) {
        setScheduleNotesError("课程备注键名不能为空。");
        return;
      }
      if (new Set(normalizedEntries.map(([key]) => key)).size !== normalizedEntries.length) {
        setScheduleNotesError("课程备注键名不能重复。");
        return;
      }

      setScheduleNotesError("");
      onUpdateScheduleNotes({
        scheduleNotes: normalized
      });
    } catch {
      setScheduleNotesError("课程备注不是有效的 JSON。");
    }
  }

  function submitCountdownEvents() {
    try {
      const parsed = JSON.parse(countdownEventsDraft);
      if (!Array.isArray(parsed)) {
        setCountdownEventsError("倒计时事件必须是 JSON 数组。");
        return;
      }

      const normalized = parsed.map((item, index) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) {
          throw new Error(`第 ${index + 1} 条倒计时不是对象。`);
        }
        const row = item as Record<string, unknown>;
        const id = row.id == null ? "" : String(row.id).trim();
        const title = row.title == null ? "" : String(row.title).trim();
        const date = row.date == null ? "" : String(row.date).trim();
        const note = row.note == null ? "" : String(row.note).trim();
        if (!title) {
          throw new Error(`第 ${index + 1} 条倒计时缺少 title。`);
        }
        if (date && !isValidIsoDate(date)) {
          throw new Error(`第 ${index + 1} 条倒计时日期无效，需使用 YYYY-MM-DD。`);
        }

        return {
          ...(id ? { id } : {}),
          title,
          ...(date ? { date } : {}),
          ...(note ? { note } : {})
        };
      });

      setCountdownEventsError("");
      onUpdateCountdownEvents({
        countdownEvents: normalized
      });
    } catch (error) {
      setCountdownEventsError(error instanceof Error ? error.message : "倒计时事件不是有效的 JSON。");
    }
  }

  function updateCountdownEventItem(index: number, patch: Partial<CountdownEventEditorItem>) {
    const nextItems = countdownEventEditorItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    writeCountdownEventsDraft(nextItems);
  }

  function removeCountdownEventItem(index: number) {
    writeCountdownEventsDraft(countdownEventEditorItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveCountdownEventItem(index: number, direction: -1 | 1) {
    writeCountdownEventsDraft(moveDraftItem(countdownEventEditorItems, index, direction));
  }

  function resetCountdownEventDragState() {
    setDraggingCountdownEventIndex(null);
    setDragOverCountdownEventIndex(null);
  }

  function startCountdownEventDrag(event: DragEvent<HTMLSpanElement>, index: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDraggingCountdownEventIndex(index);
    setDragOverCountdownEventIndex(index);
  }

  function handleCountdownEventDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    if (draggingCountdownEventIndex === null) return;
    event.preventDefault();
    if (dragOverCountdownEventIndex !== index) {
      setDragOverCountdownEventIndex(index);
    }
  }

  function dropCountdownEventItem(index: number) {
    if (draggingCountdownEventIndex === null) {
      return;
    }

    if (draggingCountdownEventIndex !== index) {
      writeCountdownEventsDraft(moveDraftItemToIndex(countdownEventEditorItems, draggingCountdownEventIndex, index));
    }
    resetCountdownEventDragState();
  }

  function appendCountdownEventItem() {
    if (!newCountdownEventTitle.trim()) {
      setCountdownEventsError("新增倒计时时必须填写标题。");
      return;
    }
    writeCountdownEventsDraft([
      ...countdownEventEditorItems,
      {
        id: newCountdownEventId.trim(),
        title: newCountdownEventTitle.trim(),
        date: newCountdownEventDate.trim(),
        note: newCountdownEventNote.trim()
      }
    ]);
    setNewCountdownEventId("");
    setNewCountdownEventTitle("");
    setNewCountdownEventDate("");
    setNewCountdownEventNote("");
  }

  function updateScheduleNoteItem(index: number, patch: Partial<ScheduleNoteEditorItem>) {
    const nextItems = scheduleNoteEditorItems.map((item, itemIndex) =>
      itemIndex === index ? { ...item, ...patch } : item
    );
    const nonEmptyKeys = nextItems.map((item) => item.key.trim()).filter((item) => item.length > 0);
    if (new Set(nonEmptyKeys).size !== nonEmptyKeys.length) {
      setScheduleNotesError("课程备注键名不能重复。");
      return;
    }
    writeScheduleNotesDraft(nextItems);
  }

  function removeScheduleNoteItem(index: number) {
    writeScheduleNotesDraft(scheduleNoteEditorItems.filter((_, itemIndex) => itemIndex !== index));
  }

  function moveScheduleNoteItem(index: number, direction: -1 | 1) {
    writeScheduleNotesDraft(moveDraftItem(scheduleNoteEditorItems, index, direction));
  }

  function resetScheduleNoteDragState() {
    setDraggingScheduleNoteIndex(null);
    setDragOverScheduleNoteIndex(null);
  }

  function startScheduleNoteDrag(event: DragEvent<HTMLSpanElement>, index: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(index));
    setDraggingScheduleNoteIndex(index);
    setDragOverScheduleNoteIndex(index);
  }

  function handleScheduleNoteDragOver(event: DragEvent<HTMLDivElement>, index: number) {
    if (draggingScheduleNoteIndex === null) return;
    event.preventDefault();
    if (dragOverScheduleNoteIndex !== index) {
      setDragOverScheduleNoteIndex(index);
    }
  }

  function dropScheduleNoteItem(index: number) {
    if (draggingScheduleNoteIndex === null) {
      return;
    }

    if (draggingScheduleNoteIndex !== index) {
      writeScheduleNotesDraft(moveDraftItemToIndex(scheduleNoteEditorItems, draggingScheduleNoteIndex, index));
    }
    resetScheduleNoteDragState();
  }

  function appendScheduleNoteItem() {
    if (!newScheduleNoteKey.trim()) {
      setScheduleNotesError("新增课程备注时必须填写键名。");
      return;
    }
    if (scheduleNoteEditorItems.some((item) => item.key.trim() === newScheduleNoteKey.trim())) {
      setScheduleNotesError("课程备注键名不能重复。");
      return;
    }
    writeScheduleNotesDraft([
      ...scheduleNoteEditorItems,
      {
        key: newScheduleNoteKey.trim(),
        value: newScheduleNoteValue
      }
    ]);
    setNewScheduleNoteKey("");
    setNewScheduleNoteValue("");
  }

  function startEditTemplate(templateId: string) {
    const template = reasonTemplates.find((item) => item.id === templateId);
    if (!template) return;

    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateValue(template.value);
    setTemplateTransactionType(template.transactionType as "bonus" | "penalty" | "reward");
    setTemplateScene(template.scene);
    setTemplateCategory(template.category);
  }

  useEffect(() => {
    if (editingTemplateId && settingsWriteMessage.includes("已更新积分模板")) {
      resetTemplateForm();
    }
  }, [editingTemplateId, settingsWriteMessage]);

  useEffect(() => {
    if (editingFeatureFlagId && settingsWriteMessage.includes("已更新功能开关配置")) {
      cancelEditFeatureFlag();
    }
  }, [editingFeatureFlagId, settingsWriteMessage]);

  useEffect(() => {
    if (editingCategoryKey && settingsWriteMessage.includes("已更新积分模板分类")) {
      cancelEditCategory();
    }
  }, [editingCategoryKey, settingsWriteMessage]);

  useEffect(() => {
    if (settingsWriteMessage.includes("已批量新增")) {
      setBatchTemplateDraft("[]");
      setBatchTemplateErrors([]);
      setBatchTemplatePreview([]);
    }
  }, [settingsWriteMessage]);

  useEffect(() => {
    if (batchTemplateFormat === "json") {
      setBatchTemplateColumns([]);
      setBatchTemplateColumnMap({
        name: "",
        value: "",
        transactionType: "",
        scene: "",
        category: ""
      });
      return;
    }
    const delimiter = batchTemplateFormat === "csv" ? "," : "\t";
    const lines = batchTemplateDraft
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!lines.length) {
      setBatchTemplateColumns([]);
      return;
    }
    const headerCells = lines[0].split(delimiter).map((cell) => cell.trim());
    const columnCount = headerCells.length;
    const columnNames = batchTemplateHasHeader
      ? headerCells
      : Array.from({ length: columnCount }, (_, index) => `col_${index + 1}`);
    setBatchTemplateColumns(columnNames);

    if (batchTemplateHasHeader) {
      const lower = columnNames.map((name) => name.toLowerCase());
      const nextMap = {
        name: columnNames[lower.indexOf("name")] || "",
        value: columnNames[lower.indexOf("value")] || "",
        transactionType: columnNames[lower.indexOf("transactiontype")] || "",
        scene: columnNames[lower.indexOf("scene")] || "",
        category: columnNames[lower.indexOf("category")] || ""
      };
      setBatchTemplateColumnMap((current) => ({
        name: current.name || nextMap.name,
        value: current.value || nextMap.value,
        transactionType: current.transactionType || nextMap.transactionType,
        scene: current.scene || nextMap.scene,
        category: current.category || nextMap.category
      }));
    } else if (!batchTemplateColumnMap.name && columnNames.length >= 5) {
      setBatchTemplateColumnMap({
        name: columnNames[0] || "",
        value: columnNames[1] || "",
        transactionType: columnNames[2] || "",
        scene: columnNames[3] || "",
        category: columnNames[4] || ""
      });
    }
  }, [batchTemplateDraft, batchTemplateFormat, batchTemplateHasHeader]);

  useEffect(() => {
    setClassNameDraft(settings?.classConfig?.className || "");
    setTimezoneDraft(settings?.classConfig?.timezone || "Asia/Shanghai");
    setClassConfigError("");
  }, [settings?.classConfig?.className, settings?.classConfig?.timezone]);

  useEffect(() => {
    const nextDuty = settings?.classConfig?.duty;
    setDutyDraft({
      mon: nextDuty?.mon?.length ? nextDuty.mon : ["", ""],
      tue: nextDuty?.tue?.length ? nextDuty.tue : [""],
      wed: nextDuty?.wed?.length ? nextDuty.wed : [""],
      thu: nextDuty?.thu?.length ? nextDuty.thu : [""],
      fri: nextDuty?.fri?.length ? nextDuty.fri : [""]
    });
    setDutyConfigError("");
  }, [settings?.classConfig?.duty]);

  useEffect(() => {
    setQuotesDraft((settings?.classConfig?.quotes || []).join("\n"));
    setQuotesConfigError("");
  }, [settings?.classConfig?.quotes]);

  useEffect(() => {
    setLegacyCompatDraft(JSON.stringify(settings?.classConfig?.legacyCompat || null, null, 2));
    setLegacyCompatError("");
  }, [settings?.classConfig?.legacyCompat]);

  useEffect(() => {
    setGroupDrafts(
      (settings?.groups || []).map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey || "",
        name: item.name,
        colorToken: item.colorToken || "",
        isActive: item.isActive,
        membersCount: item.membersCount
      }))
    );
    setGroupConfigError("");
  }, [settings?.groups]);

  useEffect(() => {
    setDormitoryDrafts(
      (settings?.dormitories || []).map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey || "",
        name: item.name,
        building: item.building || "",
        genderScope: item.genderScope || "",
        isActive: item.isActive,
        membersCount: item.membersCount
      }))
    );
    setDormitoryConfigError("");
  }, [settings?.dormitories]);

  useEffect(() => {
    setPositionDrafts(
      (settings?.positions || []).map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        isActive: item.isActive,
        holdersCount: item.holdersCount
      }))
    );
    setPositionConfigError("");
  }, [settings?.positions]);

  useEffect(() => {
    setStudentStatusDrafts(createStudentStatusDrafts(settings?.classConfig?.studentStatusOptions));
    setStudentStatusConfigError("");
  }, [settings?.classConfig?.studentStatusOptions]);

  useEffect(() => {
    setSubjectDrafts(
      (settings?.classConfig?.subjects || []).map((item) => ({
        id: item.id,
        name: item.name,
        representativeStudentIds: [item.representativeStudentIds[0] || "", item.representativeStudentIds[1] || ""]
      }))
    );
    setSubjectConfigError("");
  }, [settings?.classConfig?.subjects]);

  useEffect(() => {
    setDailyWageAmountDraft(String(settings?.classConfig?.dailyWageAmount ?? 5));
    setDailyWageGroupIdsDraft(settings?.classConfig?.dailyWageGroupIds || []);
    setPsychologyCommitteeDraft(
      Array.from(
        {
          length: Math.max(
            MIN_PSYCHOLOGY_COMMITTEE_SLOTS,
            settings?.classConfig?.psychologyCommitteeStudentIds?.length || 0
          )
        },
        (_, index) => settings?.classConfig?.psychologyCommitteeStudentIds?.[index] || ""
      )
    );
    setStudentCouncilRolesDraft(
      (settings?.classConfig?.studentCouncilRoles || []).map((item) => ({
        id: item.id,
        name: item.name,
        studentId: item.studentId || ""
      }))
    );
    setWageConfigError("");
  }, [
    settings?.classConfig?.dailyWageAmount,
    settings?.classConfig?.dailyWageGroupIds,
    settings?.classConfig?.psychologyCommitteeStudentIds,
    settings?.classConfig?.studentCouncilRoles
  ]);

  useEffect(() => {
    setCountdownEventsDraft(JSON.stringify(settings?.classConfig?.countdownEvents || [], null, 2));
    setCountdownEventsError("");
    setNewCountdownEventId("");
    setNewCountdownEventTitle("");
    setNewCountdownEventDate("");
    setNewCountdownEventNote("");
    resetCountdownEventDragState();
  }, [settings?.classConfig?.countdownEvents]);

  useEffect(() => {
    setScheduleNotesDraft(JSON.stringify(settings?.classConfig?.scheduleNotes || {}, null, 2));
    setScheduleNotesError("");
    setNewScheduleNoteKey("");
    setNewScheduleNoteValue("");
    resetScheduleNoteDragState();
  }, [settings?.classConfig?.scheduleNotes]);

  useEffect(() => {
    if (!batchTemplateDraft.trim()) {
      setBatchTemplateErrors([]);
      setBatchTemplatePreview([]);
      return;
    }
    const review = reviewBatchTemplates(batchTemplateDraft, batchTemplateFormat);
    setBatchTemplateErrors(review.errors);
    setBatchTemplatePreview(review.preview);
  }, [
    batchTemplateDraft,
    batchTemplateFormat,
    batchTemplateHasHeader,
    batchTemplateColumns,
    batchTemplateColumnMap,
    reasonTemplates
  ]);

  useEffect(() => {
    if (!editingFeatureFlagId) return;
    const featureFlag = settings?.featureFlags.find((item) => item.id === editingFeatureFlagId);
    if (!featureFlag) {
      setEditingFeatureFlagId("");
      setFeatureFlagConfigDraft("{}");
      setFeatureFlagConfigError("");
      setNewFeatureFlagConfigKey("");
      setNewFeatureFlagConfigType("string");
      setNewFeatureFlagConfigValue("");
      return;
    }
    setFeatureFlagConfigDraft(JSON.stringify(featureFlag.config || {}, null, 2));
    setFeatureFlagConfigError("");
    setNewFeatureFlagConfigKey("");
    setNewFeatureFlagConfigType("string");
    setNewFeatureFlagConfigValue("");
  }, [editingFeatureFlagId, settings?.featureFlags]);

  function startEditFeatureFlag(featureFlagId: string) {
    const featureFlag = settings?.featureFlags.find((item) => item.id === featureFlagId);
    if (!featureFlag) return;
    setEditingFeatureFlagId(featureFlag.id);
    setFeatureFlagConfigDraft(JSON.stringify(featureFlag.config || {}, null, 2));
  }

  function cancelEditFeatureFlag() {
    setEditingFeatureFlagId("");
    setFeatureFlagConfigDraft("{}");
    setFeatureFlagConfigError("");
    setNewFeatureFlagConfigKey("");
    setNewFeatureFlagConfigType("string");
    setNewFeatureFlagConfigValue("");
  }

  function updateFeatureFlagConfigEntry(index: number, patch: Partial<FeatureFlagConfigDraftEntry>) {
    const nextRows = featureFlagConfigRows.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item));
    const keys = nextRows.map((item) => item.key.trim()).filter(Boolean);
    if (keys.length !== nextRows.length) {
      setFeatureFlagConfigError("功能开关配置键名不能为空。");
      return;
    }
    if (new Set(keys).size !== keys.length) {
      setFeatureFlagConfigError("功能开关配置键名不能重复。");
      return;
    }
    if (nextRows.some((item) => item.type === "number" && !item.value.trim())) {
      setFeatureFlagConfigError("数值类型不能为空。");
      return;
    }
    if (nextRows.some((item) => item.type === "number" && Number.isNaN(Number(item.value)))) {
      setFeatureFlagConfigError("数值类型必须是有效数字。");
      return;
    }
    writeFeatureFlagConfigDraft(
      nextRows.filter((item): item is FeatureFlagConfigEntry => item.type !== null)
    );
  }

  function removeFeatureFlagConfigEntry(index: number) {
    writeFeatureFlagConfigDraft(
      featureFlagConfigRows
        .filter((_, itemIndex) => itemIndex !== index)
        .filter((item): item is FeatureFlagConfigEntry => item.type !== null)
    );
  }

  function appendFeatureFlagConfigEntry() {
    const key = newFeatureFlagConfigKey.trim();
    if (!key) {
      setFeatureFlagConfigError("新增配置项时必须填写键名。");
      return;
    }
    if (featureFlagConfigRows.some((item) => item.key.trim() === key)) {
      setFeatureFlagConfigError("功能开关配置键名不能重复。");
      return;
    }
    if (newFeatureFlagConfigType === "number" && !newFeatureFlagConfigValue.trim()) {
      setFeatureFlagConfigError("数值类型不能为空。");
      return;
    }
    if (newFeatureFlagConfigType === "number" && Number.isNaN(Number(newFeatureFlagConfigValue))) {
      setFeatureFlagConfigError("数值类型必须是有效数字。");
      return;
    }
    writeFeatureFlagConfigDraft([
      ...featureFlagConfigRows.filter((item): item is FeatureFlagConfigEntry => item.type !== null),
      {
        key,
        type: newFeatureFlagConfigType,
        value: newFeatureFlagConfigValue
      }
    ]);
    setNewFeatureFlagConfigKey("");
    setNewFeatureFlagConfigType("string");
    setNewFeatureFlagConfigValue("");
  }

  function submitFeatureFlagConfig(featureFlagId: string) {
    try {
      const { parsed, entries } = parseFeatureFlagConfigDraft(featureFlagConfigDraft);
      if (entries.some((item) => item.type === null)) {
        setFeatureFlagConfigError("当前配置包含嵌套对象或数组，请改用 JSON 直接维护。");
        return;
      }
      setFeatureFlagConfigError("");
      onUpdateFeatureFlag(featureFlagId, {
        config: parsed as Record<string, unknown>
      });
    } catch {
      setFeatureFlagConfigError("功能开关配置不是有效的 JSON。");
    }
  }

  function startEditCategory(scene: string, category: string) {
    setEditingCategoryKey(`${scene}__${category}`);
    setCategorySceneDraft(scene);
    setCategoryCategoryDraft(category);
  }

  function cancelEditCategory() {
    setEditingCategoryKey("");
    setCategorySceneDraft("");
    setCategoryCategoryDraft("");
    setCategoryFormError("");
  }

  function submitCategoryUpdate(scene: string, category: string) {
    if (!categorySceneDraft.trim() || !categoryCategoryDraft.trim()) {
      setCategoryFormError("场景和类别不能为空。");
      return;
    }
    if (categorySceneDraft.trim() === scene && categoryCategoryDraft.trim() === category) {
      setCategoryFormError("分类内容未变化。");
      return;
    }
    setCategoryFormError("");
    onUpdateReasonTemplateCategory({
      scene,
      category,
      nextScene: categorySceneDraft.trim(),
      nextCategory: categoryCategoryDraft.trim()
    });
  }

  function parseBatchTemplates(input: string, format: "json" | "csv" | "tsv") {
    const errors: string[] = [];
    const items: ReasonTemplateBatchItem[] = [];

    if (format === "json") {
      try {
        const parsed = JSON.parse(input);
        if (!Array.isArray(parsed)) {
          errors.push("批量导入需要 JSON 数组。");
        } else {
          for (const raw of parsed) {
            items.push({
              name: String(raw?.name || "").trim(),
              value: Number(raw?.value),
              transactionType: raw?.transactionType,
              scene: String(raw?.scene || "").trim(),
              category: String(raw?.category || "").trim()
            });
          }
        }
      } catch {
        errors.push("批量导入内容不是有效的 JSON。");
      }
      return { items, errors };
    }

    const delimiter = format === "csv" ? "," : "\t";
    const lines = input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (!lines.length) {
      errors.push("批量导入内容为空。");
      return { items, errors };
    }

    const headerCells = lines[0].split(delimiter).map((cell) => cell.trim());
    const startIndex = batchTemplateHasHeader ? 1 : 0;
    const columns = batchTemplateHasHeader ? headerCells : batchTemplateColumns;
    const indices = {
      name: columns.indexOf(batchTemplateColumnMap.name),
      value: columns.indexOf(batchTemplateColumnMap.value),
      transactionType: columns.indexOf(batchTemplateColumnMap.transactionType),
      scene: columns.indexOf(batchTemplateColumnMap.scene),
      category: columns.indexOf(batchTemplateColumnMap.category)
    };
    if (Object.values(indices).some((value) => value === -1)) {
      errors.push("请先完成列映射。");
      return { items, errors };
    }

    for (let i = startIndex; i < lines.length; i += 1) {
      const cells = lines[i].split(delimiter).map((cell) => cell.trim());
      items.push({
        name: String(cells[indices.name] || "").trim(),
        value: Number(cells[indices.value]),
        transactionType: cells[indices.transactionType] as ReasonTemplateBatchItem["transactionType"],
        scene: String(cells[indices.scene] || "").trim(),
        category: String(cells[indices.category] || "").trim()
      });
    }

    return { items, errors };
  }

  function submitBatchTemplates() {
    const review = reviewBatchTemplates(batchTemplateDraft, batchTemplateFormat);
    setBatchTemplateErrors(review.errors);
    setBatchTemplatePreview(review.preview);
    if (review.errors.length) return;
    onCreateReasonTemplateBatch(review.items);
  }

  function moveReasonTemplate(templateId: string, direction: "up" | "down") {
    if (!reasonTemplates.length) return;
    const currentIndex = reasonTemplates.findIndex((item) => item.id === templateId);
    if (currentIndex === -1) return;
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= reasonTemplates.length) return;
    const nextOrder = reasonTemplates.map((item) => item.id);
    [nextOrder[currentIndex], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[currentIndex]];
    onReorderReasonTemplates(nextOrder);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>班级配置</h2>
        <span>{settings?.classConfig?.className || "未配置"}</span>
      </div>

      {settings ? (
        <>
          <div className="attendance-summary-strip">
            <div>
              <span>小组</span>
              <strong>{settings.totals.groups}</strong>
            </div>
            <div>
              <span>宿舍</span>
              <strong>{settings.totals.dormitories}</strong>
            </div>
            <div>
              <span>岗位</span>
              <strong>{settings.totals.positions}</strong>
            </div>
            <div>
              <span>积分模板</span>
              <strong>{settings.totals.reasonTemplates}</strong>
            </div>
          </div>

          <div className="detail-grid">
            <div>
              <span>时区</span>
              <strong>{settings.classConfig?.timezone || "-"}</strong>
            </div>
            <div>
              <span>冻结状态</span>
              <strong>{settings.classConfig?.isFrozen ? "已冻结" : "正常"}</strong>
            </div>
            <div>
              <span>倒计时事件</span>
              <strong>{settings.classConfig?.countdownEventsCount ?? 0}</strong>
            </div>
            <div>
              <span>启用功能</span>
              <strong>{settings.totals.enabledFeatures}</strong>
            </div>
          </div>

          <div className="migration-callout">
            <div className="migration-copy">
              <p className="section-kicker">配置摘要</p>
              <h3>{settings.classConfig?.isFrozen ? "当前班级处于冻结状态" : "当前班级配置可正常运行"}</h3>
              <p className="muted">
                已整理 {settings.totals.reasonTemplates} 条积分模板、{settings.totals.positions} 个岗位、
                {settings.totals.groups} 个小组和 {settings.totals.dormitories} 个宿舍配置。
              </p>
            </div>
            <div className="migration-metrics">
              <div>
                <span>启用功能</span>
                <strong>{enabledFeatureCodes.length}</strong>
              </div>
              <div>
                <span>课程备注</span>
                <strong>{settings.classConfig?.scheduleNotesCount ?? 0}</strong>
              </div>
              <div>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageSettings || updatingClassFreeze}
                  onClick={() => onUpdateClassFreeze(!(settings.classConfig?.isFrozen ?? false))}
                >
                  {updatingClassFreeze ? "提交中..." : settings.classConfig?.isFrozen ? "解除冻结" : "冻结班级"}
                </button>
              </div>
            </div>
          </div>

          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
            <div className="student-filters">
              <label>
                <span>班级名称</span>
                <input
                  value={classNameDraft}
                  onChange={(event) => {
                    setClassNameDraft(event.target.value);
                    if (classConfigError) {
                      setClassConfigError("");
                    }
                  }}
                />
              </label>
              <label>
                <span>时区</span>
                <input
                  list="common-timezones"
                  value={timezoneDraft}
                  onChange={(event) => {
                    setTimezoneDraft(event.target.value);
                    if (classConfigError) {
                      setClassConfigError("");
                    }
                  }}
                />
              </label>
            </div>
            <datalist id="common-timezones">
              {COMMON_TIMEZONES.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingClassConfig || !classNameDraft.trim() || !timezoneDraft.trim()}
                onClick={submitClassConfig}
              >
                {updatingClassConfig ? "提交中..." : "保存班级基础配置"}
              </button>
              <span className="muted">当前阶段只开放班级名称和时区，时区需填写有效 IANA 值，如 `Asia/Shanghai`。</span>
            </div>
            {classConfigError ? <p className="warning-text">{classConfigError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>值日安排</h3>
            <span>{DUTY_DAY_ORDER.reduce((total, dayCode) => total + dutyDraft[dayCode].filter(Boolean).length, 0)} 人次</span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，值日安排已暂停修改。</p> : null}
            <p className="muted">
              默认优先展示卫生组学生；如果当前班级没有识别到卫生组，会回退为全部学生。
            </p>
            <div className="transaction-list">
              {DUTY_DAY_ORDER.map((dayCode) => (
                <div key={dayCode} className="transaction-row">
                  <div>
                    <strong>{DUTY_DAY_LABELS[dayCode]}</strong>
                    <span>{dutyDraft[dayCode].filter(Boolean).length ? `${dutyDraft[dayCode].filter(Boolean).length} 人` : "未安排"}</span>
                  </div>
                  <div className="settings-inline-editor">
                    {dutyDraft[dayCode].map((studentId, index) => (
                      <div key={`${dayCode}-${index}`} className="transaction-actions">
                        <select
                          value={studentId}
                          onChange={(event) => updateDutySlot(dayCode, index, event.target.value)}
                          disabled={!canManageSettings || classFrozen || updatingDutyConfig}
                        >
                          <option value="">值日 {index + 1}</option>
                          {hygieneDutyStudentOptions.map((student) => (
                            <option
                              key={`${dayCode}-${student.id}`}
                              value={student.id}
                              disabled={dutyDraft[dayCode].some((item, itemIndex) => itemIndex !== index && item === student.id)}
                            >
                              {studentOptionLabelMap.get(student.id) || student.name}
                            </option>
                          ))}
                        </select>
                        {dutyDraft[dayCode].length > 1 ? (
                          <button
                            type="button"
                            className="inline-action-button"
                            onClick={() => removeDutySlot(dayCode, index)}
                            disabled={!canManageSettings || classFrozen || updatingDutyConfig}
                          >
                            删除
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="inline-action-button"
                      onClick={() => appendDutySlot(dayCode)}
                      disabled={!canManageSettings || classFrozen || updatingDutyConfig}
                    >
                      新增名额
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingDutyConfig}
                onClick={submitDutyConfig}
              >
                {updatingDutyConfig ? "提交中..." : "保存值日安排"}
              </button>
              <span className="muted">旧系统中的姓名值日表会逐步转成按学生 ID 管理。</span>
            </div>
            {dutyConfigError ? <p className="warning-text">{dutyConfigError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>班级语录</h3>
            <span>{settings.classConfig?.quotes.length ?? 0} 条</span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，语录配置已暂停修改。</p> : null}
            <label>
              <span>语录列表</span>
              <textarea
                rows={8}
                value={quotesDraft}
                onChange={(event) => {
                  setQuotesDraft(event.target.value);
                  if (quotesConfigError) {
                    setQuotesConfigError("");
                  }
                }}
                placeholder={"每行一条语录\n例如：行百里者半九十。"}
                disabled={!canManageSettings || classFrozen || updatingQuotes}
              />
            </label>
            {(settings.classConfig?.quotes || []).length ? (
              <div className="transaction-list">
                {(settings.classConfig?.quotes || []).slice(0, 5).map((item, index) => (
                  <div key={`${item}-${index}`} className="transaction-row">
                    <div>
                      <strong>语录 {index + 1}</strong>
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">暂无班级语录</p>
            )}
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingQuotes}
                onClick={submitQuotesConfig}
              >
                {updatingQuotes ? "提交中..." : "保存语录配置"}
              </button>
              <span className="muted">按行保存，登录侧栏会展示今日语录。</span>
            </div>
            {quotesConfigError ? <p className="warning-text">{quotesConfigError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>兼容维护工具</h3>
            <span>Excel / JSON</span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，学生名单导入和语录导入会被暂停。</p> : null}
            <div className="content-grid overview-grid">
              <div className="adjustment-form">
                <div className="panel-header compact">
                  <h3>学生名单</h3>
                  <span>{students.length} 人</span>
                </div>
                <div className="student-filters">
                  <label>
                    <span>导入模式</span>
                    <select
                      value={studentImportMode}
                      onChange={(event) => setStudentImportMode(event.target.value as "merge" | "overwrite")}
                      disabled={!canManageSettings || classFrozen || importingStudentRoster}
                    >
                      <option value="merge">增量导入</option>
                      <option value="overwrite">覆盖导入</option>
                    </select>
                  </label>
                </div>
                <div className="import-footer">
                  <button type="button" className="inline-action-button" onClick={handleExportStudentsExcel}>
                    导出学生名单 Excel
                  </button>
                  <label className="inline-action-button">
                    {importingStudentRoster ? "导入中..." : "导入学生名单 Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      hidden
                      disabled={!canManageSettings || classFrozen || importingStudentRoster}
                      onChange={handleImportStudentsExcel}
                    />
                  </label>
                  <span className="muted">支持姓名、性别、状态、排序、小组、宿舍列。覆盖导入会将表格外的 active 学生归档。</span>
                </div>
              </div>

              <div className="adjustment-form">
                <div className="panel-header compact">
                  <h3>语录、配置与备份</h3>
                  <span>{settings.classConfig?.quotes.length ?? 0} 条语录</span>
                </div>
                <div className="import-footer">
                  <button type="button" className="inline-action-button" onClick={handleExportQuotesExcel}>
                    导出语录 Excel
                  </button>
                  <label className="inline-action-button">
                    {updatingQuotes ? "导入中..." : "导入语录 Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      hidden
                      disabled={!canManageSettings || classFrozen || updatingQuotes}
                      onChange={handleImportQuotesExcel}
                    />
                  </label>
                  <button type="button" className="inline-action-button" onClick={handleExportSystemConfigJson}>
                    导出配置 JSON
                  </button>
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageSettings || downloadingMaintenanceBackup}
                    onClick={onDownloadMaintenanceBackup}
                  >
                    {downloadingMaintenanceBackup ? "下载中..." : "下载全量备份 JSON"}
                  </button>
                  <label className="inline-action-button">
                    {restoringStructuredBackup ? "恢复中..." : "恢复全量备份 JSON"}
                    <input
                      type="file"
                      accept=".json"
                      hidden
                      disabled={!canManageSettings || restoringStructuredBackup}
                      onChange={handleRestoreStructuredBackupJson}
                    />
                  </label>
                  <label className="inline-action-button">
                    {importingMaintenanceConfig ? "导入中..." : "导入配置 JSON"}
                    <input
                      type="file"
                      accept=".json"
                      hidden
                      disabled={!canManageSettings || importingMaintenanceConfig || restoringMaintenanceSnapshot}
                      onChange={handleImportSystemConfigJson}
                    />
                  </label>
                  <span className="muted">全量备份下载/恢复走新系统结构化 full 导出；配置导入只覆盖当前已兼容的维护项，适合局部恢复。</span>
                </div>
              </div>

              <div className="adjustment-form">
                <div className="panel-header compact">
                  <h3>考勤工具</h3>
                  <span>汇总 / 明细</span>
                </div>
                <div className="import-footer">
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={exportingAttendanceExcel || importingAttendanceExcel}
                    onClick={onExportAttendanceExcel}
                  >
                    {exportingAttendanceExcel ? "导出中..." : "导出考勤 Excel"}
                  </button>
                  <label className="inline-action-button">
                    {importingAttendanceExcel ? "导入中..." : "导入考勤 Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      hidden
                      disabled={importingAttendanceExcel || exportingAttendanceExcel || !canManageSettings || classFrozen}
                      onChange={handleImportAttendanceExcelFile}
                    />
                  </label>
                  <span className="muted">导出当前班级全部考勤记录；导入兼容旧系统“日期 / 姓名 / 时段列”格式，并优先合并到现有场次。</span>
                </div>
              </div>

              <div className="adjustment-form">
                <div className="panel-header compact">
                  <h3>积分修复</h3>
                  <span>{students.length} 人</span>
                </div>
                <div className="import-footer">
                  <button type="button" className="inline-action-button" onClick={handleExportPointsExcel}>
                    导出积分 Excel
                  </button>
                  <label className="inline-action-button">
                    {importingPointsExcel ? "导入中..." : "导入积分 Excel"}
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      hidden
                      disabled={!canManageSettings || importingPointsExcel || rebuildingPointAccountsFromHistory}
                      onChange={handleImportPointsExcelFile}
                    />
                  </label>
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageSettings || rebuildingPointAccountsFromHistory || importingPointsExcel}
                    onClick={handleRebuildPointAccounts}
                  >
                    {rebuildingPointAccountsFromHistory ? "修复中..." : "从积分流水恢复分数"}
                  </button>
                  <span className="muted">支持旧“积分表”和新“积分数据”两种列名；导入会直接覆盖账户分数，不会补写历史积分流水。</span>
                </div>
                <div className="student-filters">
                  <label>
                    <span>学生</span>
                    <select
                      value={pointFixStudentId}
                      onChange={(event) => setPointFixStudentId(event.target.value)}
                      disabled={!canManageSettings || fixingPointAccount}
                    >
                      {students.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.sortOrder}. {student.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>总分</span>
                    <input
                      type="number"
                      step="0.01"
                      value={pointFixTotalPoints}
                      onChange={(event) => setPointFixTotalPoints(event.target.value)}
                      disabled={!canManageSettings || fixingPointAccount}
                    />
                  </label>
                  <label>
                    <span>余额</span>
                    <input
                      type="number"
                      step="0.01"
                      value={pointFixBalancePoints}
                      onChange={(event) => setPointFixBalancePoints(event.target.value)}
                      disabled={!canManageSettings || fixingPointAccount}
                    />
                  </label>
                  <label>
                    <span>罚分</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pointFixPenaltyPoints}
                      onChange={(event) => setPointFixPenaltyPoints(event.target.value)}
                      disabled={!canManageSettings || fixingPointAccount}
                    />
                  </label>
                </div>
                <div className="import-footer">
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageSettings || !pointFixStudentId || fixingPointAccount}
                    onClick={handleFixPointAccount}
                  >
                    {fixingPointAccount ? "修正中..." : "手动修正积分"}
                  </button>
                  <span className="muted">用于承接旧维护中心的单人账户修正；只覆盖积分账户，不补写历史流水。</span>
                </div>
                {pointFixError ? <p className="warning-text">{pointFixError}</p> : null}
              </div>

              <div className="adjustment-form">
                <div className="panel-header compact">
                  <h3>本地快照与测试模式</h3>
                  <span>{snapshotRecords.length} / 10</span>
                </div>
                <div className="attendance-summary-strip">
                  <div>
                    <span>测试模式</span>
                    <strong>{maintenanceTestMode ? "已开启" : "未开启"}</strong>
                  </div>
                  <div>
                    <span>当前选中</span>
                    <strong>{selectedSnapshot?.label || "未选择"}</strong>
                  </div>
                  <div>
                    <span>快照数量</span>
                    <strong>{snapshotRecords.length}</strong>
                  </div>
                </div>
                <div className="import-footer">
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageSettings || !settings || importingMaintenanceConfig || restoringMaintenanceSnapshot}
                    onClick={handleCreateMaintenanceSnapshot}
                  >
                    创建本地快照
                  </button>
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={
                      !canManageSettings ||
                      !selectedSnapshotId ||
                      !snapshotRecords.length ||
                      importingMaintenanceConfig ||
                      restoringMaintenanceSnapshot
                    }
                    onClick={handleRestoreSelectedSnapshot}
                  >
                    {restoringMaintenanceSnapshot ? "恢复中..." : "恢复选中快照"}
                  </button>
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageSettings || importingMaintenanceConfig || restoringMaintenanceSnapshot}
                    onClick={handleToggleMaintenanceTestMode}
                  >
                    {maintenanceTestMode ? "退出测试模式" : "进入测试模式"}
                  </button>
                  <span className="muted">快照仅保存在当前浏览器；测试模式会在进入时保存快照，退出时回滚，当前阶段不是多用户隔离沙盒。</span>
                </div>
                {snapshotRecords.length ? (
                  <div className="transaction-list">
                    {snapshotRecords.map((item) => (
                      <label key={item.id} className="transaction-row">
                        <div>
                          <strong>{item.label}</strong>
                          <span>
                            {new Date(item.createdAt).toLocaleString("zh-CN")} · {item.students.length} 名学生
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="maintenanceSnapshot"
                          checked={item.id === selectedSnapshotId}
                          onChange={() => setSelectedSnapshotId(item.id)}
                          disabled={importingMaintenanceConfig || restoringMaintenanceSnapshot}
                        />
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="muted">暂无本地快照，可先手动创建一份。</p>
                )}
              </div>
            </div>
            {maintenanceToolsError ? <p className="warning-text">{maintenanceToolsError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>旧系统兼容数据</h3>
            <span>
              {legacyCompatSummary.messages +
                legacyCompatSummary.teacherMessages +
                legacyCompatSummary.tasks +
                legacyCompatSummary.treasures +
                legacyCompatSummary.shopLogs +
                legacyCompatSummary.battleTeams +
                legacyCompatSummary.strategyDateCount}
              {" "}项
            </span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，旧系统兼容数据已暂停修改。</p> : null}
            <div className="attendance-summary-strip">
              <div>
                <span>学生留言</span>
                <strong>{legacyCompatSummary.messages}</strong>
              </div>
              <div>
                <span>教师留言</span>
                <strong>{legacyCompatSummary.teacherMessages}</strong>
              </div>
              <div>
                <span>任务</span>
                <strong>{legacyCompatSummary.tasks}</strong>
              </div>
              <div>
                <span>宝物</span>
                <strong>{legacyCompatSummary.treasures}</strong>
              </div>
              <div>
                <span>仓库学生</span>
                <strong>{legacyCompatSummary.storageStudents}</strong>
              </div>
              <div>
                <span>商城日志</span>
                <strong>{legacyCompatSummary.shopLogs}</strong>
              </div>
              <div>
                <span>兑换统计</span>
                <strong>{legacyCompatSummary.redemptionStudents}</strong>
              </div>
              <div>
                <span>对战队伍</span>
                <strong>{legacyCompatSummary.battleTeams}</strong>
              </div>
              <div>
                <span>对战场次</span>
                <strong>{legacyCompatSummary.battleMatches}</strong>
              </div>
              <div>
                <span>策略日期</span>
                <strong>{legacyCompatSummary.strategyDateCount}</strong>
              </div>
            </div>
            {legacyCompatSummary.strategyDateCount > 0 ? (
              <p className="muted">
                周期任务：{legacyCompatSummary.lastPeriodicTaskDate || "未保留"}；惩罚衰减：
                {legacyCompatSummary.lastPenaltyReductionDate || "未保留"}
              </p>
            ) : null}
            <div className="import-footer">
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings}
                onClick={handleExportLegacyTreasureExcel}
              >
                导出藏宝阁 Excel
              </button>
              <label className="inline-action-button">
                {updatingLegacyCompat ? "导入中..." : "导入藏宝阁 Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  hidden
                  disabled={!canManageSettings || classFrozen || updatingLegacyCompat}
                  onChange={handleImportLegacyTreasureExcel}
                />
              </label>
              <span className="muted">支持“宝物库存 / 学生储物箱”两张工作表，用于承接旧系统藏宝阁维护数据。</span>
            </div>
            <label>
              <span>兼容 JSON</span>
              <textarea
                rows={18}
                value={legacyCompatDraft}
                onChange={(event) => {
                  setLegacyCompatDraft(event.target.value);
                  if (legacyCompatError) {
                    setLegacyCompatError("");
                  }
                }}
                placeholder='{"messages":[],"teacherMessages":[],"tasks":[],"shop":{"treasures":[],"storage":{},"logs":[],"redemptionHistory":{},"dailyRedemptionCounts":{},"dailyUsageCounts":{}},"battle":null}'
                disabled={!canManageSettings || classFrozen || updatingLegacyCompat}
              />
            </label>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingLegacyCompat}
                onClick={submitLegacyCompat}
              >
                {updatingLegacyCompat ? "提交中..." : "保存兼容数据"}
              </button>
              <span className="muted">
                用于承接旧系统的留言、任务、藏宝阁、双子星等数据，先保证完整继承，再逐步拆进正式模块。
              </span>
            </div>
            {legacyCompatError ? <p className="warning-text">{legacyCompatError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>学生状态字典</h3>
            <span>{settings.classConfig?.studentStatusOptions.length ?? 0} 个状态</span>
          </div>
          <div className="transaction-list">
            <div className="transaction-row">
              <div>
                <strong>当前状态治理</strong>
                <span>
                  {(settings.classConfig?.studentStatusOptions || []).length
                    ? (settings.classConfig?.studentStatusOptions || [])
                        .map(
                          (item) =>
                            `${item.label} · ${item.participatesInDailyFlow ? "参与日常" : "不参与日常"} · ${
                              studentStatusCountMap.get(item.value) || 0
                            } 人`
                        )
                        .join("；")
                    : "暂无学生状态配置"}
                </span>
              </div>
            </div>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，学生状态字典已暂停修改。</p> : null}
            <div className="import-footer">
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig}
                onClick={appendStudentStatusDraft}
              >
                新增自定义状态
              </button>
              <span className="muted">
                预置状态编码不可删除，可改显示名称与“是否参与日常”；仍被学生使用的自定义状态不能直接删除。
              </span>
            </div>
            <div className="transaction-list">
              {studentStatusDrafts.length ? (
                studentStatusDrafts.map((item, index) => (
                  <div key={`${item.value || "student-status"}-${index}`} className="transaction-row">
                    <div className="settings-inline-editor">
                      <input
                        value={item.value}
                        onChange={(event) => updateStudentStatusDraft(index, { value: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig || item.isPreset}
                        placeholder="状态编码"
                      />
                      <input
                        value={item.label}
                        onChange={(event) => updateStudentStatusDraft(index, { label: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig}
                        placeholder="显示名称"
                      />
                      <label className="selection-toggle">
                        <input
                          type="checkbox"
                          checked={item.participatesInDailyFlow}
                          onChange={(event) =>
                            updateStudentStatusDraft(index, { participatesInDailyFlow: event.target.checked })
                          }
                          disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig}
                        />
                        <span>参与日常</span>
                      </label>
                    </div>
                    <div className="transaction-actions">
                      <span className="muted">
                        {studentStatusCountMap.get(item.value.trim()) || 0} 人 · {item.isPreset ? "系统预置" : "自定义"}
                      </span>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig || index === 0}
                        onClick={() => moveStudentStatusDraft(index, -1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={
                          !canManageSettings ||
                          classFrozen ||
                          updatingStudentStatusConfig ||
                          index === studentStatusDrafts.length - 1
                        }
                        onClick={() => moveStudentStatusDraft(index, 1)}
                      >
                        下移
                      </button>
                      {!item.isPreset ? (
                        <button
                          type="button"
                          className="inline-action-button"
                          disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig}
                          onClick={() => removeStudentStatusDraft(index)}
                        >
                          删除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无学生状态配置</p>
              )}
            </div>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingStudentStatusConfig}
                onClick={submitStudentStatusConfig}
              >
                {updatingStudentStatusConfig ? "提交中..." : "保存状态字典"}
              </button>
            </div>
            {studentStatusConfigError ? <p className="warning-text">{studentStatusConfigError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>学科配置</h3>
            <span>{settings.classConfig?.subjects.length ?? 0} 个学科</span>
          </div>
          <div className="transaction-list">
            <div className="transaction-row">
              <div>
                <strong>当前学科与课代表</strong>
                <span>
                  {(settings.classConfig?.subjects || []).length
                    ? (settings.classConfig?.subjects || [])
                        .map((item) => {
                          const reps = item.representativeStudentIds
                            .map((studentId) => studentOptionLabelMap.get(studentId) || "")
                            .filter(Boolean);
                          return `${item.name}${reps.length ? `（${reps.join(" / ")}）` : ""}`;
                        })
                        .join("；")
                    : "暂无学科配置"}
                </span>
              </div>
            </div>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，学科配置已暂停修改。</p> : null}
            <div className="import-footer">
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                onClick={appendSubjectDraft}
              >
                新增学科
              </button>
              <span className="muted">每个学科最多可设置 2 名课代表，后续作业批量登记会按此配置自动加分。</span>
            </div>
            <div className="transaction-list">
              {subjectDrafts.length ? (
                subjectDrafts.map((item, index) => (
                  <div key={`${item.id || "subject"}-${index}`} className="transaction-row">
                    <div className="settings-inline-editor">
                      <input
                        value={item.id}
                        onChange={(event) => updateSubjectDraft(index, { id: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                        placeholder="学科 id"
                      />
                      <input
                        value={item.name}
                        onChange={(event) => updateSubjectDraft(index, { name: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                        placeholder="学科名称"
                      />
                      <select
                        value={item.representativeStudentIds[0]}
                        onChange={(event) => updateSubjectRepresentative(index, 0, event.target.value)}
                        disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                      >
                        <option value="">课代表 1</option>
                        {studentOptions.map((student) => (
                          <option
                            key={student.id}
                            value={student.id}
                            disabled={item.representativeStudentIds[1] === student.id}
                          >
                            {studentOptionLabelMap.get(student.id) || student.name}
                          </option>
                        ))}
                      </select>
                      <select
                        value={item.representativeStudentIds[1]}
                        onChange={(event) => updateSubjectRepresentative(index, 1, event.target.value)}
                        disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                      >
                        <option value="">课代表 2</option>
                        {studentOptions.map((student) => (
                          <option
                            key={student.id}
                            value={student.id}
                            disabled={item.representativeStudentIds[0] === student.id}
                          >
                            {studentOptionLabelMap.get(student.id) || student.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="transaction-actions">
                      <span className="muted">
                        {item.representativeStudentIds.filter(Boolean).length
                          ? item.representativeStudentIds
                              .filter(Boolean)
                              .map((studentId) => studentOptionLabelMap.get(studentId) || "已设置")
                              .join(" / ")
                          : "未设置课代表"}
                      </span>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                        onClick={() => removeSubjectDraft(index)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无学科配置</p>
              )}
            </div>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingSubjectConfig}
                onClick={submitSubjectConfig}
              >
                {updatingSubjectConfig ? "提交中..." : "保存学科配置"}
              </button>
            </div>
            {subjectConfigError ? <p className="warning-text">{subjectConfigError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>工资配置</h3>
            <span>
              基础分 {settings.classConfig?.dailyWageAmount ?? 5} / 工资组 {savedWageGroupNames.length} / 心理委员{" "}
              {savedPsychologyMembers.length}
            </span>
          </div>
          <div className="transaction-list">
            <div className="transaction-row">
              <div>
                <strong>当前已保存工资配置</strong>
                <span>
                  {hasSavedWageTargets
                    ? [
                        savedWageGroupNames.length ? `工资小组：${savedWageGroupNames.join(" / ")}` : "",
                        savedPsychologyMembers.length ? `心理委员：${savedPsychologyMembers.join(" / ")}` : "",
                        configuredStudentCouncilRoles.length
                          ? `学生会：${configuredStudentCouncilRoles
                              .map(
                                (item) =>
                                  `${item.name} -> ${studentOptionLabelMap.get(item.studentId || "") || "未设置"}`
                              )
                              .join(" / ")}`
                          : ""
                      ]
                        .filter(Boolean)
                        .join("；")
                    : "暂未配置工资对象"}
                </span>
              </div>
            </div>
            <div className="transaction-row">
              <div>
                <strong>发放规则</strong>
                <span>普通成员按基础分发放，组长额外 +1，心理委员 +1，每个学生会职位 +2。</span>
              </div>
            </div>
            <div className="transaction-row">
              <div>
                <strong>最近工资日期</strong>
                <span>{settings.classConfig?.lastWageDate || "暂无记录"}</span>
              </div>
            </div>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，工资配置和发放已暂停。</p> : null}
            <div className="student-filters">
              <label>
                <span>每日工资基础分</span>
                <input
                  type="number"
                  min="0"
                  max="1000"
                  value={dailyWageAmountDraft}
                  onChange={(event) => {
                    setDailyWageAmountDraft(event.target.value);
                    if (wageConfigError) {
                      setWageConfigError("");
                    }
                  }}
                  disabled={!canManageSettings || classFrozen || updatingWageConfig}
                />
              </label>
            </div>
            <div className="transaction-list">
              <div className="transaction-row">
                <div>
                  <strong>发工资的小组</strong>
                  <span>勾选后，该小组主组成员可参与每日工资发放。</span>
                </div>
              </div>
              {settings.groups.length ? (
                settings.groups.map((group) => (
                  <label key={group.id} className="transaction-row">
                    <div>
                      <strong>{group.name}</strong>
                      <span>{group.membersCount} 人</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={dailyWageGroupIdsDraft.includes(group.id)}
                      onChange={(event) => toggleWageGroup(group.id, event.target.checked)}
                      disabled={!canManageSettings || classFrozen || updatingWageConfig}
                    />
                  </label>
                ))
              ) : (
                <p className="muted">当前班级还没有小组配置</p>
              )}
            </div>
            <div className="transaction-list">
              <div className="transaction-row">
                <div>
                  <strong>心理委员</strong>
                  <span>沿用旧系统 4 个槽位配置；已选学生每日工资时额外发放 1 分。</span>
                </div>
              </div>
              <div className="student-filters">
                {psychologyCommitteeDraft.map((studentId, index) => (
                  <label key={`psychology-slot-${index}`}>
                    <span>心理委员 {index + 1}</span>
                    <select
                      value={studentId}
                      onChange={(event) => updatePsychologyCommitteeSlot(index, event.target.value)}
                      disabled={!canManageSettings || classFrozen || updatingWageConfig}
                    >
                      <option value="">未设置</option>
                      {studentOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {studentOptionLabelMap.get(item.id) || item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </div>
            <div className="transaction-list">
              <div className="transaction-row">
                <div>
                  <strong>学生会专员职位</strong>
                  <span>每个已绑定学生的职位每日发放 2 分津贴。</span>
                </div>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageSettings || classFrozen || updatingWageConfig}
                  onClick={appendStudentCouncilRole}
                >
                  新增职位
                </button>
              </div>
              {studentCouncilRolesDraft.length ? (
                studentCouncilRolesDraft.map((role, index) => (
                  <div key={`${role.id || "role"}-${index}`} className="transaction-row">
                    <div className="settings-inline-editor">
                      <input
                        value={role.id}
                        onChange={(event) => updateStudentCouncilRole(index, { id: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingWageConfig}
                        placeholder="职位 id"
                      />
                      <input
                        value={role.name}
                        onChange={(event) => updateStudentCouncilRole(index, { name: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingWageConfig}
                        placeholder="职位名称"
                      />
                      <select
                        value={role.studentId}
                        onChange={(event) => updateStudentCouncilRole(index, { studentId: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingWageConfig}
                      >
                        <option value="">未设置</option>
                        {studentOptions.map((item) => (
                          <option key={item.id} value={item.id}>
                            {studentOptionLabelMap.get(item.id) || item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="transaction-actions">
                      <span className="muted">
                        {role.studentId ? studentOptionLabelMap.get(role.studentId) || "已绑定" : "未绑定学生"}
                      </span>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingWageConfig}
                        onClick={() => removeStudentCouncilRole(index)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无学生会专员职位配置</p>
              )}
            </div>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingWageConfig}
                onClick={submitWageConfig}
              >
                {updatingWageConfig ? "提交中..." : "保存工资配置"}
              </button>
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings || classFrozen || issuingDailyWage}
                onClick={onIssueDailyWage}
              >
                {issuingDailyWage ? "发放中..." : "发放今日工资"}
              </button>
              <span className="muted">发放动作按当前已保存配置执行；若刚修改过，请先保存再发放。当天重复发放会先提醒。</span>
            </div>
            {wageConfigError ? <p className="warning-text">{wageConfigError}</p> : null}
          </div>

          <div className="transaction-list">
            <div className="transaction-row">
              <div>
                <strong>当前启用功能</strong>
                <span>{enabledFeatureCodes.length ? enabledFeatureCodes.join(" / ") : "暂无启用功能"}</span>
              </div>
            </div>
          </div>

          <div className="panel-header compact">
            <h3>倒计时与课程备注</h3>
            <span>
              {filteredCountdownItems.length + filteredScheduleNoteItems.length} /{" "}
              {(settings.classConfig?.countdownEventItems.length ?? 0) + (settings.classConfig?.scheduleNoteItems.length ?? 0)}{" "}
              项
            </span>
          </div>
          <div className="content-grid overview-grid">
            <div className="transaction-list">
              <div className="student-filters">
                <label>
                  <span>倒计时搜索</span>
                  <input value={countdownSearch} onChange={(event) => setCountdownSearch(event.target.value)} placeholder="按标题/备注/日期筛选" />
                </label>
              </div>
              <p className="muted">列表按当前保存顺序展示。</p>
              {filteredCountdownItems.length ? (
                filteredCountdownItems.map((item) => (
                  <div key={item.id} className="transaction-row">
                    <div>
                      <strong>{item.title}</strong>
                      <span>{item.note || "无补充说明"} · {getCountdownStatusLabel(item.date || "")}</span>
                    </div>
                    <b>{item.date || "-"}</b>
                  </div>
                ))
              ) : (
                <p className="muted">{settings.classConfig?.countdownEventItems.length ? "当前筛选条件下没有匹配的倒计时事件" : "暂无倒计时事件"}</p>
              )}
            </div>
            <div className="transaction-list">
              <div className="student-filters">
                <label>
                  <span>备注搜索</span>
                  <input value={scheduleNoteSearch} onChange={(event) => setScheduleNoteSearch(event.target.value)} placeholder="按键名/备注筛选" />
                </label>
              </div>
              <p className="muted">列表按当前保存顺序展示。</p>
              {filteredScheduleNoteItems.length ? (
                filteredScheduleNoteItems.map((item) => (
                  <div key={item.key} className="transaction-row">
                    <div>
                      <strong>{item.key}</strong>
                      <span>{item.value || "无备注"}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">{settings.classConfig?.scheduleNoteItems.length ? "当前筛选条件下没有匹配的课程备注" : "暂无课程备注"}</p>
              )}
            </div>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
            <div className="transaction-list">
              {countdownEventEditorItems.length ? (
                countdownEventEditorItems.map((item, index) => (
                  <div
                    key={`${item.id || item.title}-${index}`}
                    className={`transaction-row sortable-row${
                      draggingCountdownEventIndex === index ? " dragging" : ""
                    }${dragOverCountdownEventIndex === index && draggingCountdownEventIndex !== index ? " drag-over" : ""}`}
                    onDragOver={(event) => handleCountdownEventDragOver(event, index)}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropCountdownEventItem(index);
                    }}
                  >
                    <div className="settings-inline-editor">
                      <input
                        value={item.title}
                        onChange={(event) => updateCountdownEventItem(index, { title: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                        placeholder="标题"
                      />
                      <input
                        type="date"
                        value={item.date}
                        onChange={(event) => updateCountdownEventItem(index, { date: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                      />
                      <input
                        value={item.note}
                        onChange={(event) => updateCountdownEventItem(index, { note: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                        placeholder="补充说明"
                      />
                    </div>
                    <div className="transaction-actions">
                      <span className="muted">{getCountdownStatusLabel(item.date)}</span>
                      <span className="muted">
                        第 {index + 1} / {countdownEventEditorItems.length} 项
                      </span>
                      <span className="muted">{item.id || `event-${index + 1}`}</span>
                      <span
                        className="inline-action-button drag-handle-button"
                        draggable={canManageSettings && !classFrozen && !updatingCountdownEvents}
                        onDragStart={(event) => startCountdownEventDrag(event, index)}
                        onDragEnd={resetCountdownEventDragState}
                        title="拖拽排序"
                      >
                        拖拽
                      </span>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingCountdownEvents || index === 0}
                        onClick={() => moveCountdownEventItem(index, -1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={
                          !canManageSettings ||
                          classFrozen ||
                          updatingCountdownEvents ||
                          index === countdownEventEditorItems.length - 1
                        }
                        onClick={() => moveCountdownEventItem(index, 1)}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                        onClick={() => removeCountdownEventItem(index)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">当前还没有可编辑的倒计时事件</p>
              )}
            </div>
            <div className="student-filters">
              <label>
                <span>新增事件 ID</span>
                <input
                  value={newCountdownEventId}
                  onChange={(event) => setNewCountdownEventId(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                  placeholder="可选"
                />
              </label>
              <label>
                <span>新增标题</span>
                <input
                  value={newCountdownEventTitle}
                  onChange={(event) => setNewCountdownEventTitle(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                  placeholder="例如：期中考试"
                />
              </label>
              <label>
                <span>新增日期</span>
                <input
                  type="date"
                  value={newCountdownEventDate}
                  onChange={(event) => setNewCountdownEventDate(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                />
              </label>
              <label>
                <span>新增备注</span>
                <input
                  value={newCountdownEventNote}
                  onChange={(event) => setNewCountdownEventNote(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                  placeholder="可选"
                />
              </label>
            </div>
            <label>
              <span>倒计时事件 JSON</span>
              <textarea
                rows={6}
                value={countdownEventsDraft}
                onChange={(event) => {
                  setCountdownEventsDraft(event.target.value);
                  if (countdownEventsError) {
                    setCountdownEventsError("");
                  }
                }}
                disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
              />
            </label>
            <div className="import-footer">
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings || classFrozen || updatingCountdownEvents}
                onClick={appendCountdownEventItem}
              >
                新增一条
              </button>
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingCountdownEvents || !countdownEventsDraft.trim()}
                onClick={submitCountdownEvents}
              >
                {updatingCountdownEvents ? "提交中..." : "保存倒计时事件"}
              </button>
              <span className="muted">整体覆盖当前倒计时列表，日期需使用 YYYY-MM-DD，并按当前编辑顺序保存。</span>
            </div>
            {countdownEventsError ? <p className="warning-text">{countdownEventsError}</p> : null}
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
            <div className="transaction-list">
              {scheduleNoteEditorItems.length ? (
                scheduleNoteEditorItems.map((item, index) => (
                  <div
                    key={`${item.key}-${index}`}
                    className={`transaction-row sortable-row${
                      draggingScheduleNoteIndex === index ? " dragging" : ""
                    }${dragOverScheduleNoteIndex === index && draggingScheduleNoteIndex !== index ? " drag-over" : ""}`}
                    onDragOver={(event) => handleScheduleNoteDragOver(event, index)}
                    onDrop={(event) => {
                      event.preventDefault();
                      dropScheduleNoteItem(index);
                    }}
                  >
                    <div className="settings-inline-editor">
                      <input
                        value={item.key}
                        onChange={(event) => updateScheduleNoteItem(index, { key: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                        placeholder="键名"
                      />
                      <input
                        value={item.value}
                        onChange={(event) => updateScheduleNoteItem(index, { value: event.target.value })}
                        disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                        placeholder="备注内容"
                      />
                    </div>
                    <div className="transaction-actions">
                      <span className="muted">
                        第 {index + 1} / {scheduleNoteEditorItems.length} 项
                      </span>
                      <span
                        className="inline-action-button drag-handle-button"
                        draggable={canManageSettings && !classFrozen && !updatingScheduleNotes}
                        onDragStart={(event) => startScheduleNoteDrag(event, index)}
                        onDragEnd={resetScheduleNoteDragState}
                        title="拖拽排序"
                      >
                        拖拽
                      </span>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingScheduleNotes || index === 0}
                        onClick={() => moveScheduleNoteItem(index, -1)}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={
                          !canManageSettings ||
                          classFrozen ||
                          updatingScheduleNotes ||
                          index === scheduleNoteEditorItems.length - 1
                        }
                        onClick={() => moveScheduleNoteItem(index, 1)}
                      >
                        下移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                        onClick={() => removeScheduleNoteItem(index)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">当前还没有可编辑的课程备注</p>
              )}
            </div>
            <div className="student-filters">
              <label>
                <span>新增键名</span>
                <input
                  value={newScheduleNoteKey}
                  onChange={(event) => setNewScheduleNoteKey(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                  placeholder="例如：morning"
                />
              </label>
              <label>
                <span>新增备注</span>
                <input
                  value={newScheduleNoteValue}
                  onChange={(event) => setNewScheduleNoteValue(event.target.value)}
                  disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                  placeholder="例如：语文早读"
                />
              </label>
            </div>
            <label>
              <span>课程备注 JSON</span>
              <textarea
                rows={6}
                value={scheduleNotesDraft}
                onChange={(event) => {
                  setScheduleNotesDraft(event.target.value);
                  if (scheduleNotesError) {
                    setScheduleNotesError("");
                  }
                }}
                disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
              />
            </label>
            <div className="import-footer">
              <button
                type="button"
                className="inline-action-button"
                disabled={!canManageSettings || classFrozen || updatingScheduleNotes}
                onClick={appendScheduleNoteItem}
              >
                新增一条
              </button>
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || updatingScheduleNotes || !scheduleNotesDraft.trim()}
                onClick={submitScheduleNotes}
              >
                {updatingScheduleNotes ? "提交中..." : "保存课程备注"}
              </button>
              <span className="muted">会整体覆盖当前课程备注，并按当前编辑顺序保存，值建议保持纯文本字符串。</span>
            </div>
            {scheduleNotesError ? <p className="warning-text">{scheduleNotesError}</p> : null}
          </div>

          <div className="panel-header compact">
            <h3>小组与宿舍</h3>
            <span>{settings.groups.length + settings.dormitories.length} 项</span>
          </div>
          <div className="content-grid overview-grid">
            <div className="adjustment-form">
              <div className="panel-header compact">
                <h3>小组配置</h3>
                <span>{groupDrafts.length} 项</span>
              </div>
              {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
              {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
              {groupDrafts.length ? (
                groupDrafts.map((item, index) => (
                  <div key={item.id || `group-draft-${index}`} className="adjustment-form">
                    <div className="student-filters">
                      <label>
                        <span>名称</span>
                        <input
                          value={item.name}
                          onChange={(event) => updateGroupDraft(index, { name: event.target.value })}
                          disabled={!canManageSettings || classFrozen || updatingGroups}
                        />
                      </label>
                      <label>
                        <span>旧键</span>
                        <input
                          value={item.legacyKey}
                          onChange={(event) => updateGroupDraft(index, { legacyKey: event.target.value })}
                          placeholder="兼容旧系统 id"
                          disabled={!canManageSettings || classFrozen || updatingGroups}
                        />
                      </label>
                      <label>
                        <span>颜色样式</span>
                        <input
                          value={item.colorToken}
                          onChange={(event) => updateGroupDraft(index, { colorToken: event.target.value })}
                          placeholder="例如 bg-blue-100 text-blue-700"
                          disabled={!canManageSettings || classFrozen || updatingGroups}
                        />
                      </label>
                      <label>
                        <span>状态</span>
                        <select
                          value={item.isActive ? "active" : "disabled"}
                          onChange={(event) => updateGroupDraft(index, { isActive: event.target.value === "active" })}
                          disabled={!canManageSettings || classFrozen || updatingGroups}
                        >
                          <option value="active">启用</option>
                          <option value="disabled">停用</option>
                        </select>
                      </label>
                    </div>
                    <div className="import-footer">
                      <span className="muted">{item.id ? `${item.membersCount} 人` : "新建小组"}</span>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => moveGroupDraft(index, -1)}
                        disabled={!canManageSettings || classFrozen || updatingGroups || index === 0}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => moveGroupDraft(index, 1)}
                        disabled={!canManageSettings || classFrozen || updatingGroups || index === groupDrafts.length - 1}
                      >
                        下移
                      </button>
                      {!item.id ? (
                        <button
                          type="button"
                          className="inline-action-button"
                          onClick={() => removeNewGroupDraft(index)}
                          disabled={!canManageSettings || classFrozen || updatingGroups}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无小组配置</p>
              )}
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  onClick={appendGroupDraft}
                  disabled={!canManageSettings || classFrozen || updatingGroups}
                >
                  新增小组
                </button>
                <button
                  type="button"
                  className="adjustment-submit"
                  onClick={submitGroups}
                  disabled={!canManageSettings || classFrozen || updatingGroups}
                >
                  {updatingGroups ? "提交中..." : "保存小组"}
                </button>
                <span className="muted">已分配成员不会丢失，旧条目可直接停用。</span>
              </div>
              {groupConfigError ? <p className="warning-text">{groupConfigError}</p> : null}
            </div>
            <div className="adjustment-form">
              <div className="panel-header compact">
                <h3>宿舍配置</h3>
                <span>{dormitoryDrafts.length} 项</span>
              </div>
              {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
              {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
              {dormitoryDrafts.length ? (
                dormitoryDrafts.map((item, index) => (
                  <div key={item.id || `dormitory-draft-${index}`} className="adjustment-form">
                    <div className="student-filters">
                      <label>
                        <span>名称</span>
                        <input
                          value={item.name}
                          onChange={(event) => updateDormitoryDraft(index, { name: event.target.value })}
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        />
                      </label>
                      <label>
                        <span>旧键</span>
                        <input
                          value={item.legacyKey}
                          onChange={(event) => updateDormitoryDraft(index, { legacyKey: event.target.value })}
                          placeholder="兼容旧系统 id"
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        />
                      </label>
                      <label>
                        <span>楼栋</span>
                        <input
                          value={item.building}
                          onChange={(event) => updateDormitoryDraft(index, { building: event.target.value })}
                          placeholder="例如 1号楼"
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        />
                      </label>
                      <label>
                        <span>性别范围</span>
                        <input
                          value={item.genderScope}
                          onChange={(event) => updateDormitoryDraft(index, { genderScope: event.target.value })}
                          placeholder="例如 male / female / mixed"
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        />
                      </label>
                      <label>
                        <span>状态</span>
                        <select
                          value={item.isActive ? "active" : "disabled"}
                          onChange={(event) => updateDormitoryDraft(index, { isActive: event.target.value === "active" })}
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        >
                          <option value="active">启用</option>
                          <option value="disabled">停用</option>
                        </select>
                      </label>
                    </div>
                    <div className="import-footer">
                      <span className="muted">{item.id ? `${item.membersCount} 人` : "新建宿舍"}</span>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => moveDormitoryDraft(index, -1)}
                        disabled={!canManageSettings || classFrozen || updatingDormitories || index === 0}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => moveDormitoryDraft(index, 1)}
                        disabled={
                          !canManageSettings || classFrozen || updatingDormitories || index === dormitoryDrafts.length - 1
                        }
                      >
                        下移
                      </button>
                      {!item.id ? (
                        <button
                          type="button"
                          className="inline-action-button"
                          onClick={() => removeNewDormitoryDraft(index)}
                          disabled={!canManageSettings || classFrozen || updatingDormitories}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无宿舍配置</p>
              )}
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  onClick={appendDormitoryDraft}
                  disabled={!canManageSettings || classFrozen || updatingDormitories}
                >
                  新增宿舍
                </button>
                <button
                  type="button"
                  className="adjustment-submit"
                  onClick={submitDormitories}
                  disabled={!canManageSettings || classFrozen || updatingDormitories}
                >
                  {updatingDormitories ? "提交中..." : "保存宿舍"}
                </button>
                <span className="muted">用于学生宿舍归属和后续统计，不会删除已有成员关系。</span>
              </div>
              {dormitoryConfigError ? <p className="warning-text">{dormitoryConfigError}</p> : null}
            </div>
          </div>

          <div className="panel-header compact">
            <h3>岗位与积分模板</h3>
            <span>{settings.positions.length + filteredReasonTemplates.length} 项</span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
            <div className="student-filters">
              <label>
                <span>模板名称</span>
                <input value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="例如：课堂表现" />
              </label>
              <label>
                <span>分值</span>
                <input type="number" step="0.5" value={templateValue} onChange={(event) => setTemplateValue(event.target.value)} />
              </label>
              <label>
                <span>类型</span>
                <select value={templateTransactionType} onChange={(event) => setTemplateTransactionType(event.target.value as "bonus" | "penalty" | "reward")}>
                  <option value="bonus">加分</option>
                  <option value="penalty">扣分</option>
                  <option value="reward">奖励</option>
                </select>
              </label>
              <label>
                <span>场景</span>
                <input value={templateScene} onChange={(event) => setTemplateScene(event.target.value)} />
              </label>
              <label>
                <span>类别</span>
                <input value={templateCategory} onChange={(event) => setTemplateCategory(event.target.value)} />
              </label>
            </div>
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={
                  !canManageSettings ||
                  classFrozen ||
                  creatingReasonTemplate ||
                  creatingReasonTemplateBatch ||
                  Boolean(updatingReasonTemplateId) ||
                  Boolean(deletingReasonTemplateId) ||
                  !templateName.trim() ||
                  !Number(templateValue)
                }
                onClick={submitTemplate}
              >
                {creatingReasonTemplate ||
                creatingReasonTemplateBatch ||
                Boolean(updatingReasonTemplateId) ||
                Boolean(deletingReasonTemplateId)
                  ? "提交中..."
                  : editingTemplateId
                    ? "保存模板"
                    : "新增积分模板"}
              </button>
              {editingTemplate ? (
                <button type="button" className="inline-action-button" onClick={resetTemplateForm}>
                  取消编辑
                </button>
              ) : null}
              <span className="muted">当前阶段开放新增、启停、核心字段编辑与排序。</span>
            </div>
            {settingsWriteMessage ? <p className="success-text">{settingsWriteMessage}</p> : null}
          </div>
          <div className="panel-header compact">
            <h3>批量导入积分模板</h3>
            <span>JSON/CSV/TSV</span>
          </div>
          <div className="adjustment-form">
            {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
            {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
            <div className="student-filters">
              <label>
                <span>导入格式</span>
                <select
                  value={batchTemplateFormat}
                  onChange={(event) => setBatchTemplateFormat(event.target.value as "json" | "csv" | "tsv")}
                  disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                  <option value="tsv">TSV</option>
                </select>
              </label>
              {batchTemplateFormat !== "json" ? (
                <label>
                  <span>首行表头</span>
                  <select
                    value={batchTemplateHasHeader ? "yes" : "no"}
                    onChange={(event) => setBatchTemplateHasHeader(event.target.value === "yes")}
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="yes">是</option>
                    <option value="no">否</option>
                  </select>
                </label>
              ) : null}
            </div>
            <label>
              <span>模板列表（{batchTemplateFormat.toUpperCase()}）</span>
              <textarea
                rows={8}
                value={batchTemplateDraft}
                onChange={(event) => setBatchTemplateDraft(event.target.value)}
                disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
              />
            </label>
            {batchTemplateFormat !== "json" && batchTemplateColumns.length ? (
              <div className="student-filters">
                <label>
                  <span>名称列</span>
                  <select
                    value={batchTemplateColumnMap.name}
                    onChange={(event) => setBatchTemplateColumnMap((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="">请选择</option>
                    {batchTemplateColumns.map((col) => (
                      <option key={`name-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>分值列</span>
                  <select
                    value={batchTemplateColumnMap.value}
                    onChange={(event) => setBatchTemplateColumnMap((current) => ({ ...current, value: event.target.value }))}
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="">请选择</option>
                    {batchTemplateColumns.map((col) => (
                      <option key={`value-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>类型列</span>
                  <select
                    value={batchTemplateColumnMap.transactionType}
                    onChange={(event) =>
                      setBatchTemplateColumnMap((current) => ({ ...current, transactionType: event.target.value }))
                    }
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="">请选择</option>
                    {batchTemplateColumns.map((col) => (
                      <option key={`type-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>场景列</span>
                  <select
                    value={batchTemplateColumnMap.scene}
                    onChange={(event) => setBatchTemplateColumnMap((current) => ({ ...current, scene: event.target.value }))}
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="">请选择</option>
                    {batchTemplateColumns.map((col) => (
                      <option key={`scene-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>类别列</span>
                  <select
                    value={batchTemplateColumnMap.category}
                    onChange={(event) =>
                      setBatchTemplateColumnMap((current) => ({ ...current, category: event.target.value }))
                    }
                    disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                  >
                    <option value="">请选择</option>
                    {batchTemplateColumns.map((col) => (
                      <option key={`category-${col}`} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
            {batchTemplateDraft.trim() ? (
              <p className="muted">
                当前识别 {parseBatchTemplates(batchTemplateDraft, batchTemplateFormat).items.length} 条候选模板，
                预览前 {batchTemplatePreview.length} 条。
              </p>
            ) : null}
            {batchTemplateErrors.length ? (
              <div className="warning-text">
                {batchTemplateErrors.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : null}
            {batchTemplatePreview.length ? (
              <p className="muted">
                当前预览前 {batchTemplatePreview.length}
                {batchTemplateErrors.length ? " 条预览数据（存在校验问题）" : " 条预览数据"}
              </p>
            ) : null}
            {batchTemplatePreview.length ? (
              <div className="transaction-list">
                {batchTemplatePreview.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="transaction-row">
                    <div>
                      <strong>{item.name}</strong>
                      <span>{item.scene} · {item.category} · {item.transactionType}</span>
                    </div>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="import-footer">
              <button
                type="button"
                className="adjustment-submit"
                disabled={!canManageSettings || classFrozen || creatingReasonTemplateBatch}
                onClick={submitBatchTemplates}
              >
                {creatingReasonTemplateBatch ? "导入中..." : "批量导入"}
              </button>
              <span className="muted">
                示例：[{`{"name":"课堂表现","value":2,"transactionType":"bonus","scene":"班级","category":"表现"}`}]
              </span>
            </div>
          </div>
          <div className="content-grid overview-grid">
            <div className="adjustment-form">
              <div className="panel-header compact">
                <h3>岗位配置</h3>
                <span>{positionDrafts.length} 项</span>
              </div>
              {!canManageSettings ? <p className="muted">当前账号没有设置写权限。</p> : null}
              {classFrozen ? <p className="muted">当前班级已冻结，仅保留冻结开关本身可操作。</p> : null}
              {positionDrafts.length ? (
                positionDrafts.map((item, index) => (
                  <div key={item.id || `position-draft-${index}`} className="adjustment-form">
                    <div className="student-filters">
                      <label>
                        <span>编码</span>
                        <input
                          value={item.code}
                          onChange={(event) => updatePositionDraft(index, { code: event.target.value })}
                          placeholder="兼容旧系统角色 id"
                          disabled={!canManageSettings || classFrozen || updatingPositions}
                        />
                      </label>
                      <label>
                        <span>名称</span>
                        <input
                          value={item.name}
                          onChange={(event) => updatePositionDraft(index, { name: event.target.value })}
                          disabled={!canManageSettings || classFrozen || updatingPositions}
                        />
                      </label>
                      <label>
                        <span>分类</span>
                        <input
                          list="settings-position-category-list"
                          value={item.category}
                          onChange={(event) => updatePositionDraft(index, { category: event.target.value })}
                          disabled={!canManageSettings || classFrozen || updatingPositions}
                        />
                      </label>
                      <label>
                        <span>状态</span>
                        <select
                          value={item.isActive ? "active" : "disabled"}
                          onChange={(event) => updatePositionDraft(index, { isActive: event.target.value === "active" })}
                          disabled={!canManageSettings || classFrozen || updatingPositions}
                        >
                          <option value="active">启用</option>
                          <option value="disabled">停用</option>
                        </select>
                      </label>
                    </div>
                    <div className="import-footer">
                      <span className="muted">{item.id ? `${item.holdersCount} 人` : "新建岗位"}</span>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => movePositionDraft(index, -1)}
                        disabled={!canManageSettings || classFrozen || updatingPositions || index === 0}
                      >
                        上移
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        onClick={() => movePositionDraft(index, 1)}
                        disabled={!canManageSettings || classFrozen || updatingPositions || index === positionDrafts.length - 1}
                      >
                        下移
                      </button>
                      {!item.id ? (
                        <button
                          type="button"
                          className="inline-action-button"
                          onClick={() => removeNewPositionDraft(index)}
                          disabled={!canManageSettings || classFrozen || updatingPositions}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">暂无岗位配置</p>
              )}
              <datalist id="settings-position-category-list">
                {positionCategoryOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  onClick={appendPositionDraft}
                  disabled={!canManageSettings || classFrozen || updatingPositions}
                >
                  新增岗位
                </button>
                <button
                  type="button"
                  className="adjustment-submit"
                  onClick={submitPositions}
                  disabled={!canManageSettings || classFrozen || updatingPositions}
                >
                  {updatingPositions ? "提交中..." : "保存岗位"}
                </button>
                <span className="muted">岗位用于班干部/专员分配，停用后不会清空现有记录。</span>
              </div>
              {positionConfigError ? <p className="warning-text">{positionConfigError}</p> : null}
            </div>
            <div className="transaction-list">
              <div className="student-filters">
                <label>
                  <span>模板类型</span>
                  <select value={templateTypeFilter} onChange={(event) => setTemplateTypeFilter(event.target.value as "" | "bonus" | "penalty" | "reward")}>
                    <option value="">全部</option>
                    <option value="bonus">加分</option>
                    <option value="penalty">扣分</option>
                    <option value="reward">奖励</option>
                  </select>
                </label>
                <label>
                  <span>模板状态</span>
                  <select value={templateStatusFilter} onChange={(event) => setTemplateStatusFilter(event.target.value as "" | "active" | "disabled")}>
                    <option value="">全部</option>
                    <option value="active">启用中</option>
                    <option value="disabled">已停用</option>
                  </select>
                </label>
                <label>
                  <span>关键词</span>
                  <input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="按名称/场景/类别/分值筛选" />
                </label>
              </div>
              <div className="attendance-summary-strip">
                <div>
                  <span>加分模板</span>
                  <strong>{filteredReasonTemplateSummary.bonus}</strong>
                </div>
                <div>
                  <span>扣分模板</span>
                  <strong>{filteredReasonTemplateSummary.penalty}</strong>
                </div>
                <div>
                  <span>奖励模板</span>
                  <strong>{filteredReasonTemplateSummary.reward}</strong>
                </div>
                <div>
                  <span>当前启用</span>
                  <strong>{filteredReasonTemplateSummary.active}</strong>
                </div>
              </div>
              {filteredReasonTemplates.map((item, index) => (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.scene} · {item.category} · {item.transactionType}</span>
                  </div>
                  <div className="transaction-actions">
                    <b>{item.value}</b>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={
                        !canManageSettings ||
                        classFrozen ||
                        updatingReasonTemplateOrder ||
                        updatingReasonTemplateId === item.id ||
                        deletingReasonTemplateId === item.id ||
                        index === 0
                      }
                      onClick={() => moveReasonTemplate(item.id, "up")}
                    >
                      {updatingReasonTemplateOrder ? "排序中..." : "上移"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={
                        !canManageSettings ||
                        classFrozen ||
                        updatingReasonTemplateOrder ||
                        updatingReasonTemplateId === item.id ||
                        deletingReasonTemplateId === item.id ||
                        index === filteredReasonTemplates.length - 1
                      }
                      onClick={() => moveReasonTemplate(item.id, "down")}
                    >
                      {updatingReasonTemplateOrder ? "排序中..." : "下移"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={
                        !canManageSettings ||
                        classFrozen ||
                        updatingReasonTemplateId === item.id ||
                        deletingReasonTemplateId === item.id
                      }
                      onClick={() => startEditTemplate(item.id)}
                    >
                      {editingTemplateId === item.id ? "编辑中" : "编辑模板"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={
                        !canManageSettings ||
                        classFrozen ||
                        updatingReasonTemplateId === item.id ||
                        deletingReasonTemplateId === item.id
                      }
                      onClick={() => onUpdateReasonTemplate(item.id, { isActive: !item.isActive })}
                    >
                      {updatingReasonTemplateId === item.id ? "提交中..." : item.isActive ? "停用模板" : "启用模板"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={
                        !canManageSettings ||
                        classFrozen ||
                        !item.isEditable ||
                        updatingReasonTemplateOrder ||
                        updatingReasonTemplateId === item.id ||
                        deletingReasonTemplateId === item.id
                      }
                      onClick={() => onDeleteReasonTemplate(item.id)}
                    >
                      {deletingReasonTemplateId === item.id ? "删除中..." : "删除模板"}
                    </button>
                  </div>
                </div>
              ))}
              {!filteredReasonTemplates.length ? <p className="muted">{reasonTemplates.length ? "当前筛选条件下没有匹配的积分模板" : "暂无积分模板"}</p> : null}
            </div>
          </div>

          <div className="panel-header compact">
            <h3>积分模板分类</h3>
            <span>{reasonTemplateCategories.length} 类</span>
          </div>
          <div className="transaction-list">
            {reasonTemplateCategories.map((item) => {
              const key = `${item.scene}__${item.category}`;
              const editing = editingCategoryKey === key;
              return (
                <div key={key}>
                  <div className="transaction-row">
                    <div>
                      <strong>
                        {item.scene} · {item.category}
                      </strong>
                      <span>{item.count} 个模板</span>
                    </div>
                    <div className="transaction-actions">
                      <b>{item.totalValue}</b>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingReasonTemplateCategory}
                        onClick={() => (editing ? cancelEditCategory() : startEditCategory(item.scene, item.category))}
                      >
                        {editing ? "取消编辑" : "编辑分类"}
                      </button>
                    </div>
                  </div>
                  {editing ? (
                    <div className="adjustment-form">
                      <div className="student-filters">
                        <label>
                          <span>新场景</span>
                          <input
                            value={categorySceneDraft}
                            onChange={(event) => setCategorySceneDraft(event.target.value)}
                            disabled={!canManageSettings || classFrozen || updatingReasonTemplateCategory}
                          />
                        </label>
                        <label>
                          <span>新类别</span>
                          <input
                            value={categoryCategoryDraft}
                            onChange={(event) => setCategoryCategoryDraft(event.target.value)}
                            disabled={!canManageSettings || classFrozen || updatingReasonTemplateCategory}
                          />
                        </label>
                      </div>
                      <div className="import-footer">
                        <button
                          type="button"
                          className="adjustment-submit"
                          disabled={!canManageSettings || classFrozen || updatingReasonTemplateCategory}
                          onClick={() => submitCategoryUpdate(item.scene, item.category)}
                        >
                          {updatingReasonTemplateCategory ? "提交中..." : "保存分类"}
                        </button>
                        <span className="muted">更新将覆盖该分类下所有模板的场景与类别。</span>
                      </div>
                      {categoryFormError ? <p className="warning-text">{categoryFormError}</p> : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="panel-header compact">
            <h3>功能开关</h3>
            <span>{filteredFeatureFlags.length} / {settings.featureFlags.length} 项</span>
          </div>
          <div className="transaction-list">
            <div className="student-filters">
              <label>
                <span>开关状态</span>
                <select value={featureFlagStatusFilter} onChange={(event) => setFeatureFlagStatusFilter(event.target.value as "" | "enabled" | "disabled")}>
                  <option value="">全部</option>
                  <option value="enabled">已启用</option>
                  <option value="disabled">已停用</option>
                </select>
              </label>
              <label>
                <span>关键词</span>
                <input value={featureFlagSearch} onChange={(event) => setFeatureFlagSearch(event.target.value)} placeholder="按代码/配置筛选" />
              </label>
            </div>
            {filteredFeatureFlags.map((item) => (
              <div key={item.id}>
                <div className="transaction-row">
                  <div>
                    <strong>{item.code}</strong>
                    <span>
                      {Object.keys(item.config || {}).length} 个配置项
                      {Object.keys(item.config || {}).length
                        ? ` · ${Object.keys(item.config || {}).slice(0, 3).join(" / ")}`
                        : ""}
                    </span>
                  </div>
                  <div className="transaction-actions">
                    <b>{item.enabled ? "启用" : "停用"}</b>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                      onClick={() => onUpdateFeatureFlag(item.id, { enabled: !item.enabled })}
                    >
                      {updatingFeatureFlagId === item.id ? "提交中..." : item.enabled ? "停用" : "启用"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                      onClick={() => (editingFeatureFlagId === item.id ? cancelEditFeatureFlag() : startEditFeatureFlag(item.id))}
                    >
                      {editingFeatureFlagId === item.id ? "取消配置" : "编辑配置"}
                    </button>
                  </div>
                </div>
                {editingFeatureFlagId === item.id ? (
                  <div className="adjustment-form">
                    <div className="transaction-list">
                      {featureFlagConfigRows.length ? (
                        featureFlagConfigRows.map((configItem, index) => (
                          <div key={`${configItem.key}-${index}`} className="transaction-row">
                            <div className="settings-inline-editor">
                              <input
                                value={configItem.key}
                                onChange={(event) => updateFeatureFlagConfigEntry(index, { key: event.target.value })}
                                disabled={
                                  !canManageSettings ||
                                  classFrozen ||
                                  updatingFeatureFlagId === item.id ||
                                  !configItem.type
                                }
                                placeholder="键名"
                              />
                              {configItem.type ? (
                                <select
                                  value={configItem.type}
                                  onChange={(event) =>
                                    updateFeatureFlagConfigEntry(index, {
                                      type: event.target.value as FeatureFlagConfigPrimitiveType,
                                      value: event.target.value === "boolean" ? "false" : event.target.value === "null" ? "" : configItem.value
                                    })
                                  }
                                  disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                                >
                                  <option value="string">字符串</option>
                                  <option value="number">数字</option>
                                  <option value="boolean">布尔</option>
                                  <option value="null">空值</option>
                                </select>
                              ) : null}
                              {configItem.type === "boolean" ? (
                                <select
                                  value={configItem.value}
                                  onChange={(event) => updateFeatureFlagConfigEntry(index, { value: event.target.value })}
                                  disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                                >
                                  <option value="true">true</option>
                                  <option value="false">false</option>
                                </select>
                              ) : configItem.type === "null" ? (
                                <input value="" disabled placeholder="null" />
                              ) : (
                                <input
                                  value={configItem.value}
                                  onChange={(event) => updateFeatureFlagConfigEntry(index, { value: event.target.value })}
                                  disabled={
                                    !canManageSettings ||
                                    classFrozen ||
                                    updatingFeatureFlagId === item.id ||
                                    !configItem.type
                                  }
                                  placeholder={configItem.type ? "配置值" : "复杂结构请改用 JSON"}
                                />
                              )}
                            </div>
                            <div className="transaction-actions">
                              <span className="muted">{configItem.type ? "基础类型" : "复杂结构"}</span>
                              <button
                                type="button"
                                className="inline-action-button"
                                disabled={
                                  !canManageSettings ||
                                  classFrozen ||
                                  updatingFeatureFlagId === item.id ||
                                  !configItem.type
                                }
                                onClick={() => removeFeatureFlagConfigEntry(index)}
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="muted">当前没有配置项，可直接新增键值对。</p>
                      )}
                    </div>
                    <div className="student-filters">
                      <label>
                        <span>新增键名</span>
                        <input
                          value={newFeatureFlagConfigKey}
                          onChange={(event) => setNewFeatureFlagConfigKey(event.target.value)}
                          disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                          placeholder="例如：mode"
                        />
                      </label>
                      <label>
                        <span>值类型</span>
                        <select
                          value={newFeatureFlagConfigType}
                          onChange={(event) => setNewFeatureFlagConfigType(event.target.value as FeatureFlagConfigPrimitiveType)}
                          disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                        >
                          <option value="string">字符串</option>
                          <option value="number">数字</option>
                          <option value="boolean">布尔</option>
                          <option value="null">空值</option>
                        </select>
                      </label>
                      <label>
                        <span>新增值</span>
                        {newFeatureFlagConfigType === "boolean" ? (
                          <select
                            value={newFeatureFlagConfigValue}
                            onChange={(event) => setNewFeatureFlagConfigValue(event.target.value)}
                            disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                          >
                            <option value="">请选择</option>
                            <option value="true">true</option>
                            <option value="false">false</option>
                          </select>
                        ) : (
                          <input
                            value={newFeatureFlagConfigValue}
                            onChange={(event) => setNewFeatureFlagConfigValue(event.target.value)}
                            disabled={
                              !canManageSettings ||
                              classFrozen ||
                              updatingFeatureFlagId === item.id ||
                              newFeatureFlagConfigType === "null"
                            }
                            placeholder={newFeatureFlagConfigType === "null" ? "null" : "配置值"}
                          />
                        )}
                      </label>
                    </div>
                    <label>
                      <span>配置 JSON</span>
                      <textarea
                        rows={8}
                        value={featureFlagConfigDraft}
                        onChange={(event) => setFeatureFlagConfigDraft(event.target.value)}
                        disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                      />
                    </label>
                    <div className="import-footer">
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                        onClick={appendFeatureFlagConfigEntry}
                      >
                        新增配置项
                      </button>
                      <button
                        type="button"
                        className="adjustment-submit"
                        disabled={!canManageSettings || classFrozen || updatingFeatureFlagId === item.id}
                        onClick={() => submitFeatureFlagConfig(item.id)}
                      >
                        {updatingFeatureFlagId === item.id ? "提交中..." : "保存配置"}
                      </button>
                      <span className="muted">简单键值可直接编辑；嵌套对象或数组仍建议使用 JSON。</span>
                    </div>
                    {featureFlagConfigError ? <p className="warning-text">{featureFlagConfigError}</p> : null}
                  </div>
                ) : null}
              </div>
            ))}
            {!filteredFeatureFlags.length ? <p className="muted">{settings.featureFlags.length ? "当前筛选条件下没有匹配的功能开关" : "暂无功能开关"}</p> : null}
          </div>
        </>
      ) : (
        <p className="muted">当前班级暂无配置概览</p>
      )}
    </section>
  );
}
