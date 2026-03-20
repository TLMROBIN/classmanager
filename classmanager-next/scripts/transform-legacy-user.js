const fs = require("fs");
const path = require("path");
const { loadPolicy, classifyIssue } = require("./validate-normalized-data");

const workspaceRoot = path.resolve(__dirname, "..");
const exportDir = path.join(workspaceRoot, "out", "legacy-export");
const outputDir = path.join(workspaceRoot, "out", "normalized");
const attendanceMappingPath = path.join(workspaceRoot, "scripts", "attendance-name-mapping.json");
const warningPolicy = loadPolicy();

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function readOptionalJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  return readJson(filePath);
}

function slugify(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "legacy";
}

function sanitizeFilename(input) {
  return String(input || "").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function normalizeIsoDateString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function normalizeAttendanceWeekendRulesForCodes(rawRules, schedules) {
  const scheduleCodes = Array.isArray(schedules) ? schedules.map((item) => String(item?.id || "").trim()) : [];
  const result = {};

  if (!rawRules || typeof rawRules !== "object" || Array.isArray(rawRules)) {
    return result;
  }

  for (const [weekday, value] of Object.entries(rawRules)) {
    if (!Array.isArray(value)) {
      result[weekday] = [];
      continue;
    }

    result[weekday] = Array.from(
      new Set(
        value
          .map((item) => {
            if (typeof item === "number" && Number.isInteger(item) && item >= 0) {
              return scheduleCodes[item] || "";
            }
            const token = String(item ?? "").trim();
            if (!token) return "";
            if (/^\d+$/.test(token)) {
              return scheduleCodes[Number(token)] || token;
            }
            return token;
          })
          .filter(Boolean)
      )
    );
  }

  return result;
}

function normalizeAttendanceSpecialLateRulesForCodes(rawValue, schedules) {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const scheduleCodes = Array.isArray(schedules) ? schedules.map((item) => String(item?.id || "").trim()) : [];
  const result = {};

  for (const [rawKey, rawTime] of Object.entries(rawValue)) {
    const token = String(rawKey || "").trim();
    if (!token || typeof rawTime !== "string" || !rawTime.trim()) {
      continue;
    }
    const normalizedKey =
      /^\d+$/.test(token) && scheduleCodes[Number(token)]
        ? scheduleCodes[Number(token)]
        : token;
    if (!normalizedKey) {
      continue;
    }
    result[normalizedKey] = rawTime.trim();
  }

  return result;
}

const LEGACY_ATTENDANCE_SCHEDULE_DEFAULTS = {
  morning: {
    name: "早读",
    start: "06:00",
    end: "07:20",
    lateTime: "07:00"
  },
  noon: {
    name: "午练",
    start: "14:00",
    end: "14:40",
    lateTime: "14:20"
  },
  evening: {
    name: "晚自习",
    start: "18:00",
    end: "19:00",
    lateTime: "18:30"
  }
};

const LEGACY_ATTENDANCE_SCHEDULE_ORDER = ["morning", "noon", "evening"];

function compareAttendanceScheduleCodeOrder(left, right) {
  const leftOrder = LEGACY_ATTENDANCE_SCHEDULE_ORDER.indexOf(left);
  const rightOrder = LEGACY_ATTENDANCE_SCHEDULE_ORDER.indexOf(right);

  if (leftOrder >= 0 && rightOrder >= 0) {
    return leftOrder - rightOrder;
  }
  if (leftOrder >= 0) {
    return -1;
  }
  if (rightOrder >= 0) {
    return 1;
  }
  return left.localeCompare(right, "zh-Hans-CN");
}

function collectAttendanceSessionCodes(attendanceRecords) {
  const raw = attendanceRecords?.value || {};
  const codes = new Set();

  for (const studentMap of Object.values(raw)) {
    if (!studentMap || typeof studentMap !== "object" || Array.isArray(studentMap)) {
      continue;
    }

    for (const sessionMap of Object.values(studentMap)) {
      if (!sessionMap || typeof sessionMap !== "object" || Array.isArray(sessionMap)) {
        continue;
      }

      for (const rawCode of Object.keys(sessionMap)) {
        const code = String(rawCode || "").trim();
        if (code) {
          codes.add(code);
        }
      }
    }
  }

  return Array.from(codes).sort(compareAttendanceScheduleCodeOrder);
}

function normalizeAttendanceSchedules(rawSchedule, attendanceRecords) {
  const normalized = [];
  const seenCodes = new Set();

  if (Array.isArray(rawSchedule)) {
    rawSchedule.forEach((item, index) => {
      const code = String(item?.id || "").trim();
      if (!code || seenCodes.has(code)) {
        return;
      }

      seenCodes.add(code);
      normalized.push({
        code,
        name: item?.name,
        startTime: item?.start,
        endTime: item?.end,
        lateTime: item?.lateTime,
        displayOrder: index
      });
    });
  }

  for (const code of collectAttendanceSessionCodes(attendanceRecords)) {
    if (seenCodes.has(code)) {
      continue;
    }

    const defaults = LEGACY_ATTENDANCE_SCHEDULE_DEFAULTS[code] || {
      name: code,
      start: "08:00",
      end: "08:30",
      lateTime: "08:10"
    };

    seenCodes.add(code);
    normalized.push({
      code,
      name: defaults.name,
      startTime: defaults.start,
      endTime: defaults.end,
      lateTime: defaults.lateTime,
      displayOrder: normalized.length
    });
  }

  return normalized;
}

function parseArgs(argv) {
  const args = { input: "", all: false };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--all") {
      args.all = true;
      continue;
    }
    if (token === "--input") {
      args.input = argv[i + 1] || "";
      i += 1;
    }
  }
  return args;
}

function getSourceFiles(args) {
  if (args.all) {
    return fs
      .readdirSync(exportDir)
      .filter((name) => /^\d{4}-.*\.json$/.test(name))
      .map((name) => path.join(exportDir, name));
  }

  if (args.input) {
    const directPath = path.isAbsolute(args.input)
      ? args.input
      : path.join(exportDir, args.input);
    if (!fs.existsSync(directPath)) {
      throw new Error(`Input file not found: ${directPath}`);
    }
    return [directPath];
  }

  throw new Error("Use --all or --input <file>");
}

function buildLegacyRef(scope, value) {
  return `${scope}:${value}`;
}

function flushWarningCounts(targetWarnings, label, countMap) {
  for (const [key, count] of countMap.entries()) {
    targetWarnings.push(`${label}: ${key} (${count})`);
  }
}

function buildWarningSummary(warnings) {
  const summary = {
    total: 0,
    warnings: 0,
    reviews: 0,
    blockers: 0,
    infos: 0
  };

  for (const message of warnings || []) {
    const classified = classifyIssue(warningPolicy, {
      severity: "warn",
      code: "normalizer.warning",
      message
    });
    summary.total += 1;

    if (classified.severity === "info") {
      summary.infos += 1;
      continue;
    }
    if (classified.severity === "review") {
      summary.reviews += 1;
      continue;
    }
    if (classified.severity === "blocker") {
      summary.blockers += 1;
      continue;
    }
    summary.warnings += 1;
  }

  return summary;
}

function formatWarningSummary(summary) {
  const parts = [];

  if (summary.blockers > 0) {
    parts.push(`${summary.blockers} blockers`);
  }
  if (summary.reviews > 0) {
    parts.push(`${summary.reviews} reviews`);
  }
  if (summary.warnings > 0) {
    parts.push(`${summary.warnings} warnings`);
  }
  if (summary.infos > 0) {
    parts.push(`${summary.infos} infos`);
  }

  return parts.length > 0 ? parts.join(", ") : "0 warnings";
}

function getMappingScope(user) {
  if (user && user.username) return user.username;
  if (user && user.id != null) return `user-${user.id}`;
  return "unknown";
}

function normalizeSortOrder(value, fallbackIndex) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 2147483647) {
    return numeric;
  }
  return fallbackIndex;
}

function normalizeAvatarData(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed) ? trimmed : null;
}

function normalizeStudents(legacy, warnings) {
  const students = Array.isArray(legacy.students?.value) ? legacy.students.value : [];
  const groups = new Map();
  const dorms = new Map();
  const studentRecords = [];
  const pointAccounts = [];
  const studentProfiles = [];
  const groupAssignments = [];
  const dormAssignments = [];

  students.forEach((student, index) => {
    const studentLegacyRef = buildLegacyRef("student", student.id);
    const studentCode = `legacy-student-${student.id}`;
    const avatarHappyData = normalizeAvatarData(student.avatar_happy);
    const avatarNormalData = normalizeAvatarData(student.avatar_normal);
    const avatarSadData = normalizeAvatarData(student.avatar_sad);

    studentRecords.push({
      legacyRef: studentLegacyRef,
      legacyId: student.id,
      studentNo: null,
      name: student.name,
      gender: student.gender || null,
      status: "active",
      sortOrder: normalizeSortOrder(student.id, index)
    });

    pointAccounts.push({
      studentLegacyRef,
      totalPoints: Number(student.zizai || 0),
      balancePoints: Number(student.balance || 0),
      penaltyPoints: Number(student.penalty || 0)
    });

    const hasAvatar = Boolean(avatarHappyData) || Boolean(avatarNormalData) || Boolean(avatarSadData);
    if (hasAvatar || student.titleLeft || student.titleRight) {
      studentProfiles.push({
        studentLegacyRef,
        hasLegacyAvatarData: hasAvatar,
        avatarHappyData,
        avatarNormalData,
        avatarSadData,
        titleLeft: student.titleLeft || null,
        titleRight: student.titleRight || null,
        notes: null
      });
    }

    if (student.group) {
      if (!groups.has(student.group)) {
        groups.set(student.group, {
          legacyKey: student.group,
          code: `group-${slugify(student.group)}`,
          name: student.group,
          colorToken: null
        });
      }
      groupAssignments.push({
        studentLegacyRef,
        groupLegacyKey: student.group,
        roleCode: student.role || null,
        isPrimary: true
      });
    }

    if (student.dorm) {
      if (!dorms.has(student.dorm)) {
        dorms.set(student.dorm, {
          legacyKey: student.dorm,
          code: `dorm-${slugify(student.dorm)}`,
          name: student.dorm
        });
      }
      dormAssignments.push({
        studentLegacyRef,
        dormLegacyKey: student.dorm,
        isPrimary: true
      });
    }
  });

  return {
    students: studentRecords,
    pointAccounts,
    studentProfiles,
    groups: Array.from(groups.values()),
    dormitories: Array.from(dorms.values()),
    groupAssignments,
    dormAssignments
  };
}

function normalizeConfig(config, normalizedStudents, warnings, attendanceRecords) {
  const raw = config?.value || {};
  const systemConfig = raw.systemConfig || {};
  const attendance = systemConfig.attendance || {};
  const organization = systemConfig.organization || {};
  const points = systemConfig.points || {};
  const attendanceSchedules = normalizeAttendanceSchedules(attendance.schedule, attendanceRecords);
  const scheduleCodesForPolicy = attendanceSchedules.map((item) => ({
    id: item.code
  }));

  const className = systemConfig.className || "Legacy Class";
  const groupNameMap = new Map((organization.groups || []).map((item) => [item.id, item]));
  const dormNameMap = new Map((organization.dorms || []).map((item) => [item.id, item]));

  const groups = normalizedStudents.groups.map((group) => {
    const matched = groupNameMap.get(group.legacyKey);
    return {
      ...group,
      name: matched?.name || group.name,
      colorToken: matched?.color || null
    };
  });

  const dormitories = normalizedStudents.dormitories.map((dorm) => {
    const matched = dormNameMap.get(dorm.legacyKey);
    return {
      ...dorm,
      name: matched?.name || dorm.name
    };
  });

  const positions = [];
  const positionAssignments = [];
  const commissioners = raw.commissioners || {};
  const commissionerRoles = Array.isArray(organization.commissionerRoles)
    ? organization.commissionerRoles
    : [];
  const studentCouncilRoles = Array.isArray(organization.studentCouncilRoles)
    ? organization.studentCouncilRoles
    : [];
  const knownStudentRefs = new Set(normalizedStudents.students.map((student) => student.legacyRef));

  for (const role of commissionerRoles) {
    positions.push({
      legacyKey: role.id,
      code: role.id,
      name: role.name,
      category: "commissioner"
    });
    const studentId = commissioners[role.id];
    if (studentId != null) {
      const studentLegacyRef = buildLegacyRef("student", studentId);
      if (knownStudentRefs.has(studentLegacyRef)) {
        positionAssignments.push({
          studentLegacyRef,
          positionLegacyKey: role.id
        });
      } else {
        warnings.push(`Commissioner ${role.id} references missing student id ${studentId}`);
      }
    }
  }

  const reasonTemplates = Array.isArray(points.reasons)
    ? points.reasons.map((item, index) => ({
        legacyName: item.name,
        name: item.name,
        value: Number(item.val || 0),
        transactionType: item.type === "penalty" ? "penalty" : "bonus",
        scene: item.scene || "班级",
        category: item.category || "待定",
        note: item.note || null,
        isEditable: Boolean(item.editable),
        isMultiplier: Boolean(item.isMulti),
        multiplier: item.factor != null ? Number(item.factor) : null,
        displayOrder: index
      }))
    : [];

  const dailyWageAmount = Number(points.dailyWageAmount);
  const lastWageDate = normalizeIsoDateString(raw.lastWageDate);
  const dailyWageGroups = Array.isArray(points.dailyWageGroups)
    ? points.dailyWageGroups.filter((item) => typeof item === "string" && item.trim().length > 0)
    : [];
  const psychologyCommittee = Array.isArray(raw.psychologyCommittee)
    ? raw.psychologyCommittee
        .filter((item) => item != null && String(item).trim() !== "")
        .map((item) => {
          const studentLegacyRef = buildLegacyRef("student", item);
          if (!knownStudentRefs.has(studentLegacyRef)) {
            warnings.push(`Psychology committee references missing student id ${item}`);
            return null;
          }
          return studentLegacyRef;
        })
        .filter(Boolean)
    : [];
  const normalizedStudentCouncilRoles = studentCouncilRoles.map((item, index) => {
    const role = item && typeof item === "object" ? item : {};
    const studentId = role.studentId;
    const studentLegacyRef =
      studentId == null
        ? null
        : knownStudentRefs.has(buildLegacyRef("student", studentId))
          ? buildLegacyRef("student", studentId)
          : null;
    if (studentId != null && !studentLegacyRef) {
      warnings.push(`Student council role ${role.id || `role-${index + 1}`} references missing student id ${studentId}`);
    }
    return {
      id: role.id ? String(role.id) : `student_council_${index + 1}`,
      name: role.name ? String(role.name) : `学生会职位${index + 1}`,
      studentLegacyRef
    };
  });

  return {
    classConfig: {
      className,
      timezone: "Asia/Shanghai",
      isFrozen: Boolean(raw.frozen),
      duty: raw.duty || {},
      countdownEvents: raw.countdownEvents || [],
      scheduleNotes: raw.scheduleNotes || {},
      dailyWageAmount: Number.isFinite(dailyWageAmount) ? dailyWageAmount : 5,
      ...(lastWageDate ? { lastWageDate } : {}),
      dailyWageGroupLegacyKeys: dailyWageGroups,
      psychologyCommitteeStudentLegacyRefs: psychologyCommittee,
      studentCouncilRoles: normalizedStudentCouncilRoles
    },
    featureFlags: Object.entries(systemConfig.enabledFeatures || {}).map(([code, enabled]) => ({
      code,
      enabled: Boolean(enabled)
    })),
    attendancePolicy: {
      latePenaltyValue: Number(attendance.penaltyRules?.late || -1),
      absentPenaltyValue: Number(attendance.penaltyRules?.absent || -5),
      perfectAttendanceBonusValue: Number(attendance.penaltyRules?.perfectAttendance || 10),
      weekendRules: normalizeAttendanceWeekendRulesForCodes(attendance.weekendRules || {}, scheduleCodesForPolicy),
      specialRules: {
        sundaySpecialLateTime: normalizeAttendanceSpecialLateRulesForCodes(
          attendance.sundaySpecialLateTime || {},
          scheduleCodesForPolicy
        )
      }
    },
    attendanceSchedules,
    groups,
    dormitories,
    positions,
    positionAssignments,
    reasonTemplates,
    subjects: Array.isArray(systemConfig.subjects) ? systemConfig.subjects : [],
    quotes: Array.isArray(systemConfig.quotes) ? systemConfig.quotes : []
  };
}

function normalizeTransactions(history, studentRefMap, warnings) {
  const rows = Array.isArray(history?.value) ? history.value : [];
  const transactions = [];

  for (const item of rows) {
    const studentLegacyRef = buildLegacyRef("student", item.studentId);
    if (!studentRefMap.has(studentLegacyRef)) {
      warnings.push(`History row ${item.id} references missing student id ${item.studentId}`);
      continue;
    }

    transactions.push({
      legacyNumericId: item.id,
      studentLegacyRef,
      transactionType: item.type === "penalty" ? "penalty" : "bonus",
      value: Number(item.val || 0),
      reason: item.reason || "",
      scene: item.scene || "班级",
      category: item.category || "待定",
      sourceModule: inferSourceModule(item.reason || ""),
      occurredAt: new Date(Number(item.ts || 0)).toISOString(),
      legacySnapshot: item.snapshot || null
    });
  }

  return transactions;
}

function inferSourceModule(reason) {
  if (reason.includes("作业")) return "homework";
  if (reason.includes("考勤")) return "attendance";
  if (reason.includes("任务")) return "tasks";
  if (reason.includes("宝物") || reason.includes("藏宝")) return "shop";
  if (reason.includes("工资")) return "wage";
  return "manual";
}

function normalizeAttendance(attendanceRecords, studentNameMap, warnings, attendanceMapping) {
  const raw = attendanceRecords?.value || {};
  const sessions = [];
  const records = [];
  const sessionSeen = new Set();
  const missingStudentCounts = new Map();
  const mappedStudentCounts = new Map();
  const skippedStudentCounts = new Map();

  for (const [date, studentMap] of Object.entries(raw)) {
    for (const [studentName, sessionMap] of Object.entries(studentMap || {})) {
      let studentLegacyRef = studentNameMap.get(studentName);
      const mappingRule = attendanceMapping?.[studentName];

      if (!studentLegacyRef && mappingRule?.action === "map" && mappingRule.studentLegacyRef) {
        studentLegacyRef = mappingRule.studentLegacyRef;
        mappedStudentCounts.set(studentName, (mappedStudentCounts.get(studentName) || 0) + 1);
      }

      if (!studentLegacyRef && mappingRule?.action === "skip") {
        skippedStudentCounts.set(studentName, (skippedStudentCounts.get(studentName) || 0) + 1);
        continue;
      }

      if (!studentLegacyRef) {
        missingStudentCounts.set(studentName, (missingStudentCounts.get(studentName) || 0) + 1);
        continue;
      }

      for (const [sessionCode, record] of Object.entries(sessionMap || {})) {
        const sessionLegacyKey = `${date}:${sessionCode}`;
        if (!sessionSeen.has(sessionLegacyKey)) {
          sessionSeen.add(sessionLegacyKey);
          sessions.push({
            legacyKey: sessionLegacyKey,
            sessionDate: date,
            sessionCode
          });
        }

        records.push({
          sessionLegacyKey,
          studentLegacyRef,
          status: record.status || "present",
          checkInAt: record.checkTime && record.checkTime !== "缺勤" ? `${date}T${record.checkTime}:00` : null,
          recordedAt:
            typeof record.timestamp === "number"
              ? new Date(record.timestamp).toISOString()
              : null,
          legacyStudentName: studentName,
          legacyTimestamp: typeof record.timestamp === "number" ? record.timestamp : null
        });
      }
    }
  }

  flushWarningCounts(
    warnings,
    "Attendance entry could not resolve student id",
    missingStudentCounts
  );
  flushWarningCounts(
    warnings,
    "Attendance entry mapped by alias",
    mappedStudentCounts
  );
  flushWarningCounts(
    warnings,
    "Attendance entry skipped by mapping",
    skippedStudentCounts
  );

  return { sessions, records };
}

function normalizeLegacyMessageList(value) {
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const content = row.content == null ? "" : String(row.content).trim();
      if (!content) return null;

      return {
        id: row.id == null ? `message-${index + 1}` : String(row.id).trim() || `message-${index + 1}`,
        content,
        time: row.time == null ? null : String(row.time).trim() || null,
        date: row.date == null ? null : String(row.date).trim() || null
      };
    })
    .filter(Boolean);
}

function normalizeLegacyTasks(value, knownStudentRefs, warnings) {
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const title = row.title == null ? "" : String(row.title).trim();
      if (!title) return null;

      const claimedByStudentLegacyRefs = Array.isArray(row.claimedBy)
        ? Array.from(
            new Set(
              row.claimedBy
                .map((studentId) => {
                  const studentLegacyRef = buildLegacyRef("student", studentId);
                  if (!knownStudentRefs.has(studentLegacyRef)) {
                    warnings.push(`Task ${row.id ?? `task-${index + 1}`} references missing student id ${studentId}`);
                    return null;
                  }
                  return studentLegacyRef;
                })
                .filter(Boolean)
            )
          )
        : [];

      return {
        id: row.id == null ? `task-${index + 1}` : String(row.id).trim() || `task-${index + 1}`,
        title,
        desc: row.desc == null ? "" : String(row.desc).trim(),
        points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0,
        startTime: row.startTime == null ? null : String(row.startTime).trim() || null,
        endTime: row.endTime == null ? null : String(row.endTime).trim() || null,
        claimedByStudentLegacyRefs
      };
    })
    .filter(Boolean);
}

function normalizeLegacyTreasures(value) {
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const id = row.id == null ? `treasure-${index + 1}` : String(row.id).trim();
      const name = row.name == null ? "" : String(row.name).trim();
      if (!id || !name) return null;

      return {
        id,
        name,
        rarity: row.rarity == null ? "N" : String(row.rarity).trim() || "N",
        price: Number.isFinite(Number(row.price)) ? Number(row.price) : 0,
        stock: Number.isFinite(Number(row.stock)) ? Number(row.stock) : 0,
        desc: row.desc == null ? "" : String(row.desc).trim(),
        ladderPrices: Array.isArray(row.ladderPrices)
          ? row.ladderPrices
              .map((price) => Number(price))
              .filter((price) => Number.isFinite(price))
          : [],
        dailyLimit: Number.isFinite(Number(row.dailyLimit)) ? Number(row.dailyLimit) : 0
      };
    })
    .filter(Boolean);
}

function normalizeLegacyStudentItemMap(value, knownStudentRefs, warnings, label) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const normalized = {};

  for (const [studentId, itemMap] of Object.entries(raw)) {
    const studentLegacyRef = buildLegacyRef("student", studentId);
    if (!knownStudentRefs.has(studentLegacyRef)) {
      warnings.push(`${label} references missing student id ${studentId}`);
      continue;
    }

    if (!itemMap || typeof itemMap !== "object" || Array.isArray(itemMap)) {
      continue;
    }

    const normalizedItems = Object.fromEntries(
      Object.entries(itemMap)
        .map(([itemId, count]) => [String(itemId).trim(), Number(count)])
        .filter(([itemId, count]) => itemId.length > 0 && Number.isFinite(count) && count > 0)
        .map(([itemId, count]) => [itemId, count])
    );

    if (Object.keys(normalizedItems).length > 0) {
      normalized[studentLegacyRef] = normalizedItems;
    }
  }

  return normalized;
}

function normalizeLegacyLogs(value) {
  const rows = Array.isArray(value) ? value : [];

  return rows
    .map((item, index) => {
      const row = item && typeof item === "object" ? item : {};
      const action = row.action == null ? "" : String(row.action).trim();
      const itemName = row.itemName == null ? "" : String(row.itemName).trim();
      if (!action && !itemName) return null;

      return {
        id: row.id == null ? `log-${index + 1}` : String(row.id).trim() || `log-${index + 1}`,
        ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : null,
        studentName: row.studentName == null ? "" : String(row.studentName).trim(),
        action,
        itemName,
        rarity: row.rarity == null ? null : String(row.rarity).trim() || null,
        cost: Number.isFinite(Number(row.cost)) ? Number(row.cost) : 0,
        note: row.note == null ? null : String(row.note).trim() || null
      };
    })
    .filter(Boolean);
}

function normalizeLegacyDateItemCountMap(value) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return Object.fromEntries(
    Object.entries(raw)
      .map(([date, itemMap]) => {
        if (!itemMap || typeof itemMap !== "object" || Array.isArray(itemMap)) {
          return null;
        }

        const normalizedItems = Object.fromEntries(
          Object.entries(itemMap)
            .map(([itemId, count]) => [String(itemId).trim(), Number(count)])
            .filter(([itemId, count]) => itemId.length > 0 && Number.isFinite(count) && count >= 0)
        );

        if (!String(date).trim() || Object.keys(normalizedItems).length === 0) {
          return null;
        }

        return [String(date).trim(), normalizedItems];
      })
      .filter(Boolean)
  );
}

function normalizeLegacyBattle(value, knownStudentRefs, warnings) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const teams = Array.isArray(raw.teams)
    ? raw.teams
        .map((item, index) => {
          const team = item && typeof item === "object" ? item : {};
          const id = team.id == null ? `team-${index + 1}` : String(team.id).trim();
          const name = team.name == null ? "" : String(team.name).trim();
          if (!id || !name) return null;

          const memberStudentLegacyRefs = Array.isArray(team.memberIds)
            ? Array.from(
                new Set(
                  team.memberIds
                    .map((studentId) => {
                      const normalizedStudentId = String(studentId ?? "").trim();
                      if (!normalizedStudentId) {
                        return null;
                      }

                      const studentLegacyRef = buildLegacyRef("student", normalizedStudentId);
                      if (!knownStudentRefs.has(studentLegacyRef)) {
                        warnings.push(`Battle team ${id} references missing student id ${normalizedStudentId}`);
                        return null;
                      }
                      return studentLegacyRef;
                    })
                    .filter(Boolean)
                )
              )
            : [];

          return {
            id,
            name,
            memberStudentLegacyRefs,
            points: Number.isFinite(Number(team.points)) ? Number(team.points) : 0
          };
        })
        .filter(Boolean)
    : [];

  const squads = Array.isArray(raw.squads)
    ? raw.squads
        .map((item, index) => {
          const squad = item && typeof item === "object" ? item : {};
          const id = squad.id == null ? `squad-${index + 1}` : String(squad.id).trim();
          const name = squad.name == null ? "" : String(squad.name).trim();
          if (!id || !name) return null;

          return {
            id,
            name,
            teamIds: Array.isArray(squad.teamIds)
              ? Array.from(new Set(squad.teamIds.map((teamId) => String(teamId).trim()).filter(Boolean)))
              : []
          };
        })
        .filter(Boolean)
    : [];

  const battles = Array.isArray(raw.battles)
    ? raw.battles
        .map((item, index) => {
          const battle = item && typeof item === "object" ? item : {};
          const id = battle.id == null ? `battle-${index + 1}` : String(battle.id).trim();
          const teamAId = battle.teamAId == null ? "" : String(battle.teamAId).trim();
          const teamBId = battle.teamBId == null ? "" : String(battle.teamBId).trim();
          if (!id || !teamAId || !teamBId) return null;

          return {
            id,
            teamAId,
            teamBId,
            stake: Number.isFinite(Number(battle.stake)) ? Number(battle.stake) : 0,
            isUnderdog: Boolean(battle.isUnderdog)
          };
        })
        .filter(Boolean)
    : [];

  const logs = Array.isArray(raw.logs)
    ? raw.logs
        .map((item, index) => {
          const log = item && typeof item === "object" ? item : {};
          const msg = log.msg == null ? "" : String(log.msg).trim();
          if (!msg) return null;
          return {
            time: log.time == null ? null : String(log.time).trim() || null,
            msg,
            id: log.id == null ? `battle-log-${index + 1}` : String(log.id).trim() || `battle-log-${index + 1}`
          };
        })
        .filter(Boolean)
    : [];

  const history = Array.isArray(raw.history) ? raw.history : [];
  const settlements = Array.isArray(raw.settlements) ? raw.settlements : [];
  const exams = Array.isArray(raw.exams) ? raw.exams : [];
  const rules = raw.rules && typeof raw.rules === "object" && !Array.isArray(raw.rules) ? raw.rules : {};

  if (
    teams.length === 0 &&
    squads.length === 0 &&
    battles.length === 0 &&
    logs.length === 0 &&
    history.length === 0 &&
    settlements.length === 0 &&
    exams.length === 0 &&
    !Object.keys(rules).length &&
    raw.teamBaseExamId == null &&
    raw.settleExamId == null
  ) {
    return null;
  }

  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 1,
    teams,
    squads,
    battles,
    logs,
    history,
    settlements,
    season: Number.isFinite(Number(raw.season)) ? Number(raw.season) : 1,
    rules,
    exams,
    teamBaseExamId: raw.teamBaseExamId == null ? null : String(raw.teamBaseExamId).trim() || null,
    settleExamId: raw.settleExamId == null ? null : String(raw.settleExamId).trim() || null
  };
}

function normalizeLegacyCompatModules(legacy, knownStudentRefs, warnings) {
  const lastPeriodicTaskDate = normalizeIsoDateString(legacy.lastPeriodicTaskDate);
  const lastPenaltyReductionDate = normalizeIsoDateString(legacy.lastPenaltyReductionDate);
  const strategyDates =
    lastPeriodicTaskDate || lastPenaltyReductionDate
      ? {
          lastPeriodicTaskDate: lastPeriodicTaskDate || null,
          lastPenaltyReductionDate: lastPenaltyReductionDate || null
        }
      : null;
  const legacyCompat = {
    messages: normalizeLegacyMessageList(legacy.messages?.value),
    teacherMessages: normalizeLegacyMessageList(legacy.teacherMessages?.value),
    tasks: normalizeLegacyTasks(legacy.tasks?.value, knownStudentRefs, warnings),
    shop: {
      treasures: normalizeLegacyTreasures(legacy.treasures?.value),
      storage: normalizeLegacyStudentItemMap(legacy.storage?.value, knownStudentRefs, warnings, "Storage"),
      logs: normalizeLegacyLogs(legacy.logs?.value),
      redemptionHistory: normalizeLegacyStudentItemMap(
        legacy.redemptionHistory?.value,
        knownStudentRefs,
        warnings,
        "Redemption history"
      ),
      dailyRedemptionCounts: normalizeLegacyDateItemCountMap(legacy.dailyRedemptionCounts?.value),
      dailyUsageCounts: normalizeLegacyDateItemCountMap(legacy.dailyUsageCounts?.value)
    },
    battle: normalizeLegacyBattle(legacy.battle?.value, knownStudentRefs, warnings),
    ...(strategyDates ? { strategyDates } : {})
  };

  const hasData =
    legacyCompat.messages.length > 0 ||
    legacyCompat.teacherMessages.length > 0 ||
    legacyCompat.tasks.length > 0 ||
    legacyCompat.shop.treasures.length > 0 ||
    Object.keys(legacyCompat.shop.storage).length > 0 ||
    legacyCompat.shop.logs.length > 0 ||
    Object.keys(legacyCompat.shop.redemptionHistory).length > 0 ||
    Object.keys(legacyCompat.shop.dailyRedemptionCounts).length > 0 ||
    Object.keys(legacyCompat.shop.dailyUsageCounts).length > 0 ||
    Boolean(legacyCompat.battle) ||
    Boolean(strategyDates);

  return hasData ? legacyCompat : null;
}

function normalizeUserFile(filePath) {
  const source = readJson(filePath);
  const warnings = [];
  const user = source.user || {};
  const safeUsername = sanitizeFilename(user.username || `user-${user.id}`);
  const outputPath = path.join(outputDir, `${String(user.id).padStart(4, "0")}-${safeUsername}.normalized.json`);
  const mappingScope = getMappingScope(user);
  const legacy = source.data || {};
  const attendanceMappings = readOptionalJson(attendanceMappingPath, {});
  const attendanceMapping = attendanceMappings[mappingScope] || {};

  const normalizedStudents = normalizeStudents(legacy, warnings);
  const config = normalizeConfig(legacy.config, normalizedStudents, warnings, legacy.attendanceRecords);

  const studentRefMap = new Set(normalizedStudents.students.map((student) => student.legacyRef));
  const studentNameMap = new Map(
    normalizedStudents.students.map((student) => [student.name, student.legacyRef])
  );

  const transactions = normalizeTransactions(legacy.history, studentRefMap, warnings);
  const attendance = normalizeAttendance(
    legacy.attendanceRecords,
    studentNameMap,
    warnings,
    attendanceMapping
  );
  const legacyCompat = normalizeLegacyCompatModules(legacy, studentRefMap, warnings);

  const normalized = {
    meta: {
      normalizedAt: new Date().toISOString(),
      sourceFile: filePath,
      sourceUserId: user.id,
      sourceUsername: user.username || null,
      attendanceMappingScope: mappingScope
    },
    tenant: {
      legacyUserId: user.id,
      slug: `legacy-${slugify(user.username || user.id)}`,
      name: config.classConfig.className || user.username || `Legacy ${user.id}`,
      type: "class",
      ownerUsername: user.username || null
    },
    user: {
      legacyId: user.id,
      username: user.username || null,
      email: user.email || null,
      role: user.role || null,
      createdAt: user.created_at || null,
      lastLoginAt: user.last_login || null
    },
    class: {
      legacyUserId: user.id,
      name: config.classConfig.className || "Legacy Class",
      code: `legacy-class-${user.id}`,
      timezone: config.classConfig.timezone
    },
    groups: config.groups,
    dormitories: config.dormitories,
    positions: config.positions,
    students: normalizedStudents.students,
    studentProfiles: normalizedStudents.studentProfiles,
    studentGroupAssignments: normalizedStudents.groupAssignments,
    studentDormAssignments: normalizedStudents.dormAssignments,
    studentPositionAssignments: config.positionAssignments,
    pointAccounts: normalizedStudents.pointAccounts,
    pointReasonTemplates: config.reasonTemplates,
    pointTransactions: transactions,
    attendancePolicy: config.attendancePolicy,
    attendanceSchedules: config.attendanceSchedules,
    attendanceSessions: attendance.sessions,
    attendanceRecords: attendance.records,
    classConfig: config.classConfig,
    featureFlags: config.featureFlags,
    subjects: config.subjects,
    quotes: config.quotes,
    legacyCompat,
    warnings
  };
  const warningSummary = buildWarningSummary(normalized.warnings);

  const hasImportableCoreData =
    normalized.students.length > 0 ||
    normalized.pointTransactions.length > 0 ||
    normalized.pointReasonTemplates.length > 0 ||
    normalized.attendanceSessions.length > 0 ||
    normalized.attendanceRecords.length > 0 ||
    normalized.groups.length > 0 ||
    normalized.dormitories.length > 0 ||
    normalized.positions.length > 0 ||
    normalized.featureFlags.length > 0 ||
    normalized.subjects.length > 0 ||
    normalized.quotes.length > 0;
  const hasSourceSystemConfig = Boolean(legacy.config?.value?.systemConfig);
  const shouldSkipNormalizedOutput = !hasImportableCoreData && !hasSourceSystemConfig;

  ensureDir(outputDir);
  if (shouldSkipNormalizedOutput) {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    return {
      outputPath: null,
      summary: {
        userId: user.id,
        username: user.username || null,
        students: normalized.students.length,
        pointTransactions: normalized.pointTransactions.length,
        attendanceSessions: normalized.attendanceSessions.length,
        attendanceRecords: normalized.attendanceRecords.length,
        warnings: warningSummary.warnings,
        reviews: warningSummary.reviews,
        blockers: warningSummary.blockers,
        infos: warningSummary.infos,
        totalWarnings: warningSummary.total,
        skipped: true,
        skipReason: "no importable class data"
      }
    };
  }

  writeJson(outputPath, normalized);

  return {
    outputPath,
    summary: {
      userId: user.id,
      username: user.username || null,
      students: normalized.students.length,
      pointTransactions: normalized.pointTransactions.length,
      attendanceSessions: normalized.attendanceSessions.length,
      attendanceRecords: normalized.attendanceRecords.length,
      warnings: warningSummary.warnings,
      reviews: warningSummary.reviews,
      blockers: warningSummary.blockers,
      infos: warningSummary.infos,
      totalWarnings: warningSummary.total,
      skipped: false
    }
  };
}

function main() {
  const args = parseArgs(process.argv);
  const files = getSourceFiles(args);
  ensureDir(outputDir);

  const summaries = files.map(normalizeUserFile);
  writeJson(path.join(outputDir, "summary.json"), {
    normalizedAt: new Date().toISOString(),
    files: summaries
  });

  for (const entry of summaries) {
    if (entry.summary.skipped) {
      console.log(
        `Skipped user ${entry.summary.userId} (${entry.summary.username}): ` +
          `${entry.summary.skipReason}, ${formatWarningSummary(entry.summary)}`
      );
    } else {
      console.log(
        `Normalized user ${entry.summary.userId} (${entry.summary.username}): ` +
          `${entry.summary.students} students, ` +
          `${entry.summary.pointTransactions} transactions, ` +
          `${entry.summary.attendanceRecords} attendance records, ` +
          `${formatWarningSummary(entry.summary)}`
      );
    }
  }
}

main();
