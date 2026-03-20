type ExportFilters = {
  dateFrom?: string;
  dateTo?: string;
};

type StructuredExportType = "full" | "settings" | "students" | "points" | "attendance" | "homework";

function toPlainNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "object" && value && "toString" in value) {
    return (value as { toString(): string }).toString();
  }
  return value;
}

function readAvatarMapping(metadata: unknown) {
  const avatarData =
    metadata &&
    typeof metadata === "object" &&
    !Array.isArray(metadata) &&
    typeof (metadata as Record<string, unknown>).avatarData === "object" &&
    (metadata as Record<string, unknown>).avatarData &&
    !Array.isArray((metadata as Record<string, unknown>).avatarData)
      ? ((metadata as Record<string, unknown>).avatarData as Record<string, unknown>)
      : null;

  return {
    avatarHappyData:
      (avatarData && typeof avatarData.happy === "string" ? avatarData.happy : null) ||
      (metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      typeof (metadata as Record<string, unknown>).avatarHappyData === "string"
        ? ((metadata as Record<string, unknown>).avatarHappyData as string)
        : null),
    avatarNormalData:
      (avatarData && typeof avatarData.normal === "string" ? avatarData.normal : null) ||
      (metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      typeof (metadata as Record<string, unknown>).avatarNormalData === "string"
        ? ((metadata as Record<string, unknown>).avatarNormalData as string)
        : null),
    avatarSadData:
      (avatarData && typeof avatarData.sad === "string" ? avatarData.sad : null) ||
      (metadata &&
      typeof metadata === "object" &&
      !Array.isArray(metadata) &&
      typeof (metadata as Record<string, unknown>).avatarSadData === "string"
        ? ((metadata as Record<string, unknown>).avatarSadData as string)
        : null)
  };
}

function hasAvatarData(value: { avatarHappyData: string | null; avatarNormalData: string | null; avatarSadData: string | null }) {
  return Boolean(value.avatarHappyData || value.avatarNormalData || value.avatarSadData);
}

function getAvatarMappingPriority(classRecord: any, legacyScope: unknown) {
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

function buildAvatarMappingByStudentId(
  avatarMappings: Array<{ newId: string; metadata: unknown; legacyScope?: string | null; createdAt?: Date | string | null }>,
  classRecord: any
) {
  const grouped = new Map<string, typeof avatarMappings>();
  for (const item of avatarMappings) {
    const current = grouped.get(item.newId) || [];
    current.push(item);
    grouped.set(item.newId, current);
  }

  const result = new Map<
    string,
    { avatarHappyData: string | null; avatarNormalData: string | null; avatarSadData: string | null }
  >();

  for (const [studentId, items] of grouped.entries()) {
    const sortedItems = [...items].sort((left, right) => {
      const priorityDiff =
        getAvatarMappingPriority(classRecord, right.legacyScope) -
        getAvatarMappingPriority(classRecord, left.legacyScope);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }

      const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
      const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
      return rightTime - leftTime;
    });

    const merged = sortedItems.reduce(
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

    result.set(studentId, merged);
  }

  return result;
}

function buildPointDateFilter(filters: ExportFilters) {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return {
    gte: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : undefined,
    lte: filters.dateTo ? new Date(`${filters.dateTo}T23:59:59.999Z`) : undefined
  };
}

function buildAttendanceSessionDateFilter(filters: ExportFilters) {
  if (!filters.dateFrom && !filters.dateTo) return undefined;
  return {
    gte: filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00.000Z`) : undefined,
    lte: filters.dateTo ? new Date(`${filters.dateTo}T00:00:00.000Z`) : undefined
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

async function loadSettingsExport(app: any, classRecord: any) {
  const [classConfig, featureFlags, groups, dormitories, positions, reasonTemplates, attendancePolicy, attendanceSchedules] =
    await Promise.all([
      app.prisma.classConfig.findUnique({
        where: { classId: classRecord.id }
      }),
      app.prisma.featureFlag.findMany({
        where: {
          tenantId: classRecord.tenantId,
          classId: classRecord.id
        },
        orderBy: { code: "asc" }
      }),
      app.prisma.group.findMany({
        where: { classId: classRecord.id },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      app.prisma.dormitory.findMany({
        where: { classId: classRecord.id },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      app.prisma.position.findMany({
        where: { classId: classRecord.id },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      app.prisma.pointReasonTemplate.findMany({
        where: { classId: classRecord.id },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      }),
      app.prisma.attendancePolicy.findUnique({
        where: { classId: classRecord.id }
      }),
      app.prisma.attendanceSchedule.findMany({
        where: { classId: classRecord.id },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }]
      })
    ]);

  return {
    counts: {
      groups: groups.length,
      dormitories: dormitories.length,
      positions: positions.length,
      reasonTemplates: reasonTemplates.length,
      attendanceSchedules: attendanceSchedules.length
    },
    data: {
      classConfig,
      featureFlags,
      groups,
      dormitories,
      positions,
      reasonTemplates: reasonTemplates.map((item: any) => ({
        ...item,
        value: toPlainNumber(item.value),
        multiplier: toPlainNumber(item.multiplier)
      })),
      attendancePolicy: attendancePolicy
        ? {
            ...attendancePolicy,
            latePenaltyValue: toPlainNumber(attendancePolicy.latePenaltyValue),
            absentPenaltyValue: toPlainNumber(attendancePolicy.absentPenaltyValue),
            perfectAttendanceBonusValue: toPlainNumber(attendancePolicy.perfectAttendanceBonusValue)
          }
        : null,
      attendanceSchedules
    }
  };
}

async function loadStudentsExport(app: any, classRecord: any) {
  const students = await app.prisma.student.findMany({
    where: { classId: classRecord.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      legacyId: true,
      studentNo: true,
      name: true,
      gender: true,
      status: true,
      sortOrder: true,
      joinedAt: true,
      leftAt: true,
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
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          isPrimary: true,
          startDate: true,
          endDate: true,
          roleCode: true,
          group: {
            select: {
              id: true,
              legacyKey: true,
              name: true
            }
          }
        }
      },
      dorms: {
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        select: {
          isPrimary: true,
          startDate: true,
          endDate: true,
          dormitory: {
            select: {
              id: true,
              legacyKey: true,
              name: true
            }
          }
        }
      },
      positions: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          startDate: true,
          endDate: true,
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
  const studentIds = students.map((student: any) => student.id);
  const avatarMappings =
    studentIds.length > 0
      ? await app.prisma.migrationMapping.findMany({
          where: {
            tenantId: classRecord.tenantId,
            entityType: "student_avatar",
            newId: {
              in: studentIds
            }
          },
          select: {
            newId: true,
            metadata: true,
            legacyScope: true,
            createdAt: true
          }
        })
      : [];
  const avatarMappingByStudentId = buildAvatarMappingByStudentId(avatarMappings, classRecord);

  return {
    counts: {
      students: students.length
    },
    data: students.map((student: any) => ({
      ...student,
      legacyId: student.legacyId != null ? student.legacyId.toString() : null,
      profile:
        student.profile || hasAvatarData(avatarMappingByStudentId.get(student.id) || readAvatarMapping(null))
          ? {
              titleLeft: student.profile?.titleLeft ?? null,
              titleRight: student.profile?.titleRight ?? null,
              notes: student.profile?.notes ?? null,
              avatarHappyData: avatarMappingByStudentId.get(student.id)?.avatarHappyData ?? null,
              avatarNormalData: avatarMappingByStudentId.get(student.id)?.avatarNormalData ?? null,
              avatarSadData: avatarMappingByStudentId.get(student.id)?.avatarSadData ?? null
            }
          : null,
      account: student.account
        ? {
            ...student.account,
            totalPoints: toPlainNumber(student.account.totalPoints),
            balancePoints: toPlainNumber(student.account.balancePoints),
            penaltyPoints: toPlainNumber(student.account.penaltyPoints)
          }
        : null
    }))
  };
}

async function loadPointsExport(app: any, classRecord: any, filters: ExportFilters) {
  const pointTransactions = await app.prisma.pointTransaction.findMany({
    where: {
      classId: classRecord.id,
      occurredAt: buildPointDateFilter(filters)
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      studentId: true,
      transactionType: true,
      value: true,
      reason: true,
      scene: true,
      category: true,
      sourceModule: true,
      sourceType: true,
      occurredAt: true,
      isReverted: true,
      revertedByTransactionId: true,
      legacyNumericId: true,
      metadata: true,
      reasonTemplateId: true
    }
  });

  return {
    counts: {
      pointTransactions: pointTransactions.length
    },
    filters: {
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null
    },
    data: {
      transactions: pointTransactions.map((item: any) => ({
        ...item,
        value: toPlainNumber(item.value),
        legacyNumericId: toPlainNumber(item.legacyNumericId)
      }))
    }
  };
}

async function loadAttendanceExport(app: any, classRecord: any, filters: ExportFilters) {
  const sessionDateFilter = buildAttendanceSessionDateFilter(filters);
  const [attendanceSessions, attendanceRecords] = await Promise.all([
    app.prisma.attendanceSession.findMany({
      where: {
        classId: classRecord.id,
        sessionDate: sessionDateFilter
      },
      orderBy: [{ sessionDate: "asc" }, { sessionCode: "asc" }],
      select: {
        id: true,
        scheduleId: true,
        sessionDate: true,
        sessionCode: true,
        plannedStartAt: true,
        plannedEndAt: true,
        lateDeadlineAt: true,
        status: true
      }
    }),
    app.prisma.attendanceRecord.findMany({
      where: {
        classId: classRecord.id,
        session: {
          sessionDate: sessionDateFilter
        }
      },
      orderBy: [{ recordedAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        attendanceSessionId: true,
        studentId: true,
        status: true,
        checkInAt: true,
        recordedAt: true,
        source: true,
        note: true,
        pointTransactionId: true,
        legacyStudentName: true,
        legacyTimestamp: true
      }
    })
  ]);

  return {
    counts: {
      attendanceSessions: attendanceSessions.length,
      attendanceRecords: attendanceRecords.length
    },
    filters: {
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null
    },
    data: {
      sessions: attendanceSessions,
      records: attendanceRecords.map((item: any) => ({
        ...item,
        legacyTimestamp: toPlainNumber(item.legacyTimestamp)
      }))
    }
  };
}

async function loadHomeworkExport(app: any, classRecord: any, filters: ExportFilters) {
  const txs = await app.prisma.pointTransaction.findMany({
    where: {
      classId: classRecord.id,
      occurredAt: buildPointDateFilter(filters)
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
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
    .map((item: any) => {
      const parsed = parseHomeworkReason(item.reason);
      if (!parsed) return null;
      return {
        id: item.id,
        occurredAt: item.occurredAt.toISOString(),
        transactionType: item.transactionType,
        value: toPlainNumber(item.value),
        reason: item.reason,
        scene: item.scene,
        category: item.category,
        subjectName: parsed.subjectName,
        homeworkDate: parsed.homeworkDate,
        eventType: parsed.eventType,
        student: {
          id: item.student.id,
          name: item.student.name,
          legacyId: item.student.legacyId != null ? item.student.legacyId.toString() : null
        }
      };
    })
    .filter((item: any) => Boolean(item));

  const totals = events.reduce(
    (acc: { missingCount: number; registerCount: number }, item: any) => {
      if (item.eventType === "missing") acc.missingCount += 1;
      if (item.eventType === "register") acc.registerCount += 1;
      return acc;
    },
    { missingCount: 0, registerCount: 0 }
  );

  return {
    counts: {
      homeworkEvents: events.length,
      missingCount: totals.missingCount,
      registerCount: totals.registerCount
    },
    filters: {
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null
    },
    data: {
      events
    }
  };
}

export async function buildStructuredExportBody(
  app: any,
  classRecord: any,
  exportType: StructuredExportType,
  filters: ExportFilters
) {
  const payload =
    exportType === "settings"
      ? await loadSettingsExport(app, classRecord)
      : exportType === "students"
        ? await loadStudentsExport(app, classRecord)
        : exportType === "points"
          ? await loadPointsExport(app, classRecord, filters)
          : exportType === "attendance"
            ? await loadAttendanceExport(app, classRecord, filters)
            : exportType === "homework"
              ? await loadHomeworkExport(app, classRecord, filters)
              : null;

  if (payload) {
    return {
      schemaVersion: "classmanager.export.v1",
      exportType,
      exportedAt: new Date().toISOString(),
      tenant: classRecord.tenant,
      class: {
        id: classRecord.id,
        name: classRecord.name,
        code: classRecord.code,
        timezone: classRecord.timezone
      },
      counts: payload.counts,
      filters: "filters" in payload ? payload.filters : undefined,
      [exportType]: payload.data
    };
  }

  const [settings, students, points, attendance, homework] = await Promise.all([
    loadSettingsExport(app, classRecord),
    loadStudentsExport(app, classRecord),
    loadPointsExport(app, classRecord, filters),
    loadAttendanceExport(app, classRecord, filters),
    loadHomeworkExport(app, classRecord, filters)
  ]);

  return {
    schemaVersion: "classmanager.export.v1",
    exportType: "full",
    exportedAt: new Date().toISOString(),
    tenant: classRecord.tenant,
    class: {
      id: classRecord.id,
      name: classRecord.name,
      code: classRecord.code,
      timezone: classRecord.timezone
    },
    counts: {
      ...settings.counts,
      ...students.counts,
      ...points.counts,
      ...attendance.counts,
      ...homework.counts
    },
    filters: {
      dateFrom: filters.dateFrom || null,
      dateTo: filters.dateTo || null
    },
    settings: settings.data,
    students: students.data,
    points: points.data,
    attendance: attendance.data,
    homework: homework.data
  };
}
