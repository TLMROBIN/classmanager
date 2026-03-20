const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const workspaceRoot = path.resolve(__dirname, "..");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = {
    input: "",
    apply: false,
    confirm: ""
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
      continue;
    }
    if (token === "--confirm") {
      args.confirm = argv[i + 1] || "";
      i += 1;
    }
  }

  return args;
}

function getInputFile(input) {
  if (!input) {
    throw new Error("Use --input <normalized-file>");
  }

  const candidatePaths = path.isAbsolute(input)
    ? [input]
    : [path.resolve(process.cwd(), input), path.join(normalizedDir, input)];

  const filePath = candidatePaths.find((item) => fs.existsSync(item));
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Normalized file not found: ${candidatePaths.join(" | ")}`);
  }
  return filePath;
}

function getExpectedConfirmToken(data) {
  return `ATTENDANCE_PHASE2:${data.tenant.slug}`;
}

function ensureApplyGuard(args, data) {
  if (!args.apply) return;

  const expected = getExpectedConfirmToken(data);
  if (args.confirm !== expected) {
    throw new Error(`Refusing to write. Re-run with --confirm ${expected}`);
  }

  const databaseUrl = process.env.DATABASE_URL || "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for --apply");
  }
  if (!databaseUrl.startsWith("postgresql://") && !databaseUrl.startsWith("postgres://")) {
    throw new Error("Refusing to write because DATABASE_URL is not PostgreSQL");
  }
  if (databaseUrl.includes("classmanager.db") || databaseUrl.includes("sqlite")) {
    throw new Error("Refusing to write because DATABASE_URL appears to target legacy storage");
  }
}

function buildPlan(data) {
  return {
    tenant: data.tenant,
    class: data.class,
    counts: {
      attendanceSchedules: (data.attendanceSchedules || []).length,
      attendanceSessions: (data.attendanceSessions || []).length,
      attendanceRecords: (data.attendanceRecords || []).length
    }
  };
}

function normalizeAttendanceStatus(value) {
  if (value === "ok") return "present";
  if (value === "late") return "late";
  if (value === "absent") return "absent";
  if (value === "excused") return "excused";
  return "present";
}

function parseOptionalDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseRecordedAt(value) {
  const parsed = parseOptionalDate(value);
  return parsed || new Date();
}

async function findMappedEntityId(tx, tenantId, entityType, legacyScope, legacyKey) {
  if (!legacyKey) {
    return null;
  }

  const mapping = await tx.migrationMapping.findUnique({
    where: {
      tenantId_entityType_legacyScope_legacyKey: {
        tenantId,
        entityType,
        legacyScope,
        legacyKey
      }
    },
    select: {
      newId: true
    }
  });

  return mapping?.newId || null;
}

async function deleteOtherEntityMappings(tx, tenantId, entityType, legacyScope, newId, keepLegacyKey) {
  if (!newId) {
    return;
  }

  const where = {
    tenantId,
    entityType,
    legacyScope,
    newId
  };

  if (keepLegacyKey) {
    where.legacyKey = {
      not: keepLegacyKey
    };
  }

  await tx.migrationMapping.deleteMany({ where });
}

async function deleteStaleImportedMappings(tx, input) {
  const { tenantId, entityType, legacyScope, activeLegacyKeys } = input;
  const mappings = await tx.migrationMapping.findMany({
    where: {
      tenantId,
      entityType,
      legacyScope
    },
    select: {
      legacyKey: true,
      newId: true
    }
  });

  const staleMappings = mappings.filter((item) => !activeLegacyKeys.has(item.legacyKey));
  if (!staleMappings.length) {
    return [];
  }

  const activeEntityIds = new Set(
    mappings
      .filter((item) => activeLegacyKeys.has(item.legacyKey))
      .map((item) => item.newId)
      .filter(Boolean)
  );
  const staleEntityIds = Array.from(
    new Set(
      staleMappings
        .map((item) => item.newId)
        .filter((item) => item && !activeEntityIds.has(item))
    )
  );

  await tx.migrationMapping.deleteMany({
    where: {
      tenantId,
      entityType,
      legacyScope,
      legacyKey: {
        in: staleMappings.map((item) => item.legacyKey)
      }
    }
  });

  return staleEntityIds;
}

async function loadAttendancePhase2(prisma, data, sourceFilename) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { username: data.user.username },
      select: { id: true, username: true }
    });
    if (!user) {
      throw new Error(`User not found in new system: ${data.user.username}`);
    }

    const tenant = await tx.tenant.findUnique({
      where: { slug: data.tenant.slug },
      select: { id: true, slug: true }
    });
    if (!tenant) {
      throw new Error(`Tenant not found in new system: ${data.tenant.slug}`);
    }

    const membership = await tx.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      },
      select: { id: true }
    });
    if (!membership) {
      throw new Error(`Membership not found for user ${data.user.username}`);
    }

    const classRecord = await tx.class.findUnique({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: data.class.name
        }
      },
      select: { id: true, name: true }
    });
    if (!classRecord) {
      throw new Error(`Class not found in new system: ${data.class.name}`);
    }

    const importJob = await tx.importJob.create({
      data: {
        tenantId: tenant.id,
        classId: classRecord.id,
        jobType: "legacy_attendance_phase2_import",
        status: "running",
        sourceFilename,
        triggeredByUserId: user.id,
        summary: {
          sourceUsername: data.meta?.sourceUsername || null,
          sourceUserId: data.meta?.sourceUserId || null,
          counts: {
            attendanceSchedules: (data.attendanceSchedules || []).length,
            attendanceSessions: (data.attendanceSessions || []).length,
            attendanceRecords: (data.attendanceRecords || []).length
          }
        }
      }
    });

    const scheduleIdByCode = new Map(
      (
        await tx.attendanceSchedule.findMany({
          where: {
            classId: classRecord.id
          },
          select: {
            id: true,
            code: true
          }
        })
      ).map((item) => [item.code, item.id])
    );

    const studentMappings = await tx.migrationMapping.findMany({
      where: {
        tenantId: tenant.id,
        entityType: "student",
        legacyScope: data.tenant.slug
      },
      select: {
        legacyKey: true,
        newId: true
      }
    });
    const studentIdByLegacyRef = new Map(studentMappings.map((item) => [item.legacyKey, item.newId]));
    const sessionMappings = await tx.migrationMapping.findMany({
      where: {
        tenantId: tenant.id,
        entityType: "attendance_session",
        legacyScope: data.tenant.slug
      },
      select: {
        legacyKey: true,
        newId: true
      }
    });
    const existingSessionIds = new Set(
      (
        await tx.attendanceSession.findMany({
          where: {
            id: {
              in: sessionMappings.map((item) => item.newId)
            }
          },
          select: {
            id: true
          }
        })
      ).map((item) => item.id)
    );
    const existingSessionMappings = new Map(
      sessionMappings
        .filter((item) => existingSessionIds.has(item.newId))
        .map((item) => [item.legacyKey, item.newId])
    );

    const recordMappings = await tx.migrationMapping.findMany({
      where: {
        tenantId: tenant.id,
        entityType: "attendance_record",
        legacyScope: data.tenant.slug
      },
      select: {
        legacyKey: true,
        newId: true
      }
    });
    const existingRecordIds = new Set(
      (
        await tx.attendanceRecord.findMany({
          where: {
            id: {
              in: recordMappings.map((item) => item.newId)
            }
          },
          select: {
            id: true
          }
        })
      ).map((item) => item.id)
    );
    let importedSessions = 0;
    let updatedSessions = 0;
    let importedRecords = 0;
    let updatedRecords = 0;
    let deletedSessions = 0;
    let deletedRecords = 0;
    let skippedSessions = 0;
    let skippedRecords = 0;

    const activeSessionLegacyKeys = new Set(
      (data.attendanceSessions || []).map((item) => item.legacyKey).filter(Boolean)
    );
    const sessionIdByLegacyKey = new Map();
    for (const item of data.attendanceSessions || []) {
      const scheduleId = scheduleIdByCode.get(item.sessionCode);
      if (!scheduleId) {
        skippedSessions += 1;
        continue;
      }

      const sessionDate = new Date(`${item.sessionDate}T00:00:00.000Z`);
      const mappedSessionId =
        existingSessionMappings.get(item.legacyKey) ||
        (await findMappedEntityId(
          tx,
          tenant.id,
          "attendance_session",
          data.tenant.slug,
          item.legacyKey
        ));

      let existingSession =
        mappedSessionId
          ? await tx.attendanceSession.findFirst({
              where: {
                id: mappedSessionId,
                classId: classRecord.id
              },
              select: {
                id: true
              }
            })
          : null;

      if (!existingSession) {
        existingSession = await tx.attendanceSession.findUnique({
          where: {
            classId_sessionDate_sessionCode: {
              classId: classRecord.id,
              sessionDate,
              sessionCode: item.sessionCode
            }
          },
          select: {
            id: true
          }
        });
      }

      const session =
        existingSession
          ? await tx.attendanceSession.update({
              where: { id: existingSession.id },
              data: {
                scheduleId,
                sessionDate,
                sessionCode: item.sessionCode
              }
            })
          : await tx.attendanceSession.create({
              data: {
                tenantId: tenant.id,
                classId: classRecord.id,
                scheduleId,
                sessionDate,
                sessionCode: item.sessionCode
              }
            });

      sessionIdByLegacyKey.set(item.legacyKey, session.id);
      existingSessionMappings.set(item.legacyKey, session.id);
      await deleteOtherEntityMappings(
        tx,
        tenant.id,
        "attendance_session",
        data.tenant.slug,
        session.id,
        item.legacyKey
      );
      if (existingSession) {
        updatedSessions += 1;
      } else {
        importedSessions += 1;
      }
      await tx.migrationMapping.upsert({
        where: {
          tenantId_entityType_legacyScope_legacyKey: {
            tenantId: tenant.id,
            entityType: "attendance_session",
            legacyScope: data.tenant.slug,
            legacyKey: item.legacyKey
          }
        },
        update: {
          newId: session.id,
          metadata: { source: "legacy-attendance-phase2" }
        },
        create: {
          tenantId: tenant.id,
          entityType: "attendance_session",
          legacyScope: data.tenant.slug,
          legacyKey: item.legacyKey,
          newId: session.id,
          metadata: { source: "legacy-attendance-phase2" }
        }
      });
    }

    const activeRecordLegacyKeys = new Set(
      (data.attendanceRecords || []).map((item) => `${item.sessionLegacyKey}|${item.studentLegacyRef}`)
    );
    const existingRecordMappingsByLegacyKey = new Map(
      recordMappings
        .filter((item) => existingRecordIds.has(item.newId))
        .map((item) => [item.legacyKey, item.newId])
    );
    for (const item of data.attendanceRecords || []) {
      const sessionId = sessionIdByLegacyKey.get(item.sessionLegacyKey);
      const studentId = studentIdByLegacyRef.get(item.studentLegacyRef);
      if (!sessionId || !studentId) {
        skippedRecords += 1;
        continue;
      }

      const recordLegacyKey = `${item.sessionLegacyKey}|${item.studentLegacyRef}`;
      const status = normalizeAttendanceStatus(item.status);
      const checkInAt = parseOptionalDate(item.checkInAt);
      const recordedAt = parseRecordedAt(item.recordedAt);
      const mappedRecordId =
        existingRecordMappingsByLegacyKey.get(recordLegacyKey) ||
        (await findMappedEntityId(
          tx,
          tenant.id,
          "attendance_record",
          data.tenant.slug,
          recordLegacyKey
        ));

      let existingRecord =
        mappedRecordId
          ? await tx.attendanceRecord.findFirst({
              where: {
                id: mappedRecordId,
                classId: classRecord.id
              },
              select: {
                id: true
              }
            })
          : null;

      if (!existingRecord) {
        existingRecord = await tx.attendanceRecord.findUnique({
          where: {
            attendanceSessionId_studentId: {
              attendanceSessionId: sessionId,
              studentId
            }
          },
          select: {
            id: true
          }
        });
      }

      const record =
        existingRecord
          ? await tx.attendanceRecord.update({
              where: { id: existingRecord.id },
              data: {
                attendanceSessionId: sessionId,
                status,
                checkInAt,
                recordedAt,
                source: "legacy_import",
                legacyStudentName: item.legacyStudentName || null,
                legacyTimestamp: item.legacyTimestamp != null ? BigInt(item.legacyTimestamp) : null,
                actorUserId: user.id,
                actorMembershipId: membership.id
              }
            })
          : await tx.attendanceRecord.create({
              data: {
                tenantId: tenant.id,
                classId: classRecord.id,
                attendanceSessionId: sessionId,
                studentId,
                status,
                checkInAt,
                recordedAt,
                source: "legacy_import",
                legacyStudentName: item.legacyStudentName || null,
                legacyTimestamp: item.legacyTimestamp != null ? BigInt(item.legacyTimestamp) : null,
                actorUserId: user.id,
                actorMembershipId: membership.id
              }
            });

      await deleteOtherEntityMappings(
        tx,
        tenant.id,
        "attendance_record",
        data.tenant.slug,
        record.id,
        recordLegacyKey
      );
      if (existingRecord) {
        updatedRecords += 1;
      } else {
        importedRecords += 1;
      }
      existingRecordMappingsByLegacyKey.set(recordLegacyKey, record.id);
      await tx.migrationMapping.upsert({
        where: {
          tenantId_entityType_legacyScope_legacyKey: {
            tenantId: tenant.id,
            entityType: "attendance_record",
            legacyScope: data.tenant.slug,
            legacyKey: recordLegacyKey
          }
        },
        update: {
          newId: record.id,
          metadata: { source: "legacy-attendance-phase2" }
        },
        create: {
          tenantId: tenant.id,
          entityType: "attendance_record",
          legacyScope: data.tenant.slug,
          legacyKey: recordLegacyKey,
          newId: record.id,
          metadata: { source: "legacy-attendance-phase2" }
        }
      });
    }

    const staleRecordIds = await deleteStaleImportedMappings(tx, {
      tenantId: tenant.id,
      entityType: "attendance_record",
      legacyScope: data.tenant.slug,
      activeLegacyKeys: activeRecordLegacyKeys
    });
    if (staleRecordIds.length) {
      const deleted = await tx.attendanceRecord.deleteMany({
        where: {
          classId: classRecord.id,
          id: {
            in: staleRecordIds
          }
        }
      });
      deletedRecords = deleted.count;
    }

    const staleSessionIds = await deleteStaleImportedMappings(tx, {
      tenantId: tenant.id,
      entityType: "attendance_session",
      legacyScope: data.tenant.slug,
      activeLegacyKeys: activeSessionLegacyKeys
    });
    if (staleSessionIds.length) {
      const deleted = await tx.attendanceSession.deleteMany({
        where: {
          classId: classRecord.id,
          id: {
            in: staleSessionIds
          }
        }
      });
      deletedSessions = deleted.count;
    }

    await tx.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        summary: {
          sourceUsername: data.meta?.sourceUsername || null,
          sourceUserId: data.meta?.sourceUserId || null,
          importedSessions,
          updatedSessions,
          deletedSessions,
          importedRecords,
          updatedRecords,
          deletedRecords,
          skippedSessions,
          skippedRecords
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        classId: classRecord.id,
        actorUserId: user.id,
        actorMembershipId: membership.id,
        action: "migration.attendance_phase2_import",
        targetType: "class",
        targetId: classRecord.id,
        metadata: {
          importJobId: importJob.id,
          sourceFilename,
          importedSessions,
          updatedSessions,
          deletedSessions,
          importedRecords,
          updatedRecords,
          deletedRecords,
          skippedSessions,
          skippedRecords
        },
        afterData: {
          tenantSlug: tenant.slug,
          className: classRecord.name
        }
      }
    });

    return {
      tenantId: tenant.id,
      classId: classRecord.id,
      importJobId: importJob.id,
      importedSessions,
      updatedSessions,
      deletedSessions,
      importedRecords,
      updatedRecords,
      deletedRecords,
      skippedSessions,
      skippedRecords
    };
  }, {
    maxWait: 10000,
    timeout: 120000
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = getInputFile(args.input);
  const data = readJson(filePath);
  const plan = buildPlan(data);
  const confirmToken = getExpectedConfirmToken(data);

  if (!args.apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          confirmToken,
          ...plan
        },
        null,
        2
      )
    );
    return;
  }

  ensureApplyGuard(args, data);

  const prisma = new PrismaClient();
  try {
    const result = await loadAttendancePhase2(prisma, data, path.basename(filePath));
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          ...plan,
          result
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
