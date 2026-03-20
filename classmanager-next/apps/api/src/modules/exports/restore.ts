function parseOptionalDate(value: unknown) {
  if (!value) {
    return null;
  }
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseRequiredDate(value: unknown, fallbackLabel: string) {
  const parsed = parseOptionalDate(value);
  if (!parsed) {
    throw new Error(`Invalid date value for ${fallbackLabel}`);
  }
  return parsed;
}

function parseDecimal(value: unknown, fallback = "0") {
  if (value == null || value === "") {
    return fallback;
  }
  return String(value);
}

function parseOptionalBigInt(value: unknown) {
  if (value == null || value === "") {
    return null;
  }
  try {
    return BigInt(String(value));
  } catch {
    return null;
  }
}

function normalizeOptionalString(value: unknown) {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized || null;
}

function buildAvatarMappingMetadata(profile: unknown) {
  const raw = profile && typeof profile === "object" && !Array.isArray(profile) ? (profile as Record<string, unknown>) : {};
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

type StructuredFullBackup = Record<string, unknown> & {
  exportType: "full";
  exportedAt?: string;
  class?: Record<string, unknown>;
  tenant?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  students?: Array<Record<string, unknown>>;
  points?: {
    transactions?: Array<Record<string, unknown>>;
  };
  attendance?: {
    sessions?: Array<Record<string, unknown>>;
    records?: Array<Record<string, unknown>>;
  };
  filters?: {
    dateFrom?: string | null;
    dateTo?: string | null;
  } | null;
};

export function assertStructuredFullBackup(input: unknown): asserts input is StructuredFullBackup {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Backup payload must be a JSON object");
  }

  const backup = input as StructuredFullBackup;
  if (backup.exportType !== "full") {
    throw new Error("Only full structured exports can be restored");
  }

  if (!backup.class || typeof backup.class !== "object") {
    throw new Error("Backup payload is missing class metadata");
  }

  if (!backup.settings || typeof backup.settings !== "object") {
    throw new Error("Backup payload is missing settings block");
  }

  if (!Array.isArray(backup.students)) {
    throw new Error("Backup payload is missing students block");
  }

  if (!backup.points || typeof backup.points !== "object" || !Array.isArray(backup.points.transactions)) {
    throw new Error("Backup payload is missing points block");
  }

  if (
    !backup.attendance ||
    typeof backup.attendance !== "object" ||
    !Array.isArray(backup.attendance.sessions) ||
    !Array.isArray(backup.attendance.records)
  ) {
    throw new Error("Backup payload is missing attendance block");
  }

  if (backup.filters && (backup.filters.dateFrom || backup.filters.dateTo)) {
    throw new Error("Filtered full export cannot be used as full restore backup");
  }
}

export function buildStructuredFullRestorePlan(backup: StructuredFullBackup) {
  return {
    exportedAt: backup.exportedAt || null,
    counts: {
      groups: Array.isArray(backup.settings?.groups) ? backup.settings.groups.length : 0,
      dormitories: Array.isArray(backup.settings?.dormitories) ? backup.settings.dormitories.length : 0,
      positions: Array.isArray(backup.settings?.positions) ? backup.settings.positions.length : 0,
      reasonTemplates: Array.isArray(backup.settings?.reasonTemplates) ? backup.settings.reasonTemplates.length : 0,
      featureFlags: Array.isArray(backup.settings?.featureFlags) ? backup.settings.featureFlags.length : 0,
      attendanceSchedules: Array.isArray(backup.settings?.attendanceSchedules)
        ? backup.settings.attendanceSchedules.length
        : 0,
      students: Array.isArray(backup.students) ? backup.students.length : 0,
      pointTransactions: Array.isArray(backup.points?.transactions) ? backup.points.transactions.length : 0,
      attendanceSessions: Array.isArray(backup.attendance?.sessions) ? backup.attendance.sessions.length : 0,
      attendanceRecords: Array.isArray(backup.attendance?.records) ? backup.attendance.records.length : 0
    },
    limitations: [
      "后台成员、审计日志、导入导出任务不在本次恢复范围内。",
      "作业数据由积分流水派生，恢复积分流水后作业视图会随之恢复。"
    ]
  };
}

export async function restoreStructuredFullBackup(prisma: any, input: {
  backup: StructuredFullBackup;
  classRecord: {
    id: string;
    tenantId: string;
    name: string;
    code: string | null;
    timezone: string;
    tenant?: {
      slug?: string | null;
    } | null;
  };
  actorUserId: string;
  actorMembershipId: string;
  sourceFilename?: string | null;
}) {
  const { backup, classRecord } = input;
  const plan = buildStructuredFullRestorePlan(backup);
  const backupStudentIds = new Set((backup.students || []).map((item) => item.id).filter(Boolean));
  const targetLegacyScope =
    normalizeOptionalString(classRecord.tenant?.slug) ||
    normalizeOptionalString(backup.tenant?.slug) ||
    null;
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

  return prisma.$transaction(async (tx: any) => {
    const importJob = await tx.importJob.create({
      data: {
        tenantId: classRecord.tenantId,
        classId: classRecord.id,
        jobType: "structured_full_restore",
        status: "running",
        sourceFilename: input.sourceFilename || "structured-full-restore.json",
        triggeredByUserId: input.actorUserId,
        summary: {
          exportedAt: plan.exportedAt,
          counts: plan.counts,
          limitations: plan.limitations
        }
      }
    });

    if (backup.tenant?.name) {
      await tx.tenant.update({
        where: { id: classRecord.tenantId },
        data: {
          name: String(backup.tenant.name)
        }
      });
    }

    await tx.class.update({
      where: { id: classRecord.id },
      data: {
        name: backup.class?.name ? String(backup.class.name) : classRecord.name,
        code: backup.class?.code == null ? null : String(backup.class.code) || null,
        timezone: backup.class?.timezone ? String(backup.class.timezone) : classRecord.timezone
      }
    });

    const currentStudents = await tx.student.findMany({
      where: { classId: classRecord.id },
      select: { id: true }
    });
    const currentStudentIds = currentStudents.map((item: { id: string }) => item.id);

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

    const settings = backup.settings && typeof backup.settings === "object" ? backup.settings : {};
    const classConfig = settings.classConfig && typeof settings.classConfig === "object" ? settings.classConfig : null;
    const attendancePolicy =
      settings.attendancePolicy && typeof settings.attendancePolicy === "object" ? settings.attendancePolicy : null;

    if (classConfig) {
      await tx.classConfig.upsert({
        where: { classId: classRecord.id },
        update: {
          tenantId: classRecord.tenantId,
          className: String(classConfig.className || backup.class?.name || classRecord.name),
          timezone: String(classConfig.timezone || backup.class?.timezone || classRecord.timezone),
          isFrozen: Boolean(classConfig.isFrozen),
          scheduleNotes:
            classConfig.scheduleNotes && typeof classConfig.scheduleNotes === "object"
              ? classConfig.scheduleNotes
              : {},
          countdownEvents: Array.isArray(classConfig.countdownEvents) ? classConfig.countdownEvents : [],
          extra: classConfig.extra && typeof classConfig.extra === "object" ? classConfig.extra : {}
        },
        create: {
          classId: classRecord.id,
          tenantId: classRecord.tenantId,
          className: String(classConfig.className || backup.class?.name || classRecord.name),
          timezone: String(classConfig.timezone || backup.class?.timezone || classRecord.timezone),
          isFrozen: Boolean(classConfig.isFrozen),
          scheduleNotes:
            classConfig.scheduleNotes && typeof classConfig.scheduleNotes === "object"
              ? classConfig.scheduleNotes
              : {},
          countdownEvents: Array.isArray(classConfig.countdownEvents) ? classConfig.countdownEvents : [],
          extra: classConfig.extra && typeof classConfig.extra === "object" ? classConfig.extra : {}
        }
      });
    } else {
      await tx.classConfig.deleteMany({
        where: { classId: classRecord.id }
      });
    }

    if (attendancePolicy) {
      await tx.attendancePolicy.upsert({
        where: { classId: classRecord.id },
        update: {
          tenantId: classRecord.tenantId,
          latePenaltyValue: parseDecimal(attendancePolicy.latePenaltyValue, "-1"),
          absentPenaltyValue: parseDecimal(attendancePolicy.absentPenaltyValue, "-5"),
          perfectAttendanceBonusValue: parseDecimal(attendancePolicy.perfectAttendanceBonusValue, "10"),
          weekendRules:
            attendancePolicy.weekendRules && typeof attendancePolicy.weekendRules === "object"
              ? attendancePolicy.weekendRules
              : {},
          specialRules:
            attendancePolicy.specialRules && typeof attendancePolicy.specialRules === "object"
              ? attendancePolicy.specialRules
              : {},
          isFrozen: Boolean(attendancePolicy.isFrozen)
        },
        create: {
          classId: classRecord.id,
          tenantId: classRecord.tenantId,
          latePenaltyValue: parseDecimal(attendancePolicy.latePenaltyValue, "-1"),
          absentPenaltyValue: parseDecimal(attendancePolicy.absentPenaltyValue, "-5"),
          perfectAttendanceBonusValue: parseDecimal(attendancePolicy.perfectAttendanceBonusValue, "10"),
          weekendRules:
            attendancePolicy.weekendRules && typeof attendancePolicy.weekendRules === "object"
              ? attendancePolicy.weekendRules
              : {},
          specialRules:
            attendancePolicy.specialRules && typeof attendancePolicy.specialRules === "object"
              ? attendancePolicy.specialRules
              : {},
          isFrozen: Boolean(attendancePolicy.isFrozen)
        }
      });
    } else {
      await tx.attendancePolicy.deleteMany({
        where: { classId: classRecord.id }
      });
    }

    for (const group of settings.groups || []) {
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

    for (const dormitory of settings.dormitories || []) {
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

    for (const position of settings.positions || []) {
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

    for (const student of backup.students || []) {
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

      const profile =
        student.profile && typeof student.profile === "object" && !Array.isArray(student.profile) ? student.profile : null;
      const titleLeft = normalizeOptionalString(profile ? (profile as Record<string, unknown>).titleLeft : null);
      const titleRight = normalizeOptionalString(profile ? (profile as Record<string, unknown>).titleRight : null);
      const notes = normalizeOptionalString(profile ? (profile as Record<string, unknown>).notes : null);
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

    const pointAccountIdByStudentId = new Map<string, string>();
    for (const student of backup.students || []) {
      const account = student.account && typeof student.account === "object" ? student.account : {};
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
      pointAccountIdByStudentId.set(String(student.id), created.id);

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

    const reasonTemplateIds = new Set<string>();
    for (const template of settings.reasonTemplates || []) {
      reasonTemplateIds.add(String(template.id));
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

    for (const featureFlag of settings.featureFlags || []) {
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

    for (const schedule of settings.attendanceSchedules || []) {
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

    const backupTransactionIds = new Set<string>();
    for (const item of backup.points.transactions || []) {
      backupTransactionIds.add(String(item.id));
      await tx.pointTransaction.create({
        data: {
          id: item.id,
          tenantId: classRecord.tenantId,
          classId: classRecord.id,
          studentId: item.studentId,
          pointAccountId: pointAccountIdByStudentId.get(String(item.studentId)),
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
            item.reasonTemplateId && reasonTemplateIds.has(String(item.reasonTemplateId))
              ? String(item.reasonTemplateId)
              : null,
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

    for (const item of backup.points.transactions || []) {
      if (!item.revertedByTransactionId || !backupTransactionIds.has(String(item.revertedByTransactionId))) {
        continue;
      }
      await tx.pointTransaction.update({
        where: { id: item.id },
        data: {
          revertedByTransactionId: String(item.revertedByTransactionId)
        }
      });
    }

    for (const session of backup.attendance.sessions || []) {
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

    for (const record of backup.attendance.records || []) {
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
            record.pointTransactionId && backupTransactionIds.has(String(record.pointTransactionId))
              ? String(record.pointTransactionId)
              : null,
          actorUserId: null,
          actorMembershipId: null,
          legacyStudentName: record.legacyStudentName == null ? null : String(record.legacyStudentName) || null,
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
          ...plan,
          restoredAt: new Date().toISOString()
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: classRecord.tenantId,
        classId: classRecord.id,
        actorUserId: input.actorUserId,
        actorMembershipId: input.actorMembershipId,
        action: "backup.structured_full_restore",
        targetType: "class",
        targetId: classRecord.id,
        metadata: {
          importJobId: importJob.id,
          sourceFilename: input.sourceFilename || "structured-full-restore.json",
          exportedAt: plan.exportedAt
        },
        afterData: {
          classId: classRecord.id,
          className: backup.class?.name || classRecord.name,
          restoredCounts: plan.counts
        }
      }
    });

    return {
      importJobId: importJob.id,
      counts: plan.counts
    };
  });
}
