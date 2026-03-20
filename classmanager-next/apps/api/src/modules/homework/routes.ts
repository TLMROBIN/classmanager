import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { z } from "zod";

import { canManagePoints } from "../../lib/permissions.js";

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const homeworkTransactionParamsSchema = z.object({
  classId: z.string().uuid(),
  transactionId: z.string().uuid()
});

const homeworkAuditParamsSchema = z.object({
  classId: z.string().uuid(),
  auditId: z.string().uuid()
});

const homeworkRecordBodySchema = z.object({
  studentId: z.string().uuid(),
  subjectName: z.string().trim().min(1).max(50),
  homeworkDate: z.string().date(),
  eventType: z.enum(["missing", "register"]),
  value: z.coerce.number().finite().positive().max(100)
});

const homeworkBatchRecordBodySchema = z
  .object({
    studentIds: z.array(z.string().uuid()).max(60),
    representativeStudentIds: z.array(z.string().uuid()).max(8).optional().default([]),
    subjectName: z.string().trim().min(1).max(50),
    homeworkDate: z.string().date(),
    eventType: z.enum(["missing", "register"]),
    value: z.coerce.number().finite().positive().max(100)
  })
  .refine(
    (body) =>
      new Set(body.studentIds).size === body.studentIds.length &&
      new Set(body.representativeStudentIds).size === body.representativeStudentIds.length,
    {
      message: "Homework batch contains duplicate student ids"
    }
  );

const homeworkBatchRevertBodySchema = z.object({
  transactionIds: z.array(z.string().uuid()).min(1).max(60)
});

const homeworkBatchListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(12)
});

const homeworkBatchIdParamsSchema = z.object({
  classId: z.string().uuid(),
  batchId: z.string().uuid()
});

const homeworkDetailQuerySchema = z.object({
  homeworkDate: z.string().date().optional(),
  subjectName: z.string().trim().min(1).optional(),
  days: z.coerce.number().int().min(1).max(90).optional()
});

const homeworkOverviewQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional()
});

type HomeworkBatchRecordBody = z.infer<typeof homeworkBatchRecordBodySchema>;

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
    select: { id: true, status: true }
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

function requireHomeworkWritePermission(membership: any, reply: any) {
  if (!canManagePoints(membership)) {
    throw reply.forbidden("Homework record permission denied");
  }
}

function normalizeClassConfigExtra(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    subjects: Array.isArray(raw.subjects)
      ? raw.subjects
          .map((item) => {
            const subject = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
            const id = typeof subject.id === "string" ? subject.id.trim() : "";
            const name = typeof subject.name === "string" ? subject.name.trim() : "";
            if (!id || !name) return null;
            return {
              id,
              name,
              representativeStudentIds: Array.isArray(subject.representativeStudentIds)
                ? Array.from(
                    new Set(subject.representativeStudentIds.filter((studentId): studentId is string => typeof studentId === "string"))
                  ).slice(0, 2)
                : []
            };
          })
          .filter(Boolean)
      : []
  };
}

function parseHomeworkReason(reason: string) {
  const normalizedReason = reason.replace(/^撤销[加扣]分:\s*/, "").trim();
  const missingMatch = normalizedReason.match(/^(.*)作业未交\s+(\d{4}-\d{2}-\d{2})$/);
  if (missingMatch) {
    return {
      subjectName: missingMatch[1].trim(),
      homeworkDate: missingMatch[2],
      eventType: "missing" as const
    };
  }

  const registerMatch = normalizedReason.match(/^(.*)作业登记\s+(\d{4}-\d{2}-\d{2})$/);
  if (registerMatch) {
    return {
      subjectName: registerMatch[1].trim(),
      homeworkDate: registerMatch[2],
      eventType: "register" as const
    };
  }

  return null;
}

function getHomeworkReason(subjectName: string, homeworkDate: string, eventType: "missing" | "register") {
  return eventType === "missing" ? `${subjectName}作业未交 ${homeworkDate}` : `${subjectName}作业登记 ${homeworkDate}`;
}

function normalizeHomeworkMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isRepresentativeHomeworkTransaction(value: unknown) {
  return normalizeHomeworkMetadata(value).autoAwardedRepresentative === true;
}

function getHomeworkInputValue(value: unknown, fallbackValue: number) {
  const inputValue = normalizeHomeworkMetadata(value).inputValue;
  return typeof inputValue === "number" && Number.isFinite(inputValue) ? Math.abs(inputValue) : Math.abs(fallbackValue);
}

async function resolveHomeworkBatchPlan(
  app: any,
  classId: string,
  body: HomeworkBatchRecordBody,
  reply: any,
  options?: {
    excludeBatchId?: string;
  }
) {
  const uniqueStudentIds = [...new Set(body.studentIds)];
  const uniqueRepresentativeStudentIds =
    body.eventType === "missing" ? [...new Set(body.representativeStudentIds || [])] : [];

  if (!uniqueStudentIds.length && !uniqueRepresentativeStudentIds.length) {
    throw reply.badRequest("Homework batch targets required");
  }

  const involvedStudentIds = Array.from(new Set([...uniqueStudentIds, ...uniqueRepresentativeStudentIds]));
  const students = await app.prisma.student.findMany({
    where: {
      id: {
        in: involvedStudentIds
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

  if (students.length !== involvedStudentIds.length || students.some((student) => !student.account)) {
    throw reply.notFound("Homework batch contains invalid student accounts");
  }

  const studentMap = new Map(students.map((student) => [student.id, student]));
  const reason = getHomeworkReason(body.subjectName, body.homeworkDate, body.eventType);
  const representativeReason = getHomeworkReason(body.subjectName, body.homeworkDate, "register");
  const transactionType = body.eventType === "missing" ? "penalty" : "reward";
  const signedValue = body.eventType === "missing" ? -Math.abs(body.value) : Math.abs(body.value);
  const duplicateFilter = options?.excludeBatchId ? { NOT: { batchId: options.excludeBatchId } } : {};

  const [existingRecords, existingRepresentativeRecords] = await Promise.all([
    uniqueStudentIds.length
      ? app.prisma.pointTransaction.findMany({
          where: {
            classId,
            studentId: {
              in: uniqueStudentIds
            },
            reason,
            sourceModule: "homework_record",
            isReverted: false,
            ...duplicateFilter
          },
          select: {
            studentId: true
          }
        })
      : Promise.resolve([]),
    uniqueRepresentativeStudentIds.length
      ? app.prisma.pointTransaction.findMany({
          where: {
            classId,
            studentId: {
              in: uniqueRepresentativeStudentIds
            },
            reason: representativeReason,
            sourceModule: "homework_record",
            isReverted: false,
            ...duplicateFilter
          },
          select: {
            studentId: true
          }
        })
      : Promise.resolve([])
  ]);

  const existingStudentIds = new Set(existingRecords.map((item: { studentId: string }) => item.studentId));
  const existingRepresentativeStudentIds = new Set(
    existingRepresentativeRecords.map((item: { studentId: string }) => item.studentId)
  );
  const studentsToWrite = uniqueStudentIds
    .map((studentId) => studentMap.get(studentId))
    .filter((student): student is NonNullable<typeof student> => Boolean(student))
    .filter((student) => !existingStudentIds.has(student.id));
  const representativeStudentsToWrite = uniqueRepresentativeStudentIds
    .map((studentId) => studentMap.get(studentId))
    .filter((student): student is NonNullable<typeof student> => Boolean(student))
    .filter((student) => !existingRepresentativeStudentIds.has(student.id));
  const skippedCount = uniqueStudentIds.length - studentsToWrite.length;
  const representativeSkippedCount = uniqueRepresentativeStudentIds.length - representativeStudentsToWrite.length;

  if (!studentsToWrite.length && !representativeStudentsToWrite.length) {
    throw reply.conflict("Homework batch already exists");
  }

  const classConfig = await app.prisma.classConfig?.findUnique?.({
    where: {
      classId
    },
    select: {
      extra: true
    }
  });

  if (body.eventType === "missing" && uniqueRepresentativeStudentIds.length > 0 && !classConfig) {
    throw reply.badRequest("Homework representative config changed");
  }

  if (body.eventType === "missing" && classConfig) {
    const configuredSubject = normalizeClassConfigExtra(classConfig.extra).subjects.find((item) => item.name === body.subjectName);
    if (uniqueRepresentativeStudentIds.length > 0 && !configuredSubject) {
      throw reply.badRequest("Homework representative config changed");
    }
    const configuredRepresentativeIds = configuredSubject?.representativeStudentIds || [];
    const requestedRepresentativeSet = new Set(uniqueRepresentativeStudentIds);
    if (
      configuredRepresentativeIds.length &&
      (configuredRepresentativeIds.length !== requestedRepresentativeSet.size ||
        configuredRepresentativeIds.some((studentId) => !requestedRepresentativeSet.has(studentId)))
    ) {
      throw reply.badRequest("Homework representative config changed");
    }
  }

  return {
    uniqueStudentIds,
    uniqueRepresentativeStudentIds,
    studentsToWrite,
    representativeStudentsToWrite,
    skippedCount,
    representativeSkippedCount,
    reason,
    representativeReason,
    transactionType,
    signedValue
  };
}

async function createHomeworkBatchItems(args: {
  tx: any;
  classRecord: {
    tenantId: string;
  };
  membership: {
    id: string;
  };
  authSub: string;
  classId: string;
  body: HomeworkBatchRecordBody;
  batchId: string;
  plan: Awaited<ReturnType<typeof resolveHomeworkBatchPlan>>;
  correctionSourceBatchId?: string;
}) {
  const { tx, classRecord, membership, authSub, classId, body, batchId, plan, correctionSourceBatchId } = args;
  const items = [];

  for (const student of plan.studentsToWrite) {
    const account = student.account!;
    const nextTotal = Number(account.totalPoints) + plan.signedValue;
    const nextBalance = Number(account.balancePoints) + plan.signedValue;
    const nextPenalty =
      body.eventType === "missing" ? Number(account.penaltyPoints) + Math.abs(body.value) : Number(account.penaltyPoints);

    const transaction = await tx.pointTransaction.create({
      data: {
        tenantId: classRecord.tenantId,
        classId,
        studentId: student.id,
        pointAccountId: account.id,
        transactionType: plan.transactionType,
        value: plan.signedValue,
        reason: plan.reason,
        scene: "作业",
        category: body.eventType === "missing" ? "未交" : "登记",
        batchId,
        sourceModule: "homework_record",
        sourceType: "homework_record_batch",
        actorUserId: authSub,
        actorMembershipId: membership.id,
        occurredAt: new Date(),
        metadata: {
          subjectName: body.subjectName,
          homeworkDate: body.homeworkDate,
          eventType: body.eventType,
          inputValue: body.value,
          batchSize: plan.uniqueStudentIds.length,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
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
        classId,
        actorUserId: authSub,
        actorMembershipId: membership.id,
        action: "homework.record.batch_create",
        targetType: "student",
        targetId: student.id,
        afterData: {
          transactionId: transaction.id,
          studentName: student.name,
          subjectName: body.subjectName,
          homeworkDate: body.homeworkDate,
          eventType: body.eventType,
          value: plan.signedValue,
          balancePoints: updatedAccount.balancePoints,
          totalPoints: updatedAccount.totalPoints,
          penaltyPoints: updatedAccount.penaltyPoints
        },
        metadata: {
          sourceModule: "homework_record",
          batchSize: plan.uniqueStudentIds.length,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
        }
      }
    });

    items.push({
      student: {
        id: student.id,
        name: student.name
      },
      transaction,
      account: updatedAccount
    });
  }

  for (const student of plan.representativeStudentsToWrite) {
    const account = student.account!;
    const nextTotal = Number(account.totalPoints) + 1;
    const nextBalance = Number(account.balancePoints) + 1;

    const transaction = await tx.pointTransaction.create({
      data: {
        tenantId: classRecord.tenantId,
        classId,
        studentId: student.id,
        pointAccountId: account.id,
        transactionType: "reward",
        value: 1,
        reason: plan.representativeReason,
        scene: "作业",
        category: "登记",
        batchId,
        sourceModule: "homework_record",
        sourceType: "homework_record_batch",
        actorUserId: authSub,
        actorMembershipId: membership.id,
        occurredAt: new Date(),
        metadata: {
          subjectName: body.subjectName,
          homeworkDate: body.homeworkDate,
          eventType: "register",
          inputValue: 1,
          batchSize: plan.uniqueStudentIds.length + plan.uniqueRepresentativeStudentIds.length,
          autoAwardedRepresentative: true,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
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
        action: "homework.record.batch_create",
        targetType: "student",
        targetId: student.id,
        afterData: {
          transactionId: transaction.id,
          studentName: student.name,
          subjectName: body.subjectName,
          homeworkDate: body.homeworkDate,
          eventType: "register",
          value: 1,
          balancePoints: updatedAccount.balancePoints,
          totalPoints: updatedAccount.totalPoints,
          penaltyPoints: updatedAccount.penaltyPoints
        },
        metadata: {
          sourceModule: "homework_record",
          batchSize: plan.uniqueStudentIds.length + plan.uniqueRepresentativeStudentIds.length,
          autoAwardedRepresentative: true,
          ...(correctionSourceBatchId ? { correctedFromBatchId: correctionSourceBatchId } : {})
        }
      }
    });

    items.push({
      student: {
        id: student.id,
        name: student.name
      },
      transaction,
      account: updatedAccount
    });
  }

  return items;
}

function serializeHomeworkBatchHistoryItem(batchId: string, items: any[]) {
  if (!items.length) {
    return null;
  }

  const representativeItems = items.filter((item) => isRepresentativeHomeworkTransaction(item.metadata));
  const primaryItems = items.filter((item) => !isRepresentativeHomeworkTransaction(item.metadata));
  const mainItem = primaryItems[0] || items[0];
  const parsedReason = parseHomeworkReason(mainItem.reason) || items.map((item) => parseHomeworkReason(item.reason)).find(Boolean) || null;
  const createdAt = items.reduce((latest, item) => {
    const current = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
    return current > latest ? current : latest;
  }, items[0].createdAt instanceof Date ? items[0].createdAt : new Date(items[0].createdAt));
  const representativeRewardValue = representativeItems.length
    ? getHomeworkInputValue(representativeItems[0].metadata, Number(representativeItems[0].value))
    : null;

  return {
    batchId,
    transactionType: mainItem.transactionType,
    eventType: parsedReason?.eventType || (mainItem.transactionType === "penalty" ? "missing" : "register"),
    subjectName: parsedReason?.subjectName || "",
    homeworkDate: parsedReason?.homeworkDate || "",
    value: getHomeworkInputValue(mainItem.metadata, Number(mainItem.value)).toString(),
    representativeRewardValue: representativeRewardValue === null ? null : representativeRewardValue.toString(),
    reason: mainItem.reason,
    scene: mainItem.scene,
    category: mainItem.category,
    occurredAt: mainItem.occurredAt,
    createdAt,
    count: primaryItems.length || items.length,
    representativeCount: representativeItems.length,
    totalCount: items.length,
    actorUserId: mainItem.actorUserId
  };
}

async function fetchHomeworkBatchHistoryItems(app: any, classId: string, limit: number) {
  const batches = await app.prisma.pointTransaction.groupBy({
    by: ["batchId"],
    where: {
      classId,
      sourceModule: "homework_record",
      sourceType: "homework_record_batch",
      isReverted: false,
      batchId: {
        not: null
      }
    },
    _max: {
      createdAt: true
    },
    orderBy: {
      _max: {
        createdAt: "desc"
      }
    },
    take: limit
  });

  const batchIds = batches.map((item) => item.batchId).filter((item): item is string => Boolean(item));
  if (!batchIds.length) {
    return [];
  }

  const transactions = await app.prisma.pointTransaction.findMany({
    where: {
      classId,
      batchId: {
        in: batchIds
      },
      sourceModule: "homework_record",
      sourceType: "homework_record_batch",
      isReverted: false
    },
    orderBy: [{ createdAt: "desc" }, { occurredAt: "desc" }],
    select: {
      batchId: true,
      transactionType: true,
      value: true,
      reason: true,
      scene: true,
      category: true,
      occurredAt: true,
      createdAt: true,
      actorUserId: true,
      metadata: true
    }
  });

  const transactionMap = new Map<string, any[]>();
  for (const item of transactions) {
    const batchKey = item.batchId;
    if (!batchKey) continue;
    const current = transactionMap.get(batchKey) || [];
    current.push(item);
    transactionMap.set(batchKey, current);
  }

  return batchIds
    .map((batchId) => serializeHomeworkBatchHistoryItem(batchId, transactionMap.get(batchId) || []))
    .filter(Boolean);
}

function getHomeworkTransactionWhere(classId: string, dateFrom: Date) {
  return {
    classId,
    occurredAt: {
      gte: dateFrom
    },
    sourceModule: "homework_record",
    isReverted: false
  } as const;
}

function getHomeworkTransactionIdFromAuditData(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const transactionId = (value as Record<string, unknown>).transactionId;
  return typeof transactionId === "string" ? transactionId : null;
}

function serializeHomeworkAudit(item: any) {
  const metaByAction: Record<
    string,
    {
      label: string;
      canRevert: boolean;
    }
  > = {
    "homework.record.create": {
      label: "单条作业登记",
      canRevert: true
    },
    "homework.record.batch_create": {
      label: "批量作业登记",
      canRevert: true
    },
    "homework.record.revert": {
      label: "撤销单条作业登记",
      canRevert: false
    },
    "homework.record.batch_revert": {
      label: "撤销批量作业登记",
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
    canRevert: meta.canRevert && Boolean(getHomeworkTransactionIdFromAuditData(item.afterData)),
    transactionId: getHomeworkTransactionIdFromAuditData(item.afterData),
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

export const homeworkRoutes: FastifyPluginAsync = async (app) => {
  async function revertSingleHomeworkRecord(
    auth: { sub: string },
    classId: string,
    transactionId: string,
    reply: any,
    selectedAuditId?: string
  ) {
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, classId, reply);
    requireHomeworkWritePermission(membership, reply);
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
      throw reply.notFound("Homework record not found");
    }
    if (original.isReverted) {
      throw reply.badRequest("Homework record already reverted");
    }
    if (original.sourceModule !== "homework_record") {
      throw reply.badRequest("Only homework records can be reverted");
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
        (selectedAudit.action !== "homework.record.create" && selectedAudit.action !== "homework.record.batch_create") ||
        getHomeworkTransactionIdFromAuditData(selectedAudit.afterData) !== transactionId
      ) {
        throw reply.badRequest("Homework audit changed since selected operation");
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
          reason: `撤销作业记录: ${original.reason}`,
          scene: original.scene,
          category: original.category,
          sourceModule: "homework_record_revert",
          sourceType: "homework_record_revert",
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
          action: "homework.record.revert",
          targetType: "point_transaction",
          targetId: original.id,
          afterData: {
            revertedTransactionId: revertTransaction.id,
            studentId: original.student.id,
            studentName: original.student.name,
            reason: original.reason
          },
          metadata: {
            sourceModule: "homework_record_revert"
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

  app.post("/classes/:classId/homework/records", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = homeworkRecordBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requireHomeworkWritePermission(membership, reply);
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

    const reason =
      body.eventType === "missing"
        ? `${body.subjectName}作业未交 ${body.homeworkDate}`
        : `${body.subjectName}作业登记 ${body.homeworkDate}`;
    const transactionType = body.eventType === "missing" ? "penalty" : "reward";
    const signedValue = body.eventType === "missing" ? -Math.abs(body.value) : Math.abs(body.value);
    const nextTotal = Number(account.totalPoints) + signedValue;
    const nextBalance = Number(account.balancePoints) + signedValue;
    const nextPenalty =
      body.eventType === "missing"
        ? Number(account.penaltyPoints) + Math.abs(body.value)
        : Number(account.penaltyPoints);

    const existingRecord = await app.prisma.pointTransaction.findFirst({
      where: {
        classId: params.classId,
        studentId: body.studentId,
        reason,
        sourceModule: "homework_record",
        isReverted: false
      },
      select: {
        id: true
      }
    });

    if (existingRecord) {
      throw reply.conflict("Homework record already exists");
    }

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: account.id,
          transactionType,
          value: signedValue,
          reason,
          scene: "作业",
          category: body.eventType === "missing" ? "未交" : "登记",
          sourceModule: "homework_record",
          sourceType: "homework_record",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt: new Date(),
          metadata: {
            subjectName: body.subjectName,
            homeworkDate: body.homeworkDate,
            eventType: body.eventType,
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
          action: "homework.record.create",
          targetType: "student",
          targetId: student.id,
          afterData: {
            transactionId: transaction.id,
            studentName: student.name,
            subjectName: body.subjectName,
            homeworkDate: body.homeworkDate,
            eventType: body.eventType,
            value: signedValue,
            balancePoints: updatedAccount.balancePoints,
            totalPoints: updatedAccount.totalPoints,
            penaltyPoints: updatedAccount.penaltyPoints
          },
          metadata: {
            sourceModule: "homework_record"
          }
        }
      });

      return {
        transaction,
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

  app.post("/classes/:classId/homework/records/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = homeworkBatchRecordBodySchema.parse(request.body);
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requireHomeworkWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);
    const plan = await resolveHomeworkBatchPlan(app, params.classId, body, reply);
    const batchId = crypto.randomUUID();
    const result = await app.prisma.$transaction((tx) =>
      createHomeworkBatchItems({
        tx,
        classRecord,
        membership,
        authSub: auth.sub,
        classId: params.classId,
        body,
        batchId,
        plan
      })
    );

    return {
      requestedCount: plan.uniqueStudentIds.length,
      createdCount: result.length,
      skippedCount: plan.skippedCount,
      representativeRequestedCount: plan.uniqueRepresentativeStudentIds.length,
      representativeCreatedCount: plan.representativeStudentsToWrite.length,
      representativeSkippedCount: plan.representativeSkippedCount,
      batchId,
      subjectName: body.subjectName,
      homeworkDate: body.homeworkDate,
      eventType: body.eventType,
      value: plan.signedValue,
      items: result
    };
  });

  app.get("/classes/:classId/homework/records/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = homeworkBatchListQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    return {
      items: await fetchHomeworkBatchHistoryItems(app, params.classId, query.limit)
    };
  });

  app.post(
    "/classes/:classId/homework/records/batch/:batchId/correct",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = homeworkBatchIdParamsSchema.parse(request.params);
      const body = homeworkBatchRecordBodySchema.parse(request.body);
      const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
      requireHomeworkWritePermission(membership, reply);
      await requireClassNotFrozen(app, params.classId, reply);

      const originals = await app.prisma.pointTransaction.findMany({
        where: {
          classId: params.classId,
          batchId: params.batchId,
          sourceModule: "homework_record",
          sourceType: "homework_record_batch"
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
        throw reply.notFound("Homework batch not found");
      }
      if (originals.some((item) => item.isReverted)) {
        throw reply.badRequest("Homework batch already reverted");
      }

      const plan = await resolveHomeworkBatchPlan(app, params.classId, body, reply, {
        excludeBatchId: params.batchId
      });

      if (plan.skippedCount || plan.representativeSkippedCount) {
        throw reply.conflict("Homework correction conflicts with existing records");
      }

      const batchId = crypto.randomUUID();
      const result = await app.prisma.$transaction(async (tx) => {
        const revertedItems = [];

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
              reason: `撤销作业记录: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "homework_batch_revert",
              sourceType: "homework_record_batch_revert",
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
            action: "homework.record.batch_revert",
            targetType: "point_transaction_batch",
            afterData: {
              revertedCount: originals.length,
              batchId: params.batchId,
              correctionBatchId: batchId
            },
            metadata: {
              sourceModule: "homework_batch_revert"
            }
          }
        });

        const createdItems = await createHomeworkBatchItems({
          tx,
          classRecord,
          membership,
          authSub: auth.sub,
          classId: params.classId,
          body,
          batchId,
          plan,
          correctionSourceBatchId: params.batchId
        });

        return {
          revertedItems,
          createdItems
        };
      });

      return {
        revertedCount: result.revertedItems.length,
        requestedCount: plan.uniqueStudentIds.length,
        createdCount: result.createdItems.length,
        skippedCount: plan.skippedCount,
        representativeRequestedCount: plan.uniqueRepresentativeStudentIds.length,
        representativeCreatedCount: plan.representativeStudentsToWrite.length,
        representativeSkippedCount: plan.representativeSkippedCount,
        batchId,
        subjectName: body.subjectName,
        homeworkDate: body.homeworkDate,
        eventType: body.eventType,
        value: plan.signedValue,
        items: result.createdItems
      };
    }
  );

  app.post(
    "/classes/:classId/homework/records/batch-revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = classParamsSchema.parse(request.params);
      const body = homeworkBatchRevertBodySchema.parse(request.body);
      const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
      requireHomeworkWritePermission(membership, reply);
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
        throw reply.notFound("Homework batch revert target contains invalid items");
      }
      if (originals.some((item) => item.isReverted)) {
        throw reply.badRequest("Homework batch contains already reverted items");
      }
      if (originals.some((item) => item.sourceModule !== "homework_record")) {
        throw reply.badRequest("Only homework batch records can be reverted");
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
              reason: `撤销批量作业记录: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "homework_batch_revert",
              sourceType: "homework_record_batch_revert",
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
            action: "homework.record.batch_revert",
            targetType: "point_transaction_batch",
            afterData: {
              revertedCount: items.length,
              transactionIds
            },
            metadata: {
              sourceModule: "homework_batch_revert"
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
    "/classes/:classId/homework/records/batch/:batchId/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = homeworkBatchIdParamsSchema.parse(request.params);
      const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
      requireHomeworkWritePermission(membership, reply);
      await requireClassNotFrozen(app, params.classId, reply);

      const originals = await app.prisma.pointTransaction.findMany({
        where: {
          classId: params.classId,
          batchId: params.batchId,
          sourceModule: "homework_record",
          sourceType: "homework_record_batch"
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
        throw reply.notFound("Homework batch not found");
      }
      if (originals.some((item) => item.isReverted)) {
        throw reply.badRequest("Homework batch already reverted");
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
              reason: `撤销作业记录: ${original.reason}`,
              scene: original.scene,
              category: original.category,
              sourceModule: "homework_batch_revert",
              sourceType: "homework_record_batch_revert",
              actorUserId: auth.sub,
              actorMembershipId: membership.id,
              occurredAt: new Date(),
              metadata: {
                revertedTransactionId: original.id,
                revertedBatchId: params.batchId
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
            action: "homework.record.batch_revert",
            targetType: "point_transaction_batch",
            afterData: {
              revertedCount: items.length,
              batchId: params.batchId
            },
            metadata: {
              sourceModule: "homework_batch_revert"
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
  );

  app.post(
    "/classes/:classId/homework/records/:transactionId/revert",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const auth = request.auth;
      if (!auth) {
        throw reply.unauthorized("Missing auth context");
      }

      const params = homeworkTransactionParamsSchema.parse(request.params);
      return revertSingleHomeworkRecord(auth, params.classId, params.transactionId, reply);
    }
  );

  app.post("/classes/:classId/homework/audits/:auditId/revert", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = homeworkAuditParamsSchema.parse(request.params);
    const selectedAudit = await app.prisma.auditLog.findFirst({
      where: {
        id: params.auditId,
        classId: params.classId,
        action: {
          in: ["homework.record.create", "homework.record.batch_create"]
        }
      },
      select: {
        id: true,
        afterData: true
      }
    });

    if (!selectedAudit) {
      throw reply.notFound("Homework audit not found");
    }

    const transactionId = getHomeworkTransactionIdFromAuditData(selectedAudit.afterData);
    if (!transactionId) {
      throw reply.badRequest("Homework audit is not revertible");
    }

    return revertSingleHomeworkRecord(auth, params.classId, transactionId, reply, selectedAudit.id);
  });

  app.get("/classes/:classId/homework/student-stats", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = homeworkDetailQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const days = query.days ?? 30;
    const dateFrom = new Date();
    dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));
    dateFrom.setUTCHours(0, 0, 0, 0);

    const txs = await app.prisma.pointTransaction.findMany({
      where: getHomeworkTransactionWhere(params.classId, dateFrom),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        occurredAt: true,
        transactionType: true,
        value: true,
        reason: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true
          }
        }
      }
    });

    const allEvents = txs
      .map((item) => {
        const parsed = parseHomeworkReason(item.reason);
        if (!parsed) return null;
        return {
          id: item.id,
          occurredAt: item.occurredAt.toISOString(),
          subjectName: parsed.subjectName,
          homeworkDate: parsed.homeworkDate,
          eventType: parsed.eventType,
          transactionType: item.transactionType,
          value: item.value.toString(),
          student: {
            id: item.student.id,
            name: item.student.name,
            legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null
          }
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const homeworkDates = Array.from(new Set(allEvents.map((item) => item.homeworkDate))).sort().reverse();
    const activeHomeworkDate = query.homeworkDate ?? allEvents[0]?.homeworkDate ?? homeworkDates[0] ?? null;
    const subjectNames = Array.from(
      new Set(
        allEvents
          .filter((item) => !activeHomeworkDate || item.homeworkDate === activeHomeworkDate)
          .map((item) => item.subjectName)
      )
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const activeSubjectName = query.subjectName ?? allEvents[0]?.subjectName ?? subjectNames[0] ?? null;

    const filteredEvents = allEvents.filter((item) => {
      const byDate = !activeHomeworkDate || item.homeworkDate === activeHomeworkDate;
      const bySubject = !activeSubjectName || item.subjectName === activeSubjectName;
      return byDate && bySubject;
    });

    const statsMap = new Map<
      string,
      {
        student: {
          id: string;
          name: string;
          legacyId: string | null;
        };
        missingCount: number;
        registerCount: number;
      }
    >();

    for (const event of filteredEvents) {
      const current = statsMap.get(event.student.id) || {
        student: event.student,
        missingCount: 0,
        registerCount: 0
      };
      if (event.eventType === "missing") current.missingCount += 1;
      if (event.eventType === "register") current.registerCount += 1;
      statsMap.set(event.student.id, current);
    }

    return {
      filters: {
        homeworkDate: activeHomeworkDate,
        subjectName: activeSubjectName,
        days,
        availableHomeworkDates: homeworkDates,
        availableSubjects: subjectNames
      },
      totals: {
        students: statsMap.size,
        missingCount: filteredEvents.filter((item) => item.eventType === "missing").length,
        registerCount: filteredEvents.filter((item) => item.eventType === "register").length
      },
      items: Array.from(statsMap.values()).sort((left, right) => {
        return (
          right.missingCount - left.missingCount ||
          right.registerCount - left.registerCount ||
          left.student.name.localeCompare(right.student.name, "zh-CN")
        );
      })
    };
  });

  app.get("/classes/:classId/homework/detail", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = homeworkDetailQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const days = query.days ?? 30;
    const dateFrom = new Date();
    dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));
    dateFrom.setUTCHours(0, 0, 0, 0);

    const txs = await app.prisma.pointTransaction.findMany({
      where: getHomeworkTransactionWhere(params.classId, dateFrom),
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        occurredAt: true,
        transactionType: true,
        value: true,
        reason: true,
        scene: true,
        category: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true
          }
        }
      }
    });

    const allEvents = txs
      .map((item) => {
        const parsed = parseHomeworkReason(item.reason);
        if (!parsed) return null;
        return {
          id: item.id,
          occurredAt: item.occurredAt.toISOString(),
          subjectName: parsed.subjectName,
          homeworkDate: parsed.homeworkDate,
          eventType: parsed.eventType,
          transactionType: item.transactionType,
          value: item.value.toString(),
          scene: item.scene,
          category: item.category,
          student: {
            id: item.student.id,
            name: item.student.name,
            legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null
          }
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const homeworkDates = Array.from(new Set(allEvents.map((item) => item.homeworkDate))).sort().reverse();
    const activeHomeworkDate = query.homeworkDate ?? allEvents[0]?.homeworkDate ?? homeworkDates[0] ?? null;
    const subjectNames = Array.from(
      new Set(
        allEvents
          .filter((item) => !activeHomeworkDate || item.homeworkDate === activeHomeworkDate)
          .map((item) => item.subjectName)
      )
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
    const activeSubjectName = query.subjectName ?? allEvents[0]?.subjectName ?? subjectNames[0] ?? null;

    const filteredEvents = allEvents.filter((item) => {
      const byDate = !activeHomeworkDate || item.homeworkDate === activeHomeworkDate;
      const bySubject = !activeSubjectName || item.subjectName === activeSubjectName;
      return byDate && bySubject;
    });

    return {
      filters: {
        homeworkDate: activeHomeworkDate,
        subjectName: activeSubjectName,
        days,
        availableHomeworkDates: homeworkDates,
        availableSubjects: subjectNames
      },
      totals: {
        events: filteredEvents.length,
        missingCount: filteredEvents.filter((item) => item.eventType === "missing").length,
        registerCount: filteredEvents.filter((item) => item.eventType === "register").length
      },
      items: filteredEvents
    };
  });

  app.get("/classes/:classId/homework/overview", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const query = homeworkOverviewQuerySchema.parse(request.query);
    await requireClassAccess(app, auth.sub, params.classId, reply);

    const days = query.days ?? 14;
    const dateFrom = new Date();
    dateFrom.setUTCDate(dateFrom.getUTCDate() - (days - 1));
    dateFrom.setUTCHours(0, 0, 0, 0);

    const txs = await app.prisma.pointTransaction.findMany({
      where: getHomeworkTransactionWhere(params.classId, dateFrom),
      orderBy: {
        occurredAt: "desc"
      },
      select: {
        id: true,
        occurredAt: true,
        transactionType: true,
        value: true,
        reason: true,
        scene: true,
        category: true,
        student: {
          select: {
            id: true,
            name: true,
            legacyId: true
          }
        }
      }
    });

    const events = txs
      .map((item) => {
        const parsed = parseHomeworkReason(item.reason);
        if (!parsed) return null;
        return {
          id: item.id,
          occurredAt: item.occurredAt.toISOString(),
          subjectName: parsed.subjectName,
          homeworkDate: parsed.homeworkDate,
          eventType: parsed.eventType,
          transactionType: item.transactionType,
          value: item.value.toString(),
          scene: item.scene,
          category: item.category,
          student: {
            id: item.student.id,
            name: item.student.name,
            legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null
          }
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    const subjectMap = new Map<
      string,
      {
        subjectName: string;
        missingCount: number;
        registerCount: number;
        affectedStudents: Set<string>;
        lastHomeworkDate: string | null;
      }
    >();

    for (const event of events) {
      const current = subjectMap.get(event.subjectName) || {
        subjectName: event.subjectName,
        missingCount: 0,
        registerCount: 0,
        affectedStudents: new Set<string>(),
        lastHomeworkDate: null
      };
      if (event.eventType === "missing") current.missingCount += 1;
      if (event.eventType === "register") current.registerCount += 1;
      current.affectedStudents.add(event.student.id);
      if (!current.lastHomeworkDate || event.homeworkDate > current.lastHomeworkDate) {
        current.lastHomeworkDate = event.homeworkDate;
      }
      subjectMap.set(event.subjectName, current);
    }

    const subjectSummaries = Array.from(subjectMap.values())
      .map((item) => ({
        subjectName: item.subjectName,
        missingCount: item.missingCount,
        registerCount: item.registerCount,
        affectedStudentCount: item.affectedStudents.size,
        lastHomeworkDate: item.lastHomeworkDate
      }))
      .sort((left, right) => {
        return (
          right.missingCount - left.missingCount ||
          right.registerCount - left.registerCount ||
          left.subjectName.localeCompare(right.subjectName, "zh-CN")
        );
      });

    const uniqueHomeworkDates = new Set(events.map((item) => item.homeworkDate));
    const recentAudits = await app.prisma.auditLog.findMany({
      where: {
        classId: params.classId,
        action: {
          in: [
            "homework.record.create",
            "homework.record.batch_create",
            "homework.record.revert",
            "homework.record.batch_revert"
          ]
        }
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
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
      range: {
        days,
        dateFrom: dateFrom.toISOString().slice(0, 10)
      },
      totals: {
        subjects: subjectSummaries.length,
        homeworkDays: uniqueHomeworkDates.size,
        missingCount: events.filter((item) => item.eventType === "missing").length,
        registerCount: events.filter((item) => item.eventType === "register").length
      },
      subjects: subjectSummaries,
      recentEvents: events.slice(0, 40),
      recentAudits: recentAudits.map(serializeHomeworkAudit)
    };
  });
};
