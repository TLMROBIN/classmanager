import type {
  AdminAuditsResponse,
  AdminMemberDetailResponse,
  AdminMemberDeleteResponse,
  AdminMemberInvitationResponse,
  AdminMemberPasswordUpdateResponse,
  AdminMemberRoleUpdateResponse,
  AdminMemberStatusUpdateResponse,
  AdminMembersResponse,
  AdminRolesResponse,
  AdminSummaryResponse,
  AttendanceDailyStatsResponse,
  AttendanceIssueAbsentSettleResponse,
  AttendanceIssueBatchUpdateResponse,
  AttendanceIssuesResponse,
  AttendanceMaintenanceExportResponse,
  AttendanceRecordStatus,
  AttendanceSchedulesUpdateResponse,
  AttendanceSessionDetail,
  AttendanceSessionListItem,
  AttendanceSessionListResponse,
  AttendanceRecordUpdateResponse,
  AttendancePolicyUpdateResponse,
  AttendanceRecordCreateResponse,
  AttendanceRecordRevertResponse,
  AttendanceAuditRevertResponse,
  AttendanceBatchUpdateResponse,
  AttendanceBatchCreateResponse,
  AttendanceBatchRevertResponse,
  AttendanceBatchCreateRevertResponse,
  AttendanceBatchHistoryResponse,
  AttendanceBatchRevertByIdResponse,
  AttendanceSessionSettleResponse,
  AttendanceSessionSettleRevertResponse,
  AttendanceSessionCreateResponse,
  AttendanceStudentStatsResponse,
  AttendanceOverview,
  AttendanceAuditsResponse,
  ClassItem,
  HomeworkDetail,
  ExportHistoryResponse,
  ExportJobCreateResponse,
  ExportSummaryResponse,
  HomeworkBatchRecordCreateResponse,
  HomeworkBatchRecordCorrectResponse,
  HomeworkAuditRevertResponse,
  HomeworkBatchRecordRevertResponse,
  HomeworkBatchHistoryResponse,
  HomeworkRecordCreateResponse,
  HomeworkRecordRevertResponse,
  HomeworkOverview,
  HomeworkStudentStats,
  LegacyShopGachaResponse,
  LegacyBattleSettleResponse,
  LegacyTaskClaimResponse,
  PointAccountMaintenanceImportResponse,
  PointAccountHistoryRebuildResponse,
  LegacyShopActionResponse,
  LeaderboardResponse,
  LoginResponse,
  PointAdjustmentResponse,
  PointAuditRevertResponse,
  PointAuditsResponse,
  PointBatchAdjustmentResponse,
  PointBatchCorrectionResponse,
  PointBatchAdjustmentHistoryResponse,
  PointBatchRevertResponse,
  PointRevertResponse,
  PointWageIssueResponse,
  PointsSummary,
  SettingsOverview,
  SettingsClassFreezeUpdateResponse,
  SettingsClassConfigUpdateResponse,
  SettingsCountdownEventsUpdateResponse,
  SettingsDormitoriesUpdateResponse,
  SettingsDutyUpdateResponse,
  SettingsLegacyCompatUpdateResponse,
  SettingsScheduleNotesUpdateResponse,
  SettingsFeatureFlagUpdateResponse,
  SettingsGroupsUpdateResponse,
  SettingsPositionsUpdateResponse,
  SettingsQuotesUpdateResponse,
  SettingsReasonTemplateCreateResponse,
  SettingsReasonTemplateDeleteResponse,
  SettingsReasonTemplateUpdateResponse,
  SettingsStudentStatusConfigUpdateResponse,
  SettingsSubjectConfigUpdateResponse,
  SettingsWageConfigUpdateResponse,
  StudentCreateResponse,
  StudentDeleteResponse,
  StudentProfileUpdateResponse,
  StudentOrganizationUpdateResponse,
  StudentPositionBatchUpdateResponse,
  StudentOrganizationBatchUpdateResponse,
  StudentStatusBatchUpdateResponse,
  StudentUpdateResponse,
  StudentDetail,
  StudentItem
} from "../types";

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;

export const API_BASE = viteEnv?.VITE_API_BASE || "http://127.0.0.1:4010/api";

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    let payload: any = null;

    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    throw new ApiError(
      response.status,
      payload?.message || payload?.error || `API ${response.status}`,
      payload
    );
  }
  return response;
}

export async function login(username: string, password: string) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({ username, password })
  });

  await ensureOk(response);
  return (await response.json()) as LoginResponse;
}

export async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init?.headers || {})
    }
  });

  await ensureOk(response);
  return response.json() as Promise<T>;
}

export function fetchClasses(token: string, tenantId: string) {
  return apiFetch<{ items: ClassItem[] }>(`/classes?tenantId=${tenantId}`, token);
}

export function fetchStudents(token: string, classId: string) {
  return apiFetch<{ items: StudentItem[] }>(`/classes/${classId}/students`, token);
}

export function createStudent(
  token: string,
  classId: string,
  body: {
    studentNo?: string | null;
    name: string;
    gender?: string | null;
    status?: string;
    sortOrder?: number;
  }
) {
  return apiFetch<StudentCreateResponse>(`/classes/${classId}/students`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function fetchPointsSummary(token: string, classId: string) {
  return apiFetch<PointsSummary>(`/classes/${classId}/points/summary`, token);
}

export function createPointAdjustment(
  token: string,
  classId: string,
  body: {
    studentId: string;
    transactionType: "bonus" | "penalty" | "adjustment" | "reward" | "refund";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }
) {
  return apiFetch<PointAdjustmentResponse>(`/classes/${classId}/points/adjustments`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createPointBatchAdjustment(
  token: string,
  classId: string,
  body: {
    studentIds: string[];
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }
) {
  return apiFetch<PointBatchAdjustmentResponse>(`/classes/${classId}/points/batch-adjustments`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function issuePointWage(
  token: string,
  classId: string,
  body?: {
    occurredAt?: string;
  }
) {
  return apiFetch<PointWageIssueResponse>(`/classes/${classId}/points/wages/issue`, token, {
    method: "POST",
    body: JSON.stringify(body || {})
  });
}

export function rebuildPointAccountsFromHistory(token: string, classId: string) {
  return apiFetch<PointAccountHistoryRebuildResponse>(`/classes/${classId}/points/accounts/rebuild-from-history`, token, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export function importPointAccountsMaintenance(
  token: string,
  classId: string,
  body: {
    items: Array<{
      studentId: string;
      totalPoints: number;
      balancePoints: number;
      penaltyPoints: number;
    }>;
  }
) {
  return apiFetch<PointAccountMaintenanceImportResponse>(
    `/classes/${classId}/points/accounts/maintenance-import`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function fetchPointBatchAdjustments(token: string, classId: string, limit = 12) {
  return apiFetch<PointBatchAdjustmentHistoryResponse>(
    `/classes/${classId}/points/batch-adjustments?limit=${limit}`,
    token
  );
}

export function fetchPointAudits(token: string, classId: string, limit = 12) {
  return apiFetch<PointAuditsResponse>(`/classes/${classId}/points/audits?limit=${limit}`, token);
}

export function revertPointBatchAdjustment(
  token: string,
  classId: string,
  body: {
    transactionIds: string[];
  }
) {
  return apiFetch<PointBatchRevertResponse>(`/classes/${classId}/points/batch-adjustments/revert`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function revertPointBatchAdjustmentByBatchId(token: string, classId: string, batchId: string) {
  return apiFetch<{ revertedCount: number }>(
    `/classes/${classId}/points/batch-adjustments/${batchId}/revert`,
    token,
    {
      method: "POST"
    }
  );
}

export function correctPointBatchAdjustment(
  token: string,
  classId: string,
  batchId: string,
  body: {
    studentIds: string[];
    transactionType: "bonus" | "penalty";
    value: number;
    reason: string;
    scene: string;
    category: string;
  }
) {
  return apiFetch<PointBatchCorrectionResponse>(`/classes/${classId}/points/batch-adjustments/${batchId}/correct`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createHomeworkBatchRecord(
  token: string,
  classId: string,
  body: {
    studentIds: string[];
    representativeStudentIds?: string[];
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }
) {
  return apiFetch<HomeworkBatchRecordCreateResponse>(`/classes/${classId}/homework/records/batch`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function correctHomeworkBatchRecord(
  token: string,
  classId: string,
  batchId: string,
  body: {
    studentIds: string[];
    representativeStudentIds?: string[];
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }
) {
  return apiFetch<HomeworkBatchRecordCorrectResponse>(
    `/classes/${classId}/homework/records/batch/${batchId}/correct`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function fetchHomeworkBatchHistory(token: string, classId: string, limit = 12) {
  return apiFetch<HomeworkBatchHistoryResponse>(`/classes/${classId}/homework/records/batch?limit=${limit}`, token);
}

export function revertHomeworkBatchRecord(
  token: string,
  classId: string,
  body: {
    transactionIds: string[];
  }
) {
  return apiFetch<HomeworkBatchRecordRevertResponse>(`/classes/${classId}/homework/records/batch-revert`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function revertHomeworkBatchRecordByBatchId(token: string, classId: string, batchId: string) {
  return apiFetch<{ revertedCount: number }>(
    `/classes/${classId}/homework/records/batch/${batchId}/revert`,
    token,
    {
      method: "POST"
    }
  );
}

export function revertPointAdjustment(token: string, classId: string, transactionId: string) {
  return apiFetch<PointRevertResponse>(`/classes/${classId}/points/transactions/${transactionId}/revert`, token, {
    method: "POST"
  });
}

export function revertPointAudit(token: string, classId: string, auditId: string) {
  return apiFetch<PointAuditRevertResponse>(`/classes/${classId}/points/audits/${auditId}/revert`, token, {
    method: "POST"
  });
}

export function fetchLeaderboard(token: string, classId: string, search: string) {
  return apiFetch<LeaderboardResponse>(
    `/classes/${classId}/points/leaderboard?limit=8&search=${encodeURIComponent(search)}`,
    token
  );
}

export function fetchStudentDetail(token: string, studentId: string) {
  return apiFetch<StudentDetail>(`/students/${studentId}`, token);
}

export function updateStudent(
  token: string,
  studentId: string,
  body: {
    studentNo?: string | null;
    name?: string;
    gender?: string | null;
    status?: string;
    sortOrder?: number;
  }
) {
  return apiFetch<StudentUpdateResponse>(`/students/${studentId}`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function deleteStudent(token: string, studentId: string) {
  return apiFetch<StudentDeleteResponse>(`/students/${studentId}`, token, {
    method: "DELETE"
  });
}

export function updateStudentProfile(
  token: string,
  studentId: string,
  body: {
    titleLeft?: string | null;
    titleRight?: string | null;
    notes?: string | null;
    avatarHappyData?: string | null;
    avatarNormalData?: string | null;
    avatarSadData?: string | null;
  }
) {
  return apiFetch<StudentProfileUpdateResponse>(`/students/${studentId}/profile`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateStudentOrganization(
  token: string,
  studentId: string,
  body: {
    groupId?: string | null;
    dormitoryId?: string | null;
    positionIds?: string[];
  }
) {
  return apiFetch<StudentOrganizationUpdateResponse>(`/students/${studentId}/organization`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateStudentPositionsBatch(
  token: string,
  classId: string,
  body: {
    studentIds: string[];
    positionIds: string[];
  }
) {
  return apiFetch<StudentPositionBatchUpdateResponse>(`/classes/${classId}/students/positions/batch`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateStudentOrganizationBatch(
  token: string,
  classId: string,
  body: {
    studentIds: string[];
    groupId?: string | null;
    dormitoryId?: string | null;
  }
) {
  return apiFetch<StudentOrganizationBatchUpdateResponse>(`/classes/${classId}/students/organization/batch`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateStudentStatusBatch(
  token: string,
  classId: string,
  body: {
    studentIds: string[];
    status: string;
  }
) {
  return apiFetch<StudentStatusBatchUpdateResponse>(`/classes/${classId}/students/status/batch`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function createSettingsReasonTemplate(
  token: string,
  classId: string,
  body: {
    name: string;
    value: number;
    transactionType: "bonus" | "penalty" | "reward";
    scene: string;
    category: string;
  }
) {
  return apiFetch<SettingsReasonTemplateCreateResponse>(`/classes/${classId}/settings/reason-templates`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createSettingsReasonTemplatesBatch(
  token: string,
  classId: string,
  body: {
    items: Array<{
      name: string;
      value: number;
      transactionType: "bonus" | "penalty" | "reward";
      scene: string;
      category: string;
    }>;
  }
) {
  return apiFetch<{ createdCount: number }>(`/classes/${classId}/settings/reason-templates/batch`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function precheckSettingsReasonTemplatesBatch(
  token: string,
  classId: string,
  body: {
    names: string[];
  }
) {
  return apiFetch<{ existingNames: string[] }>(`/classes/${classId}/settings/reason-templates/batch/precheck`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function updateSettingsReasonTemplate(
  token: string,
  classId: string,
  templateId: string,
  body: {
    name?: string;
    value?: number;
    transactionType?: "bonus" | "penalty" | "reward";
    scene?: string;
    category?: string;
    isActive?: boolean;
  }
) {
  return apiFetch<SettingsReasonTemplateUpdateResponse>(
    `/classes/${classId}/settings/reason-templates/${templateId}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify(body)
    }
  );
}

export function deleteSettingsReasonTemplate(token: string, classId: string, templateId: string) {
  return apiFetch<SettingsReasonTemplateDeleteResponse>(
    `/classes/${classId}/settings/reason-templates/${templateId}`,
    token,
    {
      method: "DELETE"
    }
  );
}

export function reorderSettingsReasonTemplates(
  token: string,
  classId: string,
  body: {
    templateIds: string[];
  }
) {
  return apiFetch<{ items: Array<{ id: string; displayOrder: number }> }>(
    `/classes/${classId}/settings/reason-templates/reorder`,
    token,
    {
      method: "PUT",
      body: JSON.stringify(body)
    }
  );
}

export function updateSettingsReasonTemplateCategory(
  token: string,
  classId: string,
  body: {
    scene: string;
    category: string;
    nextScene: string;
    nextCategory: string;
  }
) {
  return apiFetch<{ updatedCount: number }>(`/classes/${classId}/settings/reason-templates/categories`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsClassFreeze(
  token: string,
  classId: string,
  body: {
    isFrozen: boolean;
  }
) {
  return apiFetch<SettingsClassFreezeUpdateResponse>(`/classes/${classId}/settings/class-freeze`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsClassConfig(
  token: string,
  classId: string,
  body: {
    className: string;
    timezone: string;
  }
) {
  return apiFetch<SettingsClassConfigUpdateResponse>(`/classes/${classId}/settings/class-config`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsDuty(
  token: string,
  classId: string,
  body: {
    duty: Record<string, string[]>;
  }
) {
  return apiFetch<SettingsDutyUpdateResponse>(`/classes/${classId}/settings/duty`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsQuotes(
  token: string,
  classId: string,
  body: {
    quotes: string[];
  }
) {
  return apiFetch<SettingsQuotesUpdateResponse>(`/classes/${classId}/settings/quotes`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsLegacyCompat(
  token: string,
  classId: string,
  body: {
    legacyCompat: unknown;
  }
) {
  return apiFetch<SettingsLegacyCompatUpdateResponse>(`/classes/${classId}/settings/legacy-compat`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function claimLegacyTask(
  token: string,
  classId: string,
  taskId: string,
  body: {
    studentId: string;
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyTaskClaimResponse>(`/classes/${classId}/legacy/tasks/${taskId}/claim`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function redeemLegacyShopItem(
  token: string,
  classId: string,
  body: {
    studentId: string;
    itemId: string;
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyShopActionResponse>(`/classes/${classId}/legacy/shop/redeem`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function gachaLegacyShop(
  token: string,
  classId: string,
  body: {
    studentId: string;
    times: 1 | 10;
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyShopGachaResponse>(`/classes/${classId}/legacy/shop/gacha`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function useLegacyShopItem(
  token: string,
  classId: string,
  body: {
    studentId: string;
    itemId: string;
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyShopActionResponse>(`/classes/${classId}/legacy/shop/use`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function returnLegacyShopItem(
  token: string,
  classId: string,
  body: {
    studentId: string;
    itemId: string;
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyShopActionResponse>(`/classes/${classId}/legacy/shop/return`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function settleLegacyBattle(
  token: string,
  classId: string,
  body?: {
    occurredAt?: string;
  }
) {
  return apiFetch<LegacyBattleSettleResponse>(`/classes/${classId}/legacy/battle/settle`, token, {
    method: "POST",
    body: JSON.stringify(body || {})
  });
}

export function updateSettingsGroups(
  token: string,
  classId: string,
  body: {
    groups: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      colorToken?: string | null;
      isActive?: boolean;
    }>;
  }
) {
  return apiFetch<SettingsGroupsUpdateResponse>(`/classes/${classId}/settings/groups`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsDormitories(
  token: string,
  classId: string,
  body: {
    dormitories: Array<{
      id?: string;
      legacyKey?: string | null;
      name: string;
      building?: string | null;
      genderScope?: string | null;
      isActive?: boolean;
    }>;
  }
) {
  return apiFetch<SettingsDormitoriesUpdateResponse>(`/classes/${classId}/settings/dormitories`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsPositions(
  token: string,
  classId: string,
  body: {
    positions: Array<{
      id?: string;
      code: string;
      name: string;
      category: string;
      isActive?: boolean;
    }>;
  }
) {
  return apiFetch<SettingsPositionsUpdateResponse>(`/classes/${classId}/settings/positions`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsScheduleNotes(
  token: string,
  classId: string,
  body: {
    scheduleNotes: Record<string, string>;
  }
) {
  return apiFetch<SettingsScheduleNotesUpdateResponse>(`/classes/${classId}/settings/schedule-notes`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsCountdownEvents(
  token: string,
  classId: string,
  body: {
    countdownEvents: Array<{
      id?: string;
      title: string;
      date?: string | null;
      note?: string | null;
    }>;
  }
) {
  return apiFetch<SettingsCountdownEventsUpdateResponse>(`/classes/${classId}/settings/countdown-events`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsWageConfig(
  token: string,
  classId: string,
  body: {
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string | null;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId?: string | null;
    }>;
  }
) {
  return apiFetch<SettingsWageConfigUpdateResponse>(`/classes/${classId}/settings/wage-config`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsSubjects(
  token: string,
  classId: string,
  body: {
    subjects: Array<{
      id: string;
      name: string;
      representativeStudentIds: string[];
    }>;
  }
) {
  return apiFetch<SettingsSubjectConfigUpdateResponse>(`/classes/${classId}/settings/subjects`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsStudentStatuses(
  token: string,
  classId: string,
  body: {
    studentStatusOptions: Array<{
      value: string;
      label: string;
      participatesInDailyFlow: boolean;
    }>;
  }
) {
  return apiFetch<SettingsStudentStatusConfigUpdateResponse>(`/classes/${classId}/settings/student-statuses`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateSettingsFeatureFlag(
  token: string,
  classId: string,
  featureFlagId: string,
  body: {
    enabled?: boolean;
    config?: Record<string, unknown>;
  }
) {
  return apiFetch<SettingsFeatureFlagUpdateResponse>(
    `/classes/${classId}/settings/feature-flags/${featureFlagId}`,
    token,
    {
      method: "PUT",
      body: JSON.stringify(body)
    }
  );
}

export function fetchAttendanceOverview(token: string, classId: string) {
  return apiFetch<AttendanceOverview>(`/classes/${classId}/attendance/overview`, token);
}

export function updateAttendanceSchedules(
  token: string,
  classId: string,
  body: {
    items: Array<{
      id?: string;
      code: string;
      name: string;
      startTime: string;
      endTime: string;
      lateTime: string;
      isActive?: boolean;
    }>;
  }
) {
  return apiFetch<AttendanceSchedulesUpdateResponse>(`/classes/${classId}/attendance/schedules`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateAttendancePolicy(
  token: string,
  classId: string,
  body: {
    latePenaltyValue: number;
    absentPenaltyValue: number;
    perfectAttendanceBonusValue: number;
    weekendRules: Record<string, string[]>;
    specialRules: Record<string, unknown>;
  }
) {
  return apiFetch<AttendancePolicyUpdateResponse>(`/classes/${classId}/attendance/policy`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function fetchAttendanceAudits(
  token: string,
  classId: string,
  filters?: {
    sessionId?: string;
    limit?: number;
  }
) {
  const search = new URLSearchParams();
  if (filters?.sessionId) search.set("sessionId", filters.sessionId);
  if (filters?.limit) search.set("limit", String(filters.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceAuditsResponse>(`/classes/${classId}/attendance/audits${suffix}`, token);
}

export function fetchAttendanceIssues(
  token: string,
  classId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sessionCode?: string;
    status?: "late" | "absent" | "excused";
    studentKeyword?: string;
    limit?: number;
  }
) {
  const search = new URLSearchParams();
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.sessionCode) search.set("sessionCode", filters.sessionCode);
  if (filters?.status) search.set("status", filters.status);
  if (filters?.studentKeyword) search.set("studentKeyword", filters.studentKeyword);
  if (filters?.limit) search.set("limit", String(filters.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceIssuesResponse>(`/classes/${classId}/attendance/issues${suffix}`, token);
}

export function fetchAttendanceSessions(
  token: string,
  classId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sessionCode?: string;
    limit?: number;
  }
) {
  const search = new URLSearchParams();
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.sessionCode) search.set("sessionCode", filters.sessionCode);
  if (filters?.limit) search.set("limit", String(filters.limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceSessionListResponse>(
    `/classes/${classId}/attendance/sessions${suffix}`,
    token
  );
}

export function fetchAttendanceMaintenanceExport(
  token: string,
  classId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sessionCode?: string;
  }
) {
  const search = new URLSearchParams();
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.sessionCode) search.set("sessionCode", filters.sessionCode);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceMaintenanceExportResponse>(
    `/classes/${classId}/attendance/export${suffix}`,
    token
  );
}

export function fetchAttendanceSessionDetail(token: string, sessionId: string) {
  return apiFetch<AttendanceSessionDetail>(`/attendance/sessions/${sessionId}`, token);
}

export function updateAttendanceRecord(
  token: string,
  classId: string,
  recordId: string,
  body: {
    status: AttendanceRecordStatus;
    checkInAt?: string | null;
  }
) {
  return apiFetch<AttendanceRecordUpdateResponse>(`/classes/${classId}/attendance/records/${recordId}`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function updateAttendanceRecordBatch(
  token: string,
  classId: string,
  sessionId: string,
  body: {
    recordIds: string[];
    status: AttendanceRecordStatus;
  }
) {
  return apiFetch<AttendanceBatchUpdateResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch-status`,
    token,
    {
      method: "PUT",
      body: JSON.stringify(body)
    }
  );
}

export function updateAttendanceIssuesStatus(
  token: string,
  classId: string,
  body: {
    recordIds: string[];
    status: AttendanceRecordStatus;
  }
) {
  return apiFetch<AttendanceIssueBatchUpdateResponse>(`/classes/${classId}/attendance/issues/status`, token, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

export function settleAttendanceIssuesAbsent(
  token: string,
  classId: string,
  body: {
    recordIds: string[];
  }
) {
  return apiFetch<AttendanceIssueAbsentSettleResponse>(
    `/classes/${classId}/attendance/issues/settle-absent`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function createAttendanceSession(
  token: string,
  classId: string,
  body: {
    sessionDate: string;
    sessionCode: string;
    initialStatus: AttendanceRecordStatus;
    seedDailyParticipantStudents?: boolean;
    allowInactiveSchedule?: boolean;
  }
) {
  return apiFetch<AttendanceSessionCreateResponse>(`/classes/${classId}/attendance/sessions`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function settleAttendanceSession(token: string, classId: string, sessionId: string) {
  return apiFetch<AttendanceSessionSettleResponse>(`/classes/${classId}/attendance/sessions/${sessionId}/settle`, token, {
    method: "POST"
  });
}

export function revertAttendanceSessionSettlement(token: string, classId: string, sessionId: string) {
  return apiFetch<AttendanceSessionSettleRevertResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/revert-latest-settlement`,
    token,
    {
      method: "POST"
    }
  );
}

export function createAttendanceRecord(
  token: string,
  classId: string,
  sessionId: string,
  body: {
    studentId: string;
    status: AttendanceRecordStatus;
    checkInAt?: string | null;
    allowNonDailyParticipant?: boolean;
  }
) {
  return apiFetch<AttendanceRecordCreateResponse>(`/classes/${classId}/attendance/sessions/${sessionId}/records`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function createAttendanceRecordsBatch(
  token: string,
  classId: string,
  sessionId: string,
  body: {
    studentIds: string[];
    status: AttendanceRecordStatus;
  }
) {
  return apiFetch<AttendanceBatchCreateResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch-create`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function fetchAttendanceBatchHistory(token: string, classId: string, sessionId: string, limit = 12) {
  const search = new URLSearchParams();
  if (limit) search.set("limit", String(limit));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceBatchHistoryResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch${suffix}`,
    token
  );
}

export function revertAttendanceRecordBatchById(token: string, classId: string, sessionId: string, batchId: string) {
  return apiFetch<AttendanceBatchRevertByIdResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch/${batchId}/revert`,
    token,
    {
      method: "POST"
    }
  );
}

export function revertAttendanceRecordLatest(token: string, classId: string, recordId: string) {
  return apiFetch<AttendanceRecordRevertResponse>(`/classes/${classId}/attendance/records/${recordId}/revert-latest`, token, {
    method: "POST"
  });
}

export function revertAttendanceAudit(token: string, classId: string, auditId: string) {
  return apiFetch<AttendanceAuditRevertResponse>(`/classes/${classId}/attendance/audits/${auditId}/revert`, token, {
    method: "POST"
  });
}

export function revertAttendanceRecordBatchLatest(
  token: string,
  classId: string,
  sessionId: string,
  body: {
    recordIds: string[];
  }
) {
  return apiFetch<AttendanceBatchRevertResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch-revert-latest`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function revertAttendanceRecordBatchCreateLatest(
  token: string,
  classId: string,
  sessionId: string,
  body: {
    recordIds: string[];
  }
) {
  return apiFetch<AttendanceBatchCreateRevertResponse>(
    `/classes/${classId}/attendance/sessions/${sessionId}/records/batch-revert-create-latest`,
    token,
    {
      method: "POST",
      body: JSON.stringify(body)
    }
  );
}

export function fetchAttendanceStudentStats(
  token: string,
  classId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sessionCode?: string;
    limit?: number;
    sortBy?: "absent" | "late" | "attendanceRate" | "sortOrder";
  }
) {
  const search = new URLSearchParams();
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.sessionCode) search.set("sessionCode", filters.sessionCode);
  if (filters?.limit) search.set("limit", String(filters.limit));
  if (filters?.sortBy) search.set("sortBy", filters.sortBy);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceStudentStatsResponse>(
    `/classes/${classId}/attendance/student-stats${suffix}`,
    token
  );
}

export function fetchAttendanceDailyStats(
  token: string,
  classId: string,
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    sessionCode?: string;
    limit?: number;
    sortBy?: "absent" | "late" | "attendanceRate" | "date";
  }
) {
  const search = new URLSearchParams();
  if (filters?.dateFrom) search.set("dateFrom", filters.dateFrom);
  if (filters?.dateTo) search.set("dateTo", filters.dateTo);
  if (filters?.sessionCode) search.set("sessionCode", filters.sessionCode);
  if (filters?.limit) search.set("limit", String(filters.limit));
  if (filters?.sortBy) search.set("sortBy", filters.sortBy);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AttendanceDailyStatsResponse>(
    `/classes/${classId}/attendance/daily-stats${suffix}`,
    token
  );
}

export function fetchHomeworkOverview(token: string, classId: string, days = 14) {
  return apiFetch<HomeworkOverview>(`/classes/${classId}/homework/overview?days=${days}`, token);
}

export function fetchHomeworkDetail(
  token: string,
  classId: string,
  filters?: {
    homeworkDate?: string;
    subjectName?: string;
    days?: number;
  }
) {
  const search = new URLSearchParams();
  if (filters?.homeworkDate) search.set("homeworkDate", filters.homeworkDate);
  if (filters?.subjectName) search.set("subjectName", filters.subjectName);
  if (filters?.days) search.set("days", String(filters.days));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<HomeworkDetail>(`/classes/${classId}/homework/detail${suffix}`, token);
}

export function fetchHomeworkStudentStats(
  token: string,
  classId: string,
  filters?: {
    homeworkDate?: string;
    subjectName?: string;
    days?: number;
  }
) {
  const search = new URLSearchParams();
  if (filters?.homeworkDate) search.set("homeworkDate", filters.homeworkDate);
  if (filters?.subjectName) search.set("subjectName", filters.subjectName);
  if (filters?.days) search.set("days", String(filters.days));
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<HomeworkStudentStats>(`/classes/${classId}/homework/student-stats${suffix}`, token);
}

export function createHomeworkRecord(
  token: string,
  classId: string,
  body: {
    studentId: string;
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    value: number;
  }
) {
  return apiFetch<HomeworkRecordCreateResponse>(`/classes/${classId}/homework/records`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export function revertHomeworkRecord(token: string, classId: string, transactionId: string) {
  return apiFetch<HomeworkRecordRevertResponse>(`/classes/${classId}/homework/records/${transactionId}/revert`, token, {
    method: "POST"
  });
}

export function revertHomeworkAudit(token: string, classId: string, auditId: string) {
  return apiFetch<HomeworkAuditRevertResponse>(`/classes/${classId}/homework/audits/${auditId}/revert`, token, {
    method: "POST"
  });
}

export function fetchSettingsOverview(token: string, classId: string) {
  return apiFetch<SettingsOverview>(`/classes/${classId}/settings/overview`, token);
}

export function fetchExportSummary(token: string, classId: string, limit = 8) {
  return apiFetch<ExportSummaryResponse>(`/classes/${classId}/exports/summary?limit=${limit}`, token);
}

export function fetchExportHistory(token: string, classId: string, limit = 12) {
  return apiFetch<ExportHistoryResponse>(`/classes/${classId}/exports/history?limit=${limit}`, token);
}

export function createExportJob(
  token: string,
  classId: string,
  body: {
    exportType: "full" | "settings" | "students" | "points" | "attendance" | "homework";
    dateFrom?: string;
    dateTo?: string;
  }
) {
  return apiFetch<ExportJobCreateResponse>(`/classes/${classId}/export-jobs`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}

export async function downloadStructuredExport(
  token: string,
  classId: string,
  input: {
    exportType: "full" | "settings" | "students" | "points" | "attendance" | "homework";
    dateFrom?: string;
    dateTo?: string;
  }
) {
  const search = new URLSearchParams();
  search.set("domain", input.exportType);
  if (input.dateFrom) {
    search.set("dateFrom", input.dateFrom);
  }
  if (input.dateTo) {
    search.set("dateTo", input.dateTo);
  }

  const response = await fetch(`${API_BASE}/classes/${classId}/exports/structured?${search.toString()}`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(response.status, message, null);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const matchedFilename = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob,
    filename: matchedFilename?.[1] || `class-export-${input.exportType}-${classId}.json`
  };
}

export function restoreStructuredFullBackup(token: string, classId: string, backup: unknown) {
  return apiFetch<{
    classId: string;
    importJobId: string;
    exportedAt: string | null;
    counts: Record<string, unknown>;
    limitations: string[];
  }>(`/classes/${classId}/exports/structured-full/restore`, token, {
    method: "POST",
    body: JSON.stringify(backup)
  });
}

export async function downloadExportJob(token: string, jobId: string) {
  const response = await fetch(`${API_BASE}/export-jobs/${jobId}/download`, {
    headers: {
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    let message = `API ${response.status}`;
    try {
      const payload = await response.json();
      message = payload.message || payload.error || message;
    } catch {
      // ignore non-json error body
    }
    throw new ApiError(response.status, message, null);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const matchedFilename = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob,
    filename: matchedFilename?.[1] || `export-job-${jobId}.json`
  };
}

export function fetchAdminMembers(
  token: string,
  tenantId: string,
  filters?: {
    limit?: number;
    status?: "active" | "disabled" | "invited";
    search?: string;
    roleCode?: string;
    sortBy?: "status" | "joinedAt" | "lastLoginAt";
  }
) {
  const search = new URLSearchParams();
  if (filters?.limit) search.set("limit", String(filters.limit));
  if (filters?.status) search.set("status", filters.status);
  if (filters?.search) search.set("search", filters.search);
  if (filters?.roleCode) search.set("roleCode", filters.roleCode);
  if (filters?.sortBy) search.set("sortBy", filters.sortBy);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AdminMembersResponse>(`/tenants/${tenantId}/admin/members${suffix}`, token);
}

export function fetchAdminSummary(token: string, tenantId: string) {
  return apiFetch<AdminSummaryResponse>(`/tenants/${tenantId}/admin/summary`, token);
}

export function fetchAdminMemberDetail(token: string, tenantId: string, membershipId: string) {
  return apiFetch<AdminMemberDetailResponse>(`/tenants/${tenantId}/admin/members/${membershipId}`, token);
}

export function fetchAdminRoles(token: string, tenantId: string) {
  return apiFetch<AdminRolesResponse>(`/tenants/${tenantId}/admin/roles`, token);
}

export function fetchAdminAudits(
  token: string,
  tenantId: string,
  filters?: {
    limit?: number;
    membershipId?: string;
    action?:
      | "membership.roles.update"
      | "membership.status.disable"
      | "membership.status.enable"
      | "membership.invite.create"
      | "membership.password.set"
      | "membership.delete";
  }
) {
  const search = new URLSearchParams();
  if (filters?.limit) search.set("limit", String(filters.limit));
  if (filters?.membershipId) search.set("membershipId", filters.membershipId);
  if (filters?.action) search.set("action", filters.action);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<AdminAuditsResponse>(`/tenants/${tenantId}/admin/audits${suffix}`, token);
}

export function updateAdminMemberRoles(token: string, tenantId: string, membershipId: string, roleCodes: string[]) {
  return apiFetch<AdminMemberRoleUpdateResponse>(`/tenants/${tenantId}/admin/members/${membershipId}/roles`, token, {
    method: "PUT",
    body: JSON.stringify({ roleCodes })
  });
}

export function updateAdminMemberStatus(
  token: string,
  tenantId: string,
  membershipId: string,
  status: "active" | "disabled"
) {
  return apiFetch<AdminMemberStatusUpdateResponse>(`/tenants/${tenantId}/admin/members/${membershipId}/status`, token, {
    method: "PUT",
    body: JSON.stringify({ status })
  });
}

export function updateAdminMemberPassword(
  token: string,
  tenantId: string,
  membershipId: string,
  password: string
) {
  return apiFetch<AdminMemberPasswordUpdateResponse>(
    `/tenants/${tenantId}/admin/members/${membershipId}/password`,
    token,
    {
      method: "PUT",
      body: JSON.stringify({ password })
    }
  );
}

export function deleteAdminMember(token: string, tenantId: string, membershipId: string) {
  return apiFetch<AdminMemberDeleteResponse>(`/tenants/${tenantId}/admin/members/${membershipId}`, token, {
    method: "DELETE"
  });
}

export function createAdminInvitation(
  token: string,
  tenantId: string,
  body: {
    username: string;
    displayName: string;
    email?: string;
    roleCodes: string[];
  }
) {
  return apiFetch<AdminMemberInvitationResponse>(`/tenants/${tenantId}/admin/members/invitations`, token, {
    method: "POST",
    body: JSON.stringify(body)
  });
}
