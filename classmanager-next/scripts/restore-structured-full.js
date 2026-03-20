const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const workspaceRoot = path.resolve(__dirname, "..");
const structuredExportDir = path.join(workspaceRoot, "out", "structured-exports");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function parseArgs(argv) {
  const args = {
    input: "",
    apply: false,
    confirm: "",
    classId: ""
  };

  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--input") {
      args.input = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--confirm") {
      args.confirm = argv[index + 1] || "";
      index += 1;
      continue;
    }
    if (token === "--class-id") {
      args.classId = argv[index + 1] || "";
      index += 1;
    }
  }

  return args;
}

function getInputFile(input) {
  if (!input) {
    throw new Error("Use --input <structured-full-export.json>");
  }

  const candidatePaths = path.isAbsolute(input)
    ? [input]
    : [path.resolve(process.cwd(), input), path.join(structuredExportDir, input)];

  const filePath = candidatePaths.find((item) => fs.existsSync(item));
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error(`Structured export file not found: ${candidatePaths.join(" | ")}`);
  }
  return filePath;
}

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseRequiredDate(value, fallbackLabel) {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    throw new Error(`Invalid date value for ${fallbackLabel}`);
  }
  return parsed;
}

function parseDecimal(value, fallback = "0") {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value);
}

function parseOptionalBigInt(value) {
  if (value == null || value === "") {
    return null;
  }
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function normalizeOptionalString(value) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function buildAvatarMappingMetadata(profile) {
  const raw = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
  const avatarData = {
    happy: normalizeOptionalString(raw.avatarHappyData),
    normal: normalizeOptionalString(raw.avatarNormalData),
    sad: normalizeOptionalString(raw.avatarSadData)
  };

  if (!avatarData.happy && !avatarData.normal && !avatarData.sad) {
    return null;
  }

  return {
    source: "structured-full-restore",
    avatarData
  };
}

function ensureValidFullExport(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Backup payload must be a JSON object");
  }

  if (data.exportType !== "full") {
    throw new Error("Only full structured exports can be restored");
  }

  if (!data.class || typeof data.class !== "object") {
    throw new Error("Backup payload is missing class metadata");
  }

  if (!data.settings || typeof data.settings !== "object") {
    throw new Error("Backup payload is missing settings block");
  }

  if (!Array.isArray(data.students)) {
    throw new Error("Backup payload is missing students block");
  }

  if (!data.points || typeof data.points !== "object" || !Array.isArray(data.points.transactions)) {
    throw new Error("Backup payload is missing points block");
  }

  if (
    !data.attendance ||
    typeof data.attendance !== "object" ||
    !Array.isArray(data.attendance.sessions) ||
    !Array.isArray(data.attendance.records)
  ) {
    throw new Error("Backup payload is missing attendance block");
  }

  if (data.filters && (data.filters.dateFrom || data.filters.dateTo)) {
    throw new Error("Filtered full export cannot be used as full restore backup");
  }
}

function getTargetClassId(args, data) {
  return args.classId || data.class?.id || "";
}

function getExpectedConfirmToken(targetClassId) {
  return targetClassId ? `STRUCTURED_FULL_RESTORE:${targetClassId}` : null;
}

function ensureApplyEnvironment(args) {
  if (!args.apply) return;

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

function ensureApplyConfirm(args, targetClassId) {
  if (!args.apply) return;

  const expected = getExpectedConfirmToken(targetClassId);
  if (!expected) {
    throw new Error("Target class id is required for apply mode");
  }

  if (args.confirm !== expected) {
    throw new Error(`Refusing to write. Re-run with --confirm ${expected}`);
  }
}

function buildPlan(data, filePath, targetClassId) {
  return {
    filePath,
    targetClassId: targetClassId || data.class?.id || null,
    targetClassName: data.class?.name || null,
    exportedAt: data.exportedAt || null,
    counts: {
      groups: Array.isArray(data.settings?.groups) ? data.settings.groups.length : 0,
      dormitories: Array.isArray(data.settings?.dormitories) ? data.settings.dormitories.length : 0,
      positions: Array.isArray(data.settings?.positions) ? data.settings.positions.length : 0,
      reasonTemplates: Array.isArray(data.settings?.reasonTemplates) ? data.settings.reasonTemplates.length : 0,
      featureFlags: Array.isArray(data.settings?.featureFlags) ? data.settings.featureFlags.length : 0,
      attendanceSchedules: Array.isArray(data.settings?.attendanceSchedules) ? data.settings.attendanceSchedules.length : 0,
      students: Array.isArray(data.students) ? data.students.length : 0,
      pointTransactions: Array.isArray(data.points?.transactions) ? data.points.transactions.length : 0,
      attendanceSessions: Array.isArray(data.attendance?.sessions) ? data.attendance.sessions.length : 0,
      attendanceRecords: Array.isArray(data.attendance?.records) ? data.attendance.records.length : 0
    },
    limitations: [
      "结构化 full 导出 v1 不包含后台成员、审计日志、导入导出任务，不在本次恢复范围内。",
      "作业数据由积分流水派生展示，没有独立恢复块；恢复积分流水后作业视图会随之恢复。"
    ]
  };
}

async function resolveTargetClass(prisma, data, args) {
  const targetClassId = getTargetClassId(args, data);
  if (targetClassId) {
    const classRecord = await prisma.class.findUnique({
      where: { id: targetClassId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        code: true,
        timezone: true,
        tenant: {
          select: {
            id: true,
            slug: true,
            name: true
          }
        }
      }
    });
    if (classRecord) {
      return classRecord;
    }
  }

  if (!data.tenant?.slug || !data.class?.name) {
    throw new Error("Target class not found and backup payload has no tenant/class fallback");
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug: data.tenant.slug },
    select: { id: true, slug: true, name: true }
  });
  if (!tenant) {
    throw new Error(`Target tenant not found: ${data.tenant.slug}`);
  }

  const classRecord = await prisma.class.findUnique({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: data.class.name
      }
    },
    select: {
      id: true,
      tenantId: true,
      name: true,
      code: true,
      timezone: true,
      tenant: {
        select: {
          id: true,
          slug: true,
          name: true
        }
      }
    }
  });

  if (!classRecord) {
    throw new Error(`Target class not found: ${data.class.name}`);
  }

  return classRecord;
}

async function restoreStructuredFull(prisma, classRecord, data, sourceFilename) {
  const backupStudentIds = new Set((data.students || []).map((item) => item.id).filter(Boolean));
  const targetLegacyScope = normalizeOptionalString(classRecord?.tenant?.slug) || normalizeOptionalString(data.tenant?.slug);
  const structuredFullAvatarScope = `structured-full:${classRecord.id}`;
  const legacyImportedEntityTypes = [
    "group",
    "dormitory",
    "position",
    "student",
    "student_avatar",
    "point_transaction",
    "attendance_session",
    "attendance_record"
  ];

  return prisma.$transaction(async (tx) => {
    const importJob = await tx.importJob.create({
      data: {
        tenantId: classRecord.tenantId,
        classId: classRecord.id,
        jobType: "structured_full_restore",
        status: "running",
        sourceFilename,
        summary: {
          exportedAt: data.exportedAt || null,
          counts: buildPlan(data, sourceFilename, classRecord.id).counts,
          limitations: buildPlan(data, sourceFilename, classRecord.id).limitations
        }
      }
    });

    if (data.tenant?.name) {
      await tx.tenant.update({
        where: { id: classRecord.tenantId },
        data: {
          name: String(data.tenant.name)
        }
      });
    }

    await tx.class.update({
      where: { id: classRecord.id },
      data: {
        name: data.class?.name ? String(data.class.name) : classRecord.name,
        code: data.class?.code == null ? null : String(data.class.code) || null,
        timezone: data.class?.timezone ? String(data.class.timezone) : classRecord.timezone
      }
    });

    const currentStudents = await tx.student.findMany({
      where: { classId: classRecord.id },
      select: { id: true }
    });
    const currentStudentIds = currentStudents.map((item) => item.id);

    await tx.migrationMapping.deleteMany({
      where: {
        tenantId: classRecord.tenantId,
        OR: [
          {
            entityType: "student_avatar",
            legacyScope: structuredFullAvatarScope
          },
          ...(targetLegacyScope
            ? [
                {
                  entityType: {
                    in: legacyImportedEntityTypes
                  },
                  legacyScope: targetLegacyScope
                }
              ]
            : [])
        ]
      }
    });

    await tx.attendanceRecord.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.attendanceSession.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.pointTransaction.deleteMany({
      where: { classId: classRecord.id }
    });

    if (currentStudentIds.length > 0) {
      await tx.studentPositionAssignment.deleteMany({
        where: {
          studentId: {
            in: currentStudentIds
          }
        }
      });

      await tx.studentDormAssignment.deleteMany({
        where: {
          studentId: {
            in: currentStudentIds
          }
        }
      });

      await tx.studentGroupAssignment.deleteMany({
        where: {
          studentId: {
            in: currentStudentIds
          }
        }
      });

      await tx.pointAccount.deleteMany({
        where: {
          studentId: {
            in: currentStudentIds
          }
        }
      });
      await tx.studentProfile.deleteMany({
        where: {
          studentId: {
            in: currentStudentIds
          }
        }
      });
      await tx.migrationMapping.deleteMany({
        where: {
          tenantId: classRecord.tenantId,
          entityType: "student_avatar",
          newId: {
            in: currentStudentIds
          }
        }
      });
    }

    if (backupStudentIds.size > 0) {
      await tx.student.deleteMany({
        where: {
          classId: classRecord.id,
          id: {
            notIn: Array.from(backupStudentIds)
          }
        }
      });
    } else {
      await tx.student.deleteMany({
        where: { classId: classRecord.id }
      });
    }

    await tx.pointReasonTemplate.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.attendanceSchedule.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.featureFlag.deleteMany({
      where: {
        tenantId: classRecord.tenantId,
        classId: classRecord.id
      }
    });

    await tx.position.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.dormitory.deleteMany({
      where: { classId: classRecord.id }
    });

    await tx.group.deleteMany({
      where: { classId: classRecord.id }
    });

    if (data.settings?.classConfig) {
      await tx.classConfig.upsert({
        where: { classId: classRecord.id },
        update: {
          tenantId: classRecord.tenantId,
          className: String(data.settings.classConfig.className || data.class?.name || classRecord.name),
          timezone: String(data.settings.classConfig.timezone || data.class?.timezone || classRecord.timezone),
          isFrozen: Boolean(data.settings.classConfig.isFrozen),
          scheduleNotes:
            data.settings.classConfig.scheduleNotes && typeof data.settings.classConfig.scheduleNotes === "object"
              ? data.settings.classConfig.scheduleNotes
              : {},
          countdownEvents: Array.isArray(data.settings.classConfig.countdownEvents)
            ? data.settings.classConfig.countdownEvents
            : [],
          extra:
            data.settings.classConfig.extra && typeof data.settings.classConfig.extra === "object"
              ? data.settings.classConfig.extra
              : {}
        },
        create: {
          classId: classRecord.id,
          tenantId: classRecord.tenantId,
          className: String(data.settings.classConfig.className || data.class?.name || classRecord.name),
          timezone: String(data.settings.classConfig.timezone || data.class?.timezone || classRecord.timezone),
          isFrozen: Boolean(data.settings.classConfig.isFrozen),
          scheduleNotes:
            data.settings.classConfig.scheduleNotes && typeof data.settings.classConfig.scheduleNotes === "object"
              ? data.settings.classConfig.scheduleNotes
              : {},
          countdownEvents: Array.isArray(data.settings.classConfig.countdownEvents)
            ? data.settings.classConfig.countdownEvents
            : [],
          extra:
            data.settings.classConfig.extra && typeof data.settings.classConfig.extra === "object"
              ? data.settings.classConfig.extra
              : {}
        }
      });
    } else {
      await tx.classConfig.deleteMany({
        where: { classId: classRecord.id }
      });
    }

    if (data.settings?.attendancePolicy) {
      await tx.attendancePolicy.upsert({
        where: { classId: classRecord.id },
        update: {
          tenantId: classRecord.tenantId,
          latePenaltyValue: parseDecimal(data.settings.attendancePolicy.latePenaltyValue, "-1"),
          absentPenaltyValue: parseDecimal(data.settings.attendancePolicy.absentPenaltyValue, "-5"),
          perfectAttendanceBonusValue: parseDecimal(data.settings.attendancePolicy.perfectAttendanceBonusValue, "10"),
          weekendRules:
            data.settings.attendancePolicy.weekendRules &&
            typeof data.settings.attendancePolicy.weekendRules === "object"
              ? data.settings.attendancePolicy.weekendRules
              : {},
          specialRules:
            data.settings.attendancePolicy.specialRules &&
            typeof data.settings.attendancePolicy.specialRules === "object"
              ? data.settings.attendancePolicy.specialRules
              : {},
          isFrozen: Boolean(data.settings.attendancePolicy.isFrozen)
        },
        create: {
          classId: classRecord.id,
          tenantId: classRecord.tenantId,
          latePenaltyValue: parseDecimal(data.settings.attendancePolicy.latePenaltyValue, "-1"),
          absentPenaltyValue: parseDecimal(data.settings.attendancePolicy.absentPenaltyValue, "-5"),
          perfectAttendanceBonusValue: parseDecimal(data.settings.attendancePolicy.perfectAttendanceBonusValue, "10"),
          weekendRules:
            data.settings.attendancePolicy.weekendRules &&
            typeof data.settings.attendancePolicy.weekendRules === "object"
              ? data.settings.attendancePolicy.weekendRules
              : {},
          specialRules:
            data.settings.attendancePolicy.specialRules &&
            typeof data.settings.attendancePolicy.specialRules === "object"
              ? data.settings.attendancePolicy.specialRules
              : {},
          isFrozen: Boolean(data.settings.attendancePolicy.isFrozen)
        }
      });
    } else {
      await tx.attendancePolicy.deleteMany({
        where: { classId: classRecord.id }
      });
    }

    for (const group of data.settings?.groups || []) {
      await tx.group.create({
        data: {
          id: group.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          legacyKey: group.legacyKey == null ? null : String(group.legacyKey) || null,
          name: String(group.name),
          colorToken: group.colorToken == null ? null : String(group.colorToken) || null,
          displayOrder: Number.isFinite(Number(group.displayOrder)) ? Number(group.displayOrder) : 0,
          isActive: group.isActive == null ? true : Boolean(group.isActive)
        }
      });
    }

    for (const dormitory of data.settings?.dormitories || []) {
      await tx.dormitory.create({
        data: {
          id: dormitory.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          legacyKey: dormitory.legacyKey == null ? null : String(dormitory.legacyKey) || null,
          name: String(dormitory.name),
          building: dormitory.building == null ? null : String(dormitory.building) || null,
          genderScope: dormitory.genderScope == null ? null : String(dormitory.genderScope) || null,
          displayOrder: Number.isFinite(Number(dormitory.displayOrder)) ? Number(dormitory.displayOrder) : 0,
          isActive: dormitory.isActive == null ? true : Boolean(dormitory.isActive)
        }
      });
    }

    for (const position of data.settings?.positions || []) {
      await tx.position.create({
        data: {
          id: position.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          code: String(position.code),
          name: String(position.name),
          category: String(position.category || "default"),
          displayOrder: Number.isFinite(Number(position.displayOrder)) ? Number(position.displayOrder) : 0,
          isActive: position.isActive == null ? true : Boolean(position.isActive)
        }
      });
    }

    for (const student of data.students || []) {
      await tx.student.upsert({
        where: { id: student.id },
        update: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          legacyId: student.legacyId == null ? null : BigInt(String(student.legacyId)),
          studentNo: student.studentNo == null ? null : String(student.studentNo) || null,
          name: String(student.name),
          gender: student.gender == null ? null : String(student.gender) || null,
          status: student.status == null ? "active" : String(student.status),
          sortOrder: Number.isFinite(Number(student.sortOrder)) ? Number(student.sortOrder) : 0,
          joinedAt: parseOptionalDate(student.joinedAt),
          leftAt: parseOptionalDate(student.leftAt)
        },
        create: {
          id: student.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          legacyId: student.legacyId == null ? null : BigInt(String(student.legacyId)),
          studentNo: student.studentNo == null ? null : String(student.studentNo) || null,
          name: String(student.name),
          gender: student.gender == null ? null : String(student.gender) || null,
          status: student.status == null ? "active" : String(student.status),
          sortOrder: Number.isFinite(Number(student.sortOrder)) ? Number(student.sortOrder) : 0,
          joinedAt: parseOptionalDate(student.joinedAt),
          leftAt: parseOptionalDate(student.leftAt)
        }
      });

      const profile = student.profile && typeof student.profile === "object" && !Array.isArray(student.profile)
        ? student.profile
        : null;
      const titleLeft = normalizeOptionalString(profile?.titleLeft);
      const titleRight = normalizeOptionalString(profile?.titleRight);
      const notes = normalizeOptionalString(profile?.notes);
      const avatarMetadata = buildAvatarMappingMetadata(profile);

      if (titleLeft || titleRight || notes) {
        await tx.studentProfile.create({
          data: {
            studentId: student.id,
            titleLeft,
            titleRight,
            notes
          }
        });
      }

      if (avatarMetadata) {
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: classRecord.tenantId,
              entityType: "student_avatar",
              legacyScope: `structured-full:${classRecord.id}`,
              legacyKey: String(student.id)
            }
          },
          update: {
            newId: String(student.id),
            metadata: avatarMetadata
          },
          create: {
            tenantId: classRecord.tenantId,
            entityType: "student_avatar",
            legacyScope: `structured-full:${classRecord.id}`,
            legacyKey: String(student.id),
            newId: String(student.id),
            metadata: avatarMetadata
          }
        });
      }
    }

    const pointAccountIdByStudentId = new Map();
    for (const student of data.students || []) {
      const account = student.account || {};
      const created = await tx.pointAccount.create({
        data: {
          tenantId: classRecord.tenantId,
          studentId: student.id,
          totalPoints: parseDecimal(account.totalPoints, "0"),
          balancePoints: parseDecimal(account.balancePoints, "0"),
          penaltyPoints: parseDecimal(account.penaltyPoints, "0"),
          version: Number.isFinite(Number(account.version)) ? Number(account.version) : 0
        }
      });
      pointAccountIdByStudentId.set(student.id, created.id);

      for (const groupAssignment of student.groups || []) {
        if (!groupAssignment.group?.id) continue;
        await tx.studentGroupAssignment.create({
          data: {
            tenantId: classRecord.tenantId,
            studentId: student.id,
            groupId: groupAssignment.group.id,
            roleCode: groupAssignment.roleCode == null ? null : String(groupAssignment.roleCode) || null,
            isPrimary: Boolean(groupAssignment.isPrimary),
            startDate: parseOptionalDate(groupAssignment.startDate),
            endDate: parseOptionalDate(groupAssignment.endDate)
          }
        });
      }

      for (const dormAssignment of student.dorms || []) {
        if (!dormAssignment.dormitory?.id) continue;
        await tx.studentDormAssignment.create({
          data: {
            tenantId: classRecord.tenantId,
            studentId: student.id,
            dormitoryId: dormAssignment.dormitory.id,
            isPrimary: Boolean(dormAssignment.isPrimary),
            startDate: parseOptionalDate(dormAssignment.startDate),
            endDate: parseOptionalDate(dormAssignment.endDate)
          }
        });
      }

      for (const positionAssignment of student.positions || []) {
        if (!positionAssignment.position?.id) continue;
        await tx.studentPositionAssignment.create({
          data: {
            tenantId: classRecord.tenantId,
            studentId: student.id,
            positionId: positionAssignment.position.id,
            startDate: parseOptionalDate(positionAssignment.startDate),
            endDate: parseOptionalDate(positionAssignment.endDate)
          }
        });
      }
    }

    const reasonTemplateIds = new Set();
    for (const template of data.settings?.reasonTemplates || []) {
      reasonTemplateIds.add(template.id);
      await tx.pointReasonTemplate.create({
        data: {
          id: template.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          name: String(template.name),
          value: parseDecimal(template.value, "0"),
          transactionType: template.transactionType,
          scene: String(template.scene || "班级"),
          category: String(template.category || "待定"),
          note: template.note == null ? null : String(template.note) || null,
          isEditable: Boolean(template.isEditable),
          isMultiplier: Boolean(template.isMultiplier),
          multiplier: template.multiplier == null ? null : parseDecimal(template.multiplier),
          isActive: template.isActive == null ? true : Boolean(template.isActive),
          displayOrder: Number.isFinite(Number(template.displayOrder)) ? Number(template.displayOrder) : 0,
          legacyName: template.legacyName == null ? null : String(template.legacyName) || null
        }
      });
    }

    for (const featureFlag of data.settings?.featureFlags || []) {
      await tx.featureFlag.create({
        data: {
          id: featureFlag.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          code: String(featureFlag.code),
          enabled: Boolean(featureFlag.enabled),
          config: featureFlag.config && typeof featureFlag.config === "object" ? featureFlag.config : {}
        }
      });
    }

    for (const schedule of data.settings?.attendanceSchedules || []) {
      await tx.attendanceSchedule.create({
        data: {
          id: schedule.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          code: String(schedule.code),
          name: String(schedule.name),
          startTime: parseRequiredDate(schedule.startTime, `attendance schedule ${schedule.code} startTime`),
          endTime: parseRequiredDate(schedule.endTime, `attendance schedule ${schedule.code} endTime`),
          lateTime: parseRequiredDate(schedule.lateTime, `attendance schedule ${schedule.code} lateTime`),
          displayOrder: Number.isFinite(Number(schedule.displayOrder)) ? Number(schedule.displayOrder) : 0,
          isActive: schedule.isActive == null ? true : Boolean(schedule.isActive)
        }
      });
    }

    const backupTransactionIds = new Set();
    for (const item of data.points?.transactions || []) {
      backupTransactionIds.add(item.id);
      await tx.pointTransaction.create({
        data: {
          id: item.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          studentId: item.studentId,
          pointAccountId: pointAccountIdByStudentId.get(item.studentId),
          transactionType: item.transactionType,
          value: parseDecimal(item.value, "0"),
          reason: String(item.reason || ""),
          scene: String(item.scene || "班级"),
          category: String(item.category || "待定"),
          sourceModule: String(item.sourceModule || "manual"),
          sourceType: item.sourceType == null ? null : String(item.sourceType) || null,
          sourceId: item.sourceId == null ? null : String(item.sourceId) || null,
          batchId: item.batchId == null ? null : String(item.batchId) || null,
          reasonTemplateId:
            item.reasonTemplateId && reasonTemplateIds.has(item.reasonTemplateId) ? item.reasonTemplateId : null,
          actorUserId: null,
          actorMembershipId: null,
          occurredAt: parseRequiredDate(item.occurredAt, `point transaction ${item.id} occurredAt`),
          isReverted: Boolean(item.isReverted),
          revertedByTransactionId: null,
          legacyNumericId: item.legacyNumericId == null ? null : parseDecimal(item.legacyNumericId),
          legacySnapshot: null,
          metadata: item.metadata && typeof item.metadata === "object" ? item.metadata : {}
        }
      });
    }

    for (const item of data.points?.transactions || []) {
      if (!item.revertedByTransactionId || !backupTransactionIds.has(item.revertedByTransactionId)) {
        continue;
      }
      await tx.pointTransaction.update({
        where: { id: item.id },
        data: {
          revertedByTransactionId: item.revertedByTransactionId
        }
      });
    }

    for (const session of data.attendance?.sessions || []) {
      await tx.attendanceSession.create({
        data: {
          id: session.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          scheduleId: session.scheduleId,
          sessionDate: parseRequiredDate(session.sessionDate, `attendance session ${session.id} sessionDate`),
          sessionCode: String(session.sessionCode),
          plannedStartAt: parseOptionalDate(session.plannedStartAt),
          plannedEndAt: parseOptionalDate(session.plannedEndAt),
          lateDeadlineAt: parseOptionalDate(session.lateDeadlineAt),
          status: session.status
        }
      });
    }

    for (const record of data.attendance?.records || []) {
      await tx.attendanceRecord.create({
        data: {
          id: record.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          attendanceSessionId: record.attendanceSessionId,
          studentId: record.studentId,
          status: record.status,
          checkInAt: parseOptionalDate(record.checkInAt),
          recordedAt: parseRequiredDate(record.recordedAt, `attendance record ${record.id} recordedAt`),
          source: record.source == null ? "manual" : String(record.source),
          note: record.note == null ? null : String(record.note) || null,
          pointTransactionId:
            record.pointTransactionId && backupTransactionIds.has(record.pointTransactionId)
              ? record.pointTransactionId
              : null,
          actorUserId: null,
          actorMembershipId: null,
          legacyStudentName:
            record.legacyStudentName == null ? null : String(record.legacyStudentName) || null,
          legacyTimestamp: parseOptionalBigInt(record.legacyTimestamp)
        }
      });
    }

    await tx.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        summary: {
          ...buildPlan(data, sourceFilename, classRecord.id),
          restoredAt: new Date().toISOString(),
          restoredStudentProfiles: "学生标题、备注与头像映射按备份内容恢复；备份缺失的资料不会从当前库补推"
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: classRecord.tenantId,
        classId: classRecord.id,
        action: "backup.structured_full_restore",
        targetType: "class",
        targetId: classRecord.id,
        metadata: {
          importJobId: importJob.id,
          sourceFilename,
          exportedAt: data.exportedAt || null
        },
        afterData: {
          classId: classRecord.id,
          className: data.class?.name || classRecord.name,
          restoredCounts: buildPlan(data, sourceFilename, classRecord.id).counts
        }
      }
    });

    return {
      classId: classRecord.id,
      importJobId: importJob.id,
      counts: buildPlan(data, sourceFilename, classRecord.id).counts
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = getInputFile(args.input);
  const data = readJson(filePath);
  ensureValidFullExport(data);
  const requestedTargetClassId = getTargetClassId(args, data);
  const expectedConfirmToken = getExpectedConfirmToken(requestedTargetClassId);
  const plan = buildPlan(data, filePath, requestedTargetClassId);

  if (!args.apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          requestedTargetClassId: requestedTargetClassId || null,
          confirmToken: expectedConfirmToken,
          ...plan
        },
        null,
        2
      )
    );
    return;
  }

  ensureApplyEnvironment(args);

  const prisma = new PrismaClient();
  try {
    const classRecord = await resolveTargetClass(prisma, data, args);
    ensureApplyConfirm(args, classRecord.id);
    const result = await restoreStructuredFull(prisma, classRecord, data, path.basename(filePath));
    console.log(
      JSON.stringify(
        {
          mode: "apply",
          classId: classRecord.id,
          tenantId: classRecord.tenantId,
          importJobId: result.importJobId,
          counts: result.counts
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
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
