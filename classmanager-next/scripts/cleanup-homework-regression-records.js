const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
  const args = {
    apply: false,
    subjectPrefix: "回归"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--subject-prefix") {
      args.subjectPrefix = argv[index + 1] || args.subjectPrefix;
      index += 1;
    }
  }

  return args;
}

function ensurePostgresDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("This cleanup script only supports PostgreSQL DATABASE_URL");
  }
}

function matchesHomeworkCreateAudit(auditLog, originalIds) {
  if (auditLog.action !== "homework.record.create") return false;
  const afterData = auditLog.afterData && typeof auditLog.afterData === "object" ? auditLog.afterData : null;
  return Boolean(afterData && typeof afterData.transactionId === "string" && originalIds.has(afterData.transactionId));
}

function matchesHomeworkRevertAudit(auditLog, originalIds, revertIds) {
  if (auditLog.action !== "homework.record.revert") return false;
  if (typeof auditLog.targetId === "string" && originalIds.has(auditLog.targetId)) return true;

  const afterData = auditLog.afterData && typeof auditLog.afterData === "object" ? auditLog.afterData : null;
  return Boolean(
    afterData &&
      typeof afterData.revertedTransactionId === "string" &&
      revertIds.has(afterData.revertedTransactionId)
  );
}

async function main() {
  const args = parseArgs(process.argv);
  ensurePostgresDatabaseUrl();

  const prisma = new PrismaClient();

  try {
    const originalTransactions = await prisma.pointTransaction.findMany({
      where: {
        sourceModule: "homework_record",
        isReverted: true,
        reason: {
          startsWith: args.subjectPrefix
        }
      },
      orderBy: {
        occurredAt: "asc"
      },
      select: {
        id: true,
        classId: true,
        studentId: true,
        pointAccountId: true,
        reason: true,
        occurredAt: true,
        revertedByTransactionId: true
      }
    });

    const revertIds = originalTransactions
      .map((item) => item.revertedByTransactionId)
      .filter((value) => typeof value === "string");

    const revertTransactions = revertIds.length
      ? await prisma.pointTransaction.findMany({
          where: {
            id: {
              in: revertIds
            },
            sourceModule: "homework_record_revert"
          },
          select: {
            id: true,
            classId: true,
            studentId: true,
            pointAccountId: true,
            reason: true,
            occurredAt: true
          }
        })
      : [];

    const originalIds = new Set(originalTransactions.map((item) => item.id));
    const revertIdSet = new Set(revertTransactions.map((item) => item.id));
    const relevantClassIds = Array.from(new Set(originalTransactions.map((item) => item.classId)));

    const candidateAuditLogs = relevantClassIds.length
      ? await prisma.auditLog.findMany({
          where: {
            classId: {
              in: relevantClassIds
            },
            action: {
              in: ["homework.record.create", "homework.record.revert"]
            }
          },
          select: {
            id: true,
            action: true,
            targetId: true,
            afterData: true,
            createdAt: true
          }
        })
      : [];

    const auditLogIds = candidateAuditLogs
      .filter(
        (item) =>
          matchesHomeworkCreateAudit(item, originalIds) || matchesHomeworkRevertAudit(item, originalIds, revertIdSet)
      )
      .map((item) => item.id);

    const summary = {
      mode: args.apply ? "apply" : "dry-run",
      subjectPrefix: args.subjectPrefix,
      matched: {
        originalTransactions: originalTransactions.length,
        revertTransactions: revertTransactions.length,
        auditLogs: auditLogIds.length
      },
      deleted: {
        auditLogs: 0,
        originalTransactions: 0,
        revertTransactions: 0
      },
      remainingAfterApply: null,
      originals: originalTransactions.map((item) => ({
        id: item.id,
        classId: item.classId,
        studentId: item.studentId,
        pointAccountId: item.pointAccountId,
        reason: item.reason,
        occurredAt: item.occurredAt,
        revertedByTransactionId: item.revertedByTransactionId
      })),
      reverts: revertTransactions.map((item) => ({
        id: item.id,
        classId: item.classId,
        studentId: item.studentId,
        pointAccountId: item.pointAccountId,
        reason: item.reason,
        occurredAt: item.occurredAt
      }))
    };

    if (args.apply && (originalTransactions.length > 0 || revertTransactions.length > 0 || auditLogIds.length > 0)) {
      await prisma.$transaction(async (tx) => {
        if (auditLogIds.length > 0) {
          const deletedAuditLogs = await tx.auditLog.deleteMany({
            where: {
              id: {
                in: auditLogIds
              }
            }
          });
          summary.deleted.auditLogs = deletedAuditLogs.count;
        }

        if (originalTransactions.length > 0) {
          const deletedOriginals = await tx.pointTransaction.deleteMany({
            where: {
              id: {
                in: originalTransactions.map((item) => item.id)
              }
            }
          });
          summary.deleted.originalTransactions = deletedOriginals.count;
        }

        if (revertTransactions.length > 0) {
          const deletedReverts = await tx.pointTransaction.deleteMany({
            where: {
              id: {
                in: revertTransactions.map((item) => item.id)
              }
            }
          });
          summary.deleted.revertTransactions = deletedReverts.count;
        }
      });

      summary.remainingAfterApply = {
        originalTransactions: await prisma.pointTransaction.count({
          where: {
            sourceModule: "homework_record",
            isReverted: true,
            reason: {
              startsWith: args.subjectPrefix
            }
          }
        }),
        revertTransactions: await prisma.pointTransaction.count({
          where: {
            sourceModule: "homework_record_revert",
            reason: {
              startsWith: `撤销作业记录: ${args.subjectPrefix}`
            }
          }
        }),
        auditLogs:
          auditLogIds.length > 0
            ? await prisma.auditLog.count({
                where: {
                  id: {
                    in: auditLogIds
                  }
                }
              })
            : 0
      };
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
