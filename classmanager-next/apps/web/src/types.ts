export type LoginResponse = {
  accessToken: string;
  user: {
    id: string;
    username: string;
    displayName: string | null;
  };
  memberships: Array<{
    id: string;
    tenantId: string;
    status: string;
    roleCodes: string[];
    permissions: {
      canManagePoints: boolean;
    };
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  }>;
};

export type AdminMember = {
  id: string;
  tenantId: string;
  userId: string;
  displayName: string | null;
  status: string;
  joinedAt: string;
  roleCodes: string[];
  roles: Array<{
    id: string;
    tenantId: string;
    code: string;
    name: string;
    scope: string;
  }>;
  user: {
    id: string;
    username: string;
    email: string | null;
    displayName: string | null;
    status: string;
    lastLoginAt: string | null;
    createdAt?: string;
    updatedAt?: string;
  };
};

export type AdminMembersResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  adminMembership: {
    id: string;
    roleCodes: string[];
  };
  items: AdminMember[];
};

export type AdminRole = {
  id: string;
  tenantId: string | null;
  code: string;
  name: string;
  scope: string;
  assignedMembershipCount: number;
  createdAt: string;
  updatedAt: string;
};

export type AdminRolesResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  items: AdminRole[];
};

export type AdminAudit = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  actorUserId: string | null;
  actorMembershipId: string | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
  actorUser: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
};

export type AdminAuditsResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  adminMembership: {
    id: string;
    roleCodes: string[];
  };
  items: AdminAudit[];
};

export type AdminMemberDetailResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  adminMembership: {
    id: string;
    roleCodes: string[];
  };
  item: AdminMember;
  recentAudits: AdminAudit[];
};

export type AdminMemberRoleUpdateResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  item: AdminMember;
};

export type AdminMemberStatusUpdateResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  item: AdminMember;
};

export type AdminMemberInvitationResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  item: AdminMember;
};

export type AdminMemberPasswordUpdateResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  item: AdminMember;
};

export type AdminMemberDeleteResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  deleted: boolean;
  membershipId: string;
};

export type AdminSummaryResponse = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
  adminMembership: {
    id: string;
    roleCodes: string[];
  };
  totals: {
    members: number;
    activeMembers: number;
    disabledMembers: number;
    invitedMembers: number;
    roles: number;
    roleAuditLogs: number;
  };
};

export type ClassItem = {
  id: string;
  tenantId: string;
  name: string;
  code: string | null;
  timezone: string;
};

export type StudentItem = {
  id: string;
  legacyId: string | null;
  name: string;
  gender: string | null;
  status: string;
  sortOrder: number;
  account: {
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
  } | null;
  primaryGroup: {
    id: string;
    name: string;
    colorToken: string | null;
  } | null;
  primaryDorm: {
    id: string;
    name: string;
  } | null;
};

export type StudentStatusOptionItem = {
  value: string;
  label: string;
  participatesInDailyFlow: boolean;
};

export type StudentDetail = {
  student: {
    id: string;
    classId: string;
    legacyId: string | null;
    studentNo?: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder: number;
    account: {
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    } | null;
    profile: {
      titleLeft: string | null;
      titleRight: string | null;
      notes: string | null;
      avatarHappyData: string | null;
      avatarNormalData: string | null;
      avatarSadData: string | null;
      legacyAvatarPending: boolean;
    } | null;
    groups: Array<{
      roleCode: string | null;
      isPrimary: boolean;
      group: {
        id: string;
        name: string;
        colorToken: string | null;
      };
    }>;
    dorms: Array<{
      isPrimary: boolean;
      dormitory: {
        id: string;
        name: string;
      };
    }>;
    positions: Array<{
      position: {
        id: string;
        code: string;
        name: string;
        category: string;
      };
    }>;
  };
  recentTransactions: Array<{
    id: string;
    auditId: string | null;
    transactionType: string;
    value: string;
    reason: string;
    scene: string;
    category: string;
    sourceModule: string;
    occurredAt: string;
    isReverted: boolean;
  }>;
  deleteGuard: {
    canDelete: boolean;
    blockers: string[];
    cleanupMessages: string[];
  };
};

export type StudentUpdateResponse = {
  student: {
    id: string;
    classId: string;
    studentNo: string | null;
    name: string;
    gender: string | null;
    status: string;
    sortOrder: number;
  };
};

export type StudentCreateResponse = StudentUpdateResponse;

export type StudentDeleteResponse = {
  deleted: boolean;
  studentId: string;
  studentName: string;
};

export type StudentProfileUpdateResponse = {
  profile: {
    studentId: string;
    titleLeft: string | null;
    titleRight: string | null;
    notes: string | null;
    avatarHappyData: string | null;
    avatarNormalData: string | null;
    avatarSadData: string | null;
    legacyAvatarPending: boolean;
  };
};

export type StudentOrganizationUpdateResponse = {
  organization: {
    studentId: string;
    primaryGroup: {
      id: string;
      name: string;
    } | null;
    primaryDormitory: {
      id: string;
      name: string;
    } | null;
    positions: Array<{
      id: string;
      code: string;
      name: string;
      category: string;
    }>;
  };
};

export type StudentPositionBatchUpdateResponse = {
  requestedCount: number;
  updatedCount: number;
  positionIds: string[];
  positions: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
  }>;
  students: Array<{
    id: string;
    name: string;
  }>;
};

export type StudentOrganizationBatchUpdateResponse = {
  requestedCount: number;
  updatedCount: number;
  group: {
    id: string;
    name: string;
  } | null;
  dormitory: {
    id: string;
    name: string;
  } | null;
  students: Array<{
    id: string;
    name: string;
  }>;
};

export type StudentStatusBatchUpdateResponse = {
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  status: string;
  students: Array<{
    id: string;
    name: string;
  }>;
};

export type PointAdjustmentResponse = {
  student: {
    id: string;
    name: string;
  };
  transaction: {
    id: string;
    transactionType: string;
    value: string;
    reason: string;
    scene: string;
    category: string;
    occurredAt: string;
  };
  account: {
    id: string;
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
    version: number;
  };
};

export type PointBatchAdjustmentResponse = {
  requestedCount: number;
  adjustedCount: number;
  batchId: string;
  transactionType: "bonus" | "penalty";
  value: string;
  reason: string;
  items: Array<{
    student: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      transactionType: string;
      value: string;
      reason: string;
      scene: string;
      category: string;
      occurredAt: string;
    };
    account: {
      id: string;
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    };
  }>;
};

export type PointWageIssueResponse = {
  batchId: string;
  issuedCount: number;
  summary: {
    dailyWageTargets: number;
    psychologyCommitteeTargets: number;
    studentCouncilTargets: number;
  };
  items: Array<{
    student: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      transactionType: string;
      value: string;
      reason: string;
      scene: string;
      category: string;
      occurredAt: string;
    };
    account: {
      id: string;
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    };
  }>;
};

export type PointAccountHistoryRebuildResponse = {
  studentCount: number;
  transactionCount: number;
  updatedCount: number;
  createdCount: number;
  unchangedCount: number;
};

export type PointAccountMaintenanceImportResponse = {
  requestedCount: number;
  importedCount: number;
  updatedCount: number;
  createdCount: number;
  unchangedCount: number;
};

export type PointBatchRevertResponse = {
  requestedCount: number;
  revertedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      transactionType: string;
      value: string;
      reason: string;
      scene: string;
      category: string;
      occurredAt: string;
    };
    account: {
      id: string;
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    };
  }>;
};

export type PointBatchCorrectionResponse = PointBatchAdjustmentResponse & {
  revertedCount: number;
};

export type PointBatchAdjustmentHistoryItem = {
  batchId: string;
  transactionType: "bonus" | "penalty";
  value: string;
  reason: string;
  scene: string;
  category: string;
  occurredAt: string;
  createdAt: string;
  count: number;
  actorUserId: string | null;
};

export type PointBatchAdjustmentHistoryResponse = {
  items: PointBatchAdjustmentHistoryItem[];
};

export type PointRevertResponse = PointAdjustmentResponse;

export type PointAuditRevertResponse = PointRevertResponse;

export type PointAudit = {
  id: string;
  action: string;
  label: string;
  canRevert: boolean;
  transactionId: string | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUser: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
};

export type PointAuditsResponse = {
  filters: {
    limit: number;
  };
  items: PointAudit[];
};

export type PointsSummary = {
  studentCount: number;
  transactionCount: number;
  totals: {
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
  };
  topStudents: Array<{
    id: string;
    name: string;
    sortOrder: number;
    account: {
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
    } | null;
  }>;
};

export type LeaderboardItem = {
  rank: number;
  id: string;
  legacyId: string | null;
  name: string;
  gender: string | null;
  status: string;
  sortOrder: number;
  account: {
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
  } | null;
  primaryGroup: {
    id: string;
    name: string;
    colorToken: string | null;
  } | null;
  primaryDorm: {
    id: string;
    name: string;
  } | null;
};

export type LeaderboardResponse = {
  items: LeaderboardItem[];
};

export type AttendanceOverview = {
  feature: {
    attendanceEnabled: boolean;
  };
  policy: {
    latePenaltyValue: string;
    absentPenaltyValue: string;
    perfectAttendanceBonusValue: string;
    weekendRules: Record<string, unknown>;
    specialRules: Record<string, unknown>;
    isFrozen: boolean;
    updatedAt: string;
  } | null;
  schedules: Array<{
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    lateTime: string;
    isActive: boolean;
  }>;
  migration: {
    importedSessions: number;
    importedRecords: number;
    pendingSessions: number;
    pendingRecords: number;
    latestImportJob: {
      id: string;
      status: string;
      createdAt: string;
      finishedAt: string | null;
      summary: Record<string, unknown>;
    } | null;
  };
};

export type AttendancePolicyUpdateResponse = {
  policy: {
    latePenaltyValue: string;
    absentPenaltyValue: string;
    perfectAttendanceBonusValue: string;
    weekendRules: Record<string, unknown>;
    specialRules: Record<string, unknown>;
    isFrozen: boolean;
    updatedAt: string;
  };
};

export type AttendanceSchedulesUpdateResponse = {
  schedules: Array<{
    id: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    lateTime: string;
    isActive: boolean;
    displayOrder: number;
  }>;
  policy: {
    weekendRules: Record<string, unknown>;
    specialRules: Record<string, unknown>;
  } | null;
};

export type AttendanceSessionListItem = {
  id: string;
  sessionDate: string;
  sessionCode: string;
  sessionName: string;
  status: string;
  recordCount: number;
  summary: {
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
};

export type AttendanceSessionListResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    sessionCode: string | null;
    limit: number;
    availableSessionCodes: Array<{
      code: string;
      name: string;
    }>;
  };
  totals: {
    sessions: number;
    records: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  items: AttendanceSessionListItem[];
};

export type AttendanceRecordStatus = "present" | "late" | "absent" | "excused";

export type AttendanceSessionDetail = {
  session: {
    id: string;
    sessionDate: string;
    sessionCode: string;
    sessionName: string;
    status: string;
  };
  summary: {
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  items: Array<{
    id: string;
    status: AttendanceRecordStatus;
    checkInAt: string | null;
    recordedAt: string;
    note: string | null;
    source: string;
    legacyStudentName: string | null;
    student: {
      id: string;
      name: string;
      legacyId: string | null;
      sortOrder: number;
    };
  }>;
};

export type AttendanceMaintenanceExportResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    sessionCode: string | null;
  };
  schedules: Array<{
    id: string;
    code: string;
    name: string;
    displayOrder: number;
    isActive: boolean;
  }>;
  sessions: Array<{
    id: string;
    sessionDate: string;
    sessionCode: string;
    sessionName: string;
    status: string;
  }>;
  items: Array<{
    recordId: string;
    sessionId: string;
    sessionDate: string;
    sessionCode: string;
    sessionName: string;
    sessionStatus: string;
    studentId: string;
    studentName: string;
    studentSortOrder: number;
    status: AttendanceRecordStatus;
    checkInAt: string | null;
    recordedAt: string;
    note: string | null;
    source: string;
    legacyStudentName: string | null;
  }>;
};

export type AttendanceRecordUpdateResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  student: {
    id: string;
    name: string;
    legacyId: string | null;
  };
  record: {
    id: string;
    attendanceSessionId: string;
    status: AttendanceRecordStatus;
    note: string | null;
    checkInAt: string | null;
    recordedAt: string;
    source: string;
  };
};

export type AttendanceBatchUpdateResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  batchId: string;
  targetStatus: AttendanceRecordStatus;
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
      record: {
        id: string;
        attendanceSessionId: string;
        status: AttendanceRecordStatus;
        note: string | null;
      checkInAt: string | null;
      recordedAt: string;
      source: string;
    };
  }>;
};

export type AttendanceSessionCreateResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionCode: string;
    sessionName: string;
    status: string;
  };
  seeded: {
    studentCount: number;
    initialStatus: AttendanceRecordStatus;
  };
};

export type AttendanceRecordCreateResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  student: {
    id: string;
    name: string;
    legacyId: string | null;
  };
  record: {
    id: string;
    attendanceSessionId: string;
    status: AttendanceRecordStatus;
    note: string | null;
    checkInAt: string | null;
    recordedAt: string;
    source: string;
  };
};

export type AttendanceBatchCreateResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  batchId: string;
  targetStatus: AttendanceRecordStatus;
  requestedCount: number;
  createdCount: number;
  skippedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
      record: {
        id: string;
        attendanceSessionId: string;
        status: AttendanceRecordStatus;
        note: string | null;
      checkInAt: string | null;
      recordedAt: string;
      source: string;
    };
  }>;
};

export type AttendanceBatchRevertResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  requestedCount: number;
  revertedCount: number;
  skippedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
      record: {
        id: string;
        attendanceSessionId: string;
        status: AttendanceRecordStatus;
        note: string | null;
      checkInAt: string | null;
      recordedAt: string;
      source: string;
    };
  }>;
};

export type AttendanceBatchCreateRevertResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  requestedCount: number;
  revertedCount: number;
  skippedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
    recordId: string;
  }>;
};

export type AttendanceBatchHistoryItem = {
  batchId: string;
  operation: "batch_create" | "batch_update";
  status: AttendanceRecordStatus;
  count: number;
  recordedAt: string;
  actorUserId: string | null;
};

export type AttendanceBatchHistoryResponse = {
  items: AttendanceBatchHistoryItem[];
};

export type AttendanceBatchRevertByIdResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
  };
  batchId: string;
  operation: "batch_create" | "batch_update";
  requestedCount: number;
  revertedCount: number;
  skippedCount: number;
  items: Array<
    | {
        student: {
          id: string;
          name: string;
          legacyId: string | null;
        };
        record: {
          id: string;
          attendanceSessionId: string;
          status: string;
          note: string | null;
          checkInAt: string | null;
          recordedAt: string;
          source: string;
        };
      }
    | {
        student: {
          id: string;
          name: string;
          legacyId: string | null;
        };
        recordId: string;
      }
  >;
};

export type AttendanceIssueItem = {
  recordId: string;
  attendanceSessionId: string;
  status: AttendanceRecordStatus;
  note: string | null;
  checkInAt: string | null;
  recordedAt: string;
  source: string;
  pointTransactionId: string | null;
  session: {
    id: string;
    sessionDate: string;
    sessionCode: string;
    sessionName: string;
    status: string;
  };
  student: {
    id: string;
    name: string;
    legacyId: string | null;
    sortOrder: number;
  };
};

export type AttendanceIssuesResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    sessionCode: string | null;
    status: "late" | "absent" | "excused" | null;
    studentKeyword: string | null;
    limit: number;
  };
  totals: {
    records: number;
    late: number;
    absent: number;
    excused: number;
    settleableAbsent: number;
    settledAbsent: number;
  };
  items: AttendanceIssueItem[];
};

export type AttendanceIssueBatchUpdateResponse = {
  batchId: string;
  targetStatus: AttendanceRecordStatus;
  requestedCount: number;
  updatedCount: number;
  skippedCount: number;
  items: AttendanceIssueItem[];
};

export type AttendanceIssueAbsentSettleResponse = {
  batchId: string;
  requestedCount: number;
  settledCount: number;
  skippedCount: number;
  items: Array<{
    recordId: string;
    session: {
      id: string;
      sessionDate: string;
      sessionCode: string;
      sessionName: string;
      status: string;
    };
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
    transactionId: string;
    value: string;
  }>;
};

export type AttendanceSessionSettleResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
    status: string;
  };
  settledCount: number;
  skippedCount: number;
  items: Array<{
    recordId: string;
    studentId: string;
    studentName: string;
    transactionId: string;
    status: string;
    value: string;
  }>;
};

export type AttendanceSessionSettleRevertResponse = {
  session: {
    id: string;
    sessionDate: string;
    sessionName: string;
    status: string;
  };
  revertedCount: number;
  items: Array<{
    transactionId: string;
    studentId: string;
    studentName: string;
    revertedValue: string;
  }>;
};

export type AttendanceAudit = {
  id: string;
  action: string;
  label: string;
  targetType: string;
  targetId: string | null;
  canRevert: boolean;
  revertMode: "single_update" | "batch_update" | "batch_create" | null;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actorUser: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
};

export type AttendanceAuditsResponse = {
  filters: {
    sessionId: string | null;
    limit: number;
  };
  items: AttendanceAudit[];
};

export type AttendanceRecordRevertResponse = AttendanceRecordCreateResponse;

export type AttendanceAuditRevertResponse =
  | AttendanceRecordRevertResponse
  | AttendanceBatchRevertResponse
  | AttendanceBatchCreateRevertResponse;

export type AttendanceStudentStatsResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    sessionCode: string | null;
    limit: number;
    sortBy: "absent" | "late" | "attendanceRate" | "sortOrder";
  };
  totals: {
    students: number;
    records: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
      sortOrder: number;
      primaryGroup: {
        id: string;
        name: string;
      } | null;
    };
    total: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
  }>;
};

export type AttendanceDailyStatsResponse = {
  filters: {
    dateFrom: string | null;
    dateTo: string | null;
    sessionCode: string | null;
    limit: number;
    sortBy: "absent" | "late" | "attendanceRate" | "date";
  };
  totals: {
    days: number;
    sessions: number;
    records: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
  };
  items: Array<{
    sessionDate: string;
    sessions: number;
    records: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    attendanceRate: number;
    sessionNames: string[];
  }>;
};

export type HomeworkOverview = {
  range: {
    days: number;
    dateFrom: string;
  };
  totals: {
    subjects: number;
    homeworkDays: number;
    missingCount: number;
    registerCount: number;
  };
  subjects: Array<{
    subjectName: string;
    missingCount: number;
    registerCount: number;
    affectedStudentCount: number;
    lastHomeworkDate: string | null;
  }>;
  recentEvents: Array<{
    id: string;
    occurredAt: string;
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    transactionType: string;
    value: string;
    scene: string;
    category: string;
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
  }>;
  recentAudits: Array<{
    id: string;
    action: string;
    label: string;
    canRevert: boolean;
    transactionId: string | null;
    afterData: Record<string, unknown> | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actorUser: {
      id: string;
      username: string;
      displayName: string | null;
    } | null;
  }>;
};

export type HomeworkDetail = {
  filters: {
    homeworkDate: string | null;
    subjectName: string | null;
    days: number;
    availableHomeworkDates: string[];
    availableSubjects: string[];
  };
  totals: {
    events: number;
    missingCount: number;
    registerCount: number;
  };
  items: Array<{
    id: string;
    occurredAt: string;
    subjectName: string;
    homeworkDate: string;
    eventType: "missing" | "register";
    transactionType: string;
    value: string;
    scene: string;
    category: string;
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
  }>;
};

export type HomeworkStudentStats = {
  filters: {
    homeworkDate: string | null;
    subjectName: string | null;
    days: number;
    availableHomeworkDates: string[];
    availableSubjects: string[];
  };
  totals: {
    students: number;
    missingCount: number;
    registerCount: number;
  };
  items: Array<{
    student: {
      id: string;
      name: string;
      legacyId: string | null;
    };
    missingCount: number;
    registerCount: number;
  }>;
};

export type HomeworkRecordCreateResponse = {
  student: {
    id: string;
    name: string;
  };
  transaction: {
    id: string;
    transactionType: string;
    value: string;
    reason: string;
    scene: string;
    category: string;
    sourceModule: string | null;
    sourceType: string | null;
    occurredAt: string;
  };
  account: {
    id: string;
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
    version: number;
  };
};

export type HomeworkBatchRecordCreateResponse = {
  requestedCount: number;
  createdCount: number;
  skippedCount: number;
  representativeRequestedCount: number;
  representativeCreatedCount: number;
  representativeSkippedCount: number;
  batchId: string;
  subjectName: string;
  homeworkDate: string;
  eventType: "missing" | "register";
  value: string;
  items: Array<{
    student: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      transactionType: string;
      value: string;
      reason: string;
      scene: string;
      category: string;
      sourceModule: string | null;
      sourceType: string | null;
      occurredAt: string;
    };
    account: {
      id: string;
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    };
  }>;
};

export type HomeworkBatchRecordCorrectResponse = HomeworkBatchRecordCreateResponse & {
  revertedCount: number;
};

export type HomeworkBatchRecordRevertResponse = {
  requestedCount: number;
  revertedCount: number;
  items: Array<{
    student: {
      id: string;
      name: string;
    };
    transaction: {
      id: string;
      transactionType: string;
      value: string;
      reason: string;
      scene: string;
      category: string;
      sourceModule: string | null;
      sourceType: string | null;
      occurredAt: string;
    };
    account: {
      id: string;
      totalPoints: string;
      balancePoints: string;
      penaltyPoints: string;
      version: number;
    };
  }>;
};

export type HomeworkBatchHistoryItem = {
  batchId: string;
  transactionType: "penalty" | "reward";
  eventType: "missing" | "register";
  subjectName: string;
  homeworkDate: string;
  value: string;
  representativeRewardValue: string | null;
  reason: string;
  scene: string;
  category: string;
  occurredAt: string;
  createdAt: string;
  count: number;
  representativeCount: number;
  totalCount: number;
  actorUserId: string | null;
};

export type HomeworkBatchHistoryResponse = {
  items: HomeworkBatchHistoryItem[];
};

export type HomeworkRecordRevertResponse = HomeworkRecordCreateResponse;

export type HomeworkAuditRevertResponse = HomeworkRecordRevertResponse;

export type LegacyCompatData = {
  strategyDates?: {
    lastPeriodicTaskDate: string | null;
    lastPenaltyReductionDate: string | null;
  } | null;
  messages: Array<{
    id: string;
    content: string;
    time: string | null;
    date: string | null;
  }>;
  teacherMessages: Array<{
    id: string;
    content: string;
    time: string | null;
    date: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    desc: string;
    points: number;
    startTime: string | null;
    endTime: string | null;
    claimedByStudentIds: string[];
  }>;
  shop: {
    treasures: Array<{
      id: string;
      name: string;
      rarity: string;
      price: number;
      stock: number;
      desc: string;
      ladderPrices: number[];
      dailyLimit: number;
    }>;
    storage: Record<string, Record<string, number>>;
    logs: Array<{
      id: string;
      ts: number | null;
      studentName: string;
      action: string;
      itemName: string;
      rarity: string | null;
      cost: number;
      note: string | null;
    }>;
    redemptionHistory: Record<string, Record<string, number>>;
    dailyRedemptionCounts: Record<string, Record<string, number>>;
    dailyUsageCounts: Record<string, Record<string, number>>;
  };
  battle: {
    version: number;
    teams: Array<{
      id: string;
      name: string;
      memberStudentIds: string[];
      points: number;
    }>;
    squads: Array<{
      id: string;
      name: string;
      teamIds: string[];
    }>;
    battles: Array<{
      id: string;
      teamAId: string;
      teamBId: string;
      stake: number;
      isUnderdog: boolean;
    }>;
    logs: Array<{
      id: string;
      time: string | null;
      msg: string;
    }>;
    history: unknown[];
    settlements: unknown[];
    season: number;
    rules: Record<string, unknown>;
    exams: unknown[];
    teamBaseExamId: string | null;
    settleExamId: string | null;
  } | null;
};

export type LegacyTaskClaimResponse = {
  task: {
    id: string;
    title: string;
    points: number;
    claimedByStudentIds: string[];
  };
  student: {
    id: string;
    name: string;
  };
  transaction: {
    id: string;
    transactionType: string;
    value: string;
    reason: string;
    occurredAt: string;
  };
  account: {
    id: string;
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
    version: number;
  };
};

export type LegacyShopActionResponse = {
  action: string;
  student: {
    id: string;
    name: string;
  };
  item: {
    id: string;
    name: string;
    rarity: string | null;
    stock: number;
    storageCount: number;
    dailyUsageCount?: number;
  };
  price?: number;
  refundPrice?: number;
  transaction?: {
    id: string;
    transactionType: string;
    value: string;
    reason: string;
    occurredAt: string;
  };
  account?: {
    id: string;
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
    version: number;
  };
};

export type LegacyShopGachaResponse = {
  action: string;
  student: {
    id: string;
    name: string;
  };
  times: 1 | 10;
  cost: number;
  results: Array<{
    id: string;
    name: string;
    rarity: string;
  }>;
  transaction: {
    id: string;
    transactionType: string;
    value: string;
    reason: string;
    occurredAt: string;
  };
  account: {
    id: string;
    totalPoints: string;
    balancePoints: string;
    penaltyPoints: string;
    version: number;
  };
};

export type LegacyBattleSettleResponse = {
  settlement: {
    id: string;
    occurredAt: string;
    teamBaseExamId: string | null;
    settleExamId: string | null;
    teamBaseExamName: string | null;
    settleExamName: string | null;
    squadBonuses: string[];
    summaryText: string;
  };
  teams: Array<{
    id: string;
    name: string;
    currentPoints: number;
    newPoints: number;
    delta: number;
    won: boolean;
  }>;
  adjustments: Array<{
    studentId: string;
    studentName: string;
    teamId: string;
    teamName: string;
    transactionType: string;
    value: string;
    balancePoints: string;
    totalPoints: string;
  }>;
};

export type SettingsOverview = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    scheduleNotes: Record<string, unknown>;
    countdownEvents: unknown[];
    duty: Record<string, string[]>;
    quotes: string[];
    studentStatusOptions: StudentStatusOptionItem[];
    subjects: Array<{
      id: string;
      name: string;
      representativeStudentIds: string[];
    }>;
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId: string | null;
    }>;
    legacyCompat: LegacyCompatData | null;
    countdownEventsCount: number;
    scheduleNotesCount: number;
    countdownEventItems: Array<{
      id: string;
      title: string;
      date: string | null;
      note: string | null;
    }>;
    scheduleNoteItems: Array<{
      key: string;
      value: string;
    }>;
  } | null;
  totals: {
    groups: number;
    dormitories: number;
    positions: number;
    reasonTemplates: number;
    enabledFeatures: number;
  };
  groups: Array<{
    id: string;
    legacyKey: string | null;
    name: string;
    colorToken: string | null;
    isActive: boolean;
    membersCount: number;
  }>;
  dormitories: Array<{
    id: string;
    legacyKey: string | null;
    name: string;
    building: string | null;
    genderScope: string | null;
    isActive: boolean;
    membersCount: number;
  }>;
  positions: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    isActive: boolean;
    holdersCount: number;
  }>;
  reasonTemplateCategories: Array<{
    scene: string;
    category: string;
    count: number;
    totalValue: number;
  }>;
  reasonTemplates: Array<{
    id: string;
    name: string;
    value: string;
    transactionType: string;
    scene: string;
    category: string;
    isEditable: boolean;
    isActive: boolean;
  }>;
  featureFlags: Array<{
    id: string;
    code: string;
    enabled: boolean;
    config: Record<string, unknown>;
  }>;
  studentOptions: Array<{
    id: string;
    name: string;
    status: string;
    sortOrder: number;
    primaryGroupId: string | null;
    primaryGroupLegacyKey: string | null;
    primaryGroupName: string | null;
  }>;
};

export type SettingsReasonTemplateCreateResponse = {
  item: {
    id: string;
    name: string;
    value: string;
    transactionType: string;
    scene: string;
    category: string;
    isEditable: boolean;
    isActive: boolean;
  };
};

export type SettingsReasonTemplateUpdateResponse = {
  item: {
    id: string;
    name: string;
    value: string;
    transactionType: string;
    scene: string;
    category: string;
    isEditable: boolean;
    isActive: boolean;
  };
};

export type SettingsReasonTemplateDeleteResponse = {
  deleted: boolean;
};

export type SettingsClassFreezeUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
  };
};

export type SettingsClassConfigUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
  };
};

export type SettingsDutyUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    duty: Record<string, string[]>;
  };
};

export type SettingsQuotesUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    quotes: string[];
  };
};

export type SettingsGroupsUpdateResponse = {
  items: Array<{
    id: string;
    legacyKey: string | null;
    name: string;
    colorToken: string | null;
    isActive: boolean;
    membersCount: number;
  }>;
};

export type SettingsDormitoriesUpdateResponse = {
  items: Array<{
    id: string;
    legacyKey: string | null;
    name: string;
    building: string | null;
    genderScope: string | null;
    isActive: boolean;
    membersCount: number;
  }>;
};

export type SettingsPositionsUpdateResponse = {
  items: Array<{
    id: string;
    code: string;
    name: string;
    category: string;
    isActive: boolean;
    holdersCount: number;
  }>;
};

export type SettingsWageConfigUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    dailyWageAmount: number;
    dailyWageGroupIds: string[];
    psychologyCommitteeStudentIds: string[];
    lastWageDate?: string;
    studentCouncilRoles: Array<{
      id: string;
      name: string;
      studentId: string | null;
    }>;
  };
};

export type SettingsSubjectConfigUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    subjects: Array<{
      id: string;
      name: string;
      representativeStudentIds: string[];
    }>;
  };
};

export type SettingsStudentStatusConfigUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    studentStatusOptions: StudentStatusOptionItem[];
  };
};

export type SettingsScheduleNotesUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    scheduleNotes: Record<string, string>;
  };
};

export type SettingsCountdownEventsUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    countdownEvents: Array<{
      id?: string;
      title: string;
      date: string | null;
      note: string | null;
    }>;
  };
};

export type SettingsLegacyCompatUpdateResponse = {
  classConfig: {
    className: string;
    timezone: string;
    isFrozen: boolean;
    legacyCompat: LegacyCompatData | null;
  };
};

export type SettingsFeatureFlagUpdateResponse = {
  item: {
    id: string;
    code: string;
    enabled: boolean;
    config: Record<string, unknown>;
  };
};

export type ExportJobItem = {
  id: string;
  requestedByUserId?: string | null;
  requestedByUser?: {
    id: string;
    username: string;
    displayName: string | null;
  } | null;
  jobType: string;
  exportType: "full" | "settings" | "students" | "points" | "attendance" | "homework";
  filters: {
    dateFrom?: string | null;
    dateTo?: string | null;
  } | null;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  outputPath: string | null;
  downloadName?: string | null;
  fileAvailable?: boolean;
  fileState?: "pending" | "available" | "expired" | "missing" | "invalid_path" | "unavailable" | "manifest_only";
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt?: string;
  source?: "export_job";
  manifestEntry?: {
    exportedAt?: string;
    outputPath?: string | null;
    downloadName?: string | null;
    classId?: string;
    exportType?: string;
    counts?: Record<string, unknown>;
    filters?: Record<string, unknown> | null;
  } | null;
};

export type ExportAuditItem = {
  id: string;
  action?: string;
  createdAt: string;
  metadata: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
};

export type ExportManifestItem = {
  exportedAt: string;
  outputPath: string | null;
  downloadName?: string | null;
  fileAvailable?: boolean;
  fileState?: "manifest_only";
  classId: string;
  exportType: string;
  counts: Record<string, unknown>;
  filters: Record<string, unknown> | null;
};

export type ExportSummaryResponse = {
  classId: string;
  manifestUpdatedAt: string | null;
  latestJob: ExportJobItem | null;
  latestAudit: ExportAuditItem | null;
  manifestSummary: {
    classId: string;
    latestExportedAt: string;
    latestOutputPath: string | null;
    latestDownloadName?: string | null;
    latestExportType: string;
    totalExports: number;
    exportTypes: Record<string, number>;
  } | null;
  recentJobs: ExportJobItem[];
  recentAudits: ExportAuditItem[];
};

export type ExportHistoryResponse = {
  classId: string;
  manifestUpdatedAt: string | null;
  items: Array<ExportJobItem | ExportManifestItem>;
  manifestItems: ExportManifestItem[];
  audits: ExportAuditItem[];
};

export type ExportJobCreateResponse = ExportJobItem;
