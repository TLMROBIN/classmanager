import type { FastifyPluginAsync } from "fastify";
import type { Prisma } from "@prisma/client";
import crypto from "node:crypto";
import { z } from "zod";

import { canManagePoints } from "../../lib/permissions.js";

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const studentParamsSchema = z.object({
  studentId: z.string().uuid()
});

const transactionParamsSchema = z.object({
  classId: z.string().uuid(),
  transactionId: z.string().uuid()
});

const pointAuditParamsSchema = z.object({
  classId: z.string().uuid(),
  auditId: z.string().uuid()
});

const pointBatchRevertBodySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(60)
});

const pointAdjustmentBodySchema = z.object({
  studentId: z.string().uuid(),
  transactionType: z.enum(["bonus", "penalty", "adjustment", "reward", "refund"]),
  value: z.coerce.number().finite().positive().max(1000),
  reason: z.string().trim().min(1).max(200),
  scene: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50),
  occurredAt: z.string().datetime().optional()
});

const pointBatchAdjustmentBodySchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1).max(60),
  transactionType: z.enum(["bonus", "penalty"]),
  value: z.coerce.number().finite().positive().max(1000),
  reason: z.string().trim().min(1).max(200),
  scene: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50),
  occurredAt: z.string().datetime().optional()
});

const wageIssueBodySchema = z.object({
  occurredAt: z.string().datetime().optional()
});

const pointAccountMaintenanceImportBodySchema = z.object({
  items: z
    .array(
      z.object({
        studentId: z.string().uuid(),
        totalPoints: z.coerce.number().finite().min(-99999999.99).max(99999999.99),
        balancePoints: z.coerce.number().finite().min(-99999999.99).max(99999999.99),
        penaltyPoints: z.coerce.number().finite().min(0).max(99999999.99)
      })
    )
    .min(1)
    .max(500)
});

const pointBatchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

const pointAuditListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const pointBatchIdParamsSchema = z.object({
  classId: z.string().uuid(),
  batchId: z.string().uuid()
});

const leaderboardQuerySchema = z.object({
  search: z.string().trim().optional().default(""),
  groupId: z.string().uuid().optional(),
  dormitoryId: z.string().uuid().optional(),
  sortBy: z.enum(["balancePoints", "totalPoints", "penaltyPoints", "sortOrder"]).default("balancePoints"),
  direction: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

const LEGACY_DEFAULT_DAILY_WAGE_GROUP_KEYS = new Set(["discipline", "hygiene"]);

async function requireClassAccess(app: any, userId: string, classId: string, reply: any) {
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
        include: {
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

function requirePointsWritePermission(membership: Awaited<ReturnType<typeof requireClassAccess>>["membership"], reply: any) {
  if (!canManagePoints(membership)) {
    throw reply.forbidden("Point adjustment permission denied");
  }
}

async function requireClassNotFrozen(app: any, classId: string, reply: any) {
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
}

function getPointTransactionIdFromAuditData(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const transactionId = (value as Record<string, unknown>).transactionId;
  return typeof transactionId === "string" ? transactionId : null;
}

function getPointBatchIdFromMetadata(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const batchId = (value as Record<string, unknown>).batchId;
  return typeof batchId === "string" ? batchId : null;
}

function normalizeIsoDateString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function getZonedDateKey(date: Date, timeZone: string | null | undefined) {
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

function normalizeDailyWageGroupIds(
  raw: Record<string, unknown>,
  fallbackGroups?: Array<{ id: string; legacyKey: string | null; isActive?: boolean }>
) {
  if (Array.isArray(raw.dailyWageGroupIds)) {
    return Array.from(new Set(raw.dailyWageGroupIds.filter((item): item is string => typeof item === "string")));
  }

  if (!fallbackGroups?.length) {
    return [];
  }

  return fallbackGroups
    .filter((item) => item.isActive !== false && item.legacyKey && LEGACY_DEFAULT_DAILY_WAGE_GROUP_KEYS.has(item.legacyKey))
    .map((item) => item.id);
}

function normalizeClassConfigExtra(
  value: unknown,
  fallbackGroups?: Array<{ id: string; legacyKey: string | null; isActive?: boolean }>
) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const dailyWageAmount = Number(raw.dailyWageAmount);
  const lastWageDate = normalizeIsoDateString(raw.lastWageDate);
  return {
    dailyWageAmount: Number.isFinite(dailyWageAmount) ? dailyWageAmount : 5,
    dailyWageGroupIds: normalizeDailyWageGroupIds(raw, fallbackGroups),
    psychologyCommitteeStudentIds: Array.isArray(raw.psychologyCommitteeStudentIds)
      ? Array.from(new Set(raw.psychologyCommitteeStudentIds.filter((item): item is string => typeof item === "string")))
      : [],
    studentCouncilRoles: Array.isArray(raw.studentCouncilRoles)
      ? raw.studentCouncilRoles
          .map((item) => {
            const role = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            const id = typeof role.id === "string" ? role.id : "";
            const name = typeof role.name === "string" ? role.name : "";
            if (!id || !name) return null;
            return {
              id,
              name,
              studentId: typeof role.studentId === "string" ? role.studentId : null
            };
          })
          .filter(Boolean)
      : [],
    ...(lastWageDate ? { lastWageDate } : {})
  };
}

function toPointCents(value: unknown) {
  return Math.round(Number(value || 0) * 100);
}

function fromPointCents(value: number) {
  return Number((value / 100).toFixed(2));
}

function getPointBatchSignedValue(transactionType: "bonus" | "penalty", value: number) {
  return transactionType === "penalty" ? -Math.abs(value) : Math.abs(value);
}

async function resolvePointBatchAdjustmentPlan(
  app: any,
  classId: string,
  body: z.infer<typeof pointBatchAdjustmentBodySchema>,
  reply: any
) {
  const uniqueStudentIds = [...new Set(body.studentIds)];
  const students = await app.prisma.student.findMany({
    where: {
      id: {
        in: uniqueStudentIds
      },
      classId
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
  });

  if (students.length !== uniqueStudentIds.length || students.some((student) => !student.account)) {
    throw reply.notFound("Student account batch contains invalid items");
  }

  return {
    uniqueStudentIds,
    students
  };
}

async function createPointBatchAdjustmentItems(args: {
  tx: any;
  classRecord: {
    tenantId: string;
  };
  membership: {
    id: string;
  };
  authSub: string;
  classId: string;
  body: z.infer<typeof pointBatchAdjustmentBodySchema>;
  batchId: string;
  plan: Awaited<ReturnType<typeof resolvePointBatchAdjustmentPlan>>;
  correctionSourceBatchId?: string;
  accountSnapshots?: Map<
    string,
    {
      id: string;
      totalPoints: number;
      balancePoints: number;
      penaltyPoints: number;
    }
  >;
}) {
  const { tx, classRecord, membership, authSub, classId, body, batchId, plan, correctionSourceBatchId, accountSnapshots } =
    args;
  const signedValue = getPointBatchSignedValue(body.transactionType, body.value);
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const items = [];

  for (const student of plan.students) {
    const currentAccount =
      accountSnapshots?.get(student.id) || {
        id: student.account!.id,
        totalPoints: Number(student.account!.totalPoints),
        balancePoints: Number(student.account!.balancePoints),
        penaltyPoints: Number(student.account!.penaltyPoints)
      };
    const nextTotal = currentAccount.totalPoints + signedValue;
    const nextBalance = currentAccount.balancePoints + signedValue;
    const nextPenalty =
      body.transactionType === "penalty"
        ? currentAccount.penaltyPoints + Math.abs(body.value)
        : currentAccount.penaltyPoints;

    const pointTransaction = await tx.pointTransaction.create({
      data: {
        tenantId: classRecord.tenantId,
        classId,
        studentId: student.id,
        pointAccountId: currentAccount.id,
        transactionType: body.transactionType,
        value: signedValue,
        reason: body.reason,
        scene: body.scene,
        category: body.category,
        batchId,
        sourceModule: "manual_batch_adjustment",
        sourceType: "point_adjustment_batch",
        actorUserId: authSub,
        actorMembershipId: membership.id,
        occurredAt,
        metadata: {
          inputValue: body.value,
          batchSize: plan.uniqueStudentIds.length,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
        }
      }
    });

    const updatedAccount = await tx.pointAccount.update({
      where: {
        id: currentAccount.id
      },
      data: {
        totalPoints: nextTotal,
        balancePoints: nextBalance,
        penaltyPoints: nextPenalty,
        version: {
          increment: 1
        }
      },
      select: {
        id: true,
        totalPoints: true,
        balancePoints: true,
        penaltyPoints: true,
        version: true
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: classRecord.tenantId,
        classId,
        actorUserId: authSub,
        actorMembershipId: membership.id,
        action: "point.adjust.batch",
        targetType: "student",
        targetId: student.id,
        afterData: {
          transactionId: pointTransaction.id,
          transactionType: body.transactionType,
          value: signedValue,
          reason: body.reason,
          scene: body.scene,
          category: body.category,
          studentName: student.name,
          balancePoints: updatedAccount.balancePoints,
          totalPoints: updatedAccount.totalPoints,
          penaltyPoints: updatedAccount.penaltyPoints
        },
        metadata: {
          sourceModule: "manual_batch_adjustment",
          batchSize: plan.uniqueStudentIds.length,
          batchId,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
        }
      }
    });

    accountSnapshots?.set(student.id, {
      id: updatedAccount.id,
      totalPoints: Number(updatedAccount.totalPoints),
      balancePoints: Number(updatedAccount.balancePoints),
      penaltyPoints: Number(updatedAccount.penaltyPoints)
    });

    items.push({
      student: {
        id: student.id,
        name: student.name
      },
      transaction: pointTransaction,
      account: updatedAccount
    });
  }

  return {
    signedValue,
    items
  };
}

function serializePointAudit(item: any) {
  const metaByAction: Record<string, { label: string; canRevert: boolean }> = {
    "point.adjust": {
      label: "单条手工积分",
      canRevert: true
    },
    "point.adjust.batch": {
      label: "批量手工积分",
      canRevert: true
    },
    "point.revert": {
      label: "撤销手工积分",
      canRevert: false
    },
    "point.revert.batch": {
      label: "撤销批量积分",
      canRevert: false
    }
  };
  const meta = metaByAction[item.action] || {
    label: item.action,
    canRevert: false
  };
  return {
    id: item.id,
    action: item.action,
    label: meta.label,
    canRevert: meta.canRevert && Boolean(getPointTransactionIdFromAuditData(item.afterData)),
    transactionId: getPointTransactionIdFromAuditData(item.afterData),
    afterData: item.afterData,
    metadata: item.metadata,
    createdAt: item.createdAt.toISOString(),
    actorUser: item.actorUser
      ? {
          id: item.actorUser.id,
          username: item.actorUser.username,
          displayName: item.actorUser.displayName
        }
      : null
  };
}

export const pointRoutes: FastifyPluginAsync = async (app) => {
  async function revertSinglePointAdjustment(
    auth: { sub: string },
    classId: string,
    transactionId: string,
    reply: any,
    selectedAuditId?: string
  ) {
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, classId, reply);

    const original = await app.prisma.pointTransaction.findFirst({
      where: {
        id: transactionId,
        classId
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

    if (!original || !original.student.account) {
      throw reply.notFound("Transaction not found");
    }
    if (original.isReverted) {
      throw reply.badRequest("Transaction already reverted");
    }
    if (original.sourceModule !== "manual_adjustment" && original.sourceModule !== "manual_batch_adjustment") {
      throw reply.badRequest("Only manual adjustments can be reverted");
    }

    if (selectedAuditId) {
      const selectedAudit = await app.prisma.auditLog.findFirst({
        where: {
          id: selectedAuditId,
          classId
        },
        select: {
          id: true,
          action: true,
          afterData: true
        }
      });

      if (
        !selectedAudit ||
        (selectedAudit.action !== "point.adjust" && selectedAudit.action !== "point.adjust.batch") ||
        getPointTransactionIdFromAuditData(selectedAudit.afterData) !== transactionId
      ) {
        throw reply.badRequest("Point audit changed since selected operation");
      }
    }

    const originalValue = Number(original.value);
    const reversedValue = -originalValue;
    const account = original.student.account;
    const nextTotal = Number(account.totalPoints) + reversedValue;
    const nextBalance = Number(account.balancePoints) + reversedValue;
    const nextPenalty =
      original.transactionType === "penalty"
        ? Number(account.penaltyPoints) - Math.abs(originalValue)
        : Number(account.penaltyPoints);

    const result = await app.prisma.$transaction(async (tx) => {
      const revertTransaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId,
          studentId: original.studentId,
          pointAccountId: original.pointAccountId,
          transactionType: "adjustment",
          value: reversedValue,
          reason: `撤销积分: ${original.reason}`,
          scene: original.scene,
          category: original.category,
          sourceModule:
            original.sourceModule === "manual_batch_adjustment" ? "manual_batch_adjustment_revert" : "manual_adjustment_revert",
          sourceType:
            original.sourceModule === "manual_batch_adjustment" ? "point_adjustment_batch_revert" : "point_adjustment_revert",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt: new Date(),
          metadata: {
            revertedTransactionId: original.id
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

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: account.id
        },
        data: {
          totalPoints: nextTotal,
          balancePoints: nextBalance,
          penaltyPoints: nextPenalty,
          version: {
            increment: 1
          }
        },
        select: {
          id: true,
          totalPoints: true,
          balancePoints: true,
          penaltyPoints: true,
          version: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "point.revert",
          targetType: "point_transaction",
          targetId: original.id,
          afterData: {
            revertedTransactionId: revertTransaction.id,
            studentId: original.student.id,
            studentName: original.student.name,
            reason: original.reason
          },
          metadata: {
            sourceModule:
              original.sourceModule === "manual_batch_adjustment" ? "manual_batch_adjustment_revert" : "manual_adjustment_revert"
          }
        }
      });

      return {
        transaction: revertTransaction,
        account: updatedAccount
      };
    });

    return {
      student: {
        id: original.student.id,
        name: original.student.name
      },
      transaction: result.transaction,
      account: result.account
    };
  }

  async function revertPointAdjustmentBatchById(
    auth: { sub: string },
    classId: string,
    batchId: string,
    reply: any
  ) {
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, classId, reply);

    const originals = await app.prisma.pointTransaction.findMany({
      where: {
        classId,
        batchId,
        sourceModule: "manual_batch_adjustment"
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

    if (!originals.length || originals.some((item) => !item.student.account)) {
      throw reply.notFound("Batch adjustment not found");
    }
    if (originals.some((item) => item.isReverted)) {
      throw reply.badRequest("Batch adjustment already reverted");
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const items = [];

      for (const original of originals) {
        const account = original.student.account!;
        const originalValue = Number(original.value);
        const reversedValue = -originalValue;
        const nextTotal = Number(account.totalPoints) + reversedValue;
        const nextBalance = Number(account.balancePoints) + reversedValue;
        const nextPenalty =
          original.transactionType === "penalty"
            ? Number(account.penaltyPoints) - Math.abs(originalValue)
            : Number(account.penaltyPoints);

        const revertTransaction = await tx.pointTransaction.create({
          data: {
            tenantId: classRecord.tenantId,
            classId,
            studentId: original.studentId,
            pointAccountId: original.pointAccountId,
            transactionType: "adjustment",
            value: reversedValue,
            reason: `撤销批量积分: ${original.reason}`,
            scene: original.scene,
            category: original.category,
            sourceModule: "manual_batch_adjustment_revert",
            sourceType: "point_adjustment_batch_revert",
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            occurredAt: new Date(),
            metadata: {
              revertedTransactionId: original.id,
              revertedBatchId: batchId
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

        const updatedAccount = await tx.pointAccount.update({
          where: {
            id: account.id
          },
          data: {
            totalPoints: nextTotal,
            balancePoints: nextBalance,
            penaltyPoints: nextPenalty,
            version: {
              increment: 1
            }
          },
          select: {
            id: true,
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true,
            version: true
          }
        });

        items.push({
          student: {
            id: original.student.id,
            name: original.student.name
          },
          transaction: revertTransaction,
          account: updatedAccount
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "point.revert.batch",
          targetType: "point_transaction_batch",
          afterData: {
            revertedCount: items.length,
            batchId
          },
          metadata: {
            sourceModule: "manual_batch_adjustment_revert"
          }
        }
      });

      return items;
    });

    return {
      revertedCount: result.length,
      items: result
    };
  }

  app.get("/classes/:classId/points/summary", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const [accountStats, transactionCount, topStudents] = await Promise.all([
      app.prisma.pointAccount.aggregate({
        where: {
          student: {
            classId: params.classId
          }
        },
        _sum: {
          totalPoints: true,
          balancePoints: true,
          penaltyPoints: true
        },
        _count: {
          studentId: true
        }
      }),
      app.prisma.pointTransaction.count({
        where: {
          classId: params.classId
        }
      }),
      app.prisma.student.findMany({
        where: {
          classId: params.classId
        },
        orderBy: [
          { account: { balancePoints: "desc" } },
          { sortOrder: "asc" }
        ],
        take: 10,
        select: {
          id: true,
          name: true,
          sortOrder: true,
          account: {
            select: {
              totalPoints: true,
              balancePoints: true,
              penaltyPoints: true
            }
          }
        }
      })
    ]);

    return {
      studentCount: accountStats._count.studentId,
      transactionCount,
      totals: {
        totalPoints: accountStats._sum.totalPoints ?? 0,
        balancePoints: accountStats._sum.balancePoints ?? 0,
        penaltyPoints: accountStats._sum.penaltyPoints ?? 0
      },
      topStudents
    };
  });

  app.get("/students/:studentId/points/transactions", { preHandler: app.authenticate }, async (request, reply) => {
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
        name: true
      }
    });

    if (!student) {
      throw reply.notFound("Student not found");
    }

    await requireClassAccess(app, auth.sub, student.classId, reply);

    const transactions = await app.prisma.pointTransaction.findMany({
      where: {
        studentId: student.id
      },
      orderBy: [
        { occurredAt: "desc" },
        { createdAt: "desc" }
      ],
      take: 100,
      select: {
        id: true,
        transactionType: true,
        value: true,
        reason: true,
        scene: true,
        category: true,
        sourceModule: true,
        occurredAt: true,
        legacyNumericId: true
      }
    });

    return {
      student,
      items: transactions
    };
  });

  app.get("/classes/:classId/points/leaderboard", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = leaderboardQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const orderBy: Prisma.StudentOrderByWithRelationInput[] = (() => {
      if (query.sortBy === "sortOrder") {
        return [{ sortOrder: query.direction }, { name: "asc" }];
      }
      if (query.sortBy === "totalPoints") {
        return [{ account: { totalPoints: query.direction } }, { sortOrder: "asc" }];
      }
      if (query.sortBy === "penaltyPoints") {
        return [{ account: { penaltyPoints: query.direction } }, { sortOrder: "asc" }];
      }
      return [{ account: { balancePoints: query.direction } }, { sortOrder: "asc" }];
    })();

    const findArgs = {
      where: {
        classId: params.classId,
        name: query.search
          ? {
              contains: query.search,
              mode: "insensitive"
            }
          : undefined,
        groups: query.groupId
          ? {
              some: {
                endDate: null,
                groupId: query.groupId
              }
            }
          : undefined,
        dorms: query.dormitoryId
          ? {
              some: {
                endDate: null,
                dormitoryId: query.dormitoryId
              }
            }
          : undefined
      },
      orderBy,
      take: query.limit,
      select: {
        id: true,
        legacyId: true,
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
    } satisfies Prisma.StudentFindManyArgs;

    const students = await app.prisma.student.findMany(findArgs);

    return {
      filters: query,
      items: students.map((student, index) => ({
        rank: index + 1,
        id: student.id,
        legacyId: student.legacyId != null ? student.legacyId.toString() : null,
        name: student.name,
        gender: student.gender,
        status: student.status,
        sortOrder: student.sortOrder,
        account: student.account,
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

  app.post("/classes/:classId/points/adjustments", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointAdjustmentBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const student = await app.prisma.student.findFirst({
      where: {
        id: body.studentId,
        classId: params.classId
      },
      select: {
        id: true,
        tenantId: true,
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
    });

    if (!student || !student.account) {
      throw reply.notFound("Student account not found");
    }

    const account = student.account;

    const signedValue = body.transactionType === "penalty" ? -Math.abs(body.value) : Math.abs(body.value);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const nextTotal = Number(account.totalPoints) + signedValue;
    const nextBalance = Number(account.balancePoints) + signedValue;
    const nextPenalty =
      body.transactionType === "penalty"
        ? Number(account.penaltyPoints) + Math.abs(body.value)
        : Number(account.penaltyPoints);

    const result = await app.prisma.$transaction(async (tx) => {
      const pointTransaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: account.id,
          transactionType: body.transactionType,
          value: signedValue,
          reason: body.reason,
          scene: body.scene,
          category: body.category,
          sourceModule: "manual_adjustment",
          sourceType: "point_adjustment",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt,
          metadata: {
            inputValue: body.value
          }
        }
      });

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: account.id
        },
        data: {
          totalPoints: nextTotal,
          balancePoints: nextBalance,
          penaltyPoints: nextPenalty,
          version: {
            increment: 1
          }
        },
        select: {
          id: true,
          totalPoints: true,
          balancePoints: true,
          penaltyPoints: true,
          version: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "point.adjust",
          targetType: "student",
          targetId: student.id,
          afterData: {
            transactionId: pointTransaction.id,
            transactionType: body.transactionType,
            value: signedValue,
            reason: body.reason,
            scene: body.scene,
            category: body.category,
            studentName: student.name,
            balancePoints: updatedAccount.balancePoints,
            totalPoints: updatedAccount.totalPoints,
            penaltyPoints: updatedAccount.penaltyPoints
          },
          metadata: {
            sourceModule: "manual_adjustment"
          }
        }
      });

      return {
        transaction: pointTransaction,
        account: updatedAccount
      };
    });

    return {
      student: {
        id: student.id,
        name: student.name
      },
      transaction: result.transaction,
      account: result.account
    };
  });

  app.post("/classes/:classId/points/wages/issue", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = wageIssueBodySchema.parse(request.body ?? {});
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const classConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        timezone: true,
        extra: true
      }
    });

    if (!classConfig) {
      throw reply.notFound("Class config not found");
    }

    const classConfigExtra =
      classConfig.extra && typeof classConfig.extra === "object" && !Array.isArray(classConfig.extra)
        ? (classConfig.extra as Record<string, unknown>)
        : {};
    const fallbackGroups = Array.isArray(classConfigExtra.dailyWageGroupIds)
      ? []
      : await app.prisma.group.findMany({
          where: {
            classId: params.classId,
            legacyKey: {
              in: Array.from(LEGACY_DEFAULT_DAILY_WAGE_GROUP_KEYS)
            }
          },
          select: {
            id: true,
            legacyKey: true,
            isActive: true
          }
        });
    const extra = normalizeClassConfigExtra(classConfig.extra, fallbackGroups);
    const students = await app.prisma.student.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
        account: {
          select: {
            id: true,
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true,
            version: true
          }
        },
        groups: {
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          select: {
            groupId: true,
            roleCode: true,
            isPrimary: true
          }
        }
      }
    });

    const studentMap = new Map(students.map((item) => [item.id, item]));
    const updates: Array<{
      studentId: string;
      name: string;
      accountId: string;
      transactionType: "bonus";
      value: number;
      reason: string;
      scene: string;
      category: string;
      metadata: Record<string, unknown>;
    }> = [];

    for (const student of students) {
      const account = student.account;
      if (!account) continue;
      const primaryGroup = student.groups.find((item) => item.isPrimary) || student.groups[0];
      if (!primaryGroup || !extra.dailyWageGroupIds.includes(primaryGroup.groupId)) {
        continue;
      }

      updates.push({
        studentId: student.id,
        name: student.name,
        accountId: account.id,
        transactionType: "bonus",
        value: primaryGroup.roleCode === "leader" ? extra.dailyWageAmount + 1 : extra.dailyWageAmount,
        reason: "每日工资",
        scene: "班级",
        category: "班务",
        metadata: {
          sourceModule: "wage_issue",
          wageType: "daily_wage",
          roleCode: primaryGroup.roleCode || null
        }
      });
    }

    for (const studentId of extra.psychologyCommitteeStudentIds) {
      const student = studentMap.get(studentId);
      if (!student?.account) continue;
      updates.push({
        studentId: student.id,
        name: student.name,
        accountId: student.account.id,
        transactionType: "bonus",
        value: 1,
        reason: "心理委员津贴",
        scene: "班级",
        category: "班务",
        metadata: {
          sourceModule: "wage_issue",
          wageType: "psychology_committee"
        }
      });
    }

    for (const role of extra.studentCouncilRoles) {
      if (!role.studentId) continue;
      const student = studentMap.get(role.studentId);
      if (!student?.account) continue;
      updates.push({
        studentId: student.id,
        name: student.name,
        accountId: student.account.id,
        transactionType: "bonus",
        value: 2,
        reason: `学生会专员津贴: ${role.name}`,
        scene: "班级",
        category: "班务",
        metadata: {
          sourceModule: "wage_issue",
          wageType: "student_council",
          studentCouncilRoleId: role.id,
          studentCouncilRoleName: role.name
        }
      });
    }

    if (!updates.length) {
      throw reply.badRequest("No wage targets configured");
    }

    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const lastWageDate = getZonedDateKey(occurredAt, classConfig.timezone);
    const batchId = crypto.randomUUID();

    const result = await app.prisma.$transaction(async (tx) => {
      const accountSnapshots = new Map(
        students
          .filter((item) => item.account)
          .map((item) => [
            item.id,
            {
              id: item.account!.id,
              totalPoints: Number(item.account!.totalPoints),
              balancePoints: Number(item.account!.balancePoints),
              penaltyPoints: Number(item.account!.penaltyPoints)
            }
          ])
      );
      const items = [];

      for (const update of updates) {
        const snapshot = accountSnapshots.get(update.studentId);
        if (!snapshot) continue;

        const nextTotal = snapshot.totalPoints + update.value;
        const nextBalance = snapshot.balancePoints + update.value;

        const pointTransaction = await tx.pointTransaction.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            studentId: update.studentId,
            pointAccountId: update.accountId,
            transactionType: update.transactionType,
            value: update.value,
            reason: update.reason,
            scene: update.scene,
            category: update.category,
            batchId,
            sourceModule: "manual_batch_adjustment",
            sourceType: "point_adjustment_batch",
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            occurredAt,
            metadata: {
              ...update.metadata,
              batchSize: updates.length
            }
          }
        });

        const updatedAccount = await tx.pointAccount.update({
          where: {
            id: update.accountId
          },
          data: {
            totalPoints: nextTotal,
            balancePoints: nextBalance,
            version: {
              increment: 1
            }
          },
          select: {
            id: true,
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true,
            version: true
          }
        });

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "point.adjust.batch",
            targetType: "student",
            targetId: update.studentId,
            afterData: {
              transactionId: pointTransaction.id,
              transactionType: update.transactionType,
              value: update.value,
              reason: update.reason,
              scene: update.scene,
              category: update.category,
              studentName: update.name,
              balancePoints: updatedAccount.balancePoints,
              totalPoints: updatedAccount.totalPoints,
              penaltyPoints: updatedAccount.penaltyPoints
            },
            metadata: {
              sourceModule: "wage_issue",
              batchId,
              batchSize: updates.length,
              wageType: update.metadata.wageType || null
            }
          }
        });

        accountSnapshots.set(update.studentId, {
          id: update.accountId,
          totalPoints: Number(updatedAccount.totalPoints),
          balancePoints: Number(updatedAccount.balancePoints),
          penaltyPoints: Number(updatedAccount.penaltyPoints)
        });

        items.push({
          student: {
            id: update.studentId,
            name: update.name
          },
          transaction: pointTransaction,
          account: updatedAccount
        });
      }

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: {
            ...classConfigExtra,
            lastWageDate
          }
        }
      });

      return items;
    });

    return {
      batchId,
      issuedCount: result.length,
      summary: {
        dailyWageTargets: updates.filter((item) => item.metadata.wageType === "daily_wage").length,
        psychologyCommitteeTargets: updates.filter((item) => item.metadata.wageType === "psychology_committee").length,
        studentCouncilTargets: updates.filter((item) => item.metadata.wageType === "student_council").length
      },
      items: result
    };
  });

  app.post("/classes/:classId/points/batch-adjustments", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointBatchAdjustmentBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);
    const plan = await resolvePointBatchAdjustmentPlan(app, params.classId, body, reply);
    const batchId = crypto.randomUUID();

    const result = await app.prisma.$transaction(async (tx) => {
      return createPointBatchAdjustmentItems({
        tx,
        classRecord,
        membership,
        authSub: auth.sub,
        classId: params.classId,
        body,
        batchId,
        plan
      });
    });

    return {
      requestedCount: plan.uniqueStudentIds.length,
      adjustedCount: result.items.length,
      batchId,
      transactionType: body.transactionType,
      value: result.signedValue,
      reason: body.reason,
      items: result.items
    };
  });

  app.post("/classes/:classId/points/accounts/rebuild-from-history", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);

    const students = await app.prisma.student.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
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
    });

    const transactions = await app.prisma.pointTransaction.findMany({
      where: {
        classId: params.classId,
        isReverted: false
      },
      select: {
        studentId: true,
        transactionType: true,
        value: true
      }
    });

    const nextAccountByStudentId = new Map(
      students.map((student) => [
        student.id,
        {
          totalPointsCents: 0,
          balancePointsCents: 0,
          penaltyPointsCents: 0
        }
      ])
    );

    for (const item of transactions) {
      const current = nextAccountByStudentId.get(item.studentId);
      if (!current) continue;

      const valueCents = toPointCents(item.value);
      current.totalPointsCents += valueCents;
      current.balancePointsCents += valueCents;
      if (item.transactionType === "penalty") {
        current.penaltyPointsCents += Math.abs(valueCents);
      }
    }

    const result = await app.prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      let createdCount = 0;
      let unchangedCount = 0;

      for (const student of students) {
        const nextAccount = nextAccountByStudentId.get(student.id) || {
          totalPointsCents: 0,
          balancePointsCents: 0,
          penaltyPointsCents: 0
        };
        const nextTotalPoints = fromPointCents(nextAccount.totalPointsCents);
        const nextBalancePoints = fromPointCents(nextAccount.balancePointsCents);
        const nextPenaltyPoints = fromPointCents(nextAccount.penaltyPointsCents);

        if (!student.account) {
          await tx.pointAccount.create({
            data: {
              tenantId: classRecord.tenantId,
              studentId: student.id,
              totalPoints: nextTotalPoints,
              balancePoints: nextBalancePoints,
              penaltyPoints: nextPenaltyPoints
            }
          });
          createdCount += 1;
          continue;
        }

        const currentTotalPoints = toPointCents(student.account.totalPoints);
        const currentBalancePoints = toPointCents(student.account.balancePoints);
        const currentPenaltyPoints = toPointCents(student.account.penaltyPoints);

        if (
          currentTotalPoints === nextAccount.totalPointsCents &&
          currentBalancePoints === nextAccount.balancePointsCents &&
          currentPenaltyPoints === nextAccount.penaltyPointsCents
        ) {
          unchangedCount += 1;
          continue;
        }

        await tx.pointAccount.update({
          where: {
            id: student.account.id
          },
          data: {
            totalPoints: nextTotalPoints,
            balancePoints: nextBalancePoints,
            penaltyPoints: nextPenaltyPoints,
            version: {
              increment: 1
            }
          }
        });
        updatedCount += 1;
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "point.account.rebuild",
          targetType: "class",
          targetId: params.classId,
          afterData: {
            studentCount: students.length,
            transactionCount: transactions.length,
            updatedCount,
            createdCount,
            unchangedCount
          },
          metadata: {
            sourceModule: "point_account_rebuild",
            rebuildMode: "from_non_reverted_transactions"
          }
        }
      });

      return {
        updatedCount,
        createdCount,
        unchangedCount
      };
    });

    return {
      studentCount: students.length,
      transactionCount: transactions.length,
      ...result
    };
  });

  app.post("/classes/:classId/points/accounts/maintenance-import", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointAccountMaintenanceImportBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);

    const uniqueItems = Array.from(
      new Map(body.items.map((item) => [item.studentId, item])).values()
    );

    const students = await app.prisma.student.findMany({
      where: {
        classId: params.classId,
        id: {
          in: uniqueItems.map((item) => item.studentId)
        }
      },
      select: {
        id: true,
        name: true,
        account: {
          select: {
            id: true,
            totalPoints: true,
            balancePoints: true,
            penaltyPoints: true
          }
        }
      }
    });

    if (students.length !== uniqueItems.length) {
      throw reply.notFound("Student not found");
    }

    const studentById = new Map(students.map((student) => [student.id, student]));
    const result = await app.prisma.$transaction(async (tx) => {
      let updatedCount = 0;
      let createdCount = 0;
      let unchangedCount = 0;

      for (const item of uniqueItems) {
        const student = studentById.get(item.studentId);
        if (!student) continue;

        const nextTotalPoints = fromPointCents(toPointCents(item.totalPoints));
        const nextBalancePoints = fromPointCents(toPointCents(item.balancePoints));
        const nextPenaltyPoints = fromPointCents(toPointCents(item.penaltyPoints));

        if (!student.account) {
          await tx.pointAccount.create({
            data: {
              tenantId: classRecord.tenantId,
              studentId: student.id,
              totalPoints: nextTotalPoints,
              balancePoints: nextBalancePoints,
              penaltyPoints: nextPenaltyPoints
            }
          });
          createdCount += 1;
          continue;
        }

        const currentTotalPoints = toPointCents(student.account.totalPoints);
        const currentBalancePoints = toPointCents(student.account.balancePoints);
        const currentPenaltyPoints = toPointCents(student.account.penaltyPoints);

        if (
          currentTotalPoints === toPointCents(nextTotalPoints) &&
          currentBalancePoints === toPointCents(nextBalancePoints) &&
          currentPenaltyPoints === toPointCents(nextPenaltyPoints)
        ) {
          unchangedCount += 1;
          continue;
        }

        await tx.pointAccount.update({
          where: {
            id: student.account.id
          },
          data: {
            totalPoints: nextTotalPoints,
            balancePoints: nextBalancePoints,
            penaltyPoints: nextPenaltyPoints,
            version: {
              increment: 1
            }
          }
        });
        updatedCount += 1;
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "point.account.maintenance_import",
          targetType: "class",
          targetId: params.classId,
          afterData: {
            importedCount: uniqueItems.length,
            updatedCount,
            createdCount,
            unchangedCount
          },
          metadata: {
            sourceModule: "maintenance_points_excel_import"
          }
        }
      });

      return {
        updatedCount,
        createdCount,
        unchangedCount
      };
    });

    return {
      requestedCount: body.items.length,
      importedCount: uniqueItems.length,
      ...result
    };
  });

  app.get("/classes/:classId/points/batch-adjustments", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = pointBatchListQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const batches = await app.prisma.pointTransaction.groupBy({
      by: ["batchId", "transactionType", "value", "reason", "scene", "category", "occurredAt", "actorUserId"],
      where: {
        classId: params.classId,
        sourceModule: "manual_batch_adjustment",
        isReverted: false,
        batchId: {
          not: null
        }
      },
      _count: {
        _all: true
      },
      _max: {
        createdAt: true
      },
      orderBy: {
        _max: {
          createdAt: "desc"
        }
      },
      take: query.limit
    });

    return {
      items: batches.map((item) => ({
        batchId: item.batchId!,
        transactionType: item.transactionType,
        value: item.value.toString(),
        reason: item.reason,
        scene: item.scene,
        category: item.category,
        occurredAt: item.occurredAt,
        createdAt: item._max.createdAt,
        count: item._count._all,
        actorUserId: item.actorUserId
      }))
    };
  });

  app.post(
    "/classes/:classId/points/batch-adjustments/:batchId/correct",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = pointBatchIdParamsSchema.parse(request.params);
      const body = pointBatchAdjustmentBodySchema.parse(request.body);
      const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
      requirePointsWritePermission(membership, reply);
      await requireClassNotFrozen(app, params.classId, reply);

      const originals = await app.prisma.pointTransaction.findMany({
        where: {
          classId: params.classId,
          batchId: params.batchId,
          sourceModule: "manual_batch_adjustment"
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

      if (!originals.length || originals.some((item) => !item.student.account)) {
        throw reply.notFound("Batch adjustment not found");
      }
      if (originals.some((item) => item.isReverted)) {
        throw reply.badRequest("Batch adjustment already reverted");
      }

      const plan = await resolvePointBatchAdjustmentPlan(app, params.classId, body, reply);
      const batchId = crypto.randomUUID();
      const result = await app.prisma.$transaction(async (tx) => {
        const revertedItems = [];
        const accountSnapshots = new Map<
          string,
          {
            id: string;
            totalPoints: number;
            balancePoints: number;
            penaltyPoints: number;
          }
        >();

        for (const original of originals) {
          const currentAccount =
            accountSnapshots.get(original.studentId) || {
              id: original.student.account!.id,
              totalPoints: Number(original.student.account!.totalPoints),
              balancePoints: Number(original.student.account!.balancePoints),
              penaltyPoints: Number(original.student.account!.penaltyPoints)
            };
          const originalValue = Number(original.value);
          const reversedValue = -originalValue;
          const nextTotal = currentAccount.totalPoints + reversedValue;
          const nextBalance = currentAccount.balancePoints + reversedValue;
          const nextPenalty =
            original.transactionType === "penalty"
              ? currentAccount.penaltyPoints - Math.abs(originalValue)
              : currentAccount.penaltyPoints;

          const revertTransaction = await tx.pointTransaction.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              studentId: original.studentId,
              pointAccountId: original.pointAccountId,
              transactionType: "adjustment",
              value: reversedValue,
              reason: `撤销批量积分: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "manual_batch_adjustment_revert",
              sourceType: "point_adjustment_batch_revert",
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              occurredAt: new Date(),
              metadata: {
                revertedTransactionId: original.id,
                revertedBatchId: params.batchId,
                correctionBatchId: batchId
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

          const updatedAccount = await tx.pointAccount.update({
            where: {
              id: currentAccount.id
            },
            data: {
              totalPoints: nextTotal,
              balancePoints: nextBalance,
              penaltyPoints: nextPenalty,
              version: {
                increment: 1
              }
            },
            select: {
              id: true,
              totalPoints: true,
              balancePoints: true,
              penaltyPoints: true,
              version: true
            }
          });

          accountSnapshots.set(original.studentId, {
            id: updatedAccount.id,
            totalPoints: Number(updatedAccount.totalPoints),
            balancePoints: Number(updatedAccount.balancePoints),
            penaltyPoints: Number(updatedAccount.penaltyPoints)
          });

          revertedItems.push({
            student: {
              id: original.student.id,
              name: original.student.name
            },
            transaction: revertTransaction,
            account: updatedAccount
          });
        }

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "point.revert.batch",
            targetType: "point_transaction_batch",
            afterData: {
              revertedCount: revertedItems.length,
              batchId: params.batchId,
              correctionBatchId: batchId
            },
            metadata: {
              sourceModule: "manual_batch_adjustment_revert",
              correctionBatchId: batchId
            }
          }
        });

        const createdResult = await createPointBatchAdjustmentItems({
          tx,
          classRecord,
          membership,
          authSub: auth.sub,
          classId: params.classId,
          body,
          batchId,
          plan,
          correctionSourceBatchId: params.batchId,
          accountSnapshots
        });

        return {
          revertedItems,
          createdResult
        };
      });

      return {
        requestedCount: plan.uniqueStudentIds.length,
        adjustedCount: result.createdResult.items.length,
        revertedCount: result.revertedItems.length,
        batchId,
        transactionType: body.transactionType,
        value: result.createdResult.signedValue,
        reason: body.reason,
        items: result.createdResult.items
      };
    }
  );

  app.get("/classes/:classId/points/audits", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = pointAuditListQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const items = await app.prisma.auditLog.findMany({
      where: {
        classId: params.classId,
        action: {
          in: ["point.adjust", "point.adjust.batch", "point.revert", "point.revert.batch"]
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: query.limit,
      select: {
        id: true,
        action: true,
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
        limit: query.limit
      },
      items: items.map(serializePointAudit)
    };
  });

  app.post(
    "/classes/:classId/points/batch-adjustments/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = classParamsSchema.parse(request.params);
      const body = pointBatchRevertBodySchema.parse(request.body);
      const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
      requirePointsWritePermission(membership, reply);
      await requireClassNotFrozen(app, params.classId, reply);

      const transactionIds = Array.from(new Set(body.transactionIds));
      const originals = await app.prisma.pointTransaction.findMany({
        where: {
          id: {
            in: transactionIds
          },
          classId: params.classId
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

      if (originals.length !== transactionIds.length || originals.some((item) => !item.student.account)) {
        throw reply.notFound("Batch adjustment revert target contains invalid items");
      }
      if (originals.some((item) => item.isReverted)) {
        throw reply.badRequest("Batch adjustment contains already reverted items");
      }
      if (originals.some((item) => item.sourceModule !== "manual_batch_adjustment")) {
        throw reply.badRequest("Only batch manual adjustments can be reverted");
      }

      const result = await app.prisma.$transaction(async (tx) => {
        const items = [];

        for (const original of originals) {
          const account = original.student.account!;
          const originalValue = Number(original.value);
          const reversedValue = -originalValue;
          const nextTotal = Number(account.totalPoints) + reversedValue;
          const nextBalance = Number(account.balancePoints) + reversedValue;
          const nextPenalty =
            original.transactionType === "penalty"
              ? Number(account.penaltyPoints) - Math.abs(originalValue)
              : Number(account.penaltyPoints);

          const revertTransaction = await tx.pointTransaction.create({
            data: {
              tenantId: classRecord.tenantId,
              classId: params.classId,
              studentId: original.studentId,
              pointAccountId: original.pointAccountId,
              transactionType: "adjustment",
              value: reversedValue,
              reason: `撤销批量积分: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "manual_batch_adjustment_revert",
              sourceType: "point_adjustment_batch_revert",
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              occurredAt: new Date(),
              metadata: {
                revertedTransactionId: original.id
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

          const updatedAccount = await tx.pointAccount.update({
            where: {
              id: account.id
            },
            data: {
              totalPoints: nextTotal,
              balancePoints: nextBalance,
              penaltyPoints: nextPenalty,
              version: {
                increment: 1
              }
            },
            select: {
              id: true,
              totalPoints: true,
              balancePoints: true,
              penaltyPoints: true,
              version: true
            }
          });

          items.push({
            student: {
              id: original.student.id,
              name: original.student.name
            },
            transaction: revertTransaction,
            account: updatedAccount
          });
        }

        await tx.auditLog.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            action: "point.revert.batch",
            targetType: "point_transaction_batch",
            afterData: {
              revertedCount: items.length,
              transactionIds
            },
            metadata: {
              sourceModule: "manual_batch_adjustment_revert"
            }
          }
        });

        return items;
      });

      return {
        requestedCount: transactionIds.length,
        revertedCount: result.length,
        items: result
      };
    }
  );

  app.post(
    "/classes/:classId/points/batch-adjustments/:batchId/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = pointBatchIdParamsSchema.parse(request.params);
      return revertPointAdjustmentBatchById(auth, params.classId, params.batchId, reply);
    }
  );

  app.post(
    "/classes/:classId/points/transactions/:transactionId/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = transactionParamsSchema.parse(request.params);
      return revertSinglePointAdjustment(auth, params.classId, params.transactionId, reply);
    }
  );

  app.post("/classes/:classId/points/audits/:auditId/revert", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = pointAuditParamsSchema.parse(request.params);
    const selectedAudit = await app.prisma.auditLog.findFirst({
      where: {
        id: params.auditId,
        classId: params.classId,
        action: {
          in: ["point.adjust", "point.adjust.batch"]
        }
      },
      select: {
        id: true,
        action: true,
        afterData: true,
        metadata: true
      }
    });

    if (!selectedAudit) {
      throw reply.notFound("Point audit not found");
    }

    const batchId = getPointBatchIdFromMetadata(selectedAudit.metadata);
    if (selectedAudit.action === "point.adjust.batch" && batchId) {
      return revertPointAdjustmentBatchById(auth, params.classId, batchId, reply);
    }

    const transactionId = getPointTransactionIdFromAuditData(selectedAudit.afterData);
    if (!transactionId) {
      throw reply.badRequest("Point audit is not revertible");
    }

    return revertSinglePointAdjustment(auth, params.classId, transactionId, reply, selectedAudit.id);
  });
};
