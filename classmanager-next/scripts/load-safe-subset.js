const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { PrismaClient } = require("@prisma/client");
const { getDefaultTenantRoles, getLegacyPrimaryRoleCode } = require("./role-catalog");
const { validateData, classifyIssue } = require("./validate-normalized-data");

const workspaceRoot = path.resolve(__dirname, "..");
const normalizedDir = path.join(workspaceRoot, "out", "normalized");
const policyPath = path.join(__dirname, "migration-warning-policy.json");
const legacyDbPath = path.resolve(workspaceRoot, "..", "database", "classmanager.db");
const MIGRATED_LOGIN_DISABLED = "MIGRATED_LOGIN_DISABLED";

let legacyDbInstance = null;
let legacyDbChecked = false;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeIsoDateString(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }
  const parsed = new Date(`${normalized}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null;
}

function normalizeAttendancePolicyForScheduleCodes(attendancePolicy, attendanceSchedules) {
  const scheduleCodes = Array.isArray(attendanceSchedules)
    ? attendanceSchedules.map((item) => String(item?.code || item?.id || "").trim())
    : [];
  const rawWeekendRules =
    attendancePolicy?.weekendRules && typeof attendancePolicy.weekendRules === "object" && !Array.isArray(attendancePolicy.weekendRules)
      ? attendancePolicy.weekendRules
      : {};
  const rawSpecialRules =
    attendancePolicy?.specialRules && typeof attendancePolicy.specialRules === "object" && !Array.isArray(attendancePolicy.specialRules)
      ? attendancePolicy.specialRules
      : {};

  const weekendRules = Object.fromEntries(
    Object.entries(rawWeekendRules).map(([weekday, value]) => [
      weekday,
      Array.isArray(value)
        ? Array.from(
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
          )
        : []
    ])
  );

  let specialRules = rawSpecialRules;
  const rawSundaySpecialLateTime =
    rawSpecialRules.sundaySpecialLateTime &&
    typeof rawSpecialRules.sundaySpecialLateTime === "object" &&
    !Array.isArray(rawSpecialRules.sundaySpecialLateTime)
      ? rawSpecialRules.sundaySpecialLateTime
      : null;
  if (rawSundaySpecialLateTime) {
    specialRules = {
      ...rawSpecialRules,
      sundaySpecialLateTime: Object.fromEntries(
        Object.entries(rawSundaySpecialLateTime)
          .map(([rawKey, rawValue]) => {
            const token = String(rawKey || "").trim();
            if (!token || rawValue == null) {
              return null;
            }
            const normalizedKey =
              /^\d+$/.test(token) && scheduleCodes[Number(token)]
                ? scheduleCodes[Number(token)]
                : token;
            return normalizedKey ? [normalizedKey, String(rawValue).trim()] : null;
          })
          .filter(Boolean)
      )
    };
  }

  return {
    latePenaltyValue: attendancePolicy?.latePenaltyValue,
    absentPenaltyValue: attendancePolicy?.absentPenaltyValue,
    perfectAttendanceBonusValue: attendancePolicy?.perfectAttendanceBonusValue,
    weekendRules,
    specialRules
  };
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

async function deleteLegacyEntityMapping(tx, tenantId, entityType, legacyScope, legacyKey) {
  if (!legacyKey) {
    return;
  }

  await tx.migrationMapping.deleteMany({
    where: {
      tenantId,
      entityType,
      legacyScope,
      legacyKey
    }
  });
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

async function deactivateStaleImportedEntities(tx, input) {
  const { tenantId, classId, entityType, legacyScope, activeLegacyKeys } = input;
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
    return;
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
  if (staleEntityIds.length) {
    if (entityType === "group") {
      await tx.group.updateMany({
        where: {
          classId,
          id: {
            in: staleEntityIds
          }
        },
        data: {
          isActive: false
        }
      });
    } else if (entityType === "dormitory") {
      await tx.dormitory.updateMany({
        where: {
          classId,
          id: {
            in: staleEntityIds
          }
        },
        data: {
          isActive: false
        }
      });
    } else if (entityType === "position") {
      await tx.position.updateMany({
        where: {
          classId,
          id: {
            in: staleEntityIds
          }
        },
        data: {
          isActive: false
        }
      });
    }
  }

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
}

function getLegacyDb() {
  if (legacyDbChecked) {
    return legacyDbInstance;
  }

  legacyDbChecked = true;
  if (!fs.existsSync(legacyDbPath)) {
    return null;
  }

  legacyDbInstance = new Database(legacyDbPath, { readonly: true, fileMustExist: true });
  return legacyDbInstance;
}

function resolveLegacyPasswordHash(user) {
  const db = getLegacyDb();
  if (!db) {
    return null;
  }

  const legacyId = Number(user?.legacyId);
  let row = null;

  if (Number.isInteger(legacyId) && legacyId > 0) {
    row =
      db
        .prepare("SELECT password_hash FROM users WHERE id = ? LIMIT 1")
        .get(legacyId) || null;
  }

  if (!row && user?.username) {
    row =
      db
        .prepare("SELECT password_hash FROM users WHERE username = ? LIMIT 1")
        .get(String(user.username)) || null;
  }

  return row && typeof row.password_hash === "string" && row.password_hash.trim().length > 0
    ? row.password_hash
    : null;
}

function parseArgs(argv) {
  const args = {
    input: "",
    apply: false,
    allowReview: false,
    confirm: ""
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--apply") {
      args.apply = true;
      continue;
    }
    if (token === "--allow-review") {
      args.allowReview = true;
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

function getExpectedConfirmToken(data) {
  return `SAFE_SUBSET:${data.tenant.slug}`;
}

function ensureApplyGuard(args, data) {
  if (!args.apply) return;

  const expected = getExpectedConfirmToken(data);
  if (args.confirm !== expected) {
    throw new Error(
      `Refusing to write. Re-run with --confirm ${expected}`
    );
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

function getInputFile(input) {
  if (!input) {
    throw new Error("Use --input <normalized-file>");
  }

  const candidatePaths = path.isAbsolute(input)
    ? [input]
    : [path.resolve(process.cwd(), input), path.join(normalizedDir, input)];

  const filePath = candidatePaths.find((item) => fs.existsSync(item));
  if (!fs.existsSync(filePath)) {
    throw new Error(`Normalized file not found: ${candidatePaths.join(" | ")}`);
  }
  return filePath;
}

function classifyWarnings(warnings, policy) {
  return warnings.map((message) => {
    let severity = "warn";
    let action = "none";

    for (const rule of policy.rules || []) {
      if (rule.matchType === "message_contains" && message.includes(rule.pattern)) {
        severity = rule.severity;
        action = rule.action;
        break;
      }
    }

    return { message, severity, action };
  });
}

function ensureNoBlockers(data, policy, allowReview) {
  const validationReport = validateData(data, "<normalized-data>");
  const validationErrors = validationReport.issues.filter((issue) => issue.severity === "error");
  if (validationErrors.length > 0) {
    throw new Error(
      `Import blocked by ${validationErrors.length} validation errors:\n${validationErrors
        .slice(0, 20)
        .map((item) => `- ${item.code}: ${item.message}`)
        .join("\n")}`
    );
  }

  const classifiedIssues = validationReport.issues
    .map((issue) => ({
      issue,
      policy: classifyIssue(policy, issue)
    }))
    .filter((item) => item.policy.severity === "blocker");
  if (classifiedIssues.length > 0) {
    throw new Error(
      `Import blocked by ${classifiedIssues.length} blocker issues:\n${classifiedIssues
        .slice(0, 20)
        .map((item) => `- ${item.issue.code}: ${item.issue.message}`)
        .join("\n")}`
    );
  }

  const validationReviews = validationReport.issues
    .map((issue) => ({
      issue,
      policy: classifyIssue(policy, issue)
    }))
    .filter((item) => item.policy.severity === "review");
  if (!allowReview && validationReviews.length > 0) {
    throw new Error(
      `Import contains ${validationReviews.length} review validation issues. Re-run with --allow-review after manual confirmation.\n${validationReviews
        .slice(0, 20)
        .map((item) => `- ${item.issue.code}: ${item.issue.message}`)
        .join("\n")}`
    );
  }

  const classified = classifyWarnings(data.warnings || [], policy);
  const blockers = classified.filter((item) => item.severity === "blocker");
  const reviews = classified.filter((item) => item.severity === "review");

  if (blockers.length > 0) {
    throw new Error(
      `Import blocked by ${blockers.length} blocker warnings:\n${blockers
        .slice(0, 20)
        .map((item) => `- ${item.message}`)
        .join("\n")}`
    );
  }

  if (!allowReview && reviews.length > 0) {
    throw new Error(
      `Import contains ${reviews.length} review warnings. Re-run with --allow-review after manual confirmation.`
    );
  }

  return {
    blockers: blockers.length,
    reviews: reviews.length + validationReviews.length,
    infos: classified.filter((item) => item.severity === "info").length
  };
}

function countStudentProfilesWithAvatarData(studentProfiles) {
  return (studentProfiles || []).filter((item) =>
    typeof item?.avatarHappyData === "string" ||
    typeof item?.avatarNormalData === "string" ||
    typeof item?.avatarSadData === "string"
  ).length;
}

function buildPlan(data, warningSummary) {
  return {
    tenant: data.tenant,
    class: data.class,
    counts: {
      groups: (data.groups || []).length,
      dormitories: (data.dormitories || []).length,
      positions: (data.positions || []).length,
      students: (data.students || []).length,
      pointAccounts: (data.pointAccounts || []).length,
      pointReasonTemplates: (data.pointReasonTemplates || []).length,
      pointTransactions: (data.pointTransactions || []).length,
      attendanceSchedules: (data.attendanceSchedules || []).length,
      featureFlags: (data.featureFlags || []).length
    },
    skipped: {
      studentProfiles: (data.studentProfiles || []).length,
      studentProfilesWithAvatarData: countStudentProfilesWithAvatarData(data.studentProfiles || []),
      deferredAttendanceSessions: (data.attendanceSessions || []).length,
      deferredAttendanceRecords: (data.attendanceRecords || []).length,
      warnings: warningSummary
    }
  };
}

function normalizeStudentSortOrder(value, fallbackIndex) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 2147483647) {
    return numeric;
  }
  return fallbackIndex;
}

const DUTY_DAY_ORDER = ["mon", "tue", "wed", "thu", "fri"];

function buildDutyConfig(duty, studentIdByName) {
  const raw = duty && typeof duty === "object" && !Array.isArray(duty) ? duty : {};

  return Object.fromEntries(
    DUTY_DAY_ORDER.map((dayCode) => [
      dayCode,
      Array.from(
        new Set(
          (Array.isArray(raw[dayCode]) ? raw[dayCode] : [])
            .map((item) => (typeof item === "string" ? studentIdByName.get(item.trim()) || null : null))
            .filter(Boolean)
        )
      )
    ])
  );
}

function buildLegacyStudentItemMap(rawMap, studentIdByLegacyRef) {
  const raw = rawMap && typeof rawMap === "object" && !Array.isArray(rawMap) ? rawMap : {};
  const normalized = {};

  for (const [studentLegacyRef, itemMap] of Object.entries(raw)) {
    const studentId = studentIdByLegacyRef.get(studentLegacyRef);
    if (!studentId || !itemMap || typeof itemMap !== "object" || Array.isArray(itemMap)) {
      continue;
    }

    const normalizedItems = Object.fromEntries(
      Object.entries(itemMap)
        .map(([itemId, count]) => [String(itemId).trim(), Number(count)])
        .filter(([itemId, count]) => itemId.length > 0 && Number.isFinite(count) && count > 0)
    );

    if (Object.keys(normalizedItems).length > 0) {
      normalized[studentId] = normalizedItems;
    }
  }

  return normalized;
}

function buildLegacyDateItemCountMap(rawMap) {
  const raw = rawMap && typeof rawMap === "object" && !Array.isArray(rawMap) ? rawMap : {};

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

function buildAvatarMappingMetadata(profile) {
  const avatarData = {
    happy: typeof profile?.avatarHappyData === "string" ? profile.avatarHappyData : null,
    normal: typeof profile?.avatarNormalData === "string" ? profile.avatarNormalData : null,
    sad: typeof profile?.avatarSadData === "string" ? profile.avatarSadData : null
  };

  if (!avatarData.happy && !avatarData.normal && !avatarData.sad) {
    return null;
  }

  return {
    source: "legacy-safe-subset",
    avatarData
  };
}

function buildLegacyCompat(dataLegacyCompat, studentIdByLegacyRef) {
  const raw = dataLegacyCompat && typeof dataLegacyCompat === "object" && !Array.isArray(dataLegacyCompat)
    ? dataLegacyCompat
    : null;
  if (!raw) {
    return null;
  }

  const messages = Array.isArray(raw.messages)
    ? raw.messages
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
        .filter(Boolean)
    : [];

  const teacherMessages = Array.isArray(raw.teacherMessages)
    ? raw.teacherMessages
        .map((item, index) => {
          const row = item && typeof item === "object" ? item : {};
          const content = row.content == null ? "" : String(row.content).trim();
          if (!content) return null;

          return {
            id: row.id == null ? `teacher-message-${index + 1}` : String(row.id).trim() || `teacher-message-${index + 1}`,
            content,
            time: row.time == null ? null : String(row.time).trim() || null,
            date: row.date == null ? null : String(row.date).trim() || null
          };
        })
        .filter(Boolean)
    : [];

  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .map((item, index) => {
          const row = item && typeof item === "object" ? item : {};
          const title = row.title == null ? "" : String(row.title).trim();
          if (!title) return null;

          return {
            id: row.id == null ? `task-${index + 1}` : String(row.id).trim() || `task-${index + 1}`,
            title,
            desc: row.desc == null ? "" : String(row.desc).trim(),
            points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0,
            startTime: row.startTime == null ? null : String(row.startTime).trim() || null,
            endTime: row.endTime == null ? null : String(row.endTime).trim() || null,
            claimedByStudentIds: Array.isArray(row.claimedByStudentLegacyRefs)
              ? Array.from(
                  new Set(
                    row.claimedByStudentLegacyRefs
                      .map((studentLegacyRef) => studentIdByLegacyRef.get(studentLegacyRef))
                      .filter(Boolean)
                  )
                )
              : []
          };
        })
        .filter(Boolean)
    : [];

  const shopRaw = raw.shop && typeof raw.shop === "object" && !Array.isArray(raw.shop) ? raw.shop : {};
  const shop = {
    treasures: Array.isArray(shopRaw.treasures)
      ? shopRaw.treasures
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
                ? row.ladderPrices.map((price) => Number(price)).filter((price) => Number.isFinite(price))
                : [],
              dailyLimit: Number.isFinite(Number(row.dailyLimit)) ? Number(row.dailyLimit) : 0
            };
          })
          .filter(Boolean)
      : [],
    storage: buildLegacyStudentItemMap(shopRaw.storage, studentIdByLegacyRef),
    logs: Array.isArray(shopRaw.logs)
      ? shopRaw.logs
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
          .filter(Boolean)
      : [],
    redemptionHistory: buildLegacyStudentItemMap(shopRaw.redemptionHistory, studentIdByLegacyRef),
    dailyRedemptionCounts: buildLegacyDateItemCountMap(shopRaw.dailyRedemptionCounts),
    dailyUsageCounts: buildLegacyDateItemCountMap(shopRaw.dailyUsageCounts)
  };

  const battleRaw = raw.battle && typeof raw.battle === "object" && !Array.isArray(raw.battle) ? raw.battle : null;
  const battle =
    battleRaw &&
    (Array.isArray(battleRaw.teams) ||
      Array.isArray(battleRaw.squads) ||
      Array.isArray(battleRaw.battles) ||
      Array.isArray(battleRaw.logs) ||
      Array.isArray(battleRaw.history) ||
      Array.isArray(battleRaw.settlements) ||
      Array.isArray(battleRaw.exams) ||
      (battleRaw.rules && typeof battleRaw.rules === "object" && !Array.isArray(battleRaw.rules)) ||
      battleRaw.teamBaseExamId != null ||
      battleRaw.settleExamId != null)
      ? {
          version: Number.isFinite(Number(battleRaw.version)) ? Number(battleRaw.version) : 1,
          teams: Array.isArray(battleRaw.teams)
            ? battleRaw.teams
                .map((item, index) => {
                  const row = item && typeof item === "object" ? item : {};
                  const id = row.id == null ? `team-${index + 1}` : String(row.id).trim();
                  const name = row.name == null ? "" : String(row.name).trim();
                  if (!id || !name) return null;

                  return {
                    id,
                    name,
                    memberStudentIds: Array.isArray(row.memberStudentLegacyRefs)
                      ? Array.from(
                          new Set(
                            row.memberStudentLegacyRefs
                              .map((studentLegacyRef) => studentIdByLegacyRef.get(studentLegacyRef))
                              .filter(Boolean)
                          )
                        )
                      : [],
                    points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0
                  };
                })
                .filter(Boolean)
            : [],
          squads: Array.isArray(battleRaw.squads)
            ? battleRaw.squads
                .map((item, index) => {
                  const row = item && typeof item === "object" ? item : {};
                  const id = row.id == null ? `squad-${index + 1}` : String(row.id).trim();
                  const name = row.name == null ? "" : String(row.name).trim();
                  if (!id || !name) return null;
                  return {
                    id,
                    name,
                    teamIds: Array.isArray(row.teamIds)
                      ? Array.from(new Set(row.teamIds.map((teamId) => String(teamId).trim()).filter(Boolean)))
                      : []
                  };
                })
                .filter(Boolean)
            : [],
          battles: Array.isArray(battleRaw.battles)
            ? battleRaw.battles
                .map((item, index) => {
                  const row = item && typeof item === "object" ? item : {};
                  const id = row.id == null ? `battle-${index + 1}` : String(row.id).trim();
                  const teamAId = row.teamAId == null ? "" : String(row.teamAId).trim();
                  const teamBId = row.teamBId == null ? "" : String(row.teamBId).trim();
                  if (!id || !teamAId || !teamBId) return null;

                  return {
                    id,
                    teamAId,
                    teamBId,
                    stake: Number.isFinite(Number(row.stake)) ? Number(row.stake) : 0,
                    isUnderdog: Boolean(row.isUnderdog)
                  };
                })
                .filter(Boolean)
            : [],
          logs: Array.isArray(battleRaw.logs)
            ? battleRaw.logs
                .map((item, index) => {
                  const row = item && typeof item === "object" ? item : {};
                  const msg = row.msg == null ? "" : String(row.msg).trim();
                  if (!msg) return null;
                  return {
                    id: row.id == null ? `battle-log-${index + 1}` : String(row.id).trim() || `battle-log-${index + 1}`,
                    time: row.time == null ? null : String(row.time).trim() || null,
                    msg
                  };
                })
                .filter(Boolean)
            : [],
          history: Array.isArray(battleRaw.history) ? battleRaw.history : [],
          settlements: Array.isArray(battleRaw.settlements) ? battleRaw.settlements : [],
          season: Number.isFinite(Number(battleRaw.season)) ? Number(battleRaw.season) : 1,
          rules: battleRaw.rules && typeof battleRaw.rules === "object" && !Array.isArray(battleRaw.rules) ? battleRaw.rules : {},
          exams: Array.isArray(battleRaw.exams) ? battleRaw.exams : [],
          teamBaseExamId: battleRaw.teamBaseExamId == null ? null : String(battleRaw.teamBaseExamId).trim() || null,
          settleExamId: battleRaw.settleExamId == null ? null : String(battleRaw.settleExamId).trim() || null
        }
      : null;

  const strategyDatesRaw =
    raw.strategyDates && typeof raw.strategyDates === "object" && !Array.isArray(raw.strategyDates)
      ? raw.strategyDates
      : null;
  const lastPeriodicTaskDate = normalizeIsoDateString(strategyDatesRaw?.lastPeriodicTaskDate);
  const lastPenaltyReductionDate = normalizeIsoDateString(strategyDatesRaw?.lastPenaltyReductionDate);
  const strategyDates =
    lastPeriodicTaskDate || lastPenaltyReductionDate
      ? {
          lastPeriodicTaskDate: lastPeriodicTaskDate || null,
          lastPenaltyReductionDate: lastPenaltyReductionDate || null
        }
      : null;

  const hasData =
    messages.length > 0 ||
    teacherMessages.length > 0 ||
    tasks.length > 0 ||
    shop.treasures.length > 0 ||
    Object.keys(shop.storage).length > 0 ||
    shop.logs.length > 0 ||
    Object.keys(shop.redemptionHistory).length > 0 ||
    Object.keys(shop.dailyRedemptionCounts).length > 0 ||
    Object.keys(shop.dailyUsageCounts).length > 0 ||
    Boolean(battle) ||
    Boolean(strategyDates);

  if (!hasData) {
    return null;
  }

  return {
    messages,
    teacherMessages,
    tasks,
    shop,
    battle,
    ...(strategyDates ? { strategyDates } : {})
  };
}

function buildClassConfigExtra(data, groupIdByLegacyKey, studentIdByLegacyRef, studentIdByName) {
  const legacyCompat = buildLegacyCompat(data.legacyCompat, studentIdByLegacyRef);
  const lastWageDate = normalizeIsoDateString(data.classConfig.lastWageDate);

  return {
    duty: buildDutyConfig(data.classConfig.duty, studentIdByName),
    quotes: Array.isArray(data.quotes)
      ? data.quotes
          .map((item) => (item == null ? "" : String(item).trim()))
          .filter((item) => item.length > 0)
          .slice(0, 500)
      : [],
    dailyWageAmount: Number.isFinite(Number(data.classConfig.dailyWageAmount))
      ? Number(data.classConfig.dailyWageAmount)
      : 5,
    dailyWageGroupIds: (data.classConfig.dailyWageGroupLegacyKeys || [])
      .map((item) => groupIdByLegacyKey.get(item))
      .filter(Boolean),
    psychologyCommitteeStudentIds: (data.classConfig.psychologyCommitteeStudentLegacyRefs || [])
      .map((item) => studentIdByLegacyRef.get(item))
      .filter(Boolean),
    ...(lastWageDate ? { lastWageDate } : {}),
    studentCouncilRoles: (data.classConfig.studentCouncilRoles || []).map((item) => ({
      id: item.id,
      name: item.name,
      studentId: item.studentLegacyRef ? studentIdByLegacyRef.get(item.studentLegacyRef) || null : null
    })),
    subjects: (data.subjects || []).map((item, index) => ({
      id: item?.id ? String(item.id) : `subject_${index + 1}`,
      name: item?.name ? String(item.name) : `学科${index + 1}`,
      representativeStudentIds: Array.from(
        new Set(
          (Array.isArray(item?.representatives) ? item.representatives : [])
            .map((studentLegacyId) => studentIdByLegacyRef.get(`student:${studentLegacyId}`))
            .filter(Boolean)
          )
      )
    })),
    ...(legacyCompat ? { legacyCompat } : {})
  };
}

async function loadSafeSubset(prisma, data) {
  return prisma.$transaction(async (tx) => {
    const legacyPasswordHash = resolveLegacyPasswordHash(data.user);
    const existingUser = await tx.user.findUnique({
      where: { username: data.user.username },
      select: {
        id: true,
        passwordHash: true,
        status: true
      }
    });

    let user;
    if (existingUser) {
      user = await tx.user.update({
        where: { id: existingUser.id },
        data: {
          email: data.user.email,
          displayName: data.user.username,
          ...(legacyPasswordHash
            ? {
                passwordHash: legacyPasswordHash,
                status: "active"
              }
            : {})
        }
      });
    } else {
      user = await tx.user.create({
        data: {
          username: data.user.username,
          email: data.user.email,
          passwordHash: legacyPasswordHash || MIGRATED_LOGIN_DISABLED,
          displayName: data.user.username,
          status: legacyPasswordHash ? "active" : "invited"
        }
      });
    }

    const tenant = await tx.tenant.upsert({
      where: { slug: data.tenant.slug },
      update: {
        name: data.tenant.name,
        type: data.tenant.type,
        status: "active",
        ownerUserId: user.id
      },
      create: {
        name: data.tenant.name,
        slug: data.tenant.slug,
        type: data.tenant.type,
        status: "active",
        ownerUserId: user.id
      }
    });

    const membership = await tx.membership.upsert({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: user.id
        }
      },
      update: {
        displayName: data.user.username,
        status: "active"
      },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        displayName: data.user.username,
        status: "active"
      }
    });

    for (const roleSeed of getDefaultTenantRoles()) {
      await tx.role.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: roleSeed.code
          }
        },
        update: {
          name: roleSeed.name,
          scope: roleSeed.scope
        },
        create: {
          tenantId: tenant.id,
          code: roleSeed.code,
          name: roleSeed.name,
          scope: roleSeed.scope
        }
      });
    }

    const roleCode = getLegacyPrimaryRoleCode(data);
    const role = await tx.role.findUniqueOrThrow({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: roleCode
        }
      }
    });

    await tx.membershipRole.upsert({
      where: {
        membershipId_roleId: {
          membershipId: membership.id,
          roleId: role.id
        }
      },
      update: {},
      create: {
        membershipId: membership.id,
        roleId: role.id
      }
    });

    const classRecord = await tx.class.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: data.class.name
        }
      },
      update: {
        code: data.class.code,
        timezone: data.class.timezone
      },
      create: {
        tenantId: tenant.id,
        name: data.class.name,
        code: data.class.code,
        timezone: data.class.timezone
      }
    });

    const importJob = await tx.importJob.create({
      data: {
        tenantId: tenant.id,
        classId: classRecord.id,
        jobType: "legacy_safe_subset_import",
        status: "running",
        sourceFilename: path.basename(data.meta?.sourceFile || "normalized.json"),
        triggeredByUserId: user.id,
        summary: {
          sourceUsername: data.meta?.sourceUsername || null,
          sourceUserId: data.meta?.sourceUserId || null,
          counts: {
            groups: (data.groups || []).length,
            dormitories: (data.dormitories || []).length,
            positions: (data.positions || []).length,
            students: (data.students || []).length,
            pointTransactions: (data.pointTransactions || []).length,
            attendanceSchedules: (data.attendanceSchedules || []).length,
            featureFlags: (data.featureFlags || []).length
          }
        }
      }
    });

    await tx.classConfig.upsert({
      where: { classId: classRecord.id },
      update: {
        className: data.classConfig.className,
        timezone: data.classConfig.timezone,
        isFrozen: Boolean(data.classConfig.isFrozen),
        scheduleNotes: data.classConfig.scheduleNotes || {},
        countdownEvents: data.classConfig.countdownEvents || [],
        extra: {
          duty: data.classConfig.duty || {}
        }
      },
      create: {
        classId: classRecord.id,
        tenantId: tenant.id,
        className: data.classConfig.className,
        timezone: data.classConfig.timezone,
        isFrozen: Boolean(data.classConfig.isFrozen),
        scheduleNotes: data.classConfig.scheduleNotes || {},
        countdownEvents: data.classConfig.countdownEvents || [],
        extra: {
          duty: data.classConfig.duty || {}
        }
      }
    });

    const normalizedAttendancePolicy = normalizeAttendancePolicyForScheduleCodes(
      data.attendancePolicy || {},
      data.attendanceSchedules || []
    );

    await tx.attendancePolicy.upsert({
      where: { classId: classRecord.id },
      update: {
        latePenaltyValue: normalizedAttendancePolicy.latePenaltyValue,
        absentPenaltyValue: normalizedAttendancePolicy.absentPenaltyValue,
        perfectAttendanceBonusValue: normalizedAttendancePolicy.perfectAttendanceBonusValue,
        weekendRules: normalizedAttendancePolicy.weekendRules,
        specialRules: normalizedAttendancePolicy.specialRules
      },
      create: {
        tenantId: tenant.id,
        classId: classRecord.id,
        latePenaltyValue: normalizedAttendancePolicy.latePenaltyValue,
        absentPenaltyValue: normalizedAttendancePolicy.absentPenaltyValue,
        perfectAttendanceBonusValue: normalizedAttendancePolicy.perfectAttendanceBonusValue,
        weekendRules: normalizedAttendancePolicy.weekendRules,
        specialRules: normalizedAttendancePolicy.specialRules
      }
    });

    const activeGroupLegacyKeys = new Set(
      (data.groups || []).map((item) => item.legacyKey).filter(Boolean)
    );
    const groupIdByLegacyKey = new Map();
    for (const group of data.groups || []) {
      const mappedGroupId = await findMappedEntityId(
        tx,
        tenant.id,
        "group",
        data.tenant.slug,
        group.legacyKey
      );

      let existingGroup =
        mappedGroupId
          ? await tx.group.findFirst({
              where: {
                id: mappedGroupId,
                classId: classRecord.id
              },
              select: {
                id: true,
                legacyKey: true
              }
            })
          : null;

      if (!existingGroup && group.legacyKey) {
        existingGroup = await tx.group.findUnique({
          where: {
            classId_legacyKey: {
              classId: classRecord.id,
              legacyKey: group.legacyKey
            }
          },
          select: {
            id: true,
            legacyKey: true
          }
        });
      }

      if (!existingGroup) {
        existingGroup = await tx.group.findUnique({
          where: {
            classId_name: {
              classId: classRecord.id,
              name: group.name
            }
          },
          select: {
            id: true,
            legacyKey: true
          }
        });
        if (existingGroup?.legacyKey && existingGroup.legacyKey !== group.legacyKey) {
          await deleteLegacyEntityMapping(
            tx,
            tenant.id,
            "group",
            data.tenant.slug,
            existingGroup.legacyKey
          );
        }
      }

      const created =
        existingGroup
          ? await tx.group.update({
              where: { id: existingGroup.id },
              data: {
                legacyKey: group.legacyKey,
                name: group.name,
                colorToken: group.colorToken,
                isActive: true
              }
            })
          : await tx.group.create({
              data: {
                tenantId: tenant.id,
                classId: classRecord.id,
                legacyKey: group.legacyKey,
                name: group.name,
                colorToken: group.colorToken,
                isActive: true
              }
            });

      await deleteOtherEntityMappings(
        tx,
        tenant.id,
        "group",
        data.tenant.slug,
        created.id,
        group.legacyKey
      );
      if (group.legacyKey) {
        groupIdByLegacyKey.set(group.legacyKey, created.id);
      }
      if (group.legacyKey) {
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: tenant.id,
              entityType: "group",
              legacyScope: data.tenant.slug,
              legacyKey: group.legacyKey
            }
          },
          update: {
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          },
          create: {
            tenantId: tenant.id,
            entityType: "group",
            legacyScope: data.tenant.slug,
            legacyKey: group.legacyKey,
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          }
        });
      }
    }
    await deactivateStaleImportedEntities(tx, {
      tenantId: tenant.id,
      classId: classRecord.id,
      entityType: "group",
      legacyScope: data.tenant.slug,
      activeLegacyKeys: activeGroupLegacyKeys
    });

    const activeDormitoryLegacyKeys = new Set(
      (data.dormitories || []).map((item) => item.legacyKey).filter(Boolean)
    );
    const dormitoryIdByLegacyKey = new Map();
    for (const dorm of data.dormitories || []) {
      const mappedDormitoryId = await findMappedEntityId(
        tx,
        tenant.id,
        "dormitory",
        data.tenant.slug,
        dorm.legacyKey
      );

      let existingDormitory =
        mappedDormitoryId
          ? await tx.dormitory.findFirst({
              where: {
                id: mappedDormitoryId,
                classId: classRecord.id
              },
              select: {
                id: true,
                legacyKey: true
              }
            })
          : null;

      if (!existingDormitory && dorm.legacyKey) {
        existingDormitory = await tx.dormitory.findUnique({
          where: {
            classId_legacyKey: {
              classId: classRecord.id,
              legacyKey: dorm.legacyKey
            }
          },
          select: {
            id: true,
            legacyKey: true
          }
        });
      }

      if (!existingDormitory) {
        existingDormitory = await tx.dormitory.findUnique({
          where: {
            classId_name: {
              classId: classRecord.id,
              name: dorm.name
            }
          },
          select: {
            id: true,
            legacyKey: true
          }
        });
        if (existingDormitory?.legacyKey && existingDormitory.legacyKey !== dorm.legacyKey) {
          await deleteLegacyEntityMapping(
            tx,
            tenant.id,
            "dormitory",
            data.tenant.slug,
            existingDormitory.legacyKey
          );
        }
      }

      const created =
        existingDormitory
          ? await tx.dormitory.update({
              where: { id: existingDormitory.id },
              data: {
                legacyKey: dorm.legacyKey,
                name: dorm.name,
                isActive: true
              }
            })
          : await tx.dormitory.create({
              data: {
                tenantId: tenant.id,
                classId: classRecord.id,
                legacyKey: dorm.legacyKey,
                name: dorm.name,
                isActive: true
              }
            });

      await deleteOtherEntityMappings(
        tx,
        tenant.id,
        "dormitory",
        data.tenant.slug,
        created.id,
        dorm.legacyKey
      );
      if (dorm.legacyKey) {
        dormitoryIdByLegacyKey.set(dorm.legacyKey, created.id);
      }
      if (dorm.legacyKey) {
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: tenant.id,
              entityType: "dormitory",
              legacyScope: data.tenant.slug,
              legacyKey: dorm.legacyKey
            }
          },
          update: {
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          },
          create: {
            tenantId: tenant.id,
            entityType: "dormitory",
            legacyScope: data.tenant.slug,
            legacyKey: dorm.legacyKey,
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          }
        });
      }
    }
    await deactivateStaleImportedEntities(tx, {
      tenantId: tenant.id,
      classId: classRecord.id,
      entityType: "dormitory",
      legacyScope: data.tenant.slug,
      activeLegacyKeys: activeDormitoryLegacyKeys
    });

    const activePositionLegacyKeys = new Set(
      (data.positions || []).map((item) => item.legacyKey).filter(Boolean)
    );
    const positionIdByLegacyKey = new Map();
    for (const position of data.positions || []) {
      const mappedPositionId = await findMappedEntityId(
        tx,
        tenant.id,
        "position",
        data.tenant.slug,
        position.legacyKey
      );

      let existingPosition = await tx.position.findUnique({
        where: {
          classId_code: {
            classId: classRecord.id,
            code: position.code
          }
        },
        select: {
          id: true
        }
      });

      if (!existingPosition && mappedPositionId) {
        existingPosition = await tx.position.findFirst({
          where: {
            id: mappedPositionId,
            classId: classRecord.id
          },
          select: {
            id: true
          }
        });
      }

      const created =
        existingPosition
          ? await tx.position.update({
              where: { id: existingPosition.id },
              data: {
                code: position.code,
                name: position.name,
                category: position.category,
                isActive: true
              }
            })
          : await tx.position.create({
              data: {
                tenantId: tenant.id,
                classId: classRecord.id,
                code: position.code,
                name: position.name,
                category: position.category,
                isActive: true
              }
            });

      await deleteOtherEntityMappings(
        tx,
        tenant.id,
        "position",
        data.tenant.slug,
        created.id,
        position.legacyKey
      );
      if (position.legacyKey) {
        positionIdByLegacyKey.set(position.legacyKey, created.id);
      }
      if (position.legacyKey) {
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: tenant.id,
              entityType: "position",
              legacyScope: data.tenant.slug,
              legacyKey: position.legacyKey
            }
          },
          update: {
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          },
          create: {
            tenantId: tenant.id,
            entityType: "position",
            legacyScope: data.tenant.slug,
            legacyKey: position.legacyKey,
            newId: created.id,
            metadata: { source: "legacy-safe-subset" }
          }
        });
      }
    }
    await deactivateStaleImportedEntities(tx, {
      tenantId: tenant.id,
      classId: classRecord.id,
      entityType: "position",
      legacyScope: data.tenant.slug,
      activeLegacyKeys: activePositionLegacyKeys
    });

    const profileByStudentLegacyRef = new Map(
      (data.studentProfiles || []).map((item) => [item.studentLegacyRef, item])
    );
    const studentIdByLegacyRef = new Map();
    const studentIdByName = new Map();
    for (const [index, student] of (data.students || []).entries()) {
      const sortOrder = normalizeStudentSortOrder(student.sortOrder, index);
      const profile = profileByStudentLegacyRef.get(student.legacyRef);
      const created = await tx.student.upsert({
        where: {
          classId_legacyId: {
            classId: classRecord.id,
            legacyId: BigInt(student.legacyId)
          }
        },
        update: {
          name: student.name,
          gender: student.gender,
          status: student.status,
          sortOrder
        },
        create: {
          tenantId: tenant.id,
          classId: classRecord.id,
          legacyId: BigInt(student.legacyId),
          studentNo: student.studentNo,
          name: student.name,
          gender: student.gender,
          status: student.status,
          sortOrder
        }
      });
      studentIdByLegacyRef.set(student.legacyRef, created.id);
      if (student.name && !studentIdByName.has(student.name)) {
        studentIdByName.set(student.name, created.id);
      }
      await tx.migrationMapping.upsert({
        where: {
          tenantId_entityType_legacyScope_legacyKey: {
            tenantId: tenant.id,
            entityType: "student",
            legacyScope: data.tenant.slug,
            legacyKey: student.legacyRef
          }
        },
        update: {
          newId: created.id,
          metadata: {
            source: "legacy-safe-subset",
            hasLegacyAvatarData: Boolean(profile?.hasLegacyAvatarData)
          }
        },
        create: {
          tenantId: tenant.id,
          entityType: "student",
          legacyScope: data.tenant.slug,
          legacyKey: student.legacyRef,
          newId: created.id,
          metadata: {
            source: "legacy-safe-subset",
            hasLegacyAvatarData: Boolean(profile?.hasLegacyAvatarData)
          }
        }
      });
    }

    const importedStudentIds = Array.from(studentIdByLegacyRef.values());
    await tx.studentProfile.deleteMany({
      where: {
        studentId: { in: importedStudentIds }
      }
    });
    await tx.migrationMapping.deleteMany({
      where: {
        tenantId: tenant.id,
        entityType: "student_avatar",
        newId: { in: importedStudentIds }
      }
    });

    for (const profile of data.studentProfiles || []) {
      const studentId = studentIdByLegacyRef.get(profile.studentLegacyRef);
      if (!studentId) continue;

      const titleLeft = profile.titleLeft ? String(profile.titleLeft).trim() : "";
      const titleRight = profile.titleRight ? String(profile.titleRight).trim() : "";
      const notes = profile.notes ? String(profile.notes).trim() : "";
      const avatarMetadata = buildAvatarMappingMetadata(profile);

      if (titleLeft || titleRight || notes) {
        await tx.studentProfile.create({
          data: {
            studentId,
            titleLeft: titleLeft || null,
            titleRight: titleRight || null,
            notes: notes || null
          }
        });
      }

      if (!avatarMetadata) {
        continue;
      }

      await tx.migrationMapping.upsert({
        where: {
          tenantId_entityType_legacyScope_legacyKey: {
            tenantId: tenant.id,
            entityType: "student_avatar",
            legacyScope: data.tenant.slug,
            legacyKey: profile.studentLegacyRef
          }
        },
        update: {
          newId: studentId,
          metadata: avatarMetadata
        },
        create: {
          tenantId: tenant.id,
          entityType: "student_avatar",
          legacyScope: data.tenant.slug,
          legacyKey: profile.studentLegacyRef,
          newId: studentId,
          metadata: avatarMetadata
        }
      });
    }

    await tx.studentGroupAssignment.deleteMany({
      where: {
        tenantId: tenant.id,
        studentId: { in: importedStudentIds }
      }
    });
    await tx.studentDormAssignment.deleteMany({
      where: {
        tenantId: tenant.id,
        studentId: { in: importedStudentIds }
      }
    });
    await tx.studentPositionAssignment.deleteMany({
      where: {
        tenantId: tenant.id,
        studentId: { in: importedStudentIds }
      }
    });

    for (const assignment of data.studentGroupAssignments || []) {
      const studentId = studentIdByLegacyRef.get(assignment.studentLegacyRef);
      const groupId = groupIdByLegacyKey.get(assignment.groupLegacyKey);
      if (!studentId || !groupId) continue;
      await tx.studentGroupAssignment.create({
        data: {
          tenantId: tenant.id,
          studentId,
          groupId,
          roleCode: assignment.roleCode,
          isPrimary: Boolean(assignment.isPrimary)
        }
      });
    }

    for (const assignment of data.studentDormAssignments || []) {
      const studentId = studentIdByLegacyRef.get(assignment.studentLegacyRef);
      const dormitoryId = dormitoryIdByLegacyKey.get(assignment.dormLegacyKey);
      if (!studentId || !dormitoryId) continue;
      await tx.studentDormAssignment.create({
        data: {
          tenantId: tenant.id,
          studentId,
          dormitoryId,
          isPrimary: Boolean(assignment.isPrimary)
        }
      });
    }

    for (const assignment of data.studentPositionAssignments || []) {
      const studentId = studentIdByLegacyRef.get(assignment.studentLegacyRef);
      const positionId = positionIdByLegacyKey.get(assignment.positionLegacyKey);
      if (!studentId || !positionId) continue;
      await tx.studentPositionAssignment.create({
        data: {
          tenantId: tenant.id,
          studentId,
          positionId
        }
      });
    }

    await tx.classConfig.update({
      where: {
        classId: classRecord.id
      },
      data: {
        extra: buildClassConfigExtra(data, groupIdByLegacyKey, studentIdByLegacyRef, studentIdByName)
      }
    });

    for (const account of data.pointAccounts || []) {
      const studentId = studentIdByLegacyRef.get(account.studentLegacyRef);
      if (!studentId) continue;
      await tx.pointAccount.upsert({
        where: { studentId },
        update: {
          totalPoints: account.totalPoints,
          balancePoints: account.balancePoints,
          penaltyPoints: account.penaltyPoints
        },
        create: {
          tenantId: tenant.id,
          studentId,
          totalPoints: account.totalPoints,
          balancePoints: account.balancePoints,
          penaltyPoints: account.penaltyPoints
        }
      });
    }

    const reasonTemplateIdByLegacyName = new Map();
    for (const reason of data.pointReasonTemplates || []) {
      const created = await tx.pointReasonTemplate.upsert({
        where: {
          classId_name: {
            classId: classRecord.id,
            name: reason.name
          }
        },
        update: {
          value: reason.value,
          transactionType: reason.transactionType,
          scene: reason.scene,
          category: reason.category,
          note: reason.note,
          isEditable: reason.isEditable,
          isMultiplier: reason.isMultiplier,
          multiplier: reason.multiplier,
          displayOrder: reason.displayOrder,
          legacyName: reason.legacyName
        },
        create: {
          tenantId: tenant.id,
          classId: classRecord.id,
          name: reason.name,
          value: reason.value,
          transactionType: reason.transactionType,
          scene: reason.scene,
          category: reason.category,
          note: reason.note,
          isEditable: reason.isEditable,
          isMultiplier: reason.isMultiplier,
          multiplier: reason.multiplier,
          displayOrder: reason.displayOrder,
          legacyName: reason.legacyName
        }
      });
      reasonTemplateIdByLegacyName.set(reason.legacyName, created.id);
    }

    const pointAccountByStudent = new Map(
      (
        await tx.pointAccount.findMany({
          where: {
            tenantId: tenant.id,
            studentId: { in: Array.from(studentIdByLegacyRef.values()) }
          },
          select: { id: true, studentId: true }
        })
      ).map((item) => [item.studentId, item.id])
    );

    let importedTransactions = 0;
    let skippedTransactions = 0;
    for (const item of data.pointTransactions || []) {
      const studentId = studentIdByLegacyRef.get(item.studentLegacyRef);
      if (!studentId) continue;
      const pointAccountId = pointAccountByStudent.get(studentId);
      if (!pointAccountId) continue;

      const transactionLegacyKey = String(item.legacyNumericId);
      const existingTxMapping = await tx.migrationMapping.findUnique({
        where: {
          tenantId_entityType_legacyScope_legacyKey: {
            tenantId: tenant.id,
            entityType: "point_transaction",
            legacyScope: data.tenant.slug,
            legacyKey: transactionLegacyKey
          }
        }
      });

      let existingTx =
        existingTxMapping
          ? await tx.pointTransaction.findFirst({
              where: {
                id: existingTxMapping.newId,
                classId: classRecord.id
              },
              select: {
                id: true
              }
            })
          : null;

      if (!existingTx && item.legacyNumericId != null) {
        existingTx = await tx.pointTransaction.findFirst({
          where: {
            classId: classRecord.id,
            legacyNumericId: item.legacyNumericId
          },
          select: {
            id: true
          }
        });
      }

      if (existingTx) {
        skippedTransactions += 1;
        await tx.migrationMapping.upsert({
          where: {
            tenantId_entityType_legacyScope_legacyKey: {
              tenantId: tenant.id,
              entityType: "point_transaction",
              legacyScope: data.tenant.slug,
              legacyKey: transactionLegacyKey
            }
          },
          update: {
            newId: existingTx.id,
            metadata: {
              source: "legacy-safe-subset",
              classId: classRecord.id
            }
          },
          create: {
            tenantId: tenant.id,
            entityType: "point_transaction",
            legacyScope: data.tenant.slug,
            legacyKey: transactionLegacyKey,
            newId: existingTx.id,
            metadata: {
              source: "legacy-safe-subset",
              classId: classRecord.id
            }
          }
        });
        continue;
      }

      const createdTx = await tx.pointTransaction.create({
        data: {
          tenantId: tenant.id,
          classId: classRecord.id,
          studentId,
          pointAccountId,
          transactionType: item.transactionType,
          value: item.value,
          reason: item.reason,
          scene: item.scene,
          category: item.category,
          sourceModule: item.sourceModule,
          occurredAt: new Date(item.occurredAt),
          reasonTemplateId: reasonTemplateIdByLegacyName.get(item.reason) || null,
          actorUserId: user.id,
          actorMembershipId: membership.id,
          legacyNumericId: item.legacyNumericId,
          legacySnapshot: item.legacySnapshot,
          metadata: {
            importSource: "legacy-safe-subset"
          }
        }
      });
      importedTransactions += 1;
      await tx.migrationMapping.create({
        data: {
          tenantId: tenant.id,
          entityType: "point_transaction",
          legacyScope: data.tenant.slug,
          legacyKey: transactionLegacyKey,
          newId: createdTx.id,
          metadata: {
            source: "legacy-safe-subset",
            classId: classRecord.id
          }
        }
      });
    }

    for (const item of data.attendanceSchedules || []) {
      await tx.attendanceSchedule.upsert({
        where: {
          classId_code: {
            classId: classRecord.id,
            code: item.code
          }
        },
        update: {
          name: item.name,
          startTime: new Date(`1970-01-01T${item.startTime}:00.000Z`),
          endTime: new Date(`1970-01-01T${item.endTime}:00.000Z`),
          lateTime: new Date(`1970-01-01T${item.lateTime}:00.000Z`),
          displayOrder: item.displayOrder
        },
        create: {
          tenantId: tenant.id,
          classId: classRecord.id,
          code: item.code,
          name: item.name,
          startTime: new Date(`1970-01-01T${item.startTime}:00.000Z`),
          endTime: new Date(`1970-01-01T${item.endTime}:00.000Z`),
          lateTime: new Date(`1970-01-01T${item.lateTime}:00.000Z`),
          displayOrder: item.displayOrder
        }
      });
    }

    for (const item of data.featureFlags || []) {
      await tx.featureFlag.upsert({
        where: {
          tenantId_classId_code: {
            tenantId: tenant.id,
            classId: classRecord.id,
            code: item.code
          }
        },
        update: {
          enabled: Boolean(item.enabled)
        },
        create: {
          tenantId: tenant.id,
          classId: classRecord.id,
          code: item.code,
          enabled: Boolean(item.enabled)
        }
      });
    }

    await tx.importJob.update({
      where: { id: importJob.id },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        summary: {
          sourceUsername: data.meta?.sourceUsername || null,
          sourceUserId: data.meta?.sourceUserId || null,
          importedStudents: studentIdByLegacyRef.size,
          importedTransactions,
          skippedTransactions,
          deferredAttendanceSessions: (data.attendanceSessions || []).length,
          deferredAttendanceRecords: (data.attendanceRecords || []).length
        }
      }
    });

    await tx.auditLog.create({
      data: {
        tenantId: tenant.id,
        classId: classRecord.id,
        actorUserId: user.id,
        actorMembershipId: membership.id,
        action: "migration.safe_subset_import",
        targetType: "class",
        targetId: classRecord.id,
        metadata: {
          importJobId: importJob.id,
          sourceFilename: path.basename(data.meta?.sourceFile || "normalized.json"),
          importedStudents: studentIdByLegacyRef.size,
          importedTransactions,
          skippedTransactions
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
      userId: user.id,
      importedStudents: studentIdByLegacyRef.size,
      importedTransactions,
      skippedTransactions,
      importJobId: importJob.id
    };
  });
}

async function main() {
  const args = parseArgs(process.argv);
  const filePath = getInputFile(args.input);
  const data = readJson(filePath);
  const policy = readJson(policyPath);
  const warningSummary = ensureNoBlockers(data, policy, args.allowReview);
  const plan = buildPlan(data, warningSummary);
  const expectedConfirmToken = getExpectedConfirmToken(data);

  if (!args.apply) {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          confirmToken: expectedConfirmToken,
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
    const result = await loadSafeSubset(prisma, data);
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
    if (legacyDbInstance) {
      legacyDbInstance.close();
      legacyDbInstance = null;
    }
    legacyDbChecked = false;
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
