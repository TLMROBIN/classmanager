const { PrismaClient } = require("@prisma/client");

function parseArgs(argv) {
  const args = {
    apply: false,
    usernamePrefix: "invite_reg_"
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--apply") {
      args.apply = true;
      continue;
    }

    if (token === "--username-prefix") {
      args.usernamePrefix = argv[index + 1] || args.usernamePrefix;
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

async function main() {
  const args = parseArgs(process.argv);
  ensurePostgresDatabaseUrl();

  const prisma = new PrismaClient();

  try {
    const users = await prisma.user.findMany({
      where: {
        username: {
          startsWith: args.usernamePrefix
        }
      },
      orderBy: {
        createdAt: "asc"
      },
      select: {
        id: true,
        username: true,
        email: true,
        status: true,
        createdAt: true,
        memberships: {
          select: {
            id: true,
            tenantId: true,
            status: true
          }
        }
      }
    });

    const membershipIds = users.flatMap((user) => user.memberships.map((membership) => membership.id));
    const auditLogCount = membershipIds.length
      ? await prisma.auditLog.count({
          where: {
            targetType: "membership",
            targetId: {
              in: membershipIds
            }
          }
        })
      : 0;

    const summary = {
      mode: args.apply ? "apply" : "dry-run",
      usernamePrefix: args.usernamePrefix,
      usersMatched: users.length,
      membershipsMatched: membershipIds.length,
      auditLogsMatched: auditLogCount,
      deleted: {
        auditLogs: 0,
        memberships: 0,
        users: 0
      },
      remainingAfterApply: null,
      users: users.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
        memberships: user.memberships
      }))
    };

    if (args.apply && users.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (membershipIds.length > 0) {
          const deletedAuditLogs = await tx.auditLog.deleteMany({
            where: {
              targetType: "membership",
              targetId: {
                in: membershipIds
              }
            }
          });
          summary.deleted.auditLogs = deletedAuditLogs.count;

          const deletedMemberships = await tx.membership.deleteMany({
            where: {
              id: {
                in: membershipIds
              }
            }
          });
          summary.deleted.memberships = deletedMemberships.count;
        }

        const deletedUsers = await tx.user.deleteMany({
          where: {
            id: {
              in: users.map((user) => user.id)
            }
          }
        });
        summary.deleted.users = deletedUsers.count;
      });

      const remainingUsers = await prisma.user.count({
        where: {
          username: {
            startsWith: args.usernamePrefix
          }
        }
      });
      const remainingMemberships = await prisma.membership.count({
        where: {
          user: {
            username: {
              startsWith: args.usernamePrefix
            }
          }
        }
      });
      const remainingAuditLogs = membershipIds.length
        ? await prisma.auditLog.count({
            where: {
              targetType: "membership",
              targetId: {
                in: membershipIds
              }
            }
          })
        : 0;

      summary.remainingAfterApply = {
        users: remainingUsers,
        memberships: remainingMemberships,
        auditLogs: remainingAuditLogs
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
