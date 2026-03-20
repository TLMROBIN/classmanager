import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { canManagePoints } from "../../lib/permissions.js";
import { normalizeStudentStatusOptions } from "../../lib/studentStatus.js";

const classParamsSchema = z.object({
  classId: z.string().uuid()
});

const featureFlagParamsSchema = z.object({
  classId: z.string().uuid(),
  featureFlagId: z.string().uuid()
});

const reasonTemplateParamsSchema = z.object({
  classId: z.string().uuid(),
  templateId: z.string().uuid()
});

const classFreezeBodySchema = z.object({
  isFrozen: z.boolean()
});

const classConfigUpdateBodySchema = z.object({
  className: z.string().trim().min(1).max(120),
  timezone: z.string().trim().min(1).max(80)
});

const dutyDayCodes = ["mon", "tue", "wed", "thu", "fri"] as const;

const dutyConfigUpdateBodySchema = z
  .object({
    duty: z.record(z.string().trim().min(1).max(20), z.array(z.string().uuid()).max(8))
  })
  .refine(
    (body) => Object.keys(body.duty).every((key) => dutyDayCodes.includes(key as (typeof dutyDayCodes)[number])),
    {
      message: "Duty config contains invalid days"
    }
  )
  .refine(
    (body) => Object.values(body.duty).every((studentIds) => new Set(studentIds).size === studentIds.length),
    {
      message: "Duty config contains duplicate students"
    }
  );

const subjectConfigUpdateBodySchema = z
  .object({
    subjects: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(120),
          representativeStudentIds: z.array(z.string().uuid()).max(2)
        })
      )
      .max(100)
  })
  .refine((body) => new Set(body.subjects.map((item) => item.id)).size === body.subjects.length, {
    message: "Subject config contains duplicate ids"
  })
  .refine((body) => new Set(body.subjects.map((item) => item.name)).size === body.subjects.length, {
    message: "Subject config contains duplicate names"
  })
  .refine(
    (body) =>
      body.subjects.every(
        (item) => new Set(item.representativeStudentIds).size === item.representativeStudentIds.length
      ),
    {
      message: "Subject config contains duplicate representatives"
    }
  );

const studentStatusOptionSchema = z.object({
  value: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(120),
  participatesInDailyFlow: z.boolean().optional().default(false)
});

const studentStatusConfigUpdateBodySchema = z
  .object({
    studentStatusOptions: z.array(studentStatusOptionSchema).min(1).max(50)
  })
  .refine(
    (body) => new Set(body.studentStatusOptions.map((item) => item.value)).size === body.studentStatusOptions.length,
    {
      message: "Student status config contains duplicate values"
    }
  );

const wageConfigUpdateBodySchema = z
  .object({
    dailyWageAmount: z.coerce.number().finite().min(0).max(1000),
    dailyWageGroupIds: z.array(z.string().uuid()).max(50),
    psychologyCommitteeStudentIds: z.array(z.string().uuid()).max(8),
    lastWageDate: z.union([z.string().date(), z.null()]).optional(),
    studentCouncilRoles: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(120),
          studentId: z.string().uuid().nullable().optional()
        })
      )
      .max(50)
  })
  .refine((body) => new Set(body.dailyWageGroupIds).size === body.dailyWageGroupIds.length, {
    message: "Wage groups contains duplicates"
  })
  .refine(
    (body) => new Set(body.psychologyCommitteeStudentIds).size === body.psychologyCommitteeStudentIds.length,
    {
      message: "Psychology committee contains duplicates"
    }
  )
  .refine((body) => new Set(body.studentCouncilRoles.map((item) => item.id)).size === body.studentCouncilRoles.length, {
    message: "Student council roles contains duplicate ids"
  });

const groupConfigUpdateBodySchema = z
  .object({
    groups: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          legacyKey: z.string().trim().max(100).nullable().optional(),
          name: z.string().trim().min(1).max(120),
          colorToken: z.string().trim().max(120).nullable().optional(),
          isActive: z.boolean().optional()
        })
      )
      .max(100)
  })
  .refine((body) => {
    const ids = body.groups.map((item) => item.id).filter((item): item is string => Boolean(item));
    return new Set(ids).size === ids.length;
  }, {
    message: "Group config contains duplicate ids"
  })
  .refine((body) => new Set(body.groups.map((item) => item.name)).size === body.groups.length, {
    message: "Group config contains duplicate names"
  })
  .refine((body) => {
    const legacyKeys = body.groups
      .map((item) => item.legacyKey?.trim())
      .filter((item): item is string => Boolean(item));
    return new Set(legacyKeys).size === legacyKeys.length;
  }, {
    message: "Group config contains duplicate legacy keys"
  });

const dormitoryConfigUpdateBodySchema = z
  .object({
    dormitories: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          legacyKey: z.string().trim().max(100).nullable().optional(),
          name: z.string().trim().min(1).max(120),
          building: z.string().trim().max(120).nullable().optional(),
          genderScope: z.string().trim().max(20).nullable().optional(),
          isActive: z.boolean().optional()
        })
      )
      .max(100)
  })
  .refine((body) => {
    const ids = body.dormitories.map((item) => item.id).filter((item): item is string => Boolean(item));
    return new Set(ids).size === ids.length;
  }, {
    message: "Dormitory config contains duplicate ids"
  })
  .refine((body) => new Set(body.dormitories.map((item) => item.name)).size === body.dormitories.length, {
    message: "Dormitory config contains duplicate names"
  })
  .refine((body) => {
    const legacyKeys = body.dormitories
      .map((item) => item.legacyKey?.trim())
      .filter((item): item is string => Boolean(item));
    return new Set(legacyKeys).size === legacyKeys.length;
  }, {
    message: "Dormitory config contains duplicate legacy keys"
  });

const positionConfigUpdateBodySchema = z
  .object({
    positions: z
      .array(
        z.object({
          id: z.string().uuid().optional(),
          code: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(120),
          category: z.string().trim().min(1).max(50),
          isActive: z.boolean().optional()
        })
      )
      .max(100)
  })
  .refine((body) => {
    const ids = body.positions.map((item) => item.id).filter((item): item is string => Boolean(item));
    return new Set(ids).size === ids.length;
  }, {
    message: "Position config contains duplicate ids"
  })
  .refine((body) => new Set(body.positions.map((item) => item.code)).size === body.positions.length, {
    message: "Position config contains duplicate codes"
  });

const scheduleNotesUpdateBodySchema = z.object({
  scheduleNotes: z.record(z.string().trim().min(1).max(80), z.string().trim().max(500))
});

const countdownEventsUpdateBodySchema = z.object({
  countdownEvents: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80).optional(),
        title: z.string().trim().min(1).max(120),
        date: z.string().trim().max(30).optional().nullable(),
        note: z.string().trim().max(300).optional().nullable()
      })
    )
    .max(200)
});

const quotesUpdateBodySchema = z.object({
  quotes: z.array(z.string().trim().min(1).max(300)).max(500)
});

const LEGACY_DEFAULT_DAILY_WAGE_GROUP_KEYS = new Set(["discipline", "hygiene"]);

const legacyCompatUpdateBodySchema = z.object({
  legacyCompat: z.unknown()
});

const pointReasonTemplateCreateBodySchema = z.object({
  name: z.string().trim().min(1).max(150),
  value: z.coerce.number().finite().refine((value) => value !== 0).refine((value) => Math.abs(value) <= 1000),
  transactionType: z.enum(["bonus", "penalty", "reward"]),
  scene: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50)
});

const pointReasonTemplateBatchCreateBodySchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(150),
        value: z.coerce.number().finite().refine((value) => value !== 0).refine((value) => Math.abs(value) <= 1000),
        transactionType: z.enum(["bonus", "penalty", "reward"]),
        scene: z.string().trim().min(1).max(50),
        category: z.string().trim().min(1).max(50)
      })
    )
    .min(1)
    .max(200)
});

const pointReasonTemplateBatchPrecheckBodySchema = z.object({
  names: z.array(z.string().trim().min(1).max(150)).min(1).max(200)
});

const featureFlagConfigSchema = z
  .record(z.string(), z.unknown())
  .refine((value) => !Array.isArray(value), { message: "Feature flag config must be an object" });

const featureFlagUpdateBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    config: featureFlagConfigSchema.optional()
  })
  .refine((body) => body.enabled !== undefined || body.config !== undefined, {
    message: "Feature flag update payload required"
  });

const reasonTemplateUpdateBodySchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    value: z.coerce.number().finite().refine((value) => value !== 0).refine((value) => Math.abs(value) <= 1000).optional(),
    transactionType: z.enum(["bonus", "penalty", "reward"]).optional(),
    scene: z.string().trim().min(1).max(50).optional(),
    category: z.string().trim().min(1).max(50).optional(),
    isActive: z.boolean().optional()
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Reason template update payload required"
  });

const reasonTemplateReorderBodySchema = z
  .object({
    templateIds: z.array(z.string().uuid()).min(1)
  })
  .refine((body) => new Set(body.templateIds).size === body.templateIds.length, {
    message: "Reason template reorder list has duplicates"
  });

const reasonTemplateCategoryUpdateBodySchema = z.object({
  scene: z.string().trim().min(1).max(50),
  category: z.string().trim().min(1).max(50),
  nextScene: z.string().trim().min(1).max(50),
  nextCategory: z.string().trim().min(1).max(50)
});

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

  return classRecord;
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

function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("zh-CN", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function isValidIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized.length > 0 ? normalized : null;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizeScheduleNotes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => [key.trim(), typeof item === "string" ? item.trim() : String(item ?? "").trim()])
      .filter(([key]) => key.length > 0)
  );
}

function normalizeCountdownEvents(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const event = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const id = event.id ? String(event.id).trim() : "";
      const titleRaw = event.title ?? event.name;
      const title = titleRaw == null ? "" : String(titleRaw).trim();
      const date = event.date ? String(event.date).trim() : "";
      const note = event.note ? String(event.note).trim() : "";

      return {
        ...(id ? { id } : {}),
        title,
        date: date || null,
        note: note || null
      };
    })
    .filter((item) => item.title.length > 0);
}

function normalizeQuotes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter((item) => item.length > 0)
    .slice(0, 500);
}

function normalizeDutySchedule(value: unknown, studentIdByName?: Map<string, string>) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

  return Object.fromEntries(
    dutyDayCodes.map((dayCode) => {
      const studentIds = Array.isArray(raw[dayCode])
        ? Array.from(
            new Set(
              raw[dayCode]
                .map((item) => {
                  const current = typeof item === "string" ? item.trim() : "";
                  if (!current) return "";
                  if (isUuidLike(current)) return current;
                  return studentIdByName?.get(current) || "";
                })
                .filter((item) => item.length > 0)
            )
          )
        : [];

      return [dayCode, studentIds];
    })
  );
}

function normalizeLegacyCompatMessageList(value: unknown, prefix: string) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const content = row.content == null ? "" : String(row.content).trim();
      if (!content) return null;

      return {
        id: row.id == null ? `${prefix}-${index + 1}` : String(row.id).trim() || `${prefix}-${index + 1}`,
        content,
        time: row.time == null ? null : String(row.time).trim() || null,
        date: row.date == null ? null : String(row.date).trim() || null
      };
    })
    .filter(Boolean);
}

function normalizeLegacyCompatStudentItemMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([studentId, itemMap]) => {
        const normalizedStudentId = String(studentId).trim();
        if (!normalizedStudentId || !itemMap || typeof itemMap !== "object" || Array.isArray(itemMap)) {
          return null;
        }

        const normalizedItems = Object.fromEntries(
          Object.entries(itemMap as Record<string, unknown>)
            .map(([itemId, count]) => [String(itemId).trim(), Number(count)])
            .filter(([itemId, count]) => itemId.length > 0 && Number.isFinite(count) && count > 0)
        );

        if (Object.keys(normalizedItems).length === 0) {
          return null;
        }

        return [normalizedStudentId, normalizedItems];
      })
      .filter(Boolean)
  );
}

function normalizeLegacyCompatDateItemCountMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([date, itemMap]) => {
        const normalizedDate = String(date).trim();
        if (!normalizedDate || !itemMap || typeof itemMap !== "object" || Array.isArray(itemMap)) {
          return null;
        }

        const normalizedItems = Object.fromEntries(
          Object.entries(itemMap as Record<string, unknown>)
            .map(([itemId, count]) => [String(itemId).trim(), Number(count)])
            .filter(([itemId, count]) => itemId.length > 0 && Number.isFinite(count) && count >= 0)
        );

        if (Object.keys(normalizedItems).length === 0) {
          return null;
        }

        return [normalizedDate, normalizedItems];
      })
      .filter(Boolean)
  );
}

function normalizeLegacyCompatStrategyDates(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const lastPeriodicTaskDate = normalizeNullableText(
    typeof raw.lastPeriodicTaskDate === "string" ? raw.lastPeriodicTaskDate : null
  );
  const lastPenaltyReductionDate = normalizeNullableText(
    typeof raw.lastPenaltyReductionDate === "string" ? raw.lastPenaltyReductionDate : null
  );

  const normalized = {
    lastPeriodicTaskDate:
      lastPeriodicTaskDate && isValidIsoDate(lastPeriodicTaskDate) ? lastPeriodicTaskDate : null,
    lastPenaltyReductionDate:
      lastPenaltyReductionDate && isValidIsoDate(lastPenaltyReductionDate) ? lastPenaltyReductionDate : null
  };

  return normalized.lastPeriodicTaskDate || normalized.lastPenaltyReductionDate ? normalized : null;
}

function normalizeLegacyCompat(value: unknown) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const messages = normalizeLegacyCompatMessageList(raw.messages, "message");
  const teacherMessages = normalizeLegacyCompatMessageList(raw.teacherMessages, "teacher-message");
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks
        .map((item, index) => {
          const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
          const title = row.title == null ? "" : String(row.title).trim();
          if (!title) return null;

          return {
            id: row.id == null ? `task-${index + 1}` : String(row.id).trim() || `task-${index + 1}`,
            title,
            desc: row.desc == null ? "" : String(row.desc).trim(),
            points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0,
            startTime: row.startTime == null ? null : String(row.startTime).trim() || null,
            endTime: row.endTime == null ? null : String(row.endTime).trim() || null,
            claimedByStudentIds: Array.isArray(row.claimedByStudentIds)
              ? Array.from(
                  new Set(
                    row.claimedByStudentIds
                      .map((studentId) => (studentId == null ? "" : String(studentId).trim()))
                      .filter((studentId) => studentId.length > 0)
                  )
                )
              : []
          };
        })
        .filter(Boolean)
    : [];

  const shopRaw = raw.shop && typeof raw.shop === "object" && !Array.isArray(raw.shop) ? (raw.shop as Record<string, unknown>) : {};
  const shop = {
    treasures: Array.isArray(shopRaw.treasures)
      ? shopRaw.treasures
          .map((item, index) => {
            const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
    storage: normalizeLegacyCompatStudentItemMap(shopRaw.storage),
    logs: Array.isArray(shopRaw.logs)
      ? shopRaw.logs
          .map((item, index) => {
            const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
    redemptionHistory: normalizeLegacyCompatStudentItemMap(shopRaw.redemptionHistory),
    dailyRedemptionCounts: normalizeLegacyCompatDateItemCountMap(shopRaw.dailyRedemptionCounts),
    dailyUsageCounts: normalizeLegacyCompatDateItemCountMap(shopRaw.dailyUsageCounts)
  };
  const strategyDates = normalizeLegacyCompatStrategyDates(raw.strategyDates);

  const battleRaw = raw.battle && typeof raw.battle === "object" && !Array.isArray(raw.battle)
    ? (raw.battle as Record<string, unknown>)
    : null;
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
                  const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
                  const id = row.id == null ? `team-${index + 1}` : String(row.id).trim();
                  const name = row.name == null ? "" : String(row.name).trim();
                  if (!id || !name) return null;

                  return {
                    id,
                    name,
                    memberStudentIds: Array.isArray(row.memberStudentIds)
                      ? Array.from(
                          new Set(
                            row.memberStudentIds
                              .map((studentId) => (studentId == null ? "" : String(studentId).trim()))
                              .filter((studentId) => studentId.length > 0)
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
                  const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
                  const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
                  const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
          rules:
            battleRaw.rules && typeof battleRaw.rules === "object" && !Array.isArray(battleRaw.rules)
              ? (battleRaw.rules as Record<string, unknown>)
              : {},
          exams: Array.isArray(battleRaw.exams) ? battleRaw.exams : [],
          teamBaseExamId: battleRaw.teamBaseExamId == null ? null : String(battleRaw.teamBaseExamId).trim() || null,
          settleExamId: battleRaw.settleExamId == null ? null : String(battleRaw.settleExamId).trim() || null
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
  studentIdByName?: Map<string, string>,
  fallbackGroups?: Array<{ id: string; legacyKey: string | null; isActive?: boolean }>
) {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const dailyWageAmount = Number(raw.dailyWageAmount);
  const lastWageDate = normalizeNullableText(typeof raw.lastWageDate === "string" ? raw.lastWageDate : null);
  const legacyCompat = normalizeLegacyCompat(raw.legacyCompat);
  const studentStatusOptions = normalizeStudentStatusOptions(raw.studentStatusOptions);
  const subjects = Array.isArray(raw.subjects)
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
    : [];
  const studentCouncilRoles = Array.isArray(raw.studentCouncilRoles)
    ? raw.studentCouncilRoles
        .map((item) => {
          const role = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          const id = typeof role.id === "string" ? role.id.trim() : "";
          const name = typeof role.name === "string" ? role.name.trim() : "";
          if (!id || !name) return null;
          const studentId = typeof role.studentId === "string" && role.studentId.trim().length > 0 ? role.studentId : null;
          return {
            id,
            name,
            studentId
          };
        })
        .filter(Boolean)
    : [];

  return {
    duty: normalizeDutySchedule(raw.duty, studentIdByName),
    dailyWageAmount: Number.isFinite(dailyWageAmount) ? dailyWageAmount : 5,
    dailyWageGroupIds: normalizeDailyWageGroupIds(raw, fallbackGroups),
    psychologyCommitteeStudentIds: Array.isArray(raw.psychologyCommitteeStudentIds)
      ? Array.from(new Set(raw.psychologyCommitteeStudentIds.filter((item): item is string => typeof item === "string")))
      : [],
    quotes: normalizeQuotes(raw.quotes),
    studentStatusOptions,
    subjects,
    studentCouncilRoles,
    ...(lastWageDate && isValidIsoDate(lastWageDate) ? { lastWageDate } : {}),
    ...(legacyCompat ? { legacyCompat } : {})
  };
}

async function requireManageSettingsContext(
  app: any,
  userId: string,
  classId: string,
  reply: any,
  deniedMessage: string
) {
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
        select: {
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
  if (!canManagePoints(membership)) {
    throw reply.forbidden(deniedMessage);
  }

  return {
    classRecord,
    membership
  };
}

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.put("/classes/:classId/settings/class-config", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = classConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings class config permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    if (!isValidTimeZone(body.timezone)) {
      throw reply.badRequest("Class config timezone is invalid");
    }

    if (currentConfig.className === body.className && currentConfig.timezone === body.timezone) {
      throw reply.badRequest("Class config unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          className: body.className,
          timezone: body.timezone
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.config.update",
          targetType: "class_config",
          beforeData: {
            className: currentConfig.className,
            timezone: currentConfig.timezone
          },
          afterData: {
            className: item.className,
            timezone: item.timezone
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: updated
    };
  });

  app.put("/classes/:classId/settings/duty", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = dutyConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings duty config permission denied"
    );

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const expectedStudentIds = Array.from(new Set(Object.values(body.duty).flat()));
    const students = expectedStudentIds.length
      ? await app.prisma.student.findMany({
          where: {
            classId: params.classId,
            id: {
              in: expectedStudentIds
            }
          },
          select: {
            id: true
          }
        })
      : [];

    if (students.length !== expectedStudentIds.length) {
      throw reply.notFound("Duty config contains invalid student items");
    }

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextExtra = {
      ...currentExtra,
      duty: normalizeDutySchedule(body.duty)
    };

    if (JSON.stringify(currentExtra) === JSON.stringify(nextExtra)) {
      throw reply.badRequest("Duty config unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.duty.update",
          targetType: "class_config",
          beforeData: {
            duty: currentExtra.duty
          },
          afterData: {
            duty: nextExtra.duty
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        ...normalizeClassConfigExtra(updated.extra)
      }
    };
  });

  app.put("/classes/:classId/settings/groups", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = groupConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings group config permission denied"
    );

    const currentGroups = await app.prisma.group.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        legacyKey: true,
        name: true,
        colorToken: true,
        isActive: true,
        displayOrder: true
      }
    });

    const groupIdSet = new Set(currentGroups.map((item) => item.id));
    const incomingIds = body.groups.map((item) => item.id).filter((item): item is string => Boolean(item));
    if (incomingIds.some((item) => !groupIdSet.has(item))) {
      throw reply.notFound("Group config contains invalid items");
    }

    const incomingIdSet = new Set(incomingIds);
    const normalizedGroups = body.groups.map((item, index) => ({
      id: item.id || null,
      legacyKey: normalizeNullableText(item.legacyKey),
      name: item.name.trim(),
      colorToken: normalizeNullableText(item.colorToken),
      isActive: item.isActive ?? true,
      displayOrder: index + 1
    }));

    const archivedGroups = currentGroups.filter((item) => !incomingIdSet.has(item.id));
    const archivedNameSet = new Set(archivedGroups.map((item) => item.name));
    const archivedLegacyKeySet = new Set(
      archivedGroups.map((item) => item.legacyKey).filter((item): item is string => Boolean(item))
    );

    if (normalizedGroups.some((item) => archivedNameSet.has(item.name))) {
      throw reply.badRequest("Group config conflicts with archived items");
    }
    if (normalizedGroups.some((item) => item.legacyKey && archivedLegacyKeySet.has(item.legacyKey))) {
      throw reply.badRequest("Group config conflicts with archived items");
    }

    const currentSnapshot = currentGroups.map((item) => ({
      id: item.id,
      legacyKey: item.legacyKey,
      name: item.name,
      colorToken: item.colorToken,
      isActive: item.isActive,
      displayOrder: item.displayOrder
    }));
    const nextSnapshot = [
      ...normalizedGroups,
      ...archivedGroups.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        colorToken: item.colorToken,
        isActive: false,
        displayOrder: item.displayOrder
      }))
    ];

    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      throw reply.badRequest("Group config unchanged");
    }

    const currentGroupMap = new Map(currentGroups.map((item) => [item.id, item]));

    await app.prisma.$transaction(async (tx) => {
      for (const item of normalizedGroups) {
        if (!item.id) continue;
        const shouldSetLegacyTemp =
          Boolean(currentGroupMap.get(item.id)?.legacyKey) || Boolean(item.legacyKey);

        await tx.group.update({
          where: {
            id: item.id
          },
          data: {
            name: `__tmp_group__${item.id}`,
            legacyKey: shouldSetLegacyTemp ? `__tmp_group__${item.id}` : null
          }
        });
      }

      for (const item of normalizedGroups) {
        if (item.id) {
          await tx.group.update({
            where: {
              id: item.id
            },
            data: {
              legacyKey: item.legacyKey,
              name: item.name,
              colorToken: item.colorToken,
              isActive: item.isActive,
              displayOrder: item.displayOrder
            }
          });
          continue;
        }

        await tx.group.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            legacyKey: item.legacyKey,
            name: item.name,
            colorToken: item.colorToken,
            isActive: item.isActive,
            displayOrder: item.displayOrder
          }
        });
      }

      if (archivedGroups.length) {
        await tx.group.updateMany({
          where: {
            id: {
              in: archivedGroups.map((item) => item.id)
            }
          },
          data: {
            isActive: false
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.groups.update",
          targetType: "class_organization",
          targetId: params.classId,
          beforeData: {
            items: currentSnapshot
          },
          afterData: {
            items: nextSnapshot
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });
    });

    const items = await app.prisma.group.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        legacyKey: true,
        name: true,
        colorToken: true,
        isActive: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        colorToken: item.colorToken,
        isActive: item.isActive,
        membersCount: item._count.members
      }))
    };
  });

  app.put("/classes/:classId/settings/dormitories", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = dormitoryConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings dormitory config permission denied"
    );

    const currentDormitories = await app.prisma.dormitory.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        legacyKey: true,
        name: true,
        building: true,
        genderScope: true,
        isActive: true,
        displayOrder: true
      }
    });

    const dormitoryIdSet = new Set(currentDormitories.map((item) => item.id));
    const incomingIds = body.dormitories.map((item) => item.id).filter((item): item is string => Boolean(item));
    if (incomingIds.some((item) => !dormitoryIdSet.has(item))) {
      throw reply.notFound("Dormitory config contains invalid items");
    }

    const incomingIdSet = new Set(incomingIds);
    const normalizedDormitories = body.dormitories.map((item, index) => ({
      id: item.id || null,
      legacyKey: normalizeNullableText(item.legacyKey),
      name: item.name.trim(),
      building: normalizeNullableText(item.building),
      genderScope: normalizeNullableText(item.genderScope),
      isActive: item.isActive ?? true,
      displayOrder: index + 1
    }));

    const archivedDormitories = currentDormitories.filter((item) => !incomingIdSet.has(item.id));
    const archivedNameSet = new Set(archivedDormitories.map((item) => item.name));
    const archivedLegacyKeySet = new Set(
      archivedDormitories.map((item) => item.legacyKey).filter((item): item is string => Boolean(item))
    );

    if (normalizedDormitories.some((item) => archivedNameSet.has(item.name))) {
      throw reply.badRequest("Dormitory config conflicts with archived items");
    }
    if (normalizedDormitories.some((item) => item.legacyKey && archivedLegacyKeySet.has(item.legacyKey))) {
      throw reply.badRequest("Dormitory config conflicts with archived items");
    }

    const currentSnapshot = currentDormitories.map((item) => ({
      id: item.id,
      legacyKey: item.legacyKey,
      name: item.name,
      building: item.building,
      genderScope: item.genderScope,
      isActive: item.isActive,
      displayOrder: item.displayOrder
    }));
    const nextSnapshot = [
      ...normalizedDormitories,
      ...archivedDormitories.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        building: item.building,
        genderScope: item.genderScope,
        isActive: false,
        displayOrder: item.displayOrder
      }))
    ];

    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      throw reply.badRequest("Dormitory config unchanged");
    }

    const currentDormitoryMap = new Map(currentDormitories.map((item) => [item.id, item]));

    await app.prisma.$transaction(async (tx) => {
      for (const item of normalizedDormitories) {
        if (!item.id) continue;
        const shouldSetLegacyTemp =
          Boolean(currentDormitoryMap.get(item.id)?.legacyKey) || Boolean(item.legacyKey);

        await tx.dormitory.update({
          where: {
            id: item.id
          },
          data: {
            name: `__tmp_dormitory__${item.id}`,
            legacyKey: shouldSetLegacyTemp ? `__tmp_dormitory__${item.id}` : null
          }
        });
      }

      for (const item of normalizedDormitories) {
        if (item.id) {
          await tx.dormitory.update({
            where: {
              id: item.id
            },
            data: {
              legacyKey: item.legacyKey,
              name: item.name,
              building: item.building,
              genderScope: item.genderScope,
              isActive: item.isActive,
              displayOrder: item.displayOrder
            }
          });
          continue;
        }

        await tx.dormitory.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            legacyKey: item.legacyKey,
            name: item.name,
            building: item.building,
            genderScope: item.genderScope,
            isActive: item.isActive,
            displayOrder: item.displayOrder
          }
        });
      }

      if (archivedDormitories.length) {
        await tx.dormitory.updateMany({
          where: {
            id: {
              in: archivedDormitories.map((item) => item.id)
            }
          },
          data: {
            isActive: false
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.dormitories.update",
          targetType: "class_organization",
          targetId: params.classId,
          beforeData: {
            items: currentSnapshot
          },
          afterData: {
            items: nextSnapshot
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });
    });

    const items = await app.prisma.dormitory.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        legacyKey: true,
        name: true,
        building: true,
        genderScope: true,
        isActive: true,
        _count: {
          select: {
            members: true
          }
        }
      }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        building: item.building,
        genderScope: item.genderScope,
        isActive: item.isActive,
        membersCount: item._count.members
      }))
    };
  });

  app.put("/classes/:classId/settings/positions", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = positionConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings position config permission denied"
    );

    const currentPositions = await app.prisma.position.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        isActive: true,
        displayOrder: true
      }
    });

    const positionIdSet = new Set(currentPositions.map((item) => item.id));
    const incomingIds = body.positions.map((item) => item.id).filter((item): item is string => Boolean(item));
    if (incomingIds.some((item) => !positionIdSet.has(item))) {
      throw reply.notFound("Position config contains invalid items");
    }

    const incomingIdSet = new Set(incomingIds);
    const normalizedPositions = body.positions.map((item, index) => ({
      id: item.id || null,
      code: item.code.trim(),
      name: item.name.trim(),
      category: item.category.trim(),
      isActive: item.isActive ?? true,
      displayOrder: index + 1
    }));

    const archivedPositions = currentPositions.filter((item) => !incomingIdSet.has(item.id));
    const archivedCodeSet = new Set(archivedPositions.map((item) => item.code));
    if (normalizedPositions.some((item) => archivedCodeSet.has(item.code))) {
      throw reply.badRequest("Position config conflicts with archived items");
    }

    const currentSnapshot = currentPositions.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      category: item.category,
      isActive: item.isActive,
      displayOrder: item.displayOrder
    }));
    const nextSnapshot = [
      ...normalizedPositions,
      ...archivedPositions.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        isActive: false,
        displayOrder: item.displayOrder
      }))
    ];

    if (JSON.stringify(currentSnapshot) === JSON.stringify(nextSnapshot)) {
      throw reply.badRequest("Position config unchanged");
    }

    await app.prisma.$transaction(async (tx) => {
      for (const item of normalizedPositions) {
        if (!item.id) continue;
        await tx.position.update({
          where: {
            id: item.id
          },
          data: {
            code: `__tmp_position__${item.id}`,
            name: `__tmp_position__${item.id}`
          }
        });
      }

      for (const item of normalizedPositions) {
        if (item.id) {
          await tx.position.update({
            where: {
              id: item.id
            },
            data: {
              code: item.code,
              name: item.name,
              category: item.category,
              isActive: item.isActive,
              displayOrder: item.displayOrder
            }
          });
          continue;
        }

        await tx.position.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            code: item.code,
            name: item.name,
            category: item.category,
            isActive: item.isActive,
            displayOrder: item.displayOrder
          }
        });
      }

      if (archivedPositions.length) {
        await tx.position.updateMany({
          where: {
            id: {
              in: archivedPositions.map((item) => item.id)
            }
          },
          data: {
            isActive: false
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.positions.update",
          targetType: "class_organization",
          targetId: params.classId,
          beforeData: {
            items: currentSnapshot
          },
          afterData: {
            items: nextSnapshot
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });
    });

    const items = await app.prisma.position.findMany({
      where: {
        classId: params.classId
      },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        isActive: true,
        _count: {
          select: {
            holders: true
          }
        }
      }
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        isActive: item.isActive,
        holdersCount: item._count.holders
      }))
    };
  });

  app.put("/classes/:classId/settings/subjects", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = subjectConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings subject config permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const expectedStudentIds = Array.from(
      new Set(body.subjects.flatMap((item) => item.representativeStudentIds))
    );
    const students = expectedStudentIds.length
      ? await app.prisma.student.findMany({
          where: {
            classId: params.classId,
            id: {
              in: expectedStudentIds
            }
          },
          select: {
            id: true
          }
        })
      : [];

    if (students.length !== expectedStudentIds.length) {
      throw reply.notFound("Subject config contains invalid student items");
    }

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextExtra = {
      ...currentExtra,
      subjects: body.subjects.map((item) => ({
        id: item.id,
        name: item.name,
        representativeStudentIds: item.representativeStudentIds
      }))
    };

    if (JSON.stringify(currentExtra) === JSON.stringify(nextExtra)) {
      throw reply.badRequest("Subject config unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.subjects.update",
          targetType: "class_config",
          beforeData: {
            subjects: currentExtra.subjects
          },
          afterData: {
            subjects: nextExtra.subjects
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        ...normalizeClassConfigExtra(updated.extra)
      }
    };
  });

  app.put("/classes/:classId/settings/student-statuses", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const bodyResult = studentStatusConfigUpdateBodySchema.safeParse(request.body);
    if (!bodyResult.success) {
      throw reply.badRequest(bodyResult.error.issues[0]?.message || "Student status config payload invalid");
    }
    const body = bodyResult.data;
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings student status config permission denied"
    );

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const students = await app.prisma.student.findMany({
      where: {
        classId: params.classId
      },
      select: {
        status: true
      }
    });

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextExtra = {
      ...currentExtra,
      studentStatusOptions: normalizeStudentStatusOptions(body.studentStatusOptions)
    };
    const configuredStatusValues = new Set(nextExtra.studentStatusOptions.map((item) => item.value));
    const missingStudentStatuses = Array.from(
      new Set(students.map((item) => item.status.trim()).filter(Boolean))
    ).filter((item) => !configuredStatusValues.has(item));

    if (missingStudentStatuses.length > 0) {
      throw reply.badRequest("Student status config missing used statuses");
    }

    if (JSON.stringify(currentExtra) === JSON.stringify(nextExtra)) {
      throw reply.badRequest("Student status config unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.student_statuses.update",
          targetType: "class_config",
          beforeData: {
            studentStatusOptions: currentExtra.studentStatusOptions
          },
          afterData: {
            studentStatusOptions: nextExtra.studentStatusOptions
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        ...normalizeClassConfigExtra(updated.extra)
      }
    };
  });

  app.put("/classes/:classId/settings/wage-config", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = wageConfigUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings wage config permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const [groups, students] = await Promise.all([
      app.prisma.group.findMany({
        where: {
          classId: params.classId,
          id: {
            in: body.dailyWageGroupIds
          }
        },
        select: {
          id: true
        }
      }),
      app.prisma.student.findMany({
        where: {
          classId: params.classId,
          id: {
            in: Array.from(
              new Set([
                ...body.psychologyCommitteeStudentIds,
                ...body.studentCouncilRoles
                  .map((item) => item.studentId)
                  .filter((item): item is string => Boolean(item))
              ])
            )
          }
        },
        select: {
          id: true
        }
      })
    ]);

    if (groups.length !== body.dailyWageGroupIds.length) {
      throw reply.notFound("Wage groups contains invalid items");
    }

    const expectedStudentIds = new Set([
      ...body.psychologyCommitteeStudentIds,
      ...body.studentCouncilRoles
        .map((item) => item.studentId)
        .filter((item): item is string => Boolean(item))
    ]);
    if (students.length !== expectedStudentIds.size) {
      throw reply.notFound("Wage config contains invalid student items");
    }

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextExtra = {
      ...currentExtra,
      dailyWageAmount: body.dailyWageAmount,
      dailyWageGroupIds: body.dailyWageGroupIds,
      psychologyCommitteeStudentIds: body.psychologyCommitteeStudentIds,
      studentCouncilRoles: body.studentCouncilRoles.map((item) => ({
        id: item.id,
        name: item.name,
        studentId: item.studentId || null
      }))
    };
    if (Object.prototype.hasOwnProperty.call(body, "lastWageDate")) {
      if (body.lastWageDate) {
        nextExtra.lastWageDate = body.lastWageDate;
      } else {
        delete nextExtra.lastWageDate;
      }
    }

    if (JSON.stringify(currentExtra) === JSON.stringify(nextExtra)) {
      throw reply.badRequest("Wage config unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.wage_config.update",
          targetType: "class_config",
          beforeData: currentExtra,
          afterData: nextExtra,
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        ...normalizeClassConfigExtra(updated.extra)
      }
    };
  });

  app.put("/classes/:classId/settings/class-freeze", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = classFreezeBodySchema.parse(request.body);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
      select: {
        id: true,
        tenantId: true,
        name: true
      }
    });

    if (!classRecord) {
      throw reply.notFound("Class not found");
    }

    const membership = await app.prisma.membership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: classRecord.tenantId,
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings class freeze permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }
    if (currentConfig.isFrozen === body.isFrozen) {
      throw reply.badRequest("Class frozen state unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          isFrozen: body.isFrozen
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.freeze.update",
          targetType: "class_config",
          beforeData: {
            isFrozen: currentConfig.isFrozen
          },
          afterData: {
            isFrozen: item.isFrozen
          },
          metadata: {
            sourceModule: "settings",
            className: classRecord.name
          }
        }
      });

      return item;
    });

    return {
      classConfig: updated
    };
  });

  app.put("/classes/:classId/settings/schedule-notes", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = scheduleNotesUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings schedule notes permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        scheduleNotes: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const nextScheduleNotes = normalizeScheduleNotes(body.scheduleNotes);
    const currentScheduleNotes = normalizeScheduleNotes(currentConfig.scheduleNotes);

    if (JSON.stringify(currentScheduleNotes) === JSON.stringify(nextScheduleNotes)) {
      throw reply.badRequest("Schedule notes unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          scheduleNotes: nextScheduleNotes
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          scheduleNotes: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.schedule_notes.update",
          targetType: "class_config",
          beforeData: {
            scheduleNotes: currentScheduleNotes
          },
          afterData: {
            scheduleNotes: item.scheduleNotes
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: updated
    };
  });

  app.put("/classes/:classId/settings/countdown-events", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = countdownEventsUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings countdown events permission denied");
    }

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        countdownEvents: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const nextCountdownEvents = normalizeCountdownEvents(body.countdownEvents);
    const currentCountdownEvents = normalizeCountdownEvents(currentConfig.countdownEvents);

    const invalidDateIndex = nextCountdownEvents.findIndex((item) => item.date && !isValidIsoDate(item.date));
    if (invalidDateIndex >= 0) {
      throw reply.badRequest("Countdown event date is invalid");
    }

    if (JSON.stringify(currentCountdownEvents) === JSON.stringify(nextCountdownEvents)) {
      throw reply.badRequest("Countdown events unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          countdownEvents: nextCountdownEvents
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          countdownEvents: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.countdown_events.update",
          targetType: "class_config",
          beforeData: {
            countdownEvents: currentCountdownEvents
          },
          afterData: {
            countdownEvents: item.countdownEvents
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: updated
    };
  });

  app.put("/classes/:classId/settings/quotes", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = quotesUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings quotes permission denied"
    );

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextExtra = {
      ...currentExtra,
      quotes: normalizeQuotes(body.quotes)
    };

    if (JSON.stringify(currentExtra) === JSON.stringify(nextExtra)) {
      throw reply.badRequest("Quotes unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.quotes.update",
          targetType: "class_config",
          beforeData: {
            quotes: currentExtra.quotes
          },
          afterData: {
            quotes: nextExtra.quotes
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        ...normalizeClassConfigExtra(updated.extra)
      }
    };
  });

  app.put("/classes/:classId/settings/legacy-compat", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = legacyCompatUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);

    const { classRecord, membership } = await requireManageSettingsContext(
      app,
      auth.sub,
      params.classId,
      reply,
      "Settings legacy compat permission denied"
    );

    const currentConfig = await app.prisma.classConfig.findUnique({
      where: {
        classId: params.classId
      },
      select: {
        className: true,
        timezone: true,
        isFrozen: true,
        extra: true
      }
    });

    if (!currentConfig) {
      throw reply.notFound("Class config not found");
    }

    const currentExtra = normalizeClassConfigExtra(currentConfig.extra);
    const nextLegacyCompat = normalizeLegacyCompat(body.legacyCompat);
    const currentSerialized = JSON.stringify(currentExtra.legacyCompat || null);
    const nextSerialized = JSON.stringify(nextLegacyCompat || null);

    if (currentSerialized === nextSerialized) {
      throw reply.badRequest("Legacy compat unchanged");
    }

    const nextExtra = {
      ...currentExtra
    } as Record<string, unknown>;
    if (nextLegacyCompat) {
      nextExtra.legacyCompat = nextLegacyCompat;
    } else {
      delete nextExtra.legacyCompat;
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          extra: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.class.legacy_compat.update",
          targetType: "class_config",
          beforeData: {
            legacyCompat: currentExtra.legacyCompat || null
          },
          afterData: {
            legacyCompat: nextLegacyCompat || null
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return item;
    });

    return {
      classConfig: {
        ...updated,
        legacyCompat: nextLegacyCompat || null
      }
    };
  });

  app.put("/classes/:classId/settings/reason-templates/:templateId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = reasonTemplateParamsSchema.parse(request.params);
    const body = reasonTemplateUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const template = await app.prisma.pointReasonTemplate.findFirst({
      where: {
        id: params.templateId,
        classId: params.classId
      },
      select: {
        id: true,
        name: true,
        value: true,
        transactionType: true,
        scene: true,
        category: true,
        isEditable: true,
        isActive: true
      }
    });

    if (!template) {
      throw reply.notFound("Reason template not found");
    }
    const nextName = body.name ?? template.name;
    const nextValue = body.value ?? template.value;
    const nextTransactionType = body.transactionType ?? template.transactionType;
    const nextScene = body.scene ?? template.scene;
    const nextCategory = body.category ?? template.category;
    const nextIsActive = body.isActive ?? template.isActive;

    if (
      nextName === template.name &&
      nextValue === template.value &&
      nextTransactionType === template.transactionType &&
      nextScene === template.scene &&
      nextCategory === template.category &&
      nextIsActive === template.isActive
    ) {
      throw reply.badRequest("Reason template active state unchanged");
    }

    if (nextName !== template.name) {
      const duplicate = await app.prisma.pointReasonTemplate.findFirst({
        where: {
          classId: params.classId,
          name: nextName,
          NOT: {
            id: template.id
          }
        },
        select: {
          id: true
        }
      });

      if (duplicate) {
        throw reply.conflict("Reason template already exists");
      }
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.pointReasonTemplate.update({
        where: {
          id: template.id
        },
        data: {
          name: nextName,
          value: nextValue,
          transactionType: nextTransactionType,
          scene: nextScene,
          category: nextCategory,
          isActive: nextIsActive
        },
        select: {
          id: true,
          name: true,
          value: true,
          transactionType: true,
          scene: true,
          category: true,
          isEditable: true,
          isActive: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.update",
          targetType: "point_reason_template",
          targetId: item.id,
          beforeData: {
            name: template.name,
            value: template.value,
            transactionType: template.transactionType,
            scene: template.scene,
            category: template.category,
            isActive: template.isActive
          },
          afterData: {
            name: item.name,
            value: item.value,
            transactionType: item.transactionType,
            scene: item.scene,
            category: item.category,
            isActive: item.isActive
          },
          metadata: {
            sourceModule: "settings",
            name: item.name
          }
        }
      });

      return item;
    });

    return {
      item: {
        ...updated,
        value: updated.value.toString()
      }
    };
  });

  app.delete("/classes/:classId/settings/reason-templates/:templateId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = reasonTemplateParamsSchema.parse(request.params);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const template = await app.prisma.pointReasonTemplate.findFirst({
      where: {
        id: params.templateId,
        classId: params.classId
      },
      select: {
        id: true,
        name: true,
        value: true,
        transactionType: true,
        scene: true,
        category: true,
        isEditable: true,
        isActive: true
      }
    });

    if (!template) {
      throw reply.notFound("Reason template not found");
    }

    if (!template.isEditable) {
      throw reply.badRequest("Reason template is not editable");
    }

    await app.prisma.$transaction(async (tx) => {
      await tx.pointReasonTemplate.delete({
        where: {
          id: template.id
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.delete",
          targetType: "point_reason_template",
          targetId: template.id,
          beforeData: {
            name: template.name,
            value: template.value,
            transactionType: template.transactionType,
            scene: template.scene,
            category: template.category,
            isActive: template.isActive
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });
    });

    return {
      deleted: true
    };
  });

  app.put("/classes/:classId/settings/reason-templates/reorder", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = reasonTemplateReorderBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const templates = await app.prisma.pointReasonTemplate.findMany({
      where: {
        classId: params.classId,
        id: {
          in: body.templateIds
        }
      },
      select: {
        id: true,
        displayOrder: true
      }
    });

    if (templates.length !== body.templateIds.length) {
      throw reply.badRequest("Reason template reorder list contains invalid templates");
    }

    const beforeData = templates
      .map((item) => ({
        id: item.id,
        displayOrder: item.displayOrder
      }))
      .sort((left, right) => left.displayOrder - right.displayOrder);
    const afterData = body.templateIds.map((id, index) => ({
      id,
      displayOrder: index + 1
    }));

    if (
      beforeData.length === afterData.length &&
      beforeData.every((item, index) => item.id === afterData[index]?.id && item.displayOrder === afterData[index]?.displayOrder)
    ) {
      throw reply.badRequest("Reason template order unchanged");
    }

    await app.prisma.$transaction(async (tx) => {
      for (const item of afterData) {
        await tx.pointReasonTemplate.update({
          where: {
            id: item.id
          },
          data: {
            displayOrder: item.displayOrder
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.reorder",
          targetType: "point_reason_template",
          beforeData,
          afterData,
          metadata: {
            sourceModule: "settings",
            total: afterData.length
          }
        }
      });
    });

    return {
      items: afterData
    };
  });

  app.put("/classes/:classId/settings/reason-templates/categories", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = reasonTemplateCategoryUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    if (body.scene === body.nextScene && body.category === body.nextCategory) {
      throw reply.badRequest("Reason template category unchanged");
    }

    const existingCount = await app.prisma.pointReasonTemplate.count({
      where: {
        classId: params.classId,
        scene: body.scene,
        category: body.category
      }
    });

    if (!existingCount) {
      throw reply.badRequest("Reason template category not found");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const result = await tx.pointReasonTemplate.updateMany({
        where: {
          classId: params.classId,
          scene: body.scene,
          category: body.category
        },
        data: {
          scene: body.nextScene,
          category: body.nextCategory
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.category.update",
          targetType: "point_reason_template",
          beforeData: {
            scene: body.scene,
            category: body.category,
            count: existingCount
          },
          afterData: {
            scene: body.nextScene,
            category: body.nextCategory,
            count: result.count
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return result;
    });

    return {
      updatedCount: updated.count
    };
  });

  app.put("/classes/:classId/settings/feature-flags/:featureFlagId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = featureFlagParamsSchema.parse(request.params);
    const body = featureFlagUpdateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings feature flag permission denied");
    }

    const featureFlag = await app.prisma.featureFlag.findFirst({
      where: {
        id: params.featureFlagId,
        tenantId: classRecord.tenantId,
        classId: params.classId
      },
      select: {
        id: true,
        code: true,
        enabled: true,
        config: true
      }
    });

    if (!featureFlag) {
      throw reply.notFound("Feature flag not found");
    }

    const nextEnabled = body.enabled ?? featureFlag.enabled;
    const nextConfig = body.config ?? featureFlag.config;

    if (
      nextEnabled === featureFlag.enabled &&
      JSON.stringify(nextConfig ?? {}) === JSON.stringify(featureFlag.config ?? {})
    ) {
      throw reply.badRequest("Feature flag settings unchanged");
    }

    const updated = await app.prisma.$transaction(async (tx) => {
      const item = await tx.featureFlag.update({
        where: {
          id: featureFlag.id
        },
        data: {
          enabled: nextEnabled,
          config: nextConfig
        },
        select: {
          id: true,
          code: true,
          enabled: true,
          config: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.feature_flag.update",
          targetType: "feature_flag",
          targetId: item.id,
          beforeData: {
            enabled: featureFlag.enabled,
            config: featureFlag.config
          },
          afterData: {
            enabled: item.enabled,
            config: item.config
          },
          metadata: {
            sourceModule: "settings",
            code: item.code
          }
        }
      });

      return item;
    });

    return {
      item: updated
    };
  });

  app.post("/classes/:classId/settings/reason-templates", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointReasonTemplateCreateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const existing = await app.prisma.pointReasonTemplate.findFirst({
      where: {
        classId: params.classId,
        name: body.name
      },
      select: {
        id: true
      }
    });

    if (existing) {
      throw reply.conflict("Reason template already exists");
    }

    const displayOrderAggregate = await app.prisma.pointReasonTemplate.aggregate({
      where: {
        classId: params.classId
      },
      _max: {
        displayOrder: true
      }
    });

    const created = await app.prisma.$transaction(async (tx) => {
      const template = await tx.pointReasonTemplate.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          name: body.name,
          value: body.value,
          transactionType: body.transactionType,
          scene: body.scene,
          category: body.category,
          isEditable: true,
          isActive: true,
          displayOrder: (displayOrderAggregate._max.displayOrder ?? 0) + 1
        },
        select: {
          id: true,
          name: true,
          value: true,
          transactionType: true,
          scene: true,
          category: true,
          isEditable: true,
          isActive: true
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.create",
          targetType: "point_reason_template",
          targetId: template.id,
          afterData: {
            name: template.name,
            value: template.value,
            transactionType: template.transactionType,
            scene: template.scene,
            category: template.category
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });

      return template;
    });

    return {
      item: {
        ...created,
        value: created.value.toString()
      }
    };
  });

  app.post("/classes/:classId/settings/reason-templates/batch", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointReasonTemplateBatchCreateBodySchema.parse(request.body);
    await requireClassNotFrozen(app, params.classId, reply);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const normalizedItems = body.items.map((item) => ({
      name: item.name.trim(),
      value: item.value,
      transactionType: item.transactionType,
      scene: item.scene.trim(),
      category: item.category.trim()
    }));
    const nameSet = new Set(normalizedItems.map((item) => item.name));
    if (nameSet.size !== normalizedItems.length) {
      throw reply.badRequest("Reason template batch contains duplicate names");
    }

    const existing = await app.prisma.pointReasonTemplate.findMany({
      where: {
        classId: params.classId,
        name: {
          in: Array.from(nameSet)
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    if (existing.length) {
      throw reply.conflict("Reason template already exists");
    }

    const displayOrderAggregate = await app.prisma.pointReasonTemplate.aggregate({
      where: {
        classId: params.classId
      },
      _max: {
        displayOrder: true
      }
    });
    let displayOrder = (displayOrderAggregate._max.displayOrder ?? 0) + 1;
    const createData = normalizedItems.map((item) => ({
      tenantId: classRecord.tenantId,
      classId: params.classId,
      name: item.name,
      value: item.value,
      transactionType: item.transactionType,
      scene: item.scene,
      category: item.category,
      isEditable: true,
      isActive: true,
      displayOrder: displayOrder++
    }));

    await app.prisma.$transaction(async (tx) => {
      await tx.pointReasonTemplate.createMany({
        data: createData
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "settings.reason_template.batch_create",
          targetType: "point_reason_template",
          afterData: {
            count: createData.length,
            names: createData.map((item) => item.name).slice(0, 50)
          },
          metadata: {
            sourceModule: "settings"
          }
        }
      });
    });

    return {
      createdCount: createData.length
    };
  });

  app.post("/classes/:classId/settings/reason-templates/batch/precheck", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const body = pointReasonTemplateBatchPrecheckBodySchema.parse(request.body);
    const classRecord = await app.prisma.class.findUnique({
      where: { id: params.classId },
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
          userId: auth.sub
        }
      },
      select: {
        id: true,
        status: true,
        roles: {
          select: {
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
    if (!canManagePoints(membership)) {
      throw reply.forbidden("Settings reason template permission denied");
    }

    const normalizedNames = body.names.map((name) => name.trim()).filter(Boolean);
    const uniqueNames = Array.from(new Set(normalizedNames));
    if (uniqueNames.length !== normalizedNames.length) {
      throw reply.badRequest("Reason template precheck contains duplicate names");
    }

    const existing = await app.prisma.pointReasonTemplate.findMany({
      where: {
        classId: params.classId,
        name: {
          in: uniqueNames
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    return {
      existingNames: existing.map((item) => item.name)
    };
  });

  app.get("/classes/:classId/settings/overview", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = classParamsSchema.parse(request.params);
    const classRecord = await requireClassAccess(app, auth.sub, params.classId, reply);

    const [classConfig, groups, dormitories, positions, reasonTemplates, featureFlags, students] = await Promise.all([
      app.prisma.classConfig.findUnique({
        where: {
          classId: params.classId
        },
        select: {
          className: true,
          timezone: true,
          isFrozen: true,
          scheduleNotes: true,
          countdownEvents: true,
          extra: true
        }
      }),
      app.prisma.group.findMany({
        where: { classId: params.classId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          legacyKey: true,
          name: true,
          colorToken: true,
          isActive: true,
          _count: {
            select: {
              members: true
            }
          }
        }
      }),
      app.prisma.dormitory.findMany({
        where: { classId: params.classId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          legacyKey: true,
          name: true,
          building: true,
          genderScope: true,
          isActive: true,
          _count: {
            select: {
              members: true
            }
          }
        }
      }),
      app.prisma.position.findMany({
        where: { classId: params.classId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          isActive: true,
          _count: {
            select: {
              holders: true
            }
          }
        }
      }),
      app.prisma.pointReasonTemplate.findMany({
        where: { classId: params.classId },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          value: true,
          transactionType: true,
          scene: true,
          category: true,
          isEditable: true,
          isActive: true
        }
      }),
      app.prisma.featureFlag.findMany({
        where: {
          tenantId: classRecord.tenantId,
          classId: params.classId
        },
        orderBy: {
          code: "asc"
        },
        select: {
          id: true,
          code: true,
          enabled: true,
          config: true
        }
      }),
      app.prisma.student.findMany({
        where: {
          classId: params.classId
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          sortOrder: true,
          groups: {
            where: {
              isPrimary: true
            },
            orderBy: {
              createdAt: "asc"
            },
            select: {
              group: {
                select: {
                  id: true,
                  legacyKey: true,
                  name: true
                }
              }
            }
          }
        }
      })
    ]);

    const reasonTemplateCategories = Array.from(
      reasonTemplates.reduce((acc, item) => {
        const key = `${item.scene}__${item.category}`;
        const current = acc.get(key) || {
          scene: item.scene,
          category: item.category,
          count: 0,
          totalValue: 0
        };
        current.count += 1;
        current.totalValue += Number(item.value);
        acc.set(key, current);
        return acc;
      }, new Map<string, { scene: string; category: string; count: number; totalValue: number }>())
        .values()
    ).sort((left, right) => right.count - left.count || left.scene.localeCompare(right.scene, "zh-CN"));

    const countdownEventItems = Array.isArray(classConfig?.countdownEvents)
      ? classConfig.countdownEvents.map((item, index) => {
          const event = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
          return {
            id: String(event.id || `countdown-${index}`),
            title: String(event.title || event.name || `事件 ${index + 1}`),
            date: event.date ? String(event.date) : null,
            note: event.note ? String(event.note) : null
          };
        })
      : [];

    const scheduleNoteItems =
      classConfig?.scheduleNotes && typeof classConfig.scheduleNotes === "object"
        ? Object.entries(classConfig.scheduleNotes as Record<string, unknown>).map(([key, value]) => ({
            key,
            value:
              typeof value === "string"
                ? value
                : value == null
                  ? ""
                  : JSON.stringify(value)
          }))
        : [];

    const studentIdByName = new Map(students.map((item) => [item.name, item.id]));
    const classConfigExtra = normalizeClassConfigExtra(classConfig?.extra, studentIdByName, groups);

    return {
      classConfig: classConfig
        ? {
            ...classConfig,
            ...classConfigExtra,
            legacyCompat: classConfigExtra.legacyCompat || null,
            countdownEventsCount: Array.isArray(classConfig.countdownEvents) ? classConfig.countdownEvents.length : 0,
            scheduleNotesCount:
              classConfig.scheduleNotes && typeof classConfig.scheduleNotes === "object"
                ? Object.keys(classConfig.scheduleNotes as Record<string, unknown>).length
                : 0,
            countdownEventItems,
            scheduleNoteItems
          }
        : null,
      totals: {
        groups: groups.length,
        dormitories: dormitories.length,
        positions: positions.length,
        reasonTemplates: reasonTemplates.length,
        enabledFeatures: featureFlags.filter((item) => item.enabled).length
      },
      groups: groups.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        colorToken: item.colorToken,
        isActive: item.isActive,
        membersCount: item._count.members
      })),
      dormitories: dormitories.map((item) => ({
        id: item.id,
        legacyKey: item.legacyKey,
        name: item.name,
        building: item.building,
        genderScope: item.genderScope,
        isActive: item.isActive,
        membersCount: item._count.members
      })),
      positions: positions.map((item) => ({
        id: item.id,
        code: item.code,
        name: item.name,
        category: item.category,
        isActive: item.isActive,
        holdersCount: item._count.holders
      })),
      reasonTemplateCategories,
      reasonTemplates: reasonTemplates.map((item) => ({
        ...item,
        value: item.value.toString()
      })),
      featureFlags,
      studentOptions: students.map((item) => ({
        id: item.id,
        name: item.name,
        status: item.status,
        sortOrder: item.sortOrder,
        primaryGroupId: item.groups[0]?.group.id || null,
        primaryGroupLegacyKey: item.groups[0]?.group.legacyKey || null,
        primaryGroupName: item.groups[0]?.group.name || null
      }))
    };
  });
};
