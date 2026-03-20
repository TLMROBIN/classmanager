import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { canManagePoints } from "../../lib/permissions.js";

const tenantQuerySchema = z.object({
  tenantId: z.string().uuid()
});

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const studentParamsSchema = z.object({
  studentId: z.string().uuid()
});

const avatarDataUrlSchema = z
  .string()
  .trim()
  .max(500_000)
  .refine((value) => /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value), {
    message: "Avatar must be a base64 image data URL"
  });

const studentUpdateBodySchema = z
  .object({
    studentNo: z
      .union([z.string().trim().min(1).max(50), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    name: z.string().trim().min(1).max(120).optional(),
    gender: z
      .union([z.string().trim().min(1).max(10), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    status: z.string().trim().min(1).max(30).optional(),
    sortOrder: z.number().int().min(0).max(9999).optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Student update payload is empty"
  });

const studentCreateBodySchema = z.object({
  studentNo: z
    .union([z.string().trim().min(1).max(50), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
  name: z.string().trim().min(1).max(120),
  gender: z
    .union([z.string().trim().min(1).max(10), z.literal(""), z.null()])
    .optional()
    .transform((value) => (value === "" ? null : value)),
  status: z.string().trim().min(1).max(30).default("active"),
  sortOrder: z.number().int().min(0).max(9999).optional()
});

const studentOrganizationUpdateBodySchema = z
  .object({
    groupId: z.union([z.string().uuid(), z.null()]).optional(),
    dormitoryId: z.union([z.string().uuid(), z.null()]).optional(),
    positionIds: z.array(z.string().uuid()).max(20).optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Student organization update payload is empty"
  });

const studentProfileUpdateBodySchema = z
  .object({
    titleLeft: z
      .union([z.string().trim().max(120), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    titleRight: z
      .union([z.string().trim().max(120), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    notes: z
      .union([z.string().trim().max(5000), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    avatarHappyData: z
      .union([avatarDataUrlSchema, z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    avatarNormalData: z
      .union([avatarDataUrlSchema, z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value)),
    avatarSadData: z
      .union([avatarDataUrlSchema, z.literal(""), z.null()])
      .optional()
      .transform((value) => (value === "" ? null : value))
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Student profile update payload is empty"
  });

const studentPositionBatchUpdateBodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(60),
  positionIds: z.array(z.string().uuid()).max(20)
});

const studentOrganizationBatchUpdateBodySchema = z
  .object({
    studentIds: z.array(z.string().uuid()).min(1).max(60),
    groupId: z.union([z.string().uuid(), z.null()]).optional(),
    dormitoryId: z.union([z.string().uuid(), z.null()]).optional()
  })
  .refine((body) => body.groupId !== undefined || body.dormitoryId !== undefined, {
    message: "Student organization batch update payload is empty"
  });

const studentStatusBatchUpdateBodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(60),
  status: z.string().trim().min(1).max(30)
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

async function requireClassMembership(app: any, userId: string, classId: string, reply: any) {
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

  return {
    classRecord,
    membership
  };
}

async function requireClassNotFrozen(app: any, classId: string, reply: any) {
  const classConfig = await app.prisma.classConfig.findUnique({
    where: { classId },
    select: { isFrozen: true }
  });

  if (classConfig?.isFrozen) {
    throw reply.badRequest("Class is frozen");
  }
}

function readMappingBoolean(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return false;
  }

  return Boolean((metadata as Record<string, unknown>)[key]);
}

function readMappingString(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readAvatarMapping(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {
      avatarHappyData: null,
      avatarNormalData: null,
      avatarSadData: null
    };
  }

  const avatarData =
    typeof (metadata as Record<string, unknown>).avatarData === "object" &&
    (metadata as Record<string, unknown>).avatarData &&
    !Array.isArray((metadata as Record<string, unknown>).avatarData)
      ? ((metadata as Record<string, unknown>).avatarData as Record<string, unknown>)
      : null;

  return {
    avatarHappyData:
      (avatarData && typeof avatarData.happy === "string" ? avatarData.happy : null) ||
      readMappingString(metadata, "avatarHappyData"),
    avatarNormalData:
      (avatarData && typeof avatarData.normal === "string" ? avatarData.normal : null) ||
      readMappingString(metadata, "avatarNormalData"),
    avatarSadData:
      (avatarData && typeof avatarData.sad === "string" ? avatarData.sad : null) ||
      readMappingString(metadata, "avatarSadData")
  };
}

function hasAvatarData(avatar: {
  avatarHappyData: string | null;
  avatarNormalData: string | null;
  avatarSadData: string | null;
}) {
  return Boolean(avatar.avatarHappyData || avatar.avatarNormalData || avatar.avatarSadData);
}

function getMappingPriority(classRecord: any, legacyScope: unknown) {
  const normalizedScope = typeof legacyScope === "string" ? legacyScope.trim() : "";
  if (!normalizedScope) return 0;
  if (normalizedScope === `structured-full:${classRecord.id}`) {
    return 3;
  }
  if (normalizedScope === classRecord.tenant?.slug) {
    return 2;
  }
  return 1;
}

function sortMappingsByPriority(classRecord: any, mappings: Array<Record<string, unknown>>) {
  return [...mappings].sort((left, right) => {
    const priorityDiff =
      getMappingPriority(classRecord, right.legacyScope) -
      getMappingPriority(classRecord, left.legacyScope);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const leftTime = left.createdAt ? new Date(String(left.createdAt)).getTime() : 0;
    const rightTime = right.createdAt ? new Date(String(right.createdAt)).getTime() : 0;
    return rightTime - leftTime;
  });
}

function pickPreferredMapping(classRecord: any, mappings: Array<Record<string, unknown>>) {
  const [mapping] = sortMappingsByPriority(classRecord, mappings);
  return mapping || null;
}

function mergeAvatarMappings(classRecord: any, mappings: Array<Record<string, unknown>>) {
  return sortMappingsByPriority(classRecord, mappings).reduce(
    (acc, item) => {
      const parsed = readAvatarMapping(item.metadata);
      return {
        avatarHappyData: acc.avatarHappyData || parsed.avatarHappyData,
        avatarNormalData: acc.avatarNormalData || parsed.avatarNormalData,
        avatarSadData: acc.avatarSadData || parsed.avatarSadData
      };
    },
    readAvatarMapping(null)
  );
}

function summarizeAvatarState(avatar: {
  avatarHappyData: string | null;
  avatarNormalData: string | null;
  avatarSadData: string | null;
}) {
  return {
    hasHappyAvatar: Boolean(avatar.avatarHappyData),
    hasNormalAvatar: Boolean(avatar.avatarNormalData),
    hasSadAvatar: Boolean(avatar.avatarSadData)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cloneJsonRecord(value: unknown) {
  if (!isRecord(value)) {
    return {} as Record<string, unknown>;
  }

  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function countExactStringReferences(value: unknown, target: string): number {
  if (typeof value === "string") {
    return value.trim() === target ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => total + countExactStringReferences(item, target), 0);
  }
  if (!isRecord(value)) {
    return 0;
  }

  return Object.entries(value).reduce((total, [key, item]) => {
    const keyMatches = key.trim() === target ? 1 : 0;
    return total + keyMatches + countExactStringReferences(item, target);
  }, 0);
}

function formatAccountValue(value: unknown) {
  const current = Number(value);
  return Number.isFinite(current) ? String(current) : "0";
}

function hasNonZeroPointAccount(
  account:
    | {
        totalPoints: unknown;
        balancePoints: unknown;
        penaltyPoints: unknown;
      }
    | null
    | undefined
) {
  if (!account) {
    return false;
  }

  return [account.totalPoints, account.balancePoints, account.penaltyPoints].some((item) => {
    const current = Number(item);
    return Number.isFinite(current) && Math.abs(current) > 0;
  });
}

function cleanupStudentIdList(value: unknown, studentId: string) {
  if (!Array.isArray(value)) {
    return {
      nextItems: value,
      removedCount: 0
    };
  }

  const filtered = value.filter((current) => String(current ?? "").trim() !== studentId);
  return {
    nextItems: filtered,
    removedCount: value.length - filtered.length
  };
}

function cleanupStudentKeyedRecord(value: unknown, studentId: string) {
  if (!isRecord(value)) {
    return {
      nextItems: value,
      removedCount: 0
    };
  }

  const rowsToRemove = Object.entries(value).filter(([key]) => key.trim() === studentId);
  const nextItems = Object.fromEntries(Object.entries(value).filter(([key]) => key.trim() !== studentId));
  const removedCount = rowsToRemove.reduce((total, [, item]) => {
    if (isRecord(item)) {
      return total + Math.max(Object.keys(item).length, 1);
    }
    return total + 1;
  }, 0);

  return {
    nextItems,
    removedCount
  };
}

function cleanupStudentReferencesInLegacyCompat(value: unknown, studentId: string) {
  if (!isRecord(value)) {
    return {
      nextLegacyCompat: value,
      cleanupMessages: [] as string[],
      changed: false
    };
  }

  const nextLegacyCompat = cloneJsonRecord(value);
  let taskClaimRefCount = 0;
  let shopStorageRefCount = 0;
  let shopRedemptionHistoryRefCount = 0;
  let battleMemberRefCount = 0;

  if (Array.isArray(nextLegacyCompat.tasks)) {
    nextLegacyCompat.tasks = nextLegacyCompat.tasks.map((item) => {
      if (!isRecord(item)) {
        return item;
      }

      const { nextItems, removedCount } = cleanupStudentIdList(item.claimedByStudentIds, studentId);
      taskClaimRefCount += removedCount;
      return {
        ...item,
        claimedByStudentIds: Array.isArray(nextItems) ? nextItems : []
      };
    });
  }

  if (isRecord(nextLegacyCompat.shop)) {
    const nextShop = cloneJsonRecord(nextLegacyCompat.shop);
    const storageCleanup = cleanupStudentKeyedRecord(nextShop.storage, studentId);
    const redemptionHistoryCleanup = cleanupStudentKeyedRecord(nextShop.redemptionHistory, studentId);
    shopStorageRefCount += storageCleanup.removedCount;
    shopRedemptionHistoryRefCount += redemptionHistoryCleanup.removedCount;
    nextShop.storage = isRecord(storageCleanup.nextItems) ? storageCleanup.nextItems : {};
    nextShop.redemptionHistory = isRecord(redemptionHistoryCleanup.nextItems) ? redemptionHistoryCleanup.nextItems : {};
    nextLegacyCompat.shop = nextShop;
  }

  if (isRecord(nextLegacyCompat.battle)) {
    const nextBattle = cloneJsonRecord(nextLegacyCompat.battle);
    if (Array.isArray(nextBattle.teams)) {
      nextBattle.teams = nextBattle.teams.map((item) => {
        if (!isRecord(item)) {
          return item;
        }

        const { nextItems, removedCount } = cleanupStudentIdList(item.memberStudentIds, studentId);
        battleMemberRefCount += removedCount;
        return {
          ...item,
          memberStudentIds: Array.isArray(nextItems) ? nextItems : []
        };
      });
    }
    nextLegacyCompat.battle = nextBattle;
  }

  const cleanupMessages: string[] = [];
  if (taskClaimRefCount > 0) {
    cleanupMessages.push(`兼容任务领取 ${taskClaimRefCount} 处`);
  }
  if (shopStorageRefCount > 0) {
    cleanupMessages.push(`藏宝阁仓库 ${shopStorageRefCount} 项`);
  }
  if (shopRedemptionHistoryRefCount > 0) {
    cleanupMessages.push(`藏宝阁兑换历史 ${shopRedemptionHistoryRefCount} 项`);
  }
  if (battleMemberRefCount > 0) {
    cleanupMessages.push(`双子星战队成员 ${battleMemberRefCount} 处`);
  }

  return {
    nextLegacyCompat,
    cleanupMessages,
    changed: cleanupMessages.length > 0
  };
}

function cleanupStudentReferencesInClassConfigExtra(value: unknown, studentId: string) {
  const nextExtra = cloneJsonRecord(value);
  let dutyRefCount = 0;
  let subjectRefCount = 0;
  let psychologyRefCount = 0;
  let studentCouncilRefCount = 0;

  if (isRecord(nextExtra.duty)) {
    nextExtra.duty = Object.fromEntries(
      Object.entries(nextExtra.duty).map(([dayCode, item]) => {
        if (!Array.isArray(item)) {
          return [dayCode, item];
        }

        const filtered = item.filter((current) => String(current ?? "").trim() !== studentId);
        dutyRefCount += item.length - filtered.length;
        return [dayCode, filtered];
      })
    );
  }

  if (Array.isArray(nextExtra.subjects)) {
    nextExtra.subjects = nextExtra.subjects.map((item) => {
      if (!isRecord(item) || !Array.isArray(item.representativeStudentIds)) {
        return item;
      }

      const filtered = item.representativeStudentIds.filter((current) => String(current ?? "").trim() !== studentId);
      subjectRefCount += item.representativeStudentIds.length - filtered.length;
      return {
        ...item,
        representativeStudentIds: filtered
      };
    });
  }

  if (Array.isArray(nextExtra.psychologyCommitteeStudentIds)) {
    const filtered = nextExtra.psychologyCommitteeStudentIds.filter((current) => String(current ?? "").trim() !== studentId);
    psychologyRefCount = nextExtra.psychologyCommitteeStudentIds.length - filtered.length;
    nextExtra.psychologyCommitteeStudentIds = filtered;
  }

  if (Array.isArray(nextExtra.studentCouncilRoles)) {
    nextExtra.studentCouncilRoles = nextExtra.studentCouncilRoles.map((item) => {
      if (!isRecord(item) || typeof item.studentId !== "string" || item.studentId.trim() !== studentId) {
        return item;
      }

      studentCouncilRefCount += 1;
      return {
        ...item,
        studentId: null
      };
    });
  }

  const legacyCompatCleanup = cleanupStudentReferencesInLegacyCompat(nextExtra.legacyCompat, studentId);
  if (legacyCompatCleanup.changed) {
    nextExtra.legacyCompat = legacyCompatCleanup.nextLegacyCompat;
  }

  const cleanupMessages: string[] = [];
  if (dutyRefCount > 0) {
    cleanupMessages.push(`值日安排 ${dutyRefCount} 处`);
  }
  if (subjectRefCount > 0) {
    cleanupMessages.push(`科目代表 ${subjectRefCount} 处`);
  }
  if (psychologyRefCount > 0) {
    cleanupMessages.push(`心理委员名单 ${psychologyRefCount} 处`);
  }
  if (studentCouncilRefCount > 0) {
    cleanupMessages.push(`学生会岗位 ${studentCouncilRefCount} 处`);
  }
  cleanupMessages.push(...legacyCompatCleanup.cleanupMessages);

  return {
    nextExtra,
    cleanupMessages,
    changed: cleanupMessages.length > 0
  };
}

function buildStudentDeleteGuard(input: {
  pointTransactionCount: number;
  attendanceRecordCount: number;
  account:
    | {
        totalPoints: unknown;
        balancePoints: unknown;
        penaltyPoints: unknown;
      }
    | null
    | undefined;
  remainingReferenceCount: number;
  cleanupMessages: string[];
}) {
  const blockers: string[] = [];

  if (input.pointTransactionCount > 0) {
    blockers.push(`已存在 ${input.pointTransactionCount} 条积分流水（含作业/考勤衍生记录）`);
  }
  if (input.attendanceRecordCount > 0) {
    blockers.push(`已存在 ${input.attendanceRecordCount} 条考勤记录`);
  }
  if (hasNonZeroPointAccount(input.account)) {
    blockers.push(
      `积分账户仍有分值（总分 ${formatAccountValue(input.account?.totalPoints)} / 余额 ${formatAccountValue(input.account?.balancePoints)} / 罚分 ${formatAccountValue(input.account?.penaltyPoints)}）`
    );
  }
  if (input.remainingReferenceCount > 0) {
    blockers.push(`班级配置或兼容区数据仍引用当前学生 ${input.remainingReferenceCount} 处`);
  }

  return {
    canDelete: blockers.length === 0,
    blockers,
    cleanupMessages: input.cleanupMessages
  };
}

async function requireTenantAccess(app: any, userId: string, tenantId: string, reply: any) {
  const membership = await app.prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId
      }
    },
    select: { id: true, status: true }
  });

  if (!membership || membership.status !== "active") {
    throw reply.forbidden("Tenant access denied");
  }
}

export const classRoutes: FastifyPluginAsync = async (app) => {
  app.get("/classes", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const query = tenantQuerySchema.parse(request.query);
    await requireTenantAccess(app, auth.sub, query.tenantId, reply);

    const classes = await app.prisma.class.findMany({
      where: {
        tenantId: query.tenantId,
        status: "active"
      },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        gradeLabel: true,
        academicYear: true,
        timezone: true
      }
    });

    return { items: classes };
  });

  app.get("/classes/:classId/students", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const students = await app.prisma.student.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        legacyId: true,
        studentNo: true,
        name: true,
        gender: true,
        status: true,
        sortOrder: true,
        account: {
          select: {
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true
          }
        },
        groups: {
          where: {
            endDate: null
          },
          select: {
            isPrimary: true,
            group: {
              select: {
                id: true,
                name: true,
                colorToken: true
              }
            }
          }
        },
        dorms: {
          where: {
            endDate: null
          },
          select: {
            isPrimary: true,
            dormitory: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    return {
      items: students.map((student) => ({
        ...student,
        legacyId: student.legacyId != null ? student.legacyId.toString() : null,
        primaryGroup:
          student.groups.find((item) => item.isPrimary)?.group ??
          student.groups[0]?.group ??
          null,
        primaryDorm:
          student.dorms.find((item) => item.isPrimary)?.dormitory ??
          student.dorms[0]?.dormitory ??
          null
      }))
    };
  });

  app.post("/classes/:classId/students", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = studentCreateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassMembership(app, auth.sub, params.classId, reply);

    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student create permission denied");
    }

    if (body.studentNo) {
      const duplicate = await app.prisma.student.findFirst({
        where: {
          classId: classRecord.id,
          studentNo: body.studentNo
        },
        select: { id: true }
      });

      if (duplicate) {
        throw reply.conflict("Student number already exists");
      }
    }

    const maxSortOrder = body.sortOrder ?? (
      await app.prisma.student.aggregate({
        where: { classId: classRecord.id },
        _max: { sortOrder: true }
      })
    )._max.sortOrder;

    const createdStudent = await app.prisma.$transaction(async (tx: any) => {
      const student = await tx.student.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          studentNo: body.studentNo ?? null,
          name: body.name,
          gender: body.gender ?? null,
          status: body.status,
          sortOrder: body.sortOrder ?? (maxSortOrder ?? -1) + 1
        },
        select: {
          id: true,
          classId: true,
          studentNo: true,
          name: true,
          gender: true,
          status: true,
          sortOrder: true
        }
      });

      await tx.pointAccount.create({
        data: {
          tenantId: classRecord.tenantId,
          studentId: student.id,
          totalPoints: 0,
          balancePoints: 0,
          penaltyPoints: 0
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "student.create",
          targetType: "student",
          targetId: student.id,
          afterData: {
            studentNo: student.studentNo,
            name: student.name,
            gender: student.gender,
            status: student.status,
            sortOrder: student.sortOrder
          }
        }
      });

      return student;
    });

    return {
      student: createdStudent
    };
  });

  app.get("/students/:studentId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = studentParamsSchema.parse(request.params);
    const student = await app.prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        classId: true,
        tenantId: true,
        legacyId: true,
        studentNo: true,
        name: true,
        gender: true,
        status: true,
        sortOrder: true,
        account: {
          select: {
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true,
            version: true
          }
        },
        profile: {
          select: {
            titleLeft: true,
            titleRight: true,
            notes: true
          }
        },
        groups: {
          where: {
            endDate: null
          },
          select: {
            roleCode: true,
            isPrimary: true,
            group: {
              select: {
                id: true,
                name: true,
                colorToken: true
              }
            }
          }
        },
        dorms: {
          where: {
            endDate: null
          },
          select: {
            isPrimary: true,
            dormitory: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        positions: {
          where: {
            endDate: null
          },
          select: {
            position: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    const classRecord = await requireClassAccess(app, auth.sub, student.classId, reply);
    const [studentMappings, avatarMappings] = await Promise.all([
      app.prisma.migrationMapping.findMany({
        where: {
          tenantId: student.tenantId,
          entityType: "student",
          newId: student.id
        },
        select: {
          legacyScope: true,
          legacyKey: true,
          metadata: true,
          createdAt: true
        }
      }),
      app.prisma.migrationMapping.findMany({
        where: {
          tenantId: student.tenantId,
          entityType: "student_avatar",
          newId: student.id
        },
        select: {
          legacyScope: true,
          legacyKey: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
    const studentMapping = pickPreferredMapping(classRecord, studentMappings);
    const avatarProfile = mergeAvatarMappings(classRecord, avatarMappings);
    const legacyAvatarPending =
      readMappingBoolean(studentMapping?.metadata, "hasLegacyAvatarData") &&
      !hasAvatarData(avatarProfile) &&
      avatarMappings.length === 0;

    const [
      recentTransactions,
      recentTransactionAuditCandidates,
      pointTransactionCount,
      attendanceRecordCount,
      classConfig
    ] = await Promise.all([
      app.prisma.pointTransaction.findMany({
        where: {
          studentId: student.id
        },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: 20,
        select: {
          id: true,
          transactionType: true,
          value: true,
          reason: true,
          scene: true,
          category: true,
          sourceModule: true,
          occurredAt: true,
          legacyNumericId: true,
          isReverted: true
        }
      }),
      app.prisma.auditLog.findMany({
        where: {
          classId: student.classId,
          action: {
            in: ["point.adjust", "point.adjust.batch"]
          }
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        select: {
          id: true,
          afterData: true
        }
      }),
      app.prisma.pointTransaction.count({
        where: {
          studentId: student.id
        }
      }),
      app.prisma.attendanceRecord.count({
        where: {
          studentId: student.id
        }
      }),
      app.prisma.classConfig.findUnique({
        where: {
          classId: student.classId
        },
        select: {
          extra: true
        }
      })
    ]);
    const classConfigCleanup = cleanupStudentReferencesInClassConfigExtra(classConfig?.extra, student.id);
    const deleteGuard = buildStudentDeleteGuard({
      pointTransactionCount,
      attendanceRecordCount,
      account: student.account,
      remainingReferenceCount: countExactStringReferences(classConfigCleanup.nextExtra, student.id),
      cleanupMessages: classConfigCleanup.cleanupMessages
    });

    const auditIdByTransactionId = new Map<string, string>();
    for (const audit of recentTransactionAuditCandidates) {
      const transactionId =
        audit.afterData &&
        typeof audit.afterData === "object" &&
        typeof (audit.afterData as Record<string, unknown>).transactionId === "string"
          ? ((audit.afterData as Record<string, unknown>).transactionId as string)
          : null;
      if (!transactionId || auditIdByTransactionId.has(transactionId)) continue;
      auditIdByTransactionId.set(transactionId, audit.id);
    }

    return {
      student: {
        ...student,
        legacyId: student.legacyId != null ? student.legacyId.toString() : null,
        profile:
          student.profile || legacyAvatarPending || avatarMappings.length > 0
            ? {
                titleLeft: student.profile?.titleLeft ?? null,
                titleRight: student.profile?.titleRight ?? null,
                notes: student.profile?.notes ?? null,
                avatarHappyData: avatarProfile.avatarHappyData,
                avatarNormalData: avatarProfile.avatarNormalData,
                avatarSadData: avatarProfile.avatarSadData,
                legacyAvatarPending
              }
            : null
      },
      recentTransactions: recentTransactions.map((item) => ({
        ...item,
        auditId: auditIdByTransactionId.get(item.id) ?? null
      })),
      deleteGuard
    };
  });

  app.put("/students/:studentId/profile", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = studentParamsSchema.parse(request.params);
    const body = studentProfileUpdateBodySchema.parse(request.body);

    const student = await app.prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        tenantId: true,
        classId: true,
        profile: {
          select: {
            titleLeft: true,
            titleRight: true,
            notes: true
          }
        }
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    const { classRecord, membership } = await requireClassMembership(app, auth.sub, student.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student profile update permission denied");
    }

    const [studentMappings, avatarMappings] = await Promise.all([
      app.prisma.migrationMapping.findMany({
        where: {
          tenantId: student.tenantId,
          entityType: "student",
          newId: student.id
        },
        select: {
          legacyScope: true,
          legacyKey: true,
          metadata: true,
          createdAt: true
        }
      }),
      app.prisma.migrationMapping.findMany({
        where: {
          tenantId: student.tenantId,
          entityType: "student_avatar",
          newId: student.id
        },
        select: {
          legacyScope: true,
          legacyKey: true,
          metadata: true,
          createdAt: true
        }
      })
    ]);
    const studentMapping = pickPreferredMapping(classRecord, studentMappings);
    const avatarMapping = pickPreferredMapping(classRecord, avatarMappings);

    const currentProfile = {
      titleLeft: student.profile?.titleLeft ?? null,
      titleRight: student.profile?.titleRight ?? null,
      notes: student.profile?.notes ?? null
    };
    const currentAvatar = mergeAvatarMappings(classRecord, avatarMappings);
    const nextProfile = {
      titleLeft: body.titleLeft === undefined ? currentProfile.titleLeft : body.titleLeft,
      titleRight: body.titleRight === undefined ? currentProfile.titleRight : body.titleRight,
      notes: body.notes === undefined ? currentProfile.notes : body.notes
    };
    const nextAvatar = {
      avatarHappyData: body.avatarHappyData === undefined ? currentAvatar.avatarHappyData : body.avatarHappyData,
      avatarNormalData: body.avatarNormalData === undefined ? currentAvatar.avatarNormalData : body.avatarNormalData,
      avatarSadData: body.avatarSadData === undefined ? currentAvatar.avatarSadData : body.avatarSadData
    };
    const shouldPersistAvatarMapping =
      avatarMappings.length > 0 ||
      body.avatarHappyData !== undefined ||
      body.avatarNormalData !== undefined ||
      body.avatarSadData !== undefined;

    if (
      nextProfile.titleLeft === currentProfile.titleLeft &&
      nextProfile.titleRight === currentProfile.titleRight &&
      nextProfile.notes === currentProfile.notes &&
      nextAvatar.avatarHappyData === currentAvatar.avatarHappyData &&
      nextAvatar.avatarNormalData === currentAvatar.avatarNormalData &&
      nextAvatar.avatarSadData === currentAvatar.avatarSadData
    ) {
      throw reply.badRequest("Student profile unchanged");
    }

    const profile = await app.prisma.$transaction(async (tx: any) => {
      const updated = await tx.studentProfile.upsert({
        where: {
          studentId: student.id
        },
        update: nextProfile,
        create: {
          studentId: student.id,
          ...nextProfile
        },
        select: {
          studentId: true,
          titleLeft: true,
          titleRight: true,
          notes: true
        }
      });

      if (shouldPersistAvatarMapping) {
        const avatarLegacyScope =
          avatarMapping?.legacyScope || studentMapping?.legacyScope || classRecord.tenant?.slug || "manual-avatar";
        const avatarLegacyKey = avatarMapping?.legacyKey || studentMapping?.legacyKey || `student:${student.id}`;
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: student.tenantId,
              entityType: "student_avatar",
              legacyScope: avatarLegacyScope,
              legacyKey: avatarLegacyKey
            }
          },
          update: {
            newId: student.id,
            metadata: {
              source: "student.profile.update",
              avatarData: {
                happy: nextAvatar.avatarHappyData,
                normal: nextAvatar.avatarNormalData,
                sad: nextAvatar.avatarSadData
              }
            }
          },
          create: {
            tenantId: student.tenantId,
            entityType: "student_avatar",
            legacyScope: avatarLegacyScope,
            legacyKey: avatarLegacyKey,
            newId: student.id,
            metadata: {
              source: "student.profile.update",
              avatarData: {
                happy: nextAvatar.avatarHappyData,
                normal: nextAvatar.avatarNormalData,
                sad: nextAvatar.avatarSadData
              }
            }
          }
        });
        await tx.migrationMapping.deleteMany({
          where: {
            tenantId: student.tenantId,
            entityType: "student_avatar",
            newId: student.id,
            NOT: {
              legacyScope: avatarLegacyScope,
              legacyKey: avatarLegacyKey
            }
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "student.profile.update",
          targetType: "student_profile",
          targetId: student.id,
          beforeData: {
            ...currentProfile,
            ...summarizeAvatarState(currentAvatar)
          },
          afterData: {
            ...nextProfile,
            ...summarizeAvatarState(nextAvatar)
          }
        }
      });

      return {
        ...updated,
        ...nextAvatar,
        legacyAvatarPending: false
      };
    });

    return {
      profile
    };
  });

  app.put("/students/:studentId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = studentParamsSchema.parse(request.params);
    const body = studentUpdateBodySchema.parse(request.body);

    const student = await app.prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        classId: true,
        name: true,
        studentNo: true,
        gender: true,
        status: true,
        sortOrder: true
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    const { classRecord, membership } = await requireClassMembership(app, auth.sub, student.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student update permission denied");
    }

    const nextData = {
      studentNo: body.studentNo === undefined ? student.studentNo : body.studentNo,
      name: body.name === undefined ? student.name : body.name,
      gender: body.gender === undefined ? student.gender : body.gender,
      status: body.status === undefined ? student.status : body.status,
      sortOrder: body.sortOrder === undefined ? student.sortOrder : body.sortOrder
    };

    if (
      nextData.studentNo === student.studentNo &&
      nextData.name === student.name &&
      nextData.gender === student.gender &&
      nextData.status === student.status &&
      nextData.sortOrder === student.sortOrder
    ) {
      throw reply.badRequest("Student unchanged");
    }

    if (nextData.studentNo) {
      const duplicate = await app.prisma.student.findFirst({
        where: {
          classId: student.classId,
          studentNo: nextData.studentNo,
          NOT: {
            id: student.id
          }
        },
        select: { id: true }
      });

      if (duplicate) {
        throw reply.conflict("Student number already exists");
      }
    }

    const updatedStudent = await app.prisma.$transaction(async (tx: any) => {
      const updated = await tx.student.update({
        where: {
          id: student.id
        },
        data: nextData,
        select: {
          id: true,
          classId: true,
          studentNo: true,
          name: true,
          gender: true,
          status: true,
          sortOrder: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "student.update",
          targetType: "student",
          targetId: student.id,
          beforeData: {
            studentNo: student.studentNo,
            name: student.name,
            gender: student.gender,
            status: student.status,
            sortOrder: student.sortOrder
          },
          afterData: {
            studentNo: updated.studentNo,
            name: updated.name,
            gender: updated.gender,
            status: updated.status,
            sortOrder: updated.sortOrder
          }
        }
      });

      return updated;
    });

    return {
      student: updatedStudent
    };
  });

  app.delete("/students/:studentId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = studentParamsSchema.parse(request.params);
    const student = await app.prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        tenantId: true,
        classId: true,
        studentNo: true,
        name: true,
        gender: true,
        status: true,
        sortOrder: true,
        account: {
          select: {
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true
          }
        }
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    const { classRecord, membership } = await requireClassMembership(app, auth.sub, student.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student delete permission denied");
    }

    const [pointTransactionCount, attendanceRecordCount, classConfig] = await Promise.all([
      app.prisma.pointTransaction.count({
        where: {
          studentId: student.id
        }
      }),
      app.prisma.attendanceRecord.count({
        where: {
          studentId: student.id
        }
      }),
      app.prisma.classConfig.findUnique({
        where: {
          classId: student.classId
        },
        select: {
          extra: true
        }
      })
    ]);

    const classConfigCleanup = cleanupStudentReferencesInClassConfigExtra(classConfig?.extra, student.id);
    const deleteGuard = buildStudentDeleteGuard({
      pointTransactionCount,
      attendanceRecordCount,
      account: student.account,
      remainingReferenceCount: countExactStringReferences(classConfigCleanup.nextExtra, student.id),
      cleanupMessages: classConfigCleanup.cleanupMessages
    });

    if (!deleteGuard.canDelete) {
      return reply.code(400).send({
        message: "Student delete blocked",
        deleteGuard
      });
    }

    await app.prisma.$transaction(async (tx: any) => {
      if (classConfig && classConfigCleanup.changed) {
        await tx.classConfig.update({
          where: {
            classId: student.classId
          },
          data: {
            extra: classConfigCleanup.nextExtra
          }
        });
      }

      await tx.migrationMapping.deleteMany({
        where: {
          tenantId: student.tenantId,
          newId: student.id,
          entityType: {
            in: ["student", "student_avatar"]
          }
        }
      });

      await tx.student.delete({
        where: {
          id: student.id
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "student.delete",
          targetType: "student",
          targetId: student.id,
          beforeData: {
            studentNo: student.studentNo,
            name: student.name,
            gender: student.gender,
            status: student.status,
            sortOrder: student.sortOrder
          },
          metadata: {
            cleanupMessages: deleteGuard.cleanupMessages
          }
        }
      });
    });

    return {
      deleted: true,
      studentId: student.id,
      studentName: student.name
    };
  });

  app.put("/students/:studentId/organization", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = studentParamsSchema.parse(request.params);
    const body = studentOrganizationUpdateBodySchema.parse(request.body);
    const student = await app.prisma.student.findUnique({
      where: { id: params.studentId },
      select: {
        id: true,
        classId: true,
        tenantId: true,
        groups: {
          where: {
            endDate: null
          },
          select: {
            id: true,
            groupId: true,
            isPrimary: true,
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        dorms: {
          where: {
            endDate: null
          },
          select: {
            id: true,
            dormitoryId: true,
            isPrimary: true,
            dormitory: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        positions: {
          where: {
            endDate: null
          },
          select: {
            id: true,
            positionId: true,
            position: {
              select: {
                id: true,
                code: true,
                name: true,
                category: true
              }
            }
          }
        }
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    const { classRecord, membership } = await requireClassMembership(app, auth.sub, student.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student organization update permission denied");
    }

    const currentPrimaryGroup = student.groups.find((item) => item.isPrimary) ?? student.groups[0] ?? null;
    const currentPrimaryDorm = student.dorms.find((item) => item.isPrimary) ?? student.dorms[0] ?? null;
    const currentPositionIds = student.positions.map((item) => item.positionId);
    const nextGroupId = body.groupId === undefined ? currentPrimaryGroup?.groupId ?? null : body.groupId;
    const nextDormitoryId =
      body.dormitoryId === undefined ? currentPrimaryDorm?.dormitoryId ?? null : body.dormitoryId;
    const nextPositionIds =
      body.positionIds === undefined ? currentPositionIds : Array.from(new Set(body.positionIds));

    const positionsUnchanged =
      body.positionIds === undefined ||
      (nextPositionIds.length === currentPositionIds.length &&
        nextPositionIds.every((id) => currentPositionIds.includes(id)));

    if (
      nextGroupId === (currentPrimaryGroup?.groupId ?? null) &&
      nextDormitoryId === (currentPrimaryDorm?.dormitoryId ?? null) &&
      positionsUnchanged
    ) {
      throw reply.badRequest("Student organization unchanged");
    }

    let groupRecord: { id: string; name: string } | null = null;
    let dormitoryRecord: { id: string; name: string } | null = null;

    if (nextGroupId) {
      groupRecord = await app.prisma.group.findFirst({
        where: {
          id: nextGroupId,
          classId: classRecord.id,
          isActive: true
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!groupRecord) {
        throw reply.notFound("Group not found");
      }
    }

    if (nextDormitoryId) {
      dormitoryRecord = await app.prisma.dormitory.findFirst({
        where: {
          id: nextDormitoryId,
          classId: classRecord.id,
          isActive: true
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!dormitoryRecord) {
        throw reply.notFound("Dormitory not found");
      }
    }

    let positionRecords: Array<{ id: string; code: string; name: string; category: string }> = [];
    if (body.positionIds !== undefined) {
      if (nextPositionIds.length) {
        const positions = await app.prisma.position.findMany({
          where: {
            id: {
              in: nextPositionIds
            },
            classId: classRecord.id,
            isActive: true
          },
          select: {
            id: true,
            code: true,
            name: true,
            category: true
          }
        });

        if (positions.length !== nextPositionIds.length) {
          throw reply.notFound("Position not found");
        }

        positionRecords = positions;
      }
    }

    const today = new Date();

    await app.prisma.$transaction(async (tx: any) => {
      if (body.groupId !== undefined) {
        await tx.studentGroupAssignment.updateMany({
          where: {
            studentId: student.id,
            endDate: null
          },
          data: {
            isPrimary: false,
            endDate: today
          }
        });

        if (groupRecord) {
          await tx.studentGroupAssignment.create({
            data: {
              tenantId: classRecord.tenantId,
              studentId: student.id,
              groupId: groupRecord.id,
              isPrimary: true,
              startDate: today
            }
          });
        }
      }

      if (body.dormitoryId !== undefined) {
        await tx.studentDormAssignment.updateMany({
          where: {
            studentId: student.id,
            endDate: null
          },
          data: {
            isPrimary: false,
            endDate: today
          }
        });

        if (dormitoryRecord) {
          await tx.studentDormAssignment.create({
            data: {
              tenantId: classRecord.tenantId,
              studentId: student.id,
              dormitoryId: dormitoryRecord.id,
              isPrimary: true,
              startDate: today
            }
          });
        }
      }

      if (body.positionIds !== undefined) {
        const nextPositionSet = new Set(nextPositionIds);
        const currentPositionSet = new Set(currentPositionIds);
        const positionIdsToRemove = currentPositionIds.filter((id) => !nextPositionSet.has(id));
        const positionIdsToAdd = nextPositionIds.filter((id) => !currentPositionSet.has(id));

        if (positionIdsToRemove.length) {
          await tx.studentPositionAssignment.updateMany({
            where: {
              studentId: student.id,
              positionId: {
                in: positionIdsToRemove
              },
              endDate: null
            },
            data: {
              endDate: today
            }
          });
        }

        if (positionIdsToAdd.length) {
          await tx.studentPositionAssignment.createMany({
            data: positionIdsToAdd.map((positionId) => ({
              tenantId: classRecord.tenantId,
              studentId: student.id,
              positionId,
              startDate: today
            }))
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "student.organization.update",
          targetType: "student",
          targetId: student.id,
          beforeData: {
            groupId: currentPrimaryGroup?.group.id ?? null,
            groupName: currentPrimaryGroup?.group.name ?? null,
            dormitoryId: currentPrimaryDorm?.dormitory.id ?? null,
            dormitoryName: currentPrimaryDorm?.dormitory.name ?? null,
            positionIds: currentPositionIds,
            positionNames: student.positions.map((item) => item.position.name)
          },
          afterData: {
            groupId: groupRecord?.id ?? null,
            groupName: groupRecord?.name ?? null,
            dormitoryId: dormitoryRecord?.id ?? null,
            dormitoryName: dormitoryRecord?.name ?? null,
            positionIds: body.positionIds === undefined ? currentPositionIds : nextPositionIds,
            positionNames:
              body.positionIds === undefined
                ? student.positions.map((item) => item.position.name)
                : positionRecords.map((item) => item.name)
          }
        }
      });
    });

    return {
      organization: {
        studentId: student.id,
        primaryGroup: groupRecord,
        primaryDormitory: dormitoryRecord,
        positions:
          body.positionIds === undefined
            ? student.positions.map((item) => item.position)
            : positionRecords
      }
    };
  });

  app.put("/classes/:classId/students/organization/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = studentOrganizationBatchUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassMembership(app, auth.sub, params.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student organization update permission denied");
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));
    const students = await app.prisma.student.findMany({
      where: {
        id: {
          in: uniqueStudentIds
        },
        classId: params.classId
      },
      select: {
        id: true,
        name: true,
        groups: {
          where: {
            endDate: null
          },
          select: {
            groupId: true,
            isPrimary: true,
            group: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        dorms: {
          where: {
            endDate: null
          },
          select: {
            dormitoryId: true,
            isPrimary: true,
            dormitory: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (students.length !== uniqueStudentIds.length) {
      throw reply.notFound("Student batch contains invalid items");
    }

    let groupRecord: { id: string; name: string } | null = null;
    let dormitoryRecord: { id: string; name: string } | null = null;

    if (body.groupId !== undefined && body.groupId !== null) {
      groupRecord = await app.prisma.group.findFirst({
        where: {
          id: body.groupId,
          classId: classRecord.id,
          isActive: true
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!groupRecord) {
        throw reply.notFound("Group not found");
      }
    }

    if (body.dormitoryId !== undefined && body.dormitoryId !== null) {
      dormitoryRecord = await app.prisma.dormitory.findFirst({
        where: {
          id: body.dormitoryId,
          classId: classRecord.id,
          isActive: true
        },
        select: {
          id: true,
          name: true
        }
      });

      if (!dormitoryRecord) {
        throw reply.notFound("Dormitory not found");
      }
    }

    const today = new Date();

    const result = await app.prisma.$transaction(async (tx: any) => {
      const updatedStudents = [];
      let updatedCount = 0;

      for (const student of students) {
        const currentPrimaryGroup = student.groups.find((item) => item.isPrimary) ?? student.groups[0] ?? null;
        const currentPrimaryDorm = student.dorms.find((item) => item.isPrimary) ?? student.dorms[0] ?? null;

        const nextGroupId = body.groupId !== undefined ? body.groupId : currentPrimaryGroup?.groupId ?? null;
        const nextDormitoryId =
          body.dormitoryId !== undefined ? body.dormitoryId : currentPrimaryDorm?.dormitoryId ?? null;

        const shouldUpdateGroup =
          body.groupId !== undefined && nextGroupId !== (currentPrimaryGroup?.groupId ?? null);
        const shouldUpdateDorm =
          body.dormitoryId !== undefined && nextDormitoryId !== (currentPrimaryDorm?.dormitoryId ?? null);

        if (shouldUpdateGroup) {
          await tx.studentGroupAssignment.updateMany({
            where: {
              studentId: student.id,
              endDate: null
            },
            data: {
              isPrimary: false,
              endDate: today
            }
          });

          if (nextGroupId) {
            await tx.studentGroupAssignment.create({
              data: {
                tenantId: classRecord.tenantId,
                studentId: student.id,
                groupId: nextGroupId,
                isPrimary: true,
                startDate: today
              }
            });
          }
        }

        if (shouldUpdateDorm) {
          await tx.studentDormAssignment.updateMany({
            where: {
              studentId: student.id,
              endDate: null
            },
            data: {
              isPrimary: false,
              endDate: today
            }
          });

          if (nextDormitoryId) {
            await tx.studentDormAssignment.create({
              data: {
                tenantId: classRecord.tenantId,
                studentId: student.id,
                dormitoryId: nextDormitoryId,
                isPrimary: true,
                startDate: today
              }
            });
          }
        }

        if (shouldUpdateGroup || shouldUpdateDorm) {
          updatedCount += 1;
        }

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: classRecord.id,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "student.organization.batch_update",
            targetType: "student",
            targetId: student.id,
            beforeData: {
              groupId: currentPrimaryGroup?.group.id ?? null,
              groupName: currentPrimaryGroup?.group.name ?? null,
              dormitoryId: currentPrimaryDorm?.dormitory.id ?? null,
              dormitoryName: currentPrimaryDorm?.dormitory.name ?? null
            },
            afterData: {
              groupId: nextGroupId,
              groupName: nextGroupId ? groupRecord?.name ?? currentPrimaryGroup?.group.name ?? null : null,
              dormitoryId: nextDormitoryId,
              dormitoryName: nextDormitoryId
                ? dormitoryRecord?.name ?? currentPrimaryDorm?.dormitory.name ?? null
                : null
            },
            metadata: {
              batchSize: uniqueStudentIds.length
            }
          }
        });

        updatedStudents.push({
          id: student.id,
          name: student.name
        });
      }

      return {
        updatedStudents,
        updatedCount
      };
    });

    return {
      requestedCount: uniqueStudentIds.length,
      updatedCount: result.updatedCount,
      group: body.groupId === undefined ? null : groupRecord,
      dormitory: body.dormitoryId === undefined ? null : dormitoryRecord,
      students: result.updatedStudents
    };
  });

  app.put("/classes/:classId/students/status/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = studentStatusBatchUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassMembership(app, auth.sub, params.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student update permission denied");
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));
    const students = await app.prisma.student.findMany({
      where: {
        id: {
          in: uniqueStudentIds
        },
        classId: params.classId
      },
      select: {
        id: true,
        name: true,
        status: true
      }
    });

    if (students.length !== uniqueStudentIds.length) {
      throw reply.notFound("Student batch contains invalid items");
    }

    const studentsToUpdate = students.filter((student) => student.status !== body.status);
    const skippedCount = students.length - studentsToUpdate.length;

    if (!studentsToUpdate.length) {
      throw reply.badRequest("Student status unchanged");
    }

    const result = await app.prisma.$transaction(async (tx: any) => {
      const updatedStudents = [];

      for (const student of studentsToUpdate) {
        await tx.student.update({
          where: {
            id: student.id
          },
          data: {
            status: body.status
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: classRecord.id,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "student.status.batch_update",
            targetType: "student",
            targetId: student.id,
            beforeData: {
              status: student.status
            },
            afterData: {
              status: body.status
            },
            metadata: {
              batchSize: uniqueStudentIds.length
            }
          }
        });

        updatedStudents.push({
          id: student.id,
          name: student.name
        });
      }

      return updatedStudents;
    });

    return {
      requestedCount: uniqueStudentIds.length,
      updatedCount: result.length,
      skippedCount,
      status: body.status,
      students: result
    };
  });

  app.put("/classes/:classId/students/positions/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = studentPositionBatchUpdateBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassMembership(app, auth.sub, params.classId, reply);
    await requireClassNotFrozen(app, classRecord.id, reply);
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Student organization update permission denied");
    }

    const uniqueStudentIds = Array.from(new Set(body.studentIds));
    const students = await app.prisma.student.findMany({
      where: {
        id: {
          in: uniqueStudentIds
        },
        classId: params.classId
      },
      select: {
        id: true,
        name: true
      }
    });

    if (students.length !== uniqueStudentIds.length) {
      throw reply.notFound("Student batch contains invalid items");
    }

    const uniquePositionIds = Array.from(new Set(body.positionIds));
    const positions = uniquePositionIds.length
      ? await app.prisma.position.findMany({
          where: {
            id: {
              in: uniquePositionIds
            },
            classId: params.classId,
            isActive: true
          },
          select: {
            id: true,
            code: true,
            name: true,
            category: true
          }
        })
      : [];

    if (positions.length !== uniquePositionIds.length) {
      throw reply.notFound("Position not found");
    }

    const assignments = await app.prisma.studentPositionAssignment.findMany({
      where: {
        studentId: {
          in: uniqueStudentIds
        },
        endDate: null
      },
      select: {
        id: true,
        studentId: true,
        positionId: true
      }
    });

    const assignmentMap = new Map<string, string[]>();
    for (const item of assignments) {
      const current = assignmentMap.get(item.studentId) || [];
      current.push(item.positionId);
      assignmentMap.set(item.studentId, current);
    }

    const nextPositionSet = new Set(uniquePositionIds);
    const today = new Date();

    const result = await app.prisma.$transaction(async (tx: any) => {
      const updatedStudents = [];

      for (const student of students) {
        const currentPositionIds = assignmentMap.get(student.id) || [];
        const currentSet = new Set(currentPositionIds);
        const positionIdsToRemove = currentPositionIds.filter((id) => !nextPositionSet.has(id));
        const positionIdsToAdd = uniquePositionIds.filter((id) => !currentSet.has(id));

        if (positionIdsToRemove.length) {
          await tx.studentPositionAssignment.updateMany({
            where: {
              studentId: student.id,
              positionId: {
                in: positionIdsToRemove
              },
              endDate: null
            },
            data: {
              endDate: today
            }
          });
        }

        if (positionIdsToAdd.length) {
          await tx.studentPositionAssignment.createMany({
            data: positionIdsToAdd.map((positionId) => ({
              tenantId: classRecord.tenantId,
              studentId: student.id,
              positionId,
              startDate: today
            }))
          });
        }

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: classRecord.id,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "student.position.batch_update",
            targetType: "student",
            targetId: student.id,
            beforeData: {
              positionIds: currentPositionIds
            },
            afterData: {
              positionIds: uniquePositionIds
            },
            metadata: {
              batchSize: uniqueStudentIds.length
            }
          }
        });

        updatedStudents.push({
          id: student.id,
          name: student.name
        });
      }

      return updatedStudents;
    });

    return {
      requestedCount: uniqueStudentIds.length,
      updatedCount: result.length,
      positionIds: uniquePositionIds,
      positions,
      students: result
    };
  });
};
