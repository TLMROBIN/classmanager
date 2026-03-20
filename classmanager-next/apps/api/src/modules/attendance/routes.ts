import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";
import { canManagePoints } from "../../lib/permissions.js";
import { getDailyParticipantStatusValues } from "../../lib/studentStatus.js";

const attendanceRecordStatusValues = ["present", "late", "absent", "excused"] as const;
type AttendanceRecordStatus = (typeof attendanceRecordStatusValues)[number];
type AttendancePenaltyStatus = Extract<AttendanceRecordStatus, "late" | "absent">;
type AttendanceStatusSummary = {
  present: number;
  late: number;
  absent: number;
  excused: number;
};

const attendanceRecordStatusSchema = z.enum(attendanceRecordStatusValues);

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const sessionParamsSchema = z.object({
  sessionId: z.string().uuid()
});

const attendanceSessionParamsSchema = z.object({
  classId: z.string().uuid(),
  sessionId: z.string().uuid()
});

const attendanceRecordParamsSchema = z.object({
  classId: z.string().uuid(),
  recordId: z.string().uuid()
});

const attendanceRecordUpdateBodySchema = z.object({
  status: attendanceRecordStatusSchema,
  checkInAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional()
});

const attendanceRecordRevertParamsSchema = z.object({
  classId: z.string().uuid(),
  recordId: z.string().uuid()
});

const attendanceAuditRevertParamsSchema = z.object({
  classId: z.string().uuid(),
  auditId: z.string().uuid()
});

const attendanceSessionCreateBodySchema = z
  .object({
    sessionDate: z.string().date(),
    sessionCode: z.string().trim().min(1),
    initialStatus: attendanceRecordStatusSchema.default("present"),
    seedDailyParticipantStudents: z.boolean().optional(),
    seedAllActiveStudents: z.boolean().optional(),
    allowInactiveSchedule: z.boolean().optional().default(false)
  })
  .transform((body) => ({
    ...body,
    seedDailyParticipantStudents: body.seedDailyParticipantStudents ?? body.seedAllActiveStudents ?? true
  }));

const attendanceRecordCreateBodySchema = z
  .object({
    studentId: z.string().uuid(),
    status: attendanceRecordStatusSchema.default("present"),
    checkInAt: z.union([z.string().datetime({ offset: true }), z.null()]).optional(),
    allowNonDailyParticipant: z.boolean().optional(),
    allowInactiveStudent: z.boolean().optional()
  })
  .transform((body) => ({
    ...body,
    allowNonDailyParticipant: body.allowNonDailyParticipant ?? body.allowInactiveStudent ?? false
  }));

const attendanceRecordBatchCreateBodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(60),
  status: attendanceRecordStatusSchema.default("present")
});

const attendanceBatchUpdateBodySchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(60),
  status: attendanceRecordStatusSchema
});

const attendanceBatchRevertBodySchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(60)
});

const attendanceBatchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20)
});

const attendanceBatchIdParamsSchema = z.object({
  classId: z.string().uuid(),
  sessionId: z.string().uuid(),
  batchId: z.string().uuid()
});

const attendancePolicyUpdateBodySchema = z.object({
  latePenaltyValue: z.coerce.number().finite().refine((value) => value <= 0 && Math.abs(value) <= 1000),
  absentPenaltyValue: z.coerce.number().finite().refine((value) => value <= 0 && Math.abs(value) <= 1000),
  perfectAttendanceBonusValue: z.coerce.number().finite().refine((value) => value >= 0 && Math.abs(value) <= 1000),
  weekendRules: z
    .record(z.array(z.string().trim().min(1).max(50)).max(20))
    .optional()
    .default({}),
  specialRules: z
    .record(z.unknown())
    .optional()
    .default({})
});

const attendanceWeekdayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
] as const;

const attendanceScheduleUpdateItemSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(50),
  startTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  lateTime: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  isActive: z.boolean().optional().default(true)
});

const attendanceSchedulesUpdateBodySchema = z
  .object({
    items: z.array(attendanceScheduleUpdateItemSchema).max(20)
  })
  .refine((body) => {
    const ids = body.items.map((item) => item.id).filter((item): item is string => Boolean(item));
    return new Set(ids).size === ids.length;
  }, {
    message: "Attendance schedule contains duplicate ids"
  })
  .refine((body) => new Set(body.items.map((item) => item.code)).size === body.items.length, {
    message: "Attendance schedule contains duplicate codes"
  });

const attendanceExportQuerySchema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sessionCode: z.string().trim().min(1).optional()
});

function getSignedAttendancePenalty(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 0 ? -numeric : numeric;
}

const attendanceSessionsQuerySchema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sessionCode: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(180).optional()
});

const attendanceStudentStatsQuerySchema = attendanceSessionsQuerySchema.extend({
  sortBy: z.enum(["absent", "late", "attendanceRate", "sortOrder"]).optional()
});

const attendanceDailyStatsQuerySchema = attendanceSessionsQuerySchema.extend({
  sortBy: z.enum(["absent", "late", "attendanceRate", "date"]).optional()
});

const attendanceIssuesQuerySchema = z.object({
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  sessionCode: z.string().trim().min(1).optional(),
  status: z.enum(["late", "absent", "excused"]).optional(),
  studentKeyword: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200)
});

const attendanceIssueBatchUpdateBodySchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(200),
  status: attendanceRecordStatusSchema
});

const attendanceIssueSettleBodySchema = z.object({
  recordIds: z.array(z.string().uuid()).min(1).max(200)
});

const attendanceAuditQuerySchema = z.object({
  sessionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20)
});

async function requireClassAccess(app: any, userId: string, classId: string, reply: any) {
  const classRecord = await app.prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      tenantId: true,
      tenant: {
        select: {
          slug: true
        }
      }
    }
  });

  if (!classRecord) {
    throw reply.notFound("Class not found");
  }

  const membership = await app.prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: classRecord.tenantId,
        userId
      }
    },
    select: { id: true, status: true }
  });

  if (!membership || membership.status !== "active") {
    throw reply.forbidden("Class access denied");
  }

  return classRecord;
}

async function loadClassDailyParticipantStatusValues(app: any, classId: string) {
  const currentConfig = await app.prisma.classConfig?.findUnique?.({
    where: {
      classId
    },
    select: {
      extra: true
    }
  });

  const rawExtra =
    currentConfig?.extra && typeof currentConfig.extra === "object" && !Array.isArray(currentConfig.extra)
      ? (currentConfig.extra as Record<string, unknown>)
      : {};

  return getDailyParticipantStatusValues(rawExtra.studentStatusOptions);
}

async function requireAttendanceWriteAccess(app: any, userId: string, classId: string, reply: any) {
  const classRecord = await app.prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      tenantId: true
    }
  });

  if (!classRecord) {
    throw reply.notFound("Class not found");
  }

  const membership = await app.prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId: classRecord.tenantId,
        userId
      }
    },
    select: {
      id: true,
      status: true,
      roles: {
        select: {
          role: {
            select: {
              code: true
            }
          }
        }
      }
    }
  });

  if (!membership || membership.status !== "active") {
    throw reply.forbidden("Class access denied");
  }

  const classConfig = await app.prisma.classConfig?.findUnique?.({
    where: {
      classId
    },
    select: {
      isFrozen: true
    }
  });

  if (classConfig?.isFrozen) {
    throw reply.badRequest("Class is frozen");
  }

  if (!canManagePoints(membership)) {
    throw reply.forbidden("Attendance record permission denied");
  }

  return {
    classRecord,
    membership
  };
}

function formatTime(value: Date) {
  return value.toISOString().slice(11, 16);
}

function buildSessionDateRange(query: { dateFrom?: string; dateTo?: string }) {
  if (!query.dateFrom && !query.dateTo) {
    return undefined;
  }

  const range: { gte?: Date; lte?: Date } = {};
  if (query.dateFrom) {
    range.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
  }
  if (query.dateTo) {
    range.lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  }
  return range;
}

function createAttendanceStatusSummary(): AttendanceStatusSummary {
  return {
    present: 0,
    late: 0,
    absent: 0,
    excused: 0
  };
}

function isAttendanceRecordStatus(value: unknown): value is AttendanceRecordStatus {
  return attendanceRecordStatusValues.includes(value as AttendanceRecordStatus);
}

function isAttendancePenaltyStatus(status: AttendanceRecordStatus): status is AttendancePenaltyStatus {
  return status === "late" || status === "absent";
}

function attendanceStatusUsesCheckIn(status: AttendanceRecordStatus) {
  return status === "present" || status === "late";
}

function addAttendanceStatusCount(summary: AttendanceStatusSummary, status: string, count = 1) {
  if (!isAttendanceRecordStatus(status)) return summary;
  summary[status] += count;
  return summary;
}

function formatAttendanceRecordResponse(item: {
  id: string;
  status: string;
  checkInAt: Date | null;
  recordedAt: Date;
  note: string | null;
  source: string;
}) {
  return {
    id: item.id,
    status: item.status,
    note: item.note,
    checkInAt: item.checkInAt ? item.checkInAt.toISOString() : null,
    recordedAt: item.recordedAt.toISOString(),
    source: item.source
  };
}

function combineSessionDateAndTime(sessionDate: string, timeValue: Date) {
  const isoTime = timeValue.toISOString().slice(11, 19);
  return new Date(`${sessionDate}T${isoTime}.000Z`);
}

function parseAttendanceTimeValue(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  return new Date(`1970-01-01T${value}:00.000Z`);
}

function getSundaySpecialLateTimeValue(
  specialRules: unknown,
  schedule: {
    id: string;
    code: string;
  }
) {
  if (!specialRules || typeof specialRules !== "object" || Array.isArray(specialRules)) {
    return null;
  }
  const sundaySpecialLateTime = (specialRules as Record<string, unknown>).sundaySpecialLateTime;
  if (!sundaySpecialLateTime || typeof sundaySpecialLateTime !== "object" || Array.isArray(sundaySpecialLateTime)) {
    return null;
  }
  const rawValue =
    (sundaySpecialLateTime as Record<string, unknown>)[schedule.code] ??
    (sundaySpecialLateTime as Record<string, unknown>)[schedule.id];
  return typeof rawValue === "string" ? parseAttendanceTimeValue(rawValue) : null;
}

function serializePolicyRuleValue(value: unknown) {
  return JSON.stringify(value ?? {});
}

function serializeAttendanceScheduleSnapshot(item: {
  id: string | null;
  code: string;
  name: string;
  startTime: Date | string;
  endTime: Date | string;
  lateTime: Date | string;
  isActive: boolean;
  displayOrder: number;
}) {
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    startTime: typeof item.startTime === "string" ? item.startTime : formatTime(item.startTime),
    endTime: typeof item.endTime === "string" ? item.endTime : formatTime(item.endTime),
    lateTime: typeof item.lateTime === "string" ? item.lateTime : formatTime(item.lateTime),
    isActive: item.isActive,
    displayOrder: item.displayOrder
  };
}

function normalizeAttendanceScheduleRulesForCodes(
  value: unknown,
  currentSchedules: Array<{ id: string; code: string }>,
  nextSchedules: Array<{ id: string; code: string }>
) {
  const nextOrderMap = new Map(nextSchedules.map((item, index) => [item.code, index]));
  const nextCodeSet = new Set(nextSchedules.map((item) => item.code));
  const currentCodeById = new Map(currentSchedules.map((item) => [item.id, item.code]));
  const nextCodeById = new Map(nextSchedules.map((item) => [item.id, item.code]));
  const remappedCodeByCurrentCode = new Map(
    currentSchedules
      .map((item) => {
        const nextCode = nextCodeById.get(item.id);
        return nextCode ? ([item.code, nextCode] as const) : null;
      })
      .filter((item): item is readonly [string, string] => Boolean(item))
  );

  const mapRawCodeToNextCode = (rawValue: unknown) => {
    if (typeof rawValue === "number" && Number.isInteger(rawValue) && rawValue >= 0 && rawValue < currentSchedules.length) {
      rawValue = currentSchedules[rawValue]?.code ?? "";
    }
    if (typeof rawValue !== "string") {
      return null;
    }
    const trimmed = rawValue.trim();
    if (!trimmed) {
      return null;
    }
    if (nextCodeById.has(trimmed)) {
      return nextCodeById.get(trimmed) || null;
    }
    if (nextCodeSet.has(trimmed)) {
      return trimmed;
    }
    if (currentCodeById.has(trimmed)) {
      const currentCode = currentCodeById.get(trimmed) || "";
      return remappedCodeByCurrentCode.get(currentCode) ?? (nextCodeSet.has(currentCode) ? currentCode : null);
    }
    if (remappedCodeByCurrentCode.has(trimmed)) {
      return remappedCodeByCurrentCode.get(trimmed) ?? null;
    }
    if (/^\d+$/.test(trimmed)) {
      const index = Number(trimmed);
      if (index >= 0 && index < currentSchedules.length) {
        const currentCode = currentSchedules[index]?.code ?? "";
        return remappedCodeByCurrentCode.get(currentCode) ?? (nextCodeSet.has(currentCode) ? currentCode : null);
      }
    }
    return null;
  };

  const normalizedWeekendRules = attendanceWeekdayKeys.reduce<Record<string, string[]>>((result, key) => {
    result[key] = [];
    return result;
  }, {});

  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of attendanceWeekdayKeys) {
      const rawList = (value as Record<string, unknown>)[key];
      if (!Array.isArray(rawList)) {
        continue;
      }
      const mappedCodes = rawList
        .map((item) => mapRawCodeToNextCode(item))
        .filter((item): item is string => typeof item === "string" && nextCodeSet.has(item));
      normalizedWeekendRules[key] = Array.from(new Set(mappedCodes)).sort(
        (left, right) => (nextOrderMap.get(left) ?? 999) - (nextOrderMap.get(right) ?? 999)
      );
    }
  }

  return {
    weekendRules: normalizedWeekendRules,
    mapRawCodeToNextCode
  };
}

function normalizeAttendanceSpecialRulesForCodes(
  value: unknown,
  mapRawCodeToNextCode: (rawValue: unknown) => string | null
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const specialRules = value as Record<string, unknown>;
  const nextSpecialRules: Record<string, unknown> = Object.fromEntries(
    Object.entries(specialRules).filter(([key]) => key !== "sundaySpecialLateTime")
  );

  const sundaySpecialLateTime = specialRules.sundaySpecialLateTime;
  if (sundaySpecialLateTime && typeof sundaySpecialLateTime === "object" && !Array.isArray(sundaySpecialLateTime)) {
    const normalized: Record<string, string> = {};
    for (const [rawCode, rawValue] of Object.entries(sundaySpecialLateTime as Record<string, unknown>)) {
      const nextCode = mapRawCodeToNextCode(rawCode);
      if (!nextCode || typeof rawValue !== "string" || !parseAttendanceTimeValue(rawValue)) {
        continue;
      }
      normalized[nextCode] = rawValue;
    }
    if (Object.keys(normalized).length) {
      nextSpecialRules.sundaySpecialLateTime = normalized;
    }
  }

  return nextSpecialRules;
}

function serializeAttendanceAudit(item: any) {
  const auditMetaByAction: Record<
    string,
    {
      label: string;
      revertMode: "single_update" | "batch_update" | "batch_create" | null;
    }
  > = {
    "attendance.session.create": {
      label: "创建考勤场次",
      revertMode: null
    },
    "attendance.record.create": {
      label: "单条补录",
      revertMode: null
    },
    "attendance.record.batch_create": {
      label: "批量补录",
      revertMode: "batch_create"
    },
    "attendance.record.batch_create_revert": {
      label: "撤销批量补录",
      revertMode: null
    },
    "attendance.record.update": {
      label: "单条修正",
      revertMode: "single_update"
    },
    "attendance.record.revert": {
      label: "撤销单条修正",
      revertMode: null
    },
    "attendance.record.batch_update": {
      label: "批量修正",
      revertMode: "batch_update"
    },
    "attendance.record.batch_revert": {
      label: "撤销批量修正",
      revertMode: null
    },
    "attendance.session.settle": {
      label: "场次结算",
      revertMode: null
    },
    "attendance.session.settle_revert": {
      label: "撤销场次结算",
      revertMode: null
    },
    "attendance.issue.absent_settle": {
      label: "异常缺勤结算",
      revertMode: null
    },
    "attendance.policy.update": {
      label: "更新考勤规则",
      revertMode: null
    }
  };
  const meta = auditMetaByAction[item.action] || {
    label: item.action,
    revertMode: null
  };

  return {
    id: item.id,
    action: item.action,
    label: meta.label,
    targetType: item.targetType,
    targetId: item.targetId,
    canRevert: Boolean(meta.revertMode && item.targetId),
    revertMode: meta.revertMode,
    beforeData: item.beforeData,
    afterData: item.afterData,
    metadata: item.metadata,
    createdAt: item.createdAt,
    actorUser: item.actorUser
      ? {
          id: item.actorUser.id,
          username: item.actorUser.username,
          displayName: item.actorUser.displayName
        }
      : null
  };
}

function getAttendanceStatusFromAuditData(value: unknown): AttendanceRecordStatus | null {
  if (!value || typeof value !== "object") return null;
  const status = (value as Record<string, unknown>).status;
  if (isAttendanceRecordStatus(status)) return status;
  return null;
}

function getAttendanceSessionIdFromMetadata(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const sessionId = (value as Record<string, unknown>).attendanceSessionId;
  return typeof sessionId === "string" ? sessionId : null;
}

function getAttendancePointTransactionIdFromAuditData(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const pointTransactionId = (value as Record<string, unknown>).pointTransactionId;
  return typeof pointTransactionId === "string" ? pointTransactionId : null;
}

function getAttendancePointTransactionSourceModuleFromAuditData(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const sourceModule = (value as Record<string, unknown>).pointTransactionSourceModule;
  return typeof sourceModule === "string" ? sourceModule : null;
}

function buildAttendancePenaltyReason(status: AttendancePenaltyStatus, sessionDate: string, sessionName: string) {
  return status === "late" ? `考勤迟到: ${sessionDate} ${sessionName}` : `缺勤扣分: ${sessionDate} ${sessionName}`;
}

function normalizeAttendanceSettlementSourceModule(value: string | null | undefined) {
  if (typeof value !== "string") {
    return "attendance_settlement";
  }
  return value.startsWith("attendance_issue") ? "attendance_issue_settlement" : "attendance_settlement";
}

async function reconcileAttendanceRecordSettlement(
  tx: any,
  input: {
    tenantId: string;
    classId: string;
    actorUserId: string;
    actorMembershipId: string;
    recordId: string;
    attendanceSessionId: string;
    studentId: string;
    sessionDate: string;
    sessionName: string;
    currentPointTransactionId: string | null;
    nextStatus: AttendanceRecordStatus;
    maintainSettlement: boolean;
    latePenaltyValue: number;
    absentPenaltyValue: number;
    fallbackPointAccountId?: string | null;
    preferredSettlementSourceModule?: string | null;
  }
) {
  let nextPointTransactionId: string | null = input.currentPointTransactionId ?? null;
  let nextPointTransactionSourceModule: string | null = null;
  let pointAccountId = input.fallbackPointAccountId ?? null;
  let settlementSourceModule = normalizeAttendanceSettlementSourceModule(input.preferredSettlementSourceModule);

  if (input.currentPointTransactionId) {
    const original = await tx.pointTransaction.findFirst({
      where: {
        id: input.currentPointTransactionId,
        classId: input.classId
      },
      select: {
        id: true,
        pointAccountId: true,
        transactionType: true,
        value: true,
        reason: true,
        scene: true,
        category: true,
        sourceModule: true,
        isReverted: true
      }
    });

    if (!original) {
      throw new Error("Attendance settlement transaction not found");
    }
    if (original.isReverted) {
      throw new Error("Attendance settlement transaction already reverted");
    }

    pointAccountId = original.pointAccountId;
    settlementSourceModule = normalizeAttendanceSettlementSourceModule(original.sourceModule);

    const account = await tx.pointAccount.findUnique({
      where: {
        id: original.pointAccountId
      },
      select: {
        id: true,
        totalPoints: true,
        balancePoints: true,
        penaltyPoints: true
      }
    });

    if (!account) {
      throw new Error("Attendance point account not found");
    }

    const originalValue = Number(original.value);
    const reversedValue = -originalValue;

    const revertTransaction = await tx.pointTransaction.create({
      data: {
        tenantId: input.tenantId,
        classId: input.classId,
        studentId: input.studentId,
        pointAccountId: original.pointAccountId,
        transactionType: "adjustment",
        value: reversedValue,
        reason: `撤销考勤结算: ${original.reason}`,
        scene: original.scene,
        category: original.category,
        sourceModule: "attendance_status_reconciliation",
        sourceType: "attendance_record_penalty_revert",
        sourceId: input.recordId,
        actorUserId: input.actorUserId,
        actorMembershipId: input.actorMembershipId,
        occurredAt: new Date(),
        metadata: {
          attendanceSessionId: input.attendanceSessionId,
          attendanceRecordId: input.recordId,
          revertedTransactionId: original.id,
          nextStatus: input.nextStatus
        }
      }
    });

    await tx.pointTransaction.update({
      where: {
        id: original.id
      },
      data: {
        isReverted: true,
        revertedByTransactionId: revertTransaction.id
      }
    });

    await tx.pointAccount.update({
      where: {
        id: account.id
      },
      data: {
        totalPoints: Number(account.totalPoints) + reversedValue,
        balancePoints: Number(account.balancePoints) + reversedValue,
        penaltyPoints:
          original.transactionType === "penalty"
            ? Number(account.penaltyPoints) - Math.abs(originalValue)
            : Number(account.penaltyPoints),
        version: {
          increment: 1
        }
      }
    });

    nextPointTransactionId = null;
  }

  if (!input.maintainSettlement || !isAttendancePenaltyStatus(input.nextStatus)) {
    return {
      pointTransactionId: nextPointTransactionId ?? null,
      pointTransactionSourceModule: nextPointTransactionSourceModule ?? null
    };
  }

  if (!pointAccountId) {
    throw new Error("Attendance settlement point account is missing");
  }

  const account = await tx.pointAccount.findUnique({
    where: {
      id: pointAccountId
    },
    select: {
      id: true,
      totalPoints: true,
      balancePoints: true,
      penaltyPoints: true
    }
  });

  if (!account) {
    throw new Error("Attendance point account not found");
  }

  const penaltyStatus = input.nextStatus;
  const penaltyValue = penaltyStatus === "late" ? input.latePenaltyValue : input.absentPenaltyValue;
  const createdTransaction = await tx.pointTransaction.create({
    data: {
      tenantId: input.tenantId,
      classId: input.classId,
      studentId: input.studentId,
      pointAccountId,
      transactionType: "penalty",
      value: penaltyValue,
      reason: buildAttendancePenaltyReason(penaltyStatus, input.sessionDate, input.sessionName),
      scene: "班级",
      category: "出勤",
      sourceModule: settlementSourceModule,
      sourceType:
        settlementSourceModule === "attendance_issue_settlement"
          ? "attendance_issue_status_reconciled"
          : "attendance_session_settlement_adjusted",
      sourceId: settlementSourceModule === "attendance_issue_settlement" ? input.recordId : input.attendanceSessionId,
      actorUserId: input.actorUserId,
      actorMembershipId: input.actorMembershipId,
      occurredAt: new Date(),
      metadata: {
        attendanceSessionId: input.attendanceSessionId,
        attendanceRecordId: input.recordId,
          attendanceStatus: penaltyStatus
        }
      },
    select: {
      id: true
    }
  });

  await tx.pointAccount.update({
    where: {
      id: account.id
    },
    data: {
      totalPoints: Number(account.totalPoints) + penaltyValue,
      balancePoints: Number(account.balancePoints) + penaltyValue,
      penaltyPoints: Number(account.penaltyPoints) + Math.abs(penaltyValue),
      version: {
        increment: 1
      }
    }
  });

  nextPointTransactionId = createdTransaction.id;
  nextPointTransactionSourceModule = settlementSourceModule;

  return {
    pointTransactionId: nextPointTransactionId ?? null,
    pointTransactionSourceModule: nextPointTransactionSourceModule ?? null
  };
}

function serializeAttendanceIssueItem(item: {
  id: string;
  attendanceSessionId: string;
  status: string;
  checkInAt: Date | null;
  recordedAt: Date;
  note: string | null;
  source: string;
  pointTransactionId: string | null;
  session: {
    id: string;
    sessionDate: Date;
    sessionCode: string;
    status: string;
    schedule: {
      name: string;
    };
  };
  student: {
    id: string;
    name: string;
    legacyId: bigint | number | null;
    sortOrder: number;
  };
}) {
  return {
    recordId: item.id,
    attendanceSessionId: item.attendanceSessionId,
    status: item.status,
    note: item.note,
    checkInAt: item.checkInAt ? item.checkInAt.toISOString() : null,
    recordedAt: item.recordedAt.toISOString(),
    source: item.source,
    pointTransactionId: item.pointTransactionId ?? null,
    session: {
      id: item.session.id,
      sessionDate: item.session.sessionDate.toISOString().slice(0, 10),
      sessionCode: item.session.sessionCode,
      sessionName: item.session.schedule.name,
      status: item.session.status
    },
    student: {
      id: item.student.id,
      name: item.student.name,
      legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null,
      sortOrder: item.student.sortOrder
    }
  };
}

export const attendanceRoutes: FastifyPluginAsync = async (app) => {
  async function revertSingleAttendanceRecordUpdate(
    auth: { sub: string },
    classId: string,
    recordId: string,
    reply: any,
    selectedAuditId?: string
  ) {
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, classId, reply);

    const record = await app.prisma.attendanceRecord.findFirst({
      where: {
        id: recordId,
        classId
      },
      select: {
        id: true,
        attendanceSessionId: true,
        studentId: true,
        status: true,
        note: true,
        checkInAt: true,
        source: true,
        pointTransactionId: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            account: {
              select: {
                id: true
              }
            }
          }
        },
        session: {
          select: {
            id: true,
            sessionDate: true,
            plannedStartAt: true,
            schedule: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!record) {
      throw reply.notFound("Attendance record not found");
    }

    const latestAudit = await app.prisma.auditLog.findFirst({
      where: {
        classId,
        action: "attendance.record.update",
        targetType: "attendance_record",
        targetId: record.id
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        beforeData: true,
        afterData: true
      }
    });

    if (!latestAudit) {
      throw reply.badRequest("Attendance record has no revertible update");
    }

    if (selectedAuditId && latestAudit.id !== selectedAuditId) {
      throw reply.badRequest("Attendance record changed since selected audit");
    }

    const previousStatus = getAttendanceStatusFromAuditData(latestAudit.beforeData);
    const latestAfterStatus = getAttendanceStatusFromAuditData(latestAudit.afterData);
    const previousPointTransactionId = getAttendancePointTransactionIdFromAuditData(latestAudit.beforeData);
    const previousPointTransactionSourceModule = getAttendancePointTransactionSourceModuleFromAuditData(
      latestAudit.beforeData
    );

    if (!previousStatus || !latestAfterStatus) {
      throw reply.badRequest("Attendance record revert data is invalid");
    }

    if (record.status !== latestAfterStatus) {
      throw reply.badRequest("Attendance record changed since latest update");
    }

    const shouldMaintainSettlement = Boolean(record.pointTransactionId || previousPointTransactionId);
    const policy =
      shouldMaintainSettlement && isAttendancePenaltyStatus(previousStatus)
        ? await app.prisma.attendancePolicy.findUnique({
            where: {
              classId
            },
            select: {
              latePenaltyValue: true,
              absentPenaltyValue: true
            }
          })
        : null;

    if (shouldMaintainSettlement && isAttendancePenaltyStatus(previousStatus) && !policy) {
      throw reply.notFound("Attendance policy not found");
    }

    const reverted = await app.prisma.$transaction(async (tx) => {
      const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
        tenantId: classRecord.tenantId,
        classId,
        actorUserId: auth.sub,
        actorMembershipId: membership.id,
        recordId: record.id,
        attendanceSessionId: record.attendanceSessionId,
        studentId: record.studentId,
        sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
        sessionName: record.session.schedule.name,
        currentPointTransactionId: record.pointTransactionId ?? null,
        nextStatus: previousStatus,
        maintainSettlement: shouldMaintainSettlement,
        latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
        absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
        fallbackPointAccountId: record.student.account?.id ?? null,
        preferredSettlementSourceModule: previousPointTransactionSourceModule
      });

      const updated = await tx.attendanceRecord.update({
        where: {
          id: record.id
        },
        data: {
          status: previousStatus,
          source: "manual_revert",
          recordedAt: new Date(),
          checkInAt: attendanceStatusUsesCheckIn(previousStatus) ? record.checkInAt || record.session.plannedStartAt : null,
          pointTransactionId: settlementResult.pointTransactionId ?? null,
          batchId: null,
          actorUserId: auth.sub,
          actorMembershipId: membership.id
        },
        select: {
          id: true,
          attendanceSessionId: true,
          status: true,
          note: true,
          checkInAt: true,
          recordedAt: true,
          source: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.record.revert",
          targetType: "attendance_record",
          targetId: record.id,
          beforeData: {
            status: record.status,
            note: record.note,
            checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
            source: record.source,
            pointTransactionId: record.pointTransactionId ?? null,
            pointTransactionSourceModule: getAttendancePointTransactionSourceModuleFromAuditData(latestAudit.afterData)
          },
          afterData: {
            status: updated.status,
            note: updated.note,
            checkInAt: updated.checkInAt ? updated.checkInAt.toISOString() : null,
            source: updated.source,
            pointTransactionId: settlementResult.pointTransactionId ?? null,
            pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
            studentName: record.student.name,
            sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
            sessionName: record.session.schedule.name
          },
          metadata: {
            attendanceSessionId: record.attendanceSessionId,
            revertedAuditId: latestAudit.id
          }
        }
      });

      return updated;
    });

    return {
      session: {
        id: record.session.id,
        sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
        sessionName: record.session.schedule.name
      },
      student: {
        id: record.student.id,
        name: record.student.name,
        legacyId: record.student.legacyId != null ? record.student.legacyId.toString() : null
      },
      record: {
        attendanceSessionId: reverted.attendanceSessionId,
        ...formatAttendanceRecordResponse(reverted)
      }
    };
  }

  async function revertAttendanceBatchUpdateLatest(
    auth: { sub: string },
    classId: string,
    sessionId: string,
    recordIds: string[],
    reply: any,
    selectedAuditId?: string
  ) {
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, classId, reply);

    const session = await app.prisma.attendanceSession.findFirst({
      where: {
        id: sessionId,
        classId
      },
      select: {
        id: true,
        plannedStartAt: true,
        sessionDate: true,
        schedule: {
          select: {
            name: true
          }
        }
      }
    });

    if (!session) {
      throw reply.notFound("Attendance session not found");
    }

    const records = await app.prisma.attendanceRecord.findMany({
      where: {
        attendanceSessionId: sessionId,
        classId,
        id: {
          in: recordIds
        }
      },
      select: {
        id: true,
        attendanceSessionId: true,
        studentId: true,
        status: true,
        note: true,
        checkInAt: true,
        source: true,
        pointTransactionId: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            account: {
              select: {
                id: true
              }
            }
          }
        }
      }
    });

    if (records.length !== recordIds.length) {
      throw reply.notFound("Attendance record batch contains invalid items");
    }

    const latestAudits = await app.prisma.auditLog.findMany({
      where: {
        classId,
        action: "attendance.record.batch_update",
        targetType: "attendance_record",
        targetId: {
          in: recordIds
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        targetId: true,
        beforeData: true,
        afterData: true
      }
    });

    const latestAuditByRecordId = new Map<string, (typeof latestAudits)[number]>();
    for (const audit of latestAudits) {
      if (!audit.targetId || latestAuditByRecordId.has(audit.targetId)) continue;
      latestAuditByRecordId.set(audit.targetId, audit);
    }

    if (selectedAuditId) {
      const selectedAudit = latestAudits.find((item) => item.id === selectedAuditId);
      if (!selectedAudit || !selectedAudit.targetId || latestAuditByRecordId.get(selectedAudit.targetId)?.id !== selectedAuditId) {
        throw reply.badRequest("Attendance batch update changed since selected audit");
      }
    }

    const recordsToRevert = records
      .map((record) => {
        const latestAudit = latestAuditByRecordId.get(record.id);
        if (!latestAudit) return null;

        const previousStatus = getAttendanceStatusFromAuditData(latestAudit.beforeData);
        const latestAfterStatus = getAttendanceStatusFromAuditData(latestAudit.afterData);
        const previousPointTransactionId = getAttendancePointTransactionIdFromAuditData(latestAudit.beforeData);
        const previousPointTransactionSourceModule = getAttendancePointTransactionSourceModuleFromAuditData(
          latestAudit.beforeData
        );

        if (!previousStatus || !latestAfterStatus) return null;
        if (record.status !== latestAfterStatus) return null;

        return {
          record,
          latestAudit,
          previousStatus,
          previousPointTransactionId,
          previousPointTransactionSourceModule
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const skippedCount = records.length - recordsToRevert.length;

    if (!recordsToRevert.length) {
      throw reply.badRequest("Attendance batch revert has no revertible records");
    }

    const needsSettlementPolicy = recordsToRevert.some(
      (item) => (item.record.pointTransactionId || item.previousPointTransactionId) && isAttendancePenaltyStatus(item.previousStatus)
    );
    const policy = needsSettlementPolicy
      ? await app.prisma.attendancePolicy.findUnique({
          where: {
            classId
          },
          select: {
            latePenaltyValue: true,
            absentPenaltyValue: true
          }
        })
      : null;

    if (needsSettlementPolicy && !policy) {
      throw reply.notFound("Attendance policy not found");
    }

    const revertedRecords = await app.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of recordsToRevert) {
        const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
          tenantId: classRecord.tenantId,
          classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          recordId: item.record.id,
          attendanceSessionId: sessionId,
          studentId: item.record.studentId,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name,
          currentPointTransactionId: item.record.pointTransactionId ?? null,
          nextStatus: item.previousStatus,
          maintainSettlement: Boolean(item.record.pointTransactionId || item.previousPointTransactionId),
          latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
          absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
          fallbackPointAccountId: item.record.student.account?.id ?? null,
          preferredSettlementSourceModule: item.previousPointTransactionSourceModule
        });

        const updated = await tx.attendanceRecord.update({
          where: {
            id: item.record.id
          },
          data: {
            status: item.previousStatus,
            source: "manual_batch_revert",
            recordedAt: new Date(),
            checkInAt: attendanceStatusUsesCheckIn(item.previousStatus) ? item.record.checkInAt || session.plannedStartAt : null,
            pointTransactionId: settlementResult.pointTransactionId ?? null,
            batchId: null,
            actorUserId: auth.sub,
            actorMembershipId: membership.id
          },
          select: {
            id: true,
            attendanceSessionId: true,
            status: true,
            note: true,
            checkInAt: true,
            recordedAt: true,
            source: true
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "attendance.record.batch_revert",
            targetType: "attendance_record",
            targetId: item.record.id,
            beforeData: {
              status: item.record.status,
              note: item.record.note,
              checkInAt: item.record.checkInAt ? item.record.checkInAt.toISOString() : null,
              source: item.record.source,
              pointTransactionId: item.record.pointTransactionId ?? null,
              pointTransactionSourceModule: getAttendancePointTransactionSourceModuleFromAuditData(
                item.latestAudit.afterData
              )
            },
            afterData: {
              status: updated.status,
              note: updated.note,
              checkInAt: updated.checkInAt ? updated.checkInAt.toISOString() : null,
              source: updated.source,
              pointTransactionId: settlementResult.pointTransactionId ?? null,
              pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
              studentName: item.record.student.name,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              sessionName: session.schedule.name
            },
            metadata: {
              attendanceSessionId: sessionId,
              revertedAuditId: item.latestAudit.id,
              batchSize: recordIds.length
            }
          }
        });

        results.push({
          student: {
            id: item.record.student.id,
            name: item.record.student.name,
            legacyId: item.record.student.legacyId != null ? item.record.student.legacyId.toString() : null
          },
          record: {
            attendanceSessionId: updated.attendanceSessionId,
            ...formatAttendanceRecordResponse(updated)
          }
        });
      }

      return results;
    });

    return {
      session: {
        id: session.id,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        sessionName: session.schedule.name
      },
      requestedCount: recordIds.length,
      revertedCount: revertedRecords.length,
      skippedCount,
      items: revertedRecords
    };
  }

  async function revertAttendanceBatchCreateLatest(
    auth: { sub: string },
    classId: string,
    sessionId: string,
    recordIds: string[],
    reply: any,
    selectedAuditId?: string
  ) {
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, classId, reply);

    const session = await app.prisma.attendanceSession.findFirst({
      where: {
        id: sessionId,
        classId
      },
      select: {
        id: true,
        sessionDate: true,
        schedule: {
          select: {
            name: true
          }
        }
      }
    });

    if (!session) {
      throw reply.notFound("Attendance session not found");
    }

    const records = await app.prisma.attendanceRecord.findMany({
      where: {
        attendanceSessionId: sessionId,
        classId,
        id: {
          in: recordIds
        }
      },
      select: {
        id: true,
        attendanceSessionId: true,
        studentId: true,
        status: true,
        note: true,
        checkInAt: true,
        source: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true
          }
        }
      }
    });

    if (records.length !== recordIds.length) {
      throw reply.notFound("Attendance record batch contains invalid items");
    }

    const latestAudits = await app.prisma.auditLog.findMany({
      where: {
        classId,
        targetType: "attendance_record",
        targetId: {
          in: recordIds
        },
        action: {
          in: [
            "attendance.record.create",
            "attendance.record.batch_create",
            "attendance.record.update",
            "attendance.record.revert",
            "attendance.record.batch_update",
            "attendance.record.batch_revert",
            "attendance.record.batch_create_revert"
          ]
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        targetId: true
      }
    });

    const latestAuditByRecordId = new Map<string, (typeof latestAudits)[number]>();
    for (const audit of latestAudits) {
      if (!audit.targetId || latestAuditByRecordId.has(audit.targetId)) continue;
      latestAuditByRecordId.set(audit.targetId, audit);
    }

    if (selectedAuditId) {
      const selectedAudit = latestAudits.find((item) => item.id === selectedAuditId);
      if (
        !selectedAudit ||
        selectedAudit.action !== "attendance.record.batch_create" ||
        !selectedAudit.targetId ||
        latestAuditByRecordId.get(selectedAudit.targetId)?.id !== selectedAuditId
      ) {
        throw reply.badRequest("Attendance batch create changed since selected audit");
      }
    }

    const recordsToDelete = records
      .map((record) => {
        const latestAudit = latestAuditByRecordId.get(record.id);
        if (!latestAudit) return null;
        if (latestAudit.action !== "attendance.record.batch_create") return null;
        return {
          record,
          latestAudit
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const skippedCount = records.length - recordsToDelete.length;

    if (!recordsToDelete.length) {
      throw reply.badRequest("Attendance batch create revert has no revertible records");
    }

    const deletedItems = await app.prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of recordsToDelete) {
        await tx.attendanceRecord.delete({
          where: {
            id: item.record.id
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "attendance.record.batch_create_revert",
            targetType: "attendance_record",
            targetId: item.record.id,
            beforeData: {
              status: item.record.status,
              note: item.record.note,
              checkInAt: item.record.checkInAt ? item.record.checkInAt.toISOString() : null,
              source: item.record.source
            },
            afterData: {
              deleted: true,
              studentName: item.record.student.name,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              sessionName: session.schedule.name
            },
            metadata: {
              attendanceSessionId: sessionId,
              revertedAuditId: item.latestAudit.id,
              batchSize: recordIds.length
            }
          }
        });

        results.push({
          student: {
            id: item.record.student.id,
            name: item.record.student.name,
            legacyId: item.record.student.legacyId != null ? item.record.student.legacyId.toString() : null
          },
          recordId: item.record.id
        });
      }

      return results;
    });

    return {
      session: {
        id: session.id,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        sessionName: session.schedule.name
      },
      requestedCount: recordIds.length,
      revertedCount: deletedItems.length,
      skippedCount,
      items: deletedItems
    };
  }

  app.post("/classes/:classId/attendance/sessions", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = attendanceSessionCreateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);
    const sessionDate = new Date(`${body.sessionDate}T00:00:00.000Z`);

    const schedule = await app.prisma.attendanceSchedule.findFirst({
      where: {
        classId: params.classId,
        code: body.sessionCode,
        isActive: body.allowInactiveSchedule ? undefined : true
      },
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        lateTime: true
      }
    });

    if (!schedule) {
      throw reply.notFound("Attendance schedule not found");
    }

    const existingSession = await app.prisma.attendanceSession.findFirst({
      where: {
        classId: params.classId,
        sessionDate,
        sessionCode: body.sessionCode
      },
      select: {
        id: true
      }
    });

    if (existingSession) {
      throw reply.conflict("Attendance session already exists");
    }

    const attendancePolicy = await app.prisma.attendancePolicy?.findUnique?.({
      where: {
        classId: params.classId
      },
      select: {
        specialRules: true
      }
    });

    const dailyParticipantStatusValues = body.seedDailyParticipantStudents
      ? await loadClassDailyParticipantStatusValues(app, params.classId)
      : [];
    const students = body.seedDailyParticipantStudents
      ? await app.prisma.student.findMany({
          where: {
            classId: params.classId,
            status: {
              in: dailyParticipantStatusValues
            }
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: {
            id: true,
            name: true,
            legacyId: true
          }
        })
      : [];

    const plannedStartAt = combineSessionDateAndTime(body.sessionDate, schedule.startTime);
    const plannedEndAt = combineSessionDateAndTime(body.sessionDate, schedule.endTime);
    const sundaySpecialLateTime = getSundaySpecialLateTimeValue(attendancePolicy?.specialRules, schedule);
    const lateDeadlineAt =
      sessionDate.getUTCDay() === 0 && sundaySpecialLateTime
        ? combineSessionDateAndTime(body.sessionDate, sundaySpecialLateTime)
        : combineSessionDateAndTime(body.sessionDate, schedule.lateTime);

    const created = await app.prisma.$transaction(async (tx) => {
      const session = await tx.attendanceSession.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          scheduleId: schedule.id,
          sessionDate,
          sessionCode: body.sessionCode,
          plannedStartAt,
          plannedEndAt,
          lateDeadlineAt,
          status: "open"
        },
        select: {
          id: true,
          sessionDate: true,
          sessionCode: true,
          status: true
        }
      });

      if (body.seedDailyParticipantStudents && students.length > 0) {
        await tx.attendanceRecord.createMany({
          data: students.map((student) => ({
            tenantId: classRecord.tenantId,
            classId: params.classId,
            attendanceSessionId: session.id,
            studentId: student.id,
            status: body.initialStatus,
            checkInAt: attendanceStatusUsesCheckIn(body.initialStatus) ? plannedStartAt : null,
            recordedAt: new Date(),
            source: "manual_seed",
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            legacyStudentName: student.name
          }))
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.session.create",
          targetType: "attendance_session",
          targetId: session.id,
          afterData: {
            sessionDate: body.sessionDate,
            sessionCode: body.sessionCode,
            sessionName: schedule.name,
            initialStatus: body.initialStatus,
            studentCount: students.length,
            seedDailyParticipantStudents: body.seedDailyParticipantStudents,
            lateDeadlineAt: lateDeadlineAt.toISOString()
          },
          metadata: {
            scheduleId: schedule.id
          }
        }
      });

      return session;
    });

    return {
      session: {
        id: created.id,
        sessionDate: created.sessionDate.toISOString().slice(0, 10),
        sessionCode: created.sessionCode,
        sessionName: schedule.name,
        status: created.status
      },
      seeded: {
        studentCount: students.length,
        initialStatus: body.initialStatus
      }
    };
  });

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/records",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const body = attendanceRecordCreateBodySchema.parse(request.body);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          plannedStartAt: true,
          sessionDate: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const dailyParticipantStatusValues = body.allowNonDailyParticipant
        ? []
        : await loadClassDailyParticipantStatusValues(app, params.classId);
      const student = await app.prisma.student.findFirst({
        where: {
          id: body.studentId,
          classId: params.classId,
          status: body.allowNonDailyParticipant
            ? undefined
            : {
                in: dailyParticipantStatusValues
              }
        },
        select: {
          id: true,
          name: true,
          legacyId: true
        }
      });

      if (!student) {
        throw reply.notFound("Student not found");
      }

      const existingRecord = await app.prisma.attendanceRecord.findFirst({
        where: {
          attendanceSessionId: params.sessionId,
          studentId: body.studentId
        },
        select: {
          id: true
        }
      });

      if (existingRecord) {
        throw reply.conflict("Attendance record already exists");
      }

      const checkInAt =
        !attendanceStatusUsesCheckIn(body.status)
          ? null
          : body.checkInAt
            ? new Date(body.checkInAt)
            : session.plannedStartAt;

      const created = await app.prisma.$transaction(async (tx) => {
        const record = await tx.attendanceRecord.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            attendanceSessionId: params.sessionId,
            studentId: student.id,
            status: body.status,
            checkInAt,
            recordedAt: new Date(),
            source: "manual_insert",
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            legacyStudentName: student.name
          },
          select: {
            id: true,
            attendanceSessionId: true,
            status: true,
            note: true,
            checkInAt: true,
            recordedAt: true,
            source: true
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "attendance.record.create",
            targetType: "attendance_record",
            targetId: record.id,
            afterData: {
              status: record.status,
              studentName: student.name,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              sessionName: session.schedule.name,
              source: record.source
            },
            metadata: {
              attendanceSessionId: params.sessionId
            }
          }
        });

        return record;
      });

      return {
        session: {
          id: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name
        },
        student: {
          id: student.id,
          name: student.name,
          legacyId: student.legacyId != null ? student.legacyId.toString() : null
        },
        record: {
          attendanceSessionId: created.attendanceSessionId,
          ...formatAttendanceRecordResponse(created)
        }
      };
    }
  );

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch-create",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const body = attendanceRecordBatchCreateBodySchema.parse(request.body);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          plannedStartAt: true,
          sessionDate: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const uniqueStudentIds = [...new Set(body.studentIds)];
      const dailyParticipantStatusValues = await loadClassDailyParticipantStatusValues(app, params.classId);
      const students = await app.prisma.student.findMany({
        where: {
          id: {
            in: uniqueStudentIds
          },
          classId: params.classId,
          status: {
            in: dailyParticipantStatusValues
          }
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          legacyId: true
        }
      });

      if (students.length !== uniqueStudentIds.length) {
        throw reply.notFound("Attendance record batch contains invalid students");
      }

      const existingRecords = await app.prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: params.sessionId,
          studentId: {
            in: uniqueStudentIds
          }
        },
        select: {
          studentId: true
        }
      });

      const existingStudentIds = new Set(existingRecords.map((item) => item.studentId));
      const studentsToCreate = students.filter((student) => !existingStudentIds.has(student.id));
      const skippedCount = students.length - studentsToCreate.length;

      if (!studentsToCreate.length) {
        throw reply.badRequest("Attendance batch create has no missing students");
      }

      const batchId = crypto.randomUUID();

      const createdItems = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const student of studentsToCreate) {
          const record = await tx.attendanceRecord.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              attendanceSessionId: params.sessionId,
              studentId: student.id,
              status: body.status,
              checkInAt: attendanceStatusUsesCheckIn(body.status) ? session.plannedStartAt : null,
              recordedAt: new Date(),
              source: "manual_batch_insert",
              batchId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              legacyStudentName: student.name
            },
            select: {
              id: true,
              attendanceSessionId: true,
              status: true,
              note: true,
              checkInAt: true,
              recordedAt: true,
              source: true
            }
          });

          await tx.auditLog.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              action: "attendance.record.batch_create",
              targetType: "attendance_record",
              targetId: record.id,
              afterData: {
                status: record.status,
                studentName: student.name,
                sessionDate: session.sessionDate.toISOString().slice(0, 10),
                sessionName: session.schedule.name,
                source: record.source
              },
              metadata: {
                attendanceSessionId: params.sessionId,
                batchSize: uniqueStudentIds.length,
                batchId
              }
            }
          });

          results.push({
            student: {
              id: student.id,
              name: student.name,
              legacyId: student.legacyId != null ? student.legacyId.toString() : null
            },
            record: {
              attendanceSessionId: record.attendanceSessionId,
              ...formatAttendanceRecordResponse(record)
            }
          });
        }

        return results;
      });

      return {
        session: {
          id: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name
        },
        targetStatus: body.status,
        requestedCount: uniqueStudentIds.length,
        createdCount: createdItems.length,
        skippedCount,
        batchId,
        items: createdItems
      };
    }
  );

  app.get(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const query = attendanceBatchListQuerySchema.parse(request.query);
      await requireClassAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const batches = await app.prisma.attendanceRecord.groupBy({
        by: ["batchId", "source", "status", "actorUserId"],
        where: {
          classId: params.classId,
          attendanceSessionId: params.sessionId,
          source: {
            in: ["manual_batch_insert", "manual_batch_update"]
          },
          batchId: {
            not: null
          }
        },
        _count: {
          _all: true
        },
        _max: {
          recordedAt: true
        },
        orderBy: {
          _max: {
            recordedAt: "desc"
          }
        },
        take: query.limit
      });

      return {
        items: batches.map((item) => ({
          batchId: item.batchId!,
          operation: item.source === "manual_batch_insert" ? "batch_create" : "batch_update",
          status: item.status,
          count: item._count._all,
          recordedAt: item._max.recordedAt,
          actorUserId: item.actorUserId
        }))
      };
    }
  );

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch/:batchId/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceBatchIdParamsSchema.parse(request.params);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          plannedStartAt: true,
          sessionDate: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const records = await app.prisma.attendanceRecord.findMany({
        where: {
          classId: params.classId,
          attendanceSessionId: params.sessionId,
          batchId: params.batchId,
          source: {
            in: ["manual_batch_insert", "manual_batch_update"]
          }
        },
        select: {
          id: true,
          attendanceSessionId: true,
          studentId: true,
          status: true,
          note: true,
          checkInAt: true,
          source: true,
          pointTransactionId: true,
          student: {
            select: {
              id: true,
              name: true,
              legacyId: true,
              account: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      if (!records.length) {
        throw reply.notFound("Attendance batch not found");
      }

      const sourceTypes = new Set(records.map((record) => record.source));
      if (sourceTypes.size !== 1) {
        throw reply.badRequest("Attendance batch data is inconsistent");
      }

      const sourceType = records[0].source;

      if (sourceType === "manual_batch_update") {
        const latestAudits = await app.prisma.auditLog.findMany({
          where: {
            classId: params.classId,
            action: "attendance.record.batch_update",
            targetType: "attendance_record",
            targetId: {
              in: records.map((item) => item.id)
            },
            metadata: {
              path: ["batchId"],
              equals: params.batchId
            }
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id: true,
            targetId: true,
            beforeData: true,
            afterData: true
          }
        });

        const latestAuditByRecordId = new Map<string, (typeof latestAudits)[number]>();
        for (const audit of latestAudits) {
          if (!audit.targetId || latestAuditByRecordId.has(audit.targetId)) continue;
          latestAuditByRecordId.set(audit.targetId, audit);
        }

        const recordsToRevert = records
          .map((record) => {
            const latestAudit = latestAuditByRecordId.get(record.id);
            if (!latestAudit) return null;

            const previousStatus = getAttendanceStatusFromAuditData(latestAudit.beforeData);
            const latestAfterStatus = getAttendanceStatusFromAuditData(latestAudit.afterData);
            const previousPointTransactionId = getAttendancePointTransactionIdFromAuditData(latestAudit.beforeData);
            const previousPointTransactionSourceModule = getAttendancePointTransactionSourceModuleFromAuditData(
              latestAudit.beforeData
            );

            if (!previousStatus || !latestAfterStatus) return null;
            if (record.status !== latestAfterStatus) return null;

            return {
              record,
              latestAudit,
              previousStatus,
              previousPointTransactionId,
              previousPointTransactionSourceModule
            };
          })
          .filter((item): item is NonNullable<typeof item> => Boolean(item));

        const skippedCount = records.length - recordsToRevert.length;

        if (!recordsToRevert.length) {
          throw reply.badRequest("Attendance batch update has no revertible records");
        }

        const needsSettlementPolicy = recordsToRevert.some(
          (item) => (item.record.pointTransactionId || item.previousPointTransactionId) && isAttendancePenaltyStatus(item.previousStatus)
        );
        const policy = needsSettlementPolicy
          ? await app.prisma.attendancePolicy.findUnique({
              where: {
                classId: params.classId
              },
              select: {
                latePenaltyValue: true,
                absentPenaltyValue: true
              }
            })
          : null;

        if (needsSettlementPolicy && !policy) {
          throw reply.notFound("Attendance policy not found");
        }

        const revertedRecords = await app.prisma.$transaction(async (tx) => {
          const results = [];

          for (const item of recordsToRevert) {
            const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              recordId: item.record.id,
              attendanceSessionId: params.sessionId,
              studentId: item.record.studentId,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              sessionName: session.schedule.name,
              currentPointTransactionId: item.record.pointTransactionId ?? null,
              nextStatus: item.previousStatus,
              maintainSettlement: Boolean(item.record.pointTransactionId || item.previousPointTransactionId),
              latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
              absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
              fallbackPointAccountId: item.record.student.account?.id ?? null,
              preferredSettlementSourceModule: item.previousPointTransactionSourceModule
            });

            const updated = await tx.attendanceRecord.update({
              where: {
                id: item.record.id
              },
              data: {
                status: item.previousStatus,
                source: "manual_batch_revert",
                recordedAt: new Date(),
                checkInAt:
                  attendanceStatusUsesCheckIn(item.previousStatus) ? item.record.checkInAt || session.plannedStartAt : null,
                pointTransactionId: settlementResult.pointTransactionId ?? null,
                batchId: null,
                actorUserId: auth.sub,
                actorMembershipId: membership.id
              },
              select: {
                id: true,
                attendanceSessionId: true,
                status: true,
                note: true,
                checkInAt: true,
                recordedAt: true,
                source: true
              }
            });

            await tx.auditLog.create({
              data: {
                tenantId: classRecord.tenantId,
                classId: params.classId,
                actorUserId: auth.sub,
                actorMembershipId: membership.id,
                action: "attendance.record.batch_revert",
                targetType: "attendance_record",
                targetId: item.record.id,
                beforeData: {
                  status: item.record.status,
                  note: item.record.note,
                  checkInAt: item.record.checkInAt ? item.record.checkInAt.toISOString() : null,
                  source: item.record.source,
                  pointTransactionId: item.record.pointTransactionId ?? null,
                  pointTransactionSourceModule: getAttendancePointTransactionSourceModuleFromAuditData(
                    item.latestAudit.afterData
                  )
                },
                afterData: {
                  status: updated.status,
                  note: updated.note,
                  checkInAt: updated.checkInAt ? updated.checkInAt.toISOString() : null,
                  source: updated.source,
                  pointTransactionId: settlementResult.pointTransactionId ?? null,
                  pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
                  studentName: item.record.student.name,
                  sessionDate: session.sessionDate.toISOString().slice(0, 10),
                  sessionName: session.schedule.name
                },
                metadata: {
                  attendanceSessionId: params.sessionId,
                  revertedAuditId: item.latestAudit.id,
                  batchSize: records.length,
                  revertedBatchId: params.batchId
                }
              }
            });

            results.push({
              student: {
                id: item.record.student.id,
                name: item.record.student.name,
                legacyId: item.record.student.legacyId != null ? item.record.student.legacyId.toString() : null
              },
              record: {
                attendanceSessionId: updated.attendanceSessionId,
                ...formatAttendanceRecordResponse(updated)
              }
            });
          }

          return results;
        });

        return {
          session: {
            id: session.id,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            sessionName: session.schedule.name
          },
          batchId: params.batchId,
          operation: "batch_update",
          requestedCount: records.length,
          revertedCount: revertedRecords.length,
          skippedCount,
          items: revertedRecords
        };
      }

      const deletedItems = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const record of records) {
          await tx.attendanceRecord.delete({
            where: {
              id: record.id
            }
          });

          await tx.auditLog.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              action: "attendance.record.batch_create_revert",
              targetType: "attendance_record",
              targetId: record.id,
              beforeData: {
                status: record.status,
                note: record.note,
                checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
                source: record.source
              },
              afterData: {
                deleted: true,
                studentName: record.student.name,
                sessionDate: session.sessionDate.toISOString().slice(0, 10),
                sessionName: session.schedule.name
              },
              metadata: {
                attendanceSessionId: params.sessionId,
                batchSize: records.length,
                revertedBatchId: params.batchId
              }
            }
          });

          results.push({
            student: {
              id: record.student.id,
              name: record.student.name,
              legacyId: record.student.legacyId != null ? record.student.legacyId.toString() : null
            },
            recordId: record.id
          });
        }

        return results;
      });

      return {
        session: {
          id: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name
        },
        batchId: params.batchId,
        operation: "batch_create",
        requestedCount: records.length,
        revertedCount: deletedItems.length,
        skippedCount: records.length - deletedItems.length,
        items: deletedItems
      };
    }
  );

  app.post(
    "/classes/:classId/attendance/records/:recordId/revert-latest",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceRecordRevertParamsSchema.parse(request.params);
      return revertSingleAttendanceRecordUpdate(auth, params.classId, params.recordId, reply);
    }
  );

  app.post("/classes/:classId/attendance/audits/:auditId/revert", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = attendanceAuditRevertParamsSchema.parse(request.params);
    const selectedAudit = await app.prisma.auditLog.findFirst({
      where: {
        id: params.auditId,
        classId: params.classId,
        action: {
          in: ["attendance.record.update", "attendance.record.batch_update", "attendance.record.batch_create"]
        }
      },
      select: {
        id: true,
        action: true,
        targetId: true,
        metadata: true
      }
    });

    if (!selectedAudit) {
      throw reply.notFound("Attendance audit not found");
    }

    if (!selectedAudit.targetId) {
      throw reply.badRequest("Attendance audit is not revertible");
    }

    if (selectedAudit.action === "attendance.record.update") {
      return revertSingleAttendanceRecordUpdate(auth, params.classId, selectedAudit.targetId, reply, selectedAudit.id);
    }

    const sessionId = getAttendanceSessionIdFromMetadata(selectedAudit.metadata);
    if (!sessionId) {
      throw reply.badRequest("Attendance audit session is invalid");
    }

    if (selectedAudit.action === "attendance.record.batch_update") {
      return revertAttendanceBatchUpdateLatest(auth, params.classId, sessionId, [selectedAudit.targetId], reply, selectedAudit.id);
    }

    if (selectedAudit.action === "attendance.record.batch_create") {
      return revertAttendanceBatchCreateLatest(auth, params.classId, sessionId, [selectedAudit.targetId], reply, selectedAudit.id);
    }

    throw reply.badRequest("Attendance audit is not revertible");
  });

  app.get("/classes/:classId/attendance/overview", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const classRecord = await requireClassAccess(app, auth.sub, params.classId, reply);

    const [policy, schedules, featureFlag, importedSessionCount, importedRecordCount, safeSubsetImportJob, attendancePhase2ImportJob] = await Promise.all([
      app.prisma.attendancePolicy.findUnique({
        where: { classId: params.classId },
        select: {
          latePenaltyValue: true,
          absentPenaltyValue: true,
          perfectAttendanceBonusValue: true,
          weekendRules: true,
          specialRules: true,
          isFrozen: true,
          updatedAt: true
        }
      }),
      app.prisma.attendanceSchedule.findMany({
        where: {
          classId: params.classId
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          startTime: true,
          endTime: true,
          lateTime: true,
          isActive: true
        }
      }),
      app.prisma.featureFlag.findUnique({
        where: {
          tenantId_classId_code: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            code: "attendance"
          }
        },
        select: {
          enabled: true
        }
      }),
      app.prisma.migrationMapping.count({
        where: {
          tenantId: classRecord.tenantId,
          entityType: "attendance_session",
          legacyScope: classRecord.tenant.slug
        }
      }),
      app.prisma.migrationMapping.count({
        where: {
          tenantId: classRecord.tenantId,
          entityType: "attendance_record",
          legacyScope: classRecord.tenant.slug
        }
      }),
      app.prisma.importJob.findFirst({
        where: {
          classId: params.classId,
          jobType: "legacy_safe_subset_import"
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          finishedAt: true,
          summary: true
        }
      }),
      app.prisma.importJob.findFirst({
        where: {
          classId: params.classId,
          jobType: "legacy_attendance_phase2_import"
        },
        orderBy: {
          createdAt: "desc"
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          finishedAt: true,
          summary: true
        }
      })
    ]);

    const safeSubsetSummary = (safeSubsetImportJob?.summary || {}) as Record<string, unknown>;
    const deferredSessionCount = Number(
      safeSubsetSummary.deferredAttendanceSessions ?? safeSubsetSummary.skippedAttendanceSessions ?? 0
    );
    const deferredRecordCount = Number(
      safeSubsetSummary.deferredAttendanceRecords ?? safeSubsetSummary.skippedAttendanceRecords ?? 0
    );
    const pendingSessions = Math.max(
      deferredSessionCount - importedSessionCount,
      0
    );
    const pendingRecords = Math.max(
      deferredRecordCount - importedRecordCount,
      0
    );
    const latestImportJob =
      attendancePhase2ImportJob &&
      (!safeSubsetImportJob ||
        new Date(attendancePhase2ImportJob.createdAt).getTime() >= new Date(safeSubsetImportJob.createdAt).getTime())
        ? attendancePhase2ImportJob
        : safeSubsetImportJob;

    return {
      feature: {
        attendanceEnabled: featureFlag?.enabled ?? false
      },
      policy: policy
        ? {
            ...policy,
            latePenaltyValue: String(policy.latePenaltyValue),
            absentPenaltyValue: String(policy.absentPenaltyValue),
            perfectAttendanceBonusValue: String(policy.perfectAttendanceBonusValue)
          }
        : null,
      schedules: schedules.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        startTime: formatTime(item.startTime),
        endTime: formatTime(item.endTime),
        lateTime: formatTime(item.lateTime),
        isActive: item.isActive
      })),
      migration: {
        importedSessions: importedSessionCount,
        importedRecords: importedRecordCount,
        pendingSessions,
        pendingRecords,
        latestImportJob: latestImportJob
      }
    };
  });

  app.get("/classes/:classId/attendance/audits", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceAuditQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const items = await app.prisma.auditLog.findMany({
      where: {
        classId: params.classId,
        action: {
          in: [
            "attendance.session.create",
            "attendance.record.create",
            "attendance.record.batch_create",
            "attendance.record.batch_create_revert",
            "attendance.record.update",
            "attendance.record.revert",
            "attendance.record.batch_revert",
            "attendance.record.batch_update",
            "attendance.session.settle",
            "attendance.session.settle_revert",
            "attendance.issue.absent_settle",
            "attendance.policy.update"
          ]
        },
        OR: query.sessionId
          ? [
              {
                targetType: "attendance_session",
                targetId: query.sessionId
              },
              {
                metadata: {
                  path: ["attendanceSessionId"],
                  equals: query.sessionId
                }
              }
            ]
          : undefined
      },
      orderBy: {
        createdAt: "desc"
      },
      take: query.limit,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        beforeData: true,
        afterData: true,
        metadata: true,
        createdAt: true,
        actorUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    return {
      filters: {
        sessionId: query.sessionId ?? null,
        limit: query.limit
      },
      items: items.map(serializeAttendanceAudit)
    };
  });

  app.get("/classes/:classId/attendance/issues", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceIssuesQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const sessionDateRange = buildSessionDateRange(query);
    const studentKeyword = query.studentKeyword?.trim();
    const keywordLegacyId = studentKeyword && /^\d+$/.test(studentKeyword) ? BigInt(studentKeyword) : null;

    const items = await app.prisma.attendanceRecord.findMany({
      where: {
        classId: params.classId,
        status: query.status || {
          in: ["late", "absent", "excused"]
        },
        session:
          query.sessionCode || sessionDateRange
            ? {
                is: {
                  sessionCode: query.sessionCode || undefined,
                  sessionDate: sessionDateRange
                }
              }
            : undefined,
        OR: studentKeyword
          ? [
              {
                student: {
                  is: {
                    name: {
                      contains: studentKeyword,
                      mode: "insensitive"
                    }
                  }
                }
              },
              {
                legacyStudentName: {
                  contains: studentKeyword,
                  mode: "insensitive"
                }
              },
              ...(keywordLegacyId != null
                ? [
                    {
                      student: {
                        is: {
                          legacyId: keywordLegacyId
                        }
                      }
                    }
                  ]
                : [])
            ]
          : undefined
      },
      orderBy: [
        {
          session: {
            sessionDate: "desc"
          }
        },
        {
          session: {
            sessionCode: "asc"
          }
        },
        {
          student: {
            sortOrder: "asc"
          }
        },
        {
          student: {
            name: "asc"
          }
        }
      ],
      take: query.limit,
      select: {
        id: true,
        attendanceSessionId: true,
        status: true,
        note: true,
        checkInAt: true,
        recordedAt: true,
        source: true,
        pointTransactionId: true,
        session: {
          select: {
            id: true,
            sessionDate: true,
            sessionCode: true,
            status: true,
            schedule: {
              select: {
                name: true
              }
            }
          }
        },
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            sortOrder: true
          }
        }
      }
    });

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sessionCode: query.sessionCode ?? null,
        status: query.status ?? null,
        studentKeyword: query.studentKeyword ?? null,
        limit: query.limit
      },
      totals: {
        records: items.length,
        late: items.filter((item) => item.status === "late").length,
        absent: items.filter((item) => item.status === "absent").length,
        excused: items.filter((item) => item.status === "excused").length,
        settleableAbsent: items.filter((item) => item.status === "absent" && !item.pointTransactionId).length,
        settledAbsent: items.filter((item) => item.status === "absent" && item.pointTransactionId).length
      },
      items: items.map(serializeAttendanceIssueItem)
    };
  });

  app.put("/classes/:classId/attendance/schedules", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = attendanceSchedulesUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

    const currentSchedules = await app.prisma.attendanceSchedule.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        startTime: true,
        endTime: true,
        lateTime: true,
        isActive: true,
        displayOrder: true
      }
    });

    const currentScheduleIdSet = new Set(currentSchedules.map((item) => item.id));
    const incomingIds = body.items.map((item) => item.id).filter((item): item is string => Boolean(item));
    if (incomingIds.some((item) => !currentScheduleIdSet.has(item))) {
      throw reply.notFound("Attendance schedule contains invalid items");
    }

    const normalizedItems = body.items.map((item, index) => ({
      id: item.id || null,
      code: item.code.trim(),
      name: item.name.trim(),
      startTime: item.startTime,
      endTime: item.endTime,
      lateTime: item.lateTime,
      isActive: item.isActive ?? true,
      displayOrder: index + 1
    }));

    for (const item of normalizedItems) {
      const startTime = parseAttendanceTimeValue(item.startTime);
      const endTime = parseAttendanceTimeValue(item.endTime);
      const lateTime = parseAttendanceTimeValue(item.lateTime);
      if (!startTime || !endTime || !lateTime || startTime >= endTime) {
        throw reply.badRequest("Attendance schedule time range invalid");
      }
      if (lateTime < startTime || lateTime > endTime) {
        throw reply.badRequest("Attendance schedule late time invalid");
      }
    }

    const incomingIdSet = new Set(incomingIds);
    const archivedSchedules = currentSchedules.filter((item) => !incomingIdSet.has(item.id));
    const archivedCodeSet = new Set(archivedSchedules.map((item) => item.code));
    if (normalizedItems.some((item) => archivedCodeSet.has(item.code))) {
      throw reply.badRequest("Attendance schedule conflicts with archived items");
    }

    const currentSnapshot = currentSchedules.map(serializeAttendanceScheduleSnapshot);
    const nextSnapshot = [
      ...normalizedItems.map((item) => serializeAttendanceScheduleSnapshot(item)),
      ...archivedSchedules.map((item, index) =>
        serializeAttendanceScheduleSnapshot({
          ...item,
          isActive: false,
          displayOrder: normalizedItems.length + index + 1
        })
      )
    ];

    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      throw reply.badRequest("Attendance schedules unchanged");
    }

    const scheduleRefsForCurrentRules = currentSchedules.map((item) => ({
      id: item.id,
      code: item.code
    }));
    const scheduleRefsForNextRules = normalizedItems.map((item, index) => ({
      id: item.id ?? `__new_schedule_${index}`,
      code: item.code
    }));

    const currentPolicy = await app.prisma.attendancePolicy.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        id: true,
        weekendRules: true,
        specialRules: true
      }
    });

    const { weekendRules: remappedWeekendRules, mapRawCodeToNextCode } = normalizeAttendanceScheduleRulesForCodes(
      currentPolicy?.weekendRules,
      scheduleRefsForCurrentRules,
      scheduleRefsForNextRules
    );
    const remappedSpecialRules = normalizeAttendanceSpecialRulesForCodes(
      currentPolicy?.specialRules,
      mapRawCodeToNextCode
    );

    const archivedScheduleSessionCounts = await Promise.all(
      archivedSchedules.map(async (item) => ({
        scheduleId: item.id,
        sessionCount: await app.prisma.attendanceSession.count({
          where: {
            classId: params.classId,
            scheduleId: item.id
          }
        })
      }))
    );

    const removableScheduleIds = archivedScheduleSessionCounts
      .filter((item) => item.sessionCount === 0)
      .map((item) => item.scheduleId);
    const softArchivedSchedules = archivedSchedules.filter(
      (item) => !removableScheduleIds.includes(item.id)
    );
    const currentScheduleMap = new Map(currentSchedules.map((item) => [item.id, item]));

    const updatedResult = await app.prisma.$transaction(async (tx) => {
      if (removableScheduleIds.length) {
        await tx.attendanceSchedule.deleteMany({
          where: {
            classId: params.classId,
            id: {
              in: removableScheduleIds
            }
          }
        });
      }

      for (const item of normalizedItems) {
        if (!item.id) {
          continue;
        }

        const tmpCode = `__tmp_att_${crypto.randomUUID().slice(0, 8)}_${item.displayOrder}`;
        await tx.attendanceSchedule.update({
          where: {
            id: item.id
          },
          data: {
            code: tmpCode
          }
        });
      }

      for (const item of normalizedItems) {
        const data = {
          code: item.code,
          name: item.name,
          startTime: parseAttendanceTimeValue(item.startTime) as Date,
          endTime: parseAttendanceTimeValue(item.endTime) as Date,
          lateTime: parseAttendanceTimeValue(item.lateTime) as Date,
          isActive: item.isActive,
          displayOrder: item.displayOrder
        };

        if (item.id) {
          await tx.attendanceSchedule.update({
            where: {
              id: item.id
            },
            data
          });
          continue;
        }

        await tx.attendanceSchedule.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            ...data
          }
        });
      }

      for (const [index, item] of softArchivedSchedules.entries()) {
        await tx.attendanceSchedule.update({
          where: {
            id: item.id
          },
          data: {
            isActive: false,
            displayOrder: normalizedItems.length + index + 1
          }
        });
      }

      let policyAfter = currentPolicy;
      if (
        currentPolicy &&
        (serializePolicyRuleValue(currentPolicy.weekendRules) !== serializePolicyRuleValue(remappedWeekendRules) ||
          serializePolicyRuleValue(currentPolicy.specialRules) !== serializePolicyRuleValue(remappedSpecialRules))
      ) {
        policyAfter = await tx.attendancePolicy.update({
          where: {
            classId: params.classId
          },
          data: {
            weekendRules: remappedWeekendRules,
            specialRules: remappedSpecialRules
          },
          select: {
            id: true,
            weekendRules: true,
            specialRules: true
          }
        });
      }

      const schedulesAfter = await tx.attendanceSchedule.findMany({
        where: {
          classId: params.classId
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          startTime: true,
          endTime: true,
          lateTime: true,
          isActive: true,
          displayOrder: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.schedule.update",
          targetType: "attendance_schedule_bundle",
          targetId: params.classId,
          beforeData: {
            items: currentSnapshot,
            weekendRules: currentPolicy?.weekendRules ?? null,
            specialRules: currentPolicy?.specialRules ?? null
          },
          afterData: {
            items: schedulesAfter.map(serializeAttendanceScheduleSnapshot),
            weekendRules: policyAfter?.weekendRules ?? null,
            specialRules: policyAfter?.specialRules ?? null
          },
          metadata: {
            sourceModule: "attendance",
            removedScheduleIds: archivedSchedules.map((item) => item.id),
            deletedScheduleIds: removableScheduleIds,
            archivedScheduleIds: softArchivedSchedules.map((item) => item.id)
          }
        }
      });

      return {
        schedules: schedulesAfter,
        policy: policyAfter
      };
    });

    return {
      schedules: updatedResult.schedules.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        startTime: formatTime(item.startTime),
        endTime: formatTime(item.endTime),
        lateTime: formatTime(item.lateTime),
        isActive: item.isActive,
        displayOrder: item.displayOrder
      })),
      policy: updatedResult.policy
        ? {
            weekendRules: updatedResult.policy.weekendRules,
            specialRules: updatedResult.policy.specialRules
          }
        : null
    };
  });

  app.put("/classes/:classId/attendance/policy", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = attendancePolicyUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

    const currentPolicy = await app.prisma.attendancePolicy.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        id: true,
        latePenaltyValue: true,
        absentPenaltyValue: true,
        perfectAttendanceBonusValue: true,
        weekendRules: true,
        specialRules: true,
        isFrozen: true,
        updatedAt: true
      }
    });

    if (!currentPolicy) {
      throw reply.notFound("Attendance policy not found");
    }

    const unchanged =
      Number(currentPolicy.latePenaltyValue) === body.latePenaltyValue &&
      Number(currentPolicy.absentPenaltyValue) === body.absentPenaltyValue &&
      Number(currentPolicy.perfectAttendanceBonusValue) === body.perfectAttendanceBonusValue &&
      serializePolicyRuleValue(currentPolicy.weekendRules) === serializePolicyRuleValue(body.weekendRules) &&
      serializePolicyRuleValue(currentPolicy.specialRules) === serializePolicyRuleValue(body.specialRules);

    if (unchanged) {
      throw reply.badRequest("Attendance policy unchanged");
    }

    const updatedPolicy = await app.prisma.$transaction(async (tx) => {
      const item = await tx.attendancePolicy.update({
        where: {
          classId: params.classId
        },
        data: {
          latePenaltyValue: body.latePenaltyValue,
          absentPenaltyValue: body.absentPenaltyValue,
          perfectAttendanceBonusValue: body.perfectAttendanceBonusValue,
          weekendRules: body.weekendRules,
          specialRules: body.specialRules
        },
        select: {
          latePenaltyValue: true,
          absentPenaltyValue: true,
          perfectAttendanceBonusValue: true,
          weekendRules: true,
          specialRules: true,
          isFrozen: true,
          updatedAt: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.policy.update",
          targetType: "attendance_policy",
          targetId: currentPolicy.id,
          beforeData: {
            latePenaltyValue: String(currentPolicy.latePenaltyValue),
            absentPenaltyValue: String(currentPolicy.absentPenaltyValue),
            perfectAttendanceBonusValue: String(currentPolicy.perfectAttendanceBonusValue),
            weekendRules: currentPolicy.weekendRules,
            specialRules: currentPolicy.specialRules
          },
          afterData: {
            latePenaltyValue: String(item.latePenaltyValue),
            absentPenaltyValue: String(item.absentPenaltyValue),
            perfectAttendanceBonusValue: String(item.perfectAttendanceBonusValue),
            weekendRules: item.weekendRules,
            specialRules: item.specialRules
          },
          metadata: {
            sourceModule: "attendance"
          }
        }
      });

      return item;
    });

    return {
      policy: {
        ...updatedPolicy,
        latePenaltyValue: String(updatedPolicy.latePenaltyValue),
        absentPenaltyValue: String(updatedPolicy.absentPenaltyValue),
        perfectAttendanceBonusValue: String(updatedPolicy.perfectAttendanceBonusValue)
      }
    };
  });

  app.get("/classes/:classId/attendance/sessions", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceSessionsQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const where = {
      classId: params.classId,
      sessionCode: query.sessionCode || undefined,
      sessionDate: buildSessionDateRange(query)
    };

    const sessions = await app.prisma.attendanceSession.findMany({
      where,
      orderBy: [{ sessionDate: "desc" }, { sessionCode: "asc" }],
      take: query.limit ?? 60,
      select: {
        id: true,
        sessionDate: true,
        sessionCode: true,
        status: true,
        schedule: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            records: true
          }
        }
      }
    });

    const aggregates = sessions.length
      ? await app.prisma.attendanceRecord.groupBy({
          by: ["attendanceSessionId", "status"],
          where: {
            attendanceSessionId: {
              in: sessions.map((item) => item.id)
            }
          },
          _count: {
            _all: true
          }
        })
      : [];

    const statusBySession = new Map<string, AttendanceStatusSummary>();
    for (const item of aggregates) {
      const current = statusBySession.get(item.attendanceSessionId) || createAttendanceStatusSummary();
      addAttendanceStatusCount(current, item.status, item._count._all);
      statusBySession.set(item.attendanceSessionId, current);
    }

    const availableSessionCodes = await app.prisma.attendanceSchedule.findMany({
      where: {
        classId: params.classId,
        isActive: true
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        code: true,
        name: true
      }
    });

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sessionCode: query.sessionCode ?? null,
        limit: query.limit ?? 60,
        availableSessionCodes
      },
      totals: {
        sessions: sessions.length,
        records: sessions.reduce((sum, item) => sum + item._count.records, 0),
        present: sessions.reduce((sum, item) => sum + (statusBySession.get(item.id)?.present ?? 0), 0),
        late: sessions.reduce((sum, item) => sum + (statusBySession.get(item.id)?.late ?? 0), 0),
        absent: sessions.reduce((sum, item) => sum + (statusBySession.get(item.id)?.absent ?? 0), 0),
        excused: sessions.reduce((sum, item) => sum + (statusBySession.get(item.id)?.excused ?? 0), 0)
      },
      items: sessions.map((item) => ({
        id: item.id,
        sessionDate: item.sessionDate.toISOString().slice(0, 10),
        sessionCode: item.sessionCode,
        sessionName: item.schedule.name,
        status: item.status,
        recordCount: item._count.records,
        summary: statusBySession.get(item.id) || createAttendanceStatusSummary()
      }))
    };
  });

  app.get("/classes/:classId/attendance/student-stats", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceStudentStatsQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const records = await app.prisma.attendanceRecord.findMany({
      where: {
        classId: params.classId,
        session: {
          sessionCode: query.sessionCode || undefined,
          sessionDate: buildSessionDateRange(query)
        }
      },
      select: {
        status: true,
        studentId: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            sortOrder: true,
            groups: {
              where: {
                isPrimary: true
              },
              take: 1,
              select: {
                group: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    const statsMap = new Map<
      string,
      {
        student: {
          id: string;
          name: string;
          legacyId: string | null;
          sortOrder: number;
          primaryGroup: { id: string; name: string } | null;
        };
        total: number;
        present: number;
        late: number;
        absent: number;
        excused: number;
      }
    >();

    for (const item of records) {
      const current = statsMap.get(item.studentId) || {
        student: {
          id: item.student.id,
          name: item.student.name,
          legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null,
          sortOrder: item.student.sortOrder,
          primaryGroup: item.student.groups[0]?.group || null
        },
        total: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0
      };
      current.total += 1;
      addAttendanceStatusCount(current, item.status);
      statsMap.set(item.studentId, current);
    }

    const sortBy = query.sortBy ?? "absent";
    const items = Array.from(statsMap.values())
      .map((item) => ({
        ...item,
        attendanceRate: item.total > 0 ? Number((item.present / item.total).toFixed(4)) : 0
      }))
      .sort((left, right) => {
        if (sortBy === "late") {
          return right.late - left.late || right.absent - left.absent || left.student.sortOrder - right.student.sortOrder;
        }
        if (sortBy === "attendanceRate") {
          return left.attendanceRate - right.attendanceRate || right.absent - left.absent || left.student.sortOrder - right.student.sortOrder;
        }
        if (sortBy === "sortOrder") {
          return left.student.sortOrder - right.student.sortOrder;
        }
        return right.absent - left.absent || right.late - left.late || left.student.sortOrder - right.student.sortOrder;
      })
      .slice(0, query.limit ?? 12);

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sessionCode: query.sessionCode ?? null,
        limit: query.limit ?? 12,
        sortBy
      },
      totals: {
        students: statsMap.size,
        records: records.length,
        present: records.filter((item) => item.status === "present").length,
        late: records.filter((item) => item.status === "late").length,
        absent: records.filter((item) => item.status === "absent").length,
        excused: records.filter((item) => item.status === "excused").length
      },
      items
    };
  });

  app.get("/classes/:classId/attendance/daily-stats", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceDailyStatsQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const sessions = await app.prisma.attendanceSession.findMany({
      where: {
        classId: params.classId,
        sessionCode: query.sessionCode || undefined,
        sessionDate: buildSessionDateRange(query)
      },
      select: {
        id: true,
        sessionDate: true,
        sessionCode: true,
        schedule: {
          select: {
            name: true
          }
        },
        records: {
          select: {
            status: true
          }
        }
      }
    });

    const dayMap = new Map<
      string,
      {
        sessionDate: string;
        sessions: number;
        records: number;
        present: number;
        late: number;
        absent: number;
        excused: number;
        sessionNames: string[];
      }
    >();

    for (const session of sessions) {
      const key = session.sessionDate.toISOString().slice(0, 10);
      const current = dayMap.get(key) || {
        sessionDate: key,
        sessions: 0,
        records: 0,
        present: 0,
        late: 0,
        absent: 0,
        excused: 0,
        sessionNames: []
      };
      current.sessions += 1;
      current.records += session.records.length;
      for (const record of session.records) {
        addAttendanceStatusCount(current, record.status);
      }
      if (!current.sessionNames.includes(session.schedule.name)) {
        current.sessionNames.push(session.schedule.name);
      }
      dayMap.set(key, current);
    }

    const sortBy = query.sortBy ?? "absent";
    const items = Array.from(dayMap.values())
      .map((item) => ({
        ...item,
        attendanceRate: item.records > 0 ? Number((item.present / item.records).toFixed(4)) : 0,
        sessionNames: item.sessionNames.sort((a, b) => a.localeCompare(b, "zh-CN"))
      }))
      .sort((left, right) => {
        if (sortBy === "late") {
          return right.late - left.late || right.absent - left.absent || right.sessionDate.localeCompare(left.sessionDate);
        }
        if (sortBy === "attendanceRate") {
          return left.attendanceRate - right.attendanceRate || right.absent - left.absent || right.sessionDate.localeCompare(left.sessionDate);
        }
        if (sortBy === "date") {
          return right.sessionDate.localeCompare(left.sessionDate);
        }
        return right.absent - left.absent || right.late - left.late || right.sessionDate.localeCompare(left.sessionDate);
      })
      .slice(0, query.limit ?? 12);

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sessionCode: query.sessionCode ?? null,
        limit: query.limit ?? 12,
        sortBy
      },
      totals: {
        days: dayMap.size,
        sessions: sessions.length,
        records: sessions.reduce((sum, item) => sum + item.records.length, 0),
        present: sessions.reduce(
          (sum, item) => sum + item.records.filter((record) => record.status === "present").length,
          0
        ),
        late: sessions.reduce(
          (sum, item) => sum + item.records.filter((record) => record.status === "late").length,
          0
        ),
        absent: sessions.reduce(
          (sum, item) => sum + item.records.filter((record) => record.status === "absent").length,
          0
        ),
        excused: sessions.reduce(
          (sum, item) => sum + item.records.filter((record) => record.status === "excused").length,
          0
        )
      },
      items
    };
  });

  app.get("/classes/:classId/attendance/export", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = attendanceExportQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const where = {
      classId: params.classId,
      sessionCode: query.sessionCode || undefined,
      sessionDate: buildSessionDateRange(query)
    };

    const schedules = await app.prisma.attendanceSchedule.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        displayOrder: true,
        isActive: true
      }
    });

    const sessions = await app.prisma.attendanceSession.findMany({
      where,
      orderBy: [{ sessionDate: "asc" }, { sessionCode: "asc" }],
      select: {
        id: true,
        sessionDate: true,
        sessionCode: true,
        status: true,
        schedule: {
          select: {
            name: true
          }
        }
      }
    });

    const records = sessions.length
      ? await app.prisma.attendanceRecord.findMany({
          where: {
            attendanceSessionId: {
              in: sessions.map((item) => item.id)
            }
          },
          orderBy: [{ recordedAt: "asc" }],
          select: {
            id: true,
            attendanceSessionId: true,
            status: true,
            checkInAt: true,
            recordedAt: true,
            note: true,
            source: true,
            legacyStudentName: true,
            student: {
              select: {
                id: true,
                name: true,
                sortOrder: true
              }
            }
          }
        })
      : [];

    const sessionById = new Map(
      sessions.map((item) => [
        item.id,
        {
          sessionDate: item.sessionDate.toISOString().slice(0, 10),
          sessionCode: item.sessionCode,
          sessionName: item.schedule.name,
          status: item.status
        }
      ])
    );

    return {
      filters: {
        dateFrom: query.dateFrom ?? null,
        dateTo: query.dateTo ?? null,
        sessionCode: query.sessionCode ?? null
      },
      schedules: schedules.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        displayOrder: item.displayOrder,
        isActive: item.isActive
      })),
      sessions: sessions.map((item) => ({
        id: item.id,
        sessionDate: item.sessionDate.toISOString().slice(0, 10),
        sessionCode: item.sessionCode,
        sessionName: item.schedule.name,
        status: item.status
      })),
      items: records.map((item) => {
        const session = sessionById.get(item.attendanceSessionId);
        return {
          recordId: item.id,
          sessionId: item.attendanceSessionId,
          sessionDate: session?.sessionDate || "",
          sessionCode: session?.sessionCode || "",
          sessionName: session?.sessionName || "",
          sessionStatus: session?.status || "",
          studentId: item.student.id,
          studentName: item.student.name,
          studentSortOrder: item.student.sortOrder,
          status: item.status,
          checkInAt: item.checkInAt ? item.checkInAt.toISOString() : null,
          recordedAt: item.recordedAt.toISOString(),
          note: item.note,
          source: item.source,
          legacyStudentName: item.legacyStudentName
        };
      })
    };
  });

  app.get("/attendance/sessions/:sessionId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = sessionParamsSchema.parse(request.params);
    const session = await app.prisma.attendanceSession.findUnique({
      where: {
        id: params.sessionId
      },
      select: {
        id: true,
        classId: true,
        sessionDate: true,
        sessionCode: true,
        status: true,
        schedule: {
          select: {
            name: true
          }
        }
      }
    });

    if (!session) {
      throw reply.notFound("Attendance session not found");
    }

    await requireClassAccess(app, auth.sub, session.classId, reply);

    const records = await app.prisma.attendanceRecord.findMany({
      where: {
        attendanceSessionId: session.id
      },
      orderBy: [{ student: { sortOrder: "asc" } }, { student: { name: "asc" } }],
      select: {
        id: true,
        status: true,
        checkInAt: true,
        recordedAt: true,
        note: true,
        source: true,
        legacyStudentName: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            sortOrder: true
          }
        }
      }
    });

    return {
      session: {
        id: session.id,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        sessionCode: session.sessionCode,
        sessionName: session.schedule.name,
        status: session.status
      },
      summary: {
        total: records.length,
        present: records.filter((item) => item.status === "present").length,
        late: records.filter((item) => item.status === "late").length,
        absent: records.filter((item) => item.status === "absent").length,
        excused: records.filter((item) => item.status === "excused").length
      },
      items: records.map((item) => ({
        id: item.id,
        status: item.status,
        checkInAt: item.checkInAt ? item.checkInAt.toISOString() : null,
        recordedAt: item.recordedAt.toISOString(),
        note: item.note,
        source: item.source,
        legacyStudentName: item.legacyStudentName,
        student: {
          id: item.student.id,
          name: item.student.name,
          legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null,
          sortOrder: item.student.sortOrder
        }
      }))
    };
  });

  app.put("/classes/:classId/attendance/records/:recordId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = attendanceRecordParamsSchema.parse(request.params);
    const body = attendanceRecordUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

    const record = await app.prisma.attendanceRecord.findFirst({
      where: {
        id: params.recordId,
        classId: params.classId
      },
      select: {
        id: true,
        attendanceSessionId: true,
        studentId: true,
        status: true,
        note: true,
        checkInAt: true,
        source: true,
        pointTransactionId: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true,
            account: {
              select: {
                id: true
              }
            }
          }
        },
        session: {
          select: {
            id: true,
            sessionDate: true,
            schedule: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    if (!record) {
      throw reply.notFound("Attendance record not found");
    }

    const nextCheckInAt =
      !attendanceStatusUsesCheckIn(body.status)
        ? null
        : body.checkInAt !== undefined
          ? body.checkInAt
            ? new Date(body.checkInAt)
            : null
          : record.checkInAt;
    const checkInAtChanged =
      (record.checkInAt ? record.checkInAt.toISOString() : null) !== (nextCheckInAt ? nextCheckInAt.toISOString() : null);

    if (record.status === body.status && !checkInAtChanged) {
      throw reply.badRequest("Attendance record status unchanged");
    }

    const needsSettlementPolicy = Boolean(record.pointTransactionId && isAttendancePenaltyStatus(body.status));
    const [policy, currentPointTransaction] = record.pointTransactionId
      ? await Promise.all([
          needsSettlementPolicy
            ? app.prisma.attendancePolicy.findUnique({
                where: {
                  classId: params.classId
                },
                select: {
                  latePenaltyValue: true,
                  absentPenaltyValue: true
                }
              })
            : Promise.resolve(null),
          app.prisma.pointTransaction.findFirst({
            where: {
              id: record.pointTransactionId,
              classId: params.classId
            },
            select: {
              sourceModule: true
            }
          })
        ])
      : [null, null];

    if (needsSettlementPolicy && !policy) {
      throw reply.notFound("Attendance policy not found");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
        tenantId: classRecord.tenantId,
        classId: params.classId,
        actorUserId: auth.sub,
        actorMembershipId: membership.id,
        recordId: record.id,
        attendanceSessionId: record.attendanceSessionId,
        studentId: record.studentId,
        sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
        sessionName: record.session.schedule.name,
        currentPointTransactionId: record.pointTransactionId ?? null,
        nextStatus: body.status,
        maintainSettlement: Boolean(record.pointTransactionId),
        latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
        absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
        fallbackPointAccountId: record.student.account?.id ?? null
      });

      const updatedRecord = await tx.attendanceRecord.update({
        where: {
          id: record.id
        },
        data: {
          status: body.status,
          source: "manual_update",
          recordedAt: new Date(),
          checkInAt: nextCheckInAt,
          pointTransactionId: settlementResult.pointTransactionId ?? null,
          batchId: null,
          actorUserId: auth.sub,
          actorMembershipId: membership.id
        },
        select: {
          id: true,
          attendanceSessionId: true,
          status: true,
          note: true,
          checkInAt: true,
          recordedAt: true,
          source: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.record.update",
          targetType: "attendance_record",
          targetId: record.id,
          beforeData: {
            status: record.status,
            note: record.note,
            checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
            source: record.source,
            pointTransactionId: record.pointTransactionId ?? null,
            pointTransactionSourceModule: currentPointTransaction?.sourceModule ?? null
          },
          afterData: {
            status: updatedRecord.status,
            note: updatedRecord.note,
            checkInAt: updatedRecord.checkInAt ? updatedRecord.checkInAt.toISOString() : null,
            source: updatedRecord.source,
            pointTransactionId: settlementResult.pointTransactionId ?? null,
            pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
            studentName: record.student.name,
            sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
            sessionName: record.session.schedule.name
          },
          metadata: {
            attendanceSessionId: record.attendanceSessionId
          }
        }
      });

      return updatedRecord;
    });

    return {
      session: {
        id: record.session.id,
        sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
        sessionName: record.session.schedule.name
      },
      student: {
        id: record.student.id,
        name: record.student.name,
        legacyId: record.student.legacyId != null ? record.student.legacyId.toString() : null
      },
      record: {
        attendanceSessionId: updated.attendanceSessionId,
        ...formatAttendanceRecordResponse(updated)
      }
    };
  });

  app.put(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch-status",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const body = attendanceBatchUpdateBodySchema.parse(request.body);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          sessionDate: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const records = await app.prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: params.sessionId,
          classId: params.classId,
          id: {
            in: body.recordIds
          }
        },
        select: {
          id: true,
          attendanceSessionId: true,
          studentId: true,
          status: true,
          note: true,
          checkInAt: true,
          source: true,
          pointTransactionId: true,
          student: {
            select: {
              id: true,
              name: true,
              legacyId: true
            }
          }
        }
      });

      if (records.length !== body.recordIds.length) {
        throw reply.notFound("Attendance record batch contains invalid items");
      }

      const recordsToUpdate = records.filter((item) => item.status !== body.status);
      const skippedCount = records.length - recordsToUpdate.length;

      if (!recordsToUpdate.length) {
        throw reply.badRequest("Attendance batch status unchanged");
      }

      const settledPointTransactionIds = recordsToUpdate.map((item) => item.pointTransactionId).filter((item): item is string => Boolean(item));
      const needsSettlementPolicy = settledPointTransactionIds.length > 0 && isAttendancePenaltyStatus(body.status);
      const [policy, currentPointTransactions] = settledPointTransactionIds.length
        ? await Promise.all([
            needsSettlementPolicy
              ? app.prisma.attendancePolicy.findUnique({
                  where: {
                    classId: params.classId
                  },
                  select: {
                    latePenaltyValue: true,
                    absentPenaltyValue: true
                  }
                })
              : Promise.resolve(null),
            app.prisma.pointTransaction.findMany({
              where: {
                classId: params.classId,
                id: {
                  in: settledPointTransactionIds
                }
              },
              select: {
                id: true,
                sourceModule: true
              }
            })
          ])
        : [null, []];

      if (needsSettlementPolicy && !policy) {
        throw reply.notFound("Attendance policy not found");
      }

      const currentPointTransactionSourceModuleById = new Map(
        currentPointTransactions.map((item) => [item.id, item.sourceModule])
      );

      const batchId = crypto.randomUUID();

      const updatedRecords = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const record of recordsToUpdate) {
          const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            recordId: record.id,
            attendanceSessionId: record.attendanceSessionId,
            studentId: record.studentId,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            sessionName: session.schedule.name,
            currentPointTransactionId: record.pointTransactionId ?? null,
            nextStatus: body.status,
            maintainSettlement: Boolean(record.pointTransactionId),
            latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
            absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
            preferredSettlementSourceModule:
              record.pointTransactionId ? currentPointTransactionSourceModuleById.get(record.pointTransactionId) ?? null : null
          });

          const updated = await tx.attendanceRecord.update({
            where: {
              id: record.id
            },
            data: {
              status: body.status,
              source: "manual_batch_update",
              recordedAt: new Date(),
              checkInAt: attendanceStatusUsesCheckIn(body.status) ? record.checkInAt : null,
              pointTransactionId: settlementResult.pointTransactionId ?? null,
              batchId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id
            },
            select: {
              id: true,
              attendanceSessionId: true,
              status: true,
              note: true,
              checkInAt: true,
              recordedAt: true,
              source: true
            }
          });

          await tx.auditLog.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              action: "attendance.record.batch_update",
              targetType: "attendance_record",
              targetId: record.id,
              beforeData: {
                status: record.status,
                note: record.note,
                checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
                source: record.source,
                pointTransactionId: record.pointTransactionId ?? null,
                pointTransactionSourceModule: record.pointTransactionId
                  ? currentPointTransactionSourceModuleById.get(record.pointTransactionId) ?? null
                  : null
              },
              afterData: {
                status: updated.status,
                note: updated.note,
                checkInAt: updated.checkInAt ? updated.checkInAt.toISOString() : null,
                source: updated.source,
                pointTransactionId: settlementResult.pointTransactionId ?? null,
                pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
                studentName: record.student.name,
                sessionDate: session.sessionDate.toISOString().slice(0, 10),
                sessionName: session.schedule.name
              },
              metadata: {
                attendanceSessionId: params.sessionId,
                batchSize: body.recordIds.length,
                batchId
              }
            }
          });

          results.push({
            student: {
              id: record.student.id,
              name: record.student.name,
              legacyId: record.student.legacyId != null ? record.student.legacyId.toString() : null
            },
            record: {
              attendanceSessionId: updated.attendanceSessionId,
              ...formatAttendanceRecordResponse(updated)
            }
          });
        }

        return results;
      });

      return {
        session: {
          id: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name
        },
        targetStatus: body.status,
        requestedCount: body.recordIds.length,
        updatedCount: updatedRecords.length,
        skippedCount,
        batchId,
        items: updatedRecords
      };
    }
  );

  app.put(
    "/classes/:classId/attendance/issues/status",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = classParamsSchema.parse(request.params);
      const body = attendanceIssueBatchUpdateBodySchema.parse(request.body);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);
      const uniqueRecordIds = [...new Set(body.recordIds)];

      const records = await app.prisma.attendanceRecord.findMany({
        where: {
          classId: params.classId,
          id: {
            in: uniqueRecordIds
          }
        },
        select: {
          id: true,
          attendanceSessionId: true,
          studentId: true,
          status: true,
          note: true,
          checkInAt: true,
          recordedAt: true,
          source: true,
          pointTransactionId: true,
          student: {
            select: {
              id: true,
              name: true,
              legacyId: true,
              sortOrder: true
            }
          },
          session: {
            select: {
              id: true,
              sessionDate: true,
              sessionCode: true,
              status: true,
              schedule: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      });

      if (records.length !== uniqueRecordIds.length) {
        throw reply.notFound("Attendance issue batch contains invalid items");
      }

      const recordsToUpdate = records.filter((item) => item.status !== body.status);
      const skippedCount = records.length - recordsToUpdate.length;

      if (!recordsToUpdate.length) {
        throw reply.badRequest("Attendance issues status unchanged");
      }

      const settledPointTransactionIds = recordsToUpdate.map((item) => item.pointTransactionId).filter((item): item is string => Boolean(item));
      const needsSettlementPolicy = settledPointTransactionIds.length > 0 && isAttendancePenaltyStatus(body.status);
      const [policy, currentPointTransactions] = settledPointTransactionIds.length
        ? await Promise.all([
            needsSettlementPolicy
              ? app.prisma.attendancePolicy.findUnique({
                  where: {
                    classId: params.classId
                  },
                  select: {
                    latePenaltyValue: true,
                    absentPenaltyValue: true
                  }
                })
              : Promise.resolve(null),
            app.prisma.pointTransaction.findMany({
              where: {
                classId: params.classId,
                id: {
                  in: settledPointTransactionIds
                }
              },
              select: {
                id: true,
                sourceModule: true
              }
            })
          ])
        : [null, []];

      if (needsSettlementPolicy && !policy) {
        throw reply.notFound("Attendance policy not found");
      }

      const currentPointTransactionSourceModuleById = new Map(
        currentPointTransactions.map((item) => [item.id, item.sourceModule])
      );

      const batchId = crypto.randomUUID();

      const updatedRecords = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const record of recordsToUpdate) {
          const settlementResult = await reconcileAttendanceRecordSettlement(tx, {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            recordId: record.id,
            attendanceSessionId: record.attendanceSessionId,
            studentId: record.studentId,
            sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
            sessionName: record.session.schedule.name,
            currentPointTransactionId: record.pointTransactionId ?? null,
            nextStatus: body.status,
            maintainSettlement: Boolean(record.pointTransactionId),
            latePenaltyValue: getSignedAttendancePenalty(policy?.latePenaltyValue),
            absentPenaltyValue: getSignedAttendancePenalty(policy?.absentPenaltyValue),
            preferredSettlementSourceModule:
              record.pointTransactionId ? currentPointTransactionSourceModuleById.get(record.pointTransactionId) ?? null : null
          });

          const updated = await tx.attendanceRecord.update({
            where: {
              id: record.id
            },
            data: {
              status: body.status,
              source: "manual_batch_update",
              recordedAt: new Date(),
              checkInAt: attendanceStatusUsesCheckIn(body.status) ? record.checkInAt : null,
              pointTransactionId: settlementResult.pointTransactionId ?? null,
              batchId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id
            },
            select: {
              id: true,
              attendanceSessionId: true,
              status: true,
              note: true,
              checkInAt: true,
              recordedAt: true,
              source: true,
              pointTransactionId: true
            }
          });

          await tx.auditLog.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              action: "attendance.record.batch_update",
              targetType: "attendance_record",
              targetId: record.id,
              beforeData: {
                status: record.status,
                note: record.note,
                checkInAt: record.checkInAt ? record.checkInAt.toISOString() : null,
                source: record.source,
                pointTransactionId: record.pointTransactionId ?? null,
                pointTransactionSourceModule: record.pointTransactionId
                  ? currentPointTransactionSourceModuleById.get(record.pointTransactionId) ?? null
                  : null
              },
              afterData: {
                status: updated.status,
                note: updated.note,
                checkInAt: updated.checkInAt ? updated.checkInAt.toISOString() : null,
                source: updated.source,
                pointTransactionId: settlementResult.pointTransactionId ?? null,
                pointTransactionSourceModule: settlementResult.pointTransactionSourceModule,
                studentName: record.student.name,
                sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
                sessionName: record.session.schedule.name
              },
              metadata: {
                attendanceSessionId: record.attendanceSessionId,
                batchSize: uniqueRecordIds.length,
                batchId,
                issueWorkbench: true
              }
            }
          });

          results.push(
            serializeAttendanceIssueItem({
              ...updated,
              session: record.session,
              student: record.student
            })
          );
        }

        return results;
      });

      return {
        targetStatus: body.status,
        requestedCount: uniqueRecordIds.length,
        updatedCount: updatedRecords.length,
        skippedCount,
        batchId,
        items: updatedRecords
      };
    }
  );

  app.post(
    "/classes/:classId/attendance/issues/settle-absent",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = classParamsSchema.parse(request.params);
      const body = attendanceIssueSettleBodySchema.parse(request.body);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);
      const uniqueRecordIds = [...new Set(body.recordIds)];

      const [policy, records] = await Promise.all([
        app.prisma.attendancePolicy.findUnique({
          where: {
            classId: params.classId
          },
          select: {
            absentPenaltyValue: true
          }
        }),
        app.prisma.attendanceRecord.findMany({
          where: {
            classId: params.classId,
            id: {
              in: uniqueRecordIds
            }
          },
          select: {
            id: true,
            attendanceSessionId: true,
            studentId: true,
            status: true,
            pointTransactionId: true,
            student: {
              select: {
                id: true,
                name: true,
                legacyId: true,
                account: {
                  select: {
                    id: true,
                    totalPoints: true,
                    balancePoints: true,
                    penaltyPoints: true,
                    version: true
                  }
                }
              }
            },
            session: {
              select: {
                id: true,
                sessionDate: true,
                sessionCode: true,
                status: true,
                schedule: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        })
      ]);

      if (!policy) {
        throw reply.notFound("Attendance policy not found");
      }

      if (records.length !== uniqueRecordIds.length) {
        throw reply.notFound("Attendance issue batch contains invalid items");
      }

      const absentPenaltyValue = getSignedAttendancePenalty(policy.absentPenaltyValue);
      const eligibleRecords = records.filter(
        (item) => item.status === "absent" && !item.pointTransactionId && item.student.account
      );
      const skippedCount = records.length - eligibleRecords.length;

      if (!eligibleRecords.length) {
        throw reply.badRequest("Attendance absent settle has no eligible records");
      }

      const batchId = crypto.randomUUID();

      const settledItems = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const record of eligibleRecords) {
          const account = record.student.account!;
          const reason = `缺勤扣分: ${record.session.sessionDate.toISOString().slice(0, 10)} ${record.session.schedule.name}`;

          const pointTransaction = await tx.pointTransaction.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              studentId: record.studentId,
              pointAccountId: account.id,
              transactionType: "penalty",
              value: absentPenaltyValue,
              reason,
              scene: "班级",
              category: "出勤",
              sourceModule: "attendance_issue_settlement",
              sourceType: "attendance_issue_absent_settlement",
              sourceId: record.id,
              batchId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              occurredAt: new Date(),
              metadata: {
                attendanceSessionId: record.attendanceSessionId,
                attendanceRecordId: record.id,
                attendanceStatus: record.status
              }
            }
          });

          await tx.pointAccount.update({
            where: {
              id: account.id
            },
            data: {
              totalPoints: Number(account.totalPoints) + absentPenaltyValue,
              balancePoints: Number(account.balancePoints) + absentPenaltyValue,
              penaltyPoints: Number(account.penaltyPoints) + Math.abs(absentPenaltyValue),
              version: {
                increment: 1
              }
            }
          });

          await tx.attendanceRecord.update({
            where: {
              id: record.id
            },
            data: {
              pointTransactionId: pointTransaction.id
            }
          });

          await tx.auditLog.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              action: "attendance.issue.absent_settle",
              targetType: "attendance_record",
              targetId: record.id,
              afterData: {
                status: record.status,
                studentName: record.student.name,
                sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
                sessionName: record.session.schedule.name,
                transactionId: pointTransaction.id,
                value: String(pointTransaction.value)
              },
              metadata: {
                attendanceSessionId: record.attendanceSessionId,
                attendanceRecordId: record.id,
                pointTransactionId: pointTransaction.id,
                batchId,
                batchSize: uniqueRecordIds.length
              }
            }
          });

          results.push({
            recordId: record.id,
            session: {
              id: record.session.id,
              sessionDate: record.session.sessionDate.toISOString().slice(0, 10),
              sessionCode: record.session.sessionCode,
              sessionName: record.session.schedule.name,
              status: record.session.status
            },
            student: {
              id: record.student.id,
              name: record.student.name,
              legacyId: record.student.legacyId != null ? record.student.legacyId.toString() : null
            },
            transactionId: pointTransaction.id,
            value: String(pointTransaction.value)
          });
        }

        return results;
      });

      return {
        requestedCount: uniqueRecordIds.length,
        settledCount: settledItems.length,
        skippedCount,
        batchId,
        items: settledItems
      };
    }
  );

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch-revert-latest",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const body = attendanceBatchRevertBodySchema.parse(request.body);
      return revertAttendanceBatchUpdateLatest(auth, params.classId, params.sessionId, body.recordIds, reply);
    }
  );

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/records/batch-revert-create-latest",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const body = attendanceBatchRevertBodySchema.parse(request.body);
      return revertAttendanceBatchCreateLatest(auth, params.classId, params.sessionId, body.recordIds, reply);
    }
  );

  app.post("/classes/:classId/attendance/sessions/:sessionId/settle", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = attendanceSessionParamsSchema.parse(request.params);
    const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

    const [session, policy, records] = await Promise.all([
      app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          sessionDate: true,
          status: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      }),
      app.prisma.attendancePolicy.findUnique({
        where: {
          classId: params.classId
        },
        select: {
          latePenaltyValue: true,
          absentPenaltyValue: true
        }
      }),
      app.prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          studentId: true,
          status: true,
          pointTransactionId: true,
          student: {
            select: {
              id: true,
              name: true,
              account: {
                select: {
                  id: true,
                  totalPoints: true,
                  balancePoints: true,
                  penaltyPoints: true,
                  version: true
                }
              }
            }
          }
        }
      })
    ]);

    if (!session) {
      throw reply.notFound("Attendance session not found");
    }
    if (!policy) {
      throw reply.notFound("Attendance policy not found");
    }
    if (session.status !== "open") {
      throw reply.badRequest("Attendance session is not open");
    }

    const latePenaltyValue = getSignedAttendancePenalty(policy.latePenaltyValue);
    const absentPenaltyValue = getSignedAttendancePenalty(policy.absentPenaltyValue);

    const eligibleRecords = records.filter(
      (item) => !item.pointTransactionId && (item.status === "late" || item.status === "absent") && item.student.account
    );

    const result = await app.prisma.$transaction(async (tx) => {
      const settledItems = [];

      for (const record of eligibleRecords) {
        const account = record.student.account!;
        const penaltyValue = record.status === "late" ? latePenaltyValue : absentPenaltyValue;
        const reason =
          record.status === "late"
            ? `考勤迟到: ${session.sessionDate.toISOString().slice(0, 10)} ${session.schedule.name}`
            : `缺勤扣分: ${session.sessionDate.toISOString().slice(0, 10)} ${session.schedule.name}`;

        const pointTransaction = await tx.pointTransaction.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            studentId: record.studentId,
            pointAccountId: account.id,
            transactionType: "penalty",
            value: penaltyValue,
            reason,
            scene: "班级",
            category: "出勤",
            sourceModule: "attendance_settlement",
            sourceType: "attendance_session_settlement",
            sourceId: session.id,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            occurredAt: new Date(),
            metadata: {
              attendanceSessionId: session.id,
              attendanceStatus: record.status
            }
          }
        });

        await tx.pointAccount.update({
          where: {
            id: account.id
          },
          data: {
            totalPoints: Number(account.totalPoints) + penaltyValue,
            balancePoints: Number(account.balancePoints) + penaltyValue,
            penaltyPoints: Number(account.penaltyPoints) + Math.abs(penaltyValue),
            version: {
              increment: 1
            }
          }
        });

        await tx.attendanceRecord.update({
          where: {
            id: record.id
          },
          data: {
            pointTransactionId: pointTransaction.id
          }
        });

        settledItems.push({
          recordId: record.id,
          studentId: record.student.id,
          studentName: record.student.name,
          transactionId: pointTransaction.id,
          status: record.status,
          value: String(pointTransaction.value)
        });
      }

      await tx.attendanceSession.update({
        where: {
          id: session.id
        },
        data: {
          status: "closed"
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "attendance.session.settle",
          targetType: "attendance_session",
          targetId: session.id,
          beforeData: {
            status: session.status
          },
          afterData: {
            status: "closed",
            settledCount: settledItems.length,
            sessionDate: session.sessionDate.toISOString().slice(0, 10),
            sessionName: session.schedule.name
          },
          metadata: {
            attendanceSessionId: session.id,
            latePenaltyValue: String(policy.latePenaltyValue),
            absentPenaltyValue: String(policy.absentPenaltyValue)
          }
        }
      });

      return settledItems;
    });

    return {
      session: {
        id: session.id,
        sessionDate: session.sessionDate.toISOString().slice(0, 10),
        sessionName: session.schedule.name,
        status: "closed"
      },
      settledCount: result.length,
      skippedCount: records.length - result.length,
      items: result
    };
  });

  app.post(
    "/classes/:classId/attendance/sessions/:sessionId/revert-latest-settlement",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = attendanceSessionParamsSchema.parse(request.params);
      const { classRecord, membership } = await requireAttendanceWriteAccess(app, auth.sub, params.classId, reply);

      const session = await app.prisma.attendanceSession.findFirst({
        where: {
          id: params.sessionId,
          classId: params.classId
        },
        select: {
          id: true,
          sessionDate: true,
          status: true,
          schedule: {
            select: {
              name: true
            }
          }
        }
      });

      if (!session) {
        throw reply.notFound("Attendance session not found");
      }

      const latestSettlementAudit = await app.prisma.auditLog.findFirst({
        where: {
          classId: params.classId,
          action: {
            in: ["attendance.session.settle", "attendance.session.settle_revert"]
          },
          targetType: "attendance_session",
          targetId: session.id
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          action: true
        }
      });

      if (!latestSettlementAudit || latestSettlementAudit.action !== "attendance.session.settle") {
        throw reply.badRequest("Attendance session has no revertible settlement");
      }

      const records = await app.prisma.attendanceRecord.findMany({
        where: {
          attendanceSessionId: params.sessionId,
          classId: params.classId,
          pointTransactionId: {
            not: null
          }
        },
        select: {
          id: true,
          studentId: true,
          pointTransactionId: true,
          student: {
            select: {
              id: true,
              name: true,
              account: {
                select: {
                  id: true,
                  totalPoints: true,
                  balancePoints: true,
                  penaltyPoints: true,
                  version: true
                }
              }
            }
          }
        }
      });

      const originalTransactions = await app.prisma.pointTransaction.findMany({
        where: {
          id: {
            in: records.map((item) => item.pointTransactionId!).filter(Boolean)
          }
        },
        select: {
          id: true,
          studentId: true,
          pointAccountId: true,
          transactionType: true,
          value: true,
          reason: true,
          scene: true,
          category: true,
          sourceModule: true,
          isReverted: true,
          student: {
            select: {
              id: true,
              name: true,
              account: {
                select: {
                  id: true,
                  totalPoints: true,
                  balancePoints: true,
                  penaltyPoints: true,
                  version: true
                }
              }
            }
          }
        }
      });

      const revertibleTransactions = originalTransactions.filter(
        (item) => item.sourceModule === "attendance_settlement" && !item.isReverted && item.student.account
      );

      if (!revertibleTransactions.length && session.status !== "closed") {
        throw reply.badRequest("Attendance session has no revertible settlement");
      }

      const revertedItems = await app.prisma.$transaction(async (tx) => {
        const results = [];

        for (const original of revertibleTransactions) {
          const account = original.student.account!;
          const originalValue = Number(original.value);
          const reversedValue = -originalValue;

          const revertTransaction = await tx.pointTransaction.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              studentId: original.studentId,
              pointAccountId: original.pointAccountId,
              transactionType: "adjustment",
              value: reversedValue,
              reason: `撤销考勤结算: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "attendance_settlement_revert",
              sourceType: "attendance_session_settlement_revert",
              sourceId: session.id,
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              occurredAt: new Date(),
              metadata: {
                revertedTransactionId: original.id,
                attendanceSessionId: session.id
              }
            }
          });

          await tx.pointTransaction.update({
            where: {
              id: original.id
            },
            data: {
              isReverted: true,
              revertedByTransactionId: revertTransaction.id
            }
          });

          await tx.pointAccount.update({
            where: {
              id: account.id
            },
            data: {
              totalPoints: Number(account.totalPoints) + reversedValue,
              balancePoints: Number(account.balancePoints) + reversedValue,
              penaltyPoints:
                original.transactionType === "penalty"
                  ? Number(account.penaltyPoints) - Math.abs(originalValue)
                  : Number(account.penaltyPoints),
              version: {
                increment: 1
              }
            }
          });

          await tx.attendanceRecord.updateMany({
            where: {
              attendanceSessionId: session.id,
              pointTransactionId: original.id
            },
            data: {
              pointTransactionId: null
            }
          });

          results.push({
            transactionId: original.id,
            studentId: original.student.id,
            studentName: original.student.name,
            revertedValue: String(reversedValue)
          });
        }

        await tx.attendanceSession.update({
          where: {
            id: session.id
          },
          data: {
            status: "open"
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "attendance.session.settle_revert",
            targetType: "attendance_session",
            targetId: session.id,
            beforeData: {
              status: session.status
            },
            afterData: {
              status: "open",
              revertedCount: results.length,
              sessionDate: session.sessionDate.toISOString().slice(0, 10),
              sessionName: session.schedule.name
            },
            metadata: {
              attendanceSessionId: session.id,
              revertedAuditId: latestSettlementAudit.id
            }
          }
        });

        return results;
      });

      return {
        session: {
          id: session.id,
          sessionDate: session.sessionDate.toISOString().slice(0, 10),
          sessionName: session.schedule.name,
          status: "open"
        },
        revertedCount: revertedItems.length,
        items: revertedItems
      };
    }
  );
};
