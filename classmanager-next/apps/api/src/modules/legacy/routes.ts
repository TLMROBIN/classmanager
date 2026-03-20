import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { canManagePoints } from "../../lib/permissions.js";
import { getDailyParticipantStatusValues } from "../../lib/studentStatus.js";

type LegacyMessage = {
  id: string;
  content: string;
  time: string | null;
  date: string | null;
};

type LegacyTask = {
  id: string;
  title: string;
  desc: string;
  points: number;
  startTime: string | null;
  endTime: string | null;
  claimedByStudentIds: string[];
};

type LegacyShopTreasure = {
  id: string;
  name: string;
  rarity: string;
  price: number;
  stock: number;
  desc: string;
  ladderPrices: number[];
  dailyLimit: number;
};

type LegacyShopLog = {
  id: string;
  ts: number | null;
  studentName: string;
  action: string;
  itemName: string;
  rarity: string | null;
  cost: number;
  note: string | null;
};

type LegacyShopData = {
  treasures: LegacyShopTreasure[];
  storage: Record<string, Record<string, number>>;
  logs: LegacyShopLog[];
  redemptionHistory: Record<string, Record<string, number>>;
  dailyRedemptionCounts: Record<string, Record<string, number>>;
  dailyUsageCounts: Record<string, Record<string, number>>;
};

type LegacyGachaResultItem = {
  id: string;
  name: string;
  rarity: string;
};

type LegacyBattleTeam = {
  id: string;
  name: string;
  memberStudentIds: string[];
  points: number;
};

type LegacyBattleSquad = {
  id: string;
  name: string;
  teamIds: string[];
};

type LegacyBattleMatch = {
  id: string;
  teamAId: string;
  teamBId: string;
  stake: number;
  isUnderdog: boolean;
};

type LegacyBattleLog = {
  id: string;
  time: string | null;
  msg: string;
};

type LegacyBattleExam = {
  id: string;
  name: string;
  ts: number | null;
  ranks: Record<string, { c: number | null; g: number | null }>;
};

type LegacyBattleData = {
  version: number;
  teams: LegacyBattleTeam[];
  squads: LegacyBattleSquad[];
  battles: LegacyBattleMatch[];
  logs: LegacyBattleLog[];
  history: unknown[];
  settlements: unknown[];
  season: number;
  rules: Record<string, unknown>;
  exams: LegacyBattleExam[];
  teamBaseExamId: string | null;
  settleExamId: string | null;
};

type LegacyCompatRecord = Record<string, unknown> & {
  messages: LegacyMessage[];
  teacherMessages: LegacyMessage[];
  tasks: LegacyTask[];
  shop: LegacyShopData;
  battle: LegacyBattleData | null;
};

const taskClaimParamsSchema = z.object({
  classId: z.string().uuid(),
  taskId: z.string().trim().min(1).max(120)
});

const taskClaimBodySchema = z.object({
  studentId: z.string().uuid(),
  occurredAt: z.string().datetime().optional()
});

const legacyShopActionParamsSchema = z.object({
  classId: z.string().uuid()
});

const legacyShopActionBodySchema = z.object({
  studentId: z.string().uuid(),
  itemId: z.string().trim().min(1).max(120),
  occurredAt: z.string().datetime().optional()
});

const legacyShopGachaBodySchema = z.object({
  studentId: z.string().uuid(),
  times: z.union([z.literal(1), z.literal(10)]),
  occurredAt: z.string().datetime().optional()
});

const legacyBattleSettleParamsSchema = z.object({
  classId: z.string().uuid()
});

const legacyBattleSettleBodySchema = z.object({
  occurredAt: z.string().datetime().optional()
});

async function requireClassAccess(app: any, userId: string, classId: string, reply: any) {
  const classRecord = await app.prisma.class.findUnique({
    where: { id: classId },
    select: {
      id: true,
      tenantId: true,
      timezone: true
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
        include: {
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

  return {
    classRecord,
    membership
  };
}

function requirePointsWritePermission(membership: Awaited<ReturnType<typeof requireClassAccess>>["membership"], reply: any) {
  if (!canManagePoints(membership)) {
    throw reply.forbidden("Legacy feature permission denied");
  }
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function normalizeLegacyMessages(value: unknown, prefix: string): LegacyMessage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const row = asRecord(item);
      const content = row.content == null ? "" : String(row.content).trim();
      if (!content) return null;

      return {
        id: row.id == null ? `${prefix}-${index + 1}` : String(row.id).trim() || `${prefix}-${index + 1}`,
        content,
        time: row.time == null ? null : String(row.time).trim() || null,
        date: row.date == null ? null : String(row.date).trim() || null
      };
    })
    .filter((item): item is LegacyMessage => Boolean(item));
}

function normalizeLegacyTasks(value: unknown): LegacyTask[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const row = asRecord(item);
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
    .filter((item): item is LegacyTask => Boolean(item));
}

function normalizeLegacyStudentItemMap(value: unknown) {
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
      .filter((item): item is [string, Record<string, number>] => Boolean(item))
  );
}

function normalizeLegacyDateItemCountMap(value: unknown) {
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
      .filter((item): item is [string, Record<string, number>] => Boolean(item))
  );
}

function normalizeLegacyShop(value: unknown): LegacyShopData {
  const raw = asRecord(value);

  return {
    treasures: Array.isArray(raw.treasures)
      ? raw.treasures
          .map((item, index) => {
            const row = asRecord(item);
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
          .filter((item): item is LegacyShopTreasure => Boolean(item))
      : [],
    storage: normalizeLegacyStudentItemMap(raw.storage),
    logs: Array.isArray(raw.logs)
      ? raw.logs
          .map((item, index) => {
            const row = asRecord(item);
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
          .filter((item): item is LegacyShopLog => Boolean(item))
      : [],
    redemptionHistory: normalizeLegacyStudentItemMap(raw.redemptionHistory),
    dailyRedemptionCounts: normalizeLegacyDateItemCountMap(raw.dailyRedemptionCounts),
    dailyUsageCounts: normalizeLegacyDateItemCountMap(raw.dailyUsageCounts)
  };
}

function normalizeLegacyBattle(value: unknown): LegacyBattleData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;

  return {
    version: Number.isFinite(Number(raw.version)) ? Number(raw.version) : 1,
    teams: Array.isArray(raw.teams)
      ? raw.teams
          .map((item, index) => {
            const row = asRecord(item);
            const id = row.id == null ? `team-${index + 1}` : String(row.id).trim();
            const name = row.name == null ? "" : String(row.name).trim();
            if (!id || !name) return null;

            const memberSource = Array.isArray(row.memberStudentIds)
              ? row.memberStudentIds
              : Array.isArray(row.memberIds)
                ? row.memberIds
                : [];

            return {
              id,
              name,
              memberStudentIds: Array.from(
                new Set(
                  memberSource
                    .map((studentId) => (studentId == null ? "" : String(studentId).trim()))
                    .filter((studentId) => studentId.length > 0)
                )
              ),
              points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0
            };
          })
          .filter((item): item is LegacyBattleTeam => Boolean(item))
      : [],
    squads: Array.isArray(raw.squads)
      ? raw.squads
          .map((item, index) => {
            const row = asRecord(item);
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
          .filter((item): item is LegacyBattleSquad => Boolean(item))
      : [],
    battles: Array.isArray(raw.battles)
      ? raw.battles
          .map((item, index) => {
            const row = asRecord(item);
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
          .filter((item): item is LegacyBattleMatch => Boolean(item))
      : [],
    logs: Array.isArray(raw.logs)
      ? raw.logs
          .map((item, index) => {
            const row = asRecord(item);
            const msg = row.msg == null ? "" : String(row.msg).trim();
            if (!msg) return null;

            return {
              id: row.id == null ? `battle-log-${index + 1}` : String(row.id).trim() || `battle-log-${index + 1}`,
              time: row.time == null ? null : String(row.time).trim() || null,
              msg
            };
          })
          .filter((item): item is LegacyBattleLog => Boolean(item))
      : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    settlements: Array.isArray(raw.settlements) ? raw.settlements : [],
    season: Number.isFinite(Number(raw.season)) ? Number(raw.season) : 1,
    rules: raw.rules && typeof raw.rules === "object" && !Array.isArray(raw.rules) ? (raw.rules as Record<string, unknown>) : {},
    exams: Array.isArray(raw.exams)
      ? raw.exams
          .map((item, index) => {
            const row = asRecord(item);
            const id = row.id == null ? `exam-${index + 1}` : String(row.id).trim();
            const name = row.name == null ? "" : String(row.name).trim();
            if (!id || !name) return null;

            const ranksRaw = row.ranks && typeof row.ranks === "object" && !Array.isArray(row.ranks) ? row.ranks : {};
            const ranks = Object.fromEntries(
              Object.entries(ranksRaw as Record<string, unknown>)
                .map(([studentId, rankValue]) => {
                  const rankRow = asRecord(rankValue);
                  const normalizedStudentId = String(studentId).trim();
                  if (!normalizedStudentId) return null;
                  const c = Number.isFinite(Number(rankRow.c)) ? Number(rankRow.c) : null;
                  const g = Number.isFinite(Number(rankRow.g)) ? Number(rankRow.g) : null;
                  return [normalizedStudentId, { c, g }];
                })
                .filter((item): item is [string, { c: number | null; g: number | null }] => Boolean(item))
            );

            return {
              id,
              name,
              ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : null,
              ranks
            };
          })
          .filter((item): item is LegacyBattleExam => Boolean(item))
      : [],
    teamBaseExamId: raw.teamBaseExamId == null ? null : String(raw.teamBaseExamId).trim() || null,
    settleExamId: raw.settleExamId == null ? null : String(raw.settleExamId).trim() || null
  };
}

function normalizeLegacyCompat(value: unknown): LegacyCompatRecord {
  const raw = asRecord(value);
  return {
    ...raw,
    messages: normalizeLegacyMessages(raw.messages, "message"),
    teacherMessages: normalizeLegacyMessages(raw.teacherMessages, "teacher-message"),
    tasks: normalizeLegacyTasks(raw.tasks),
    shop: normalizeLegacyShop(raw.shop),
    battle: normalizeLegacyBattle(raw.battle)
  };
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function splitCentsEvenly(totalCents: number, count: number) {
  if (count <= 0) {
    return [];
  }

  const base = Math.trunc(totalCents / count);
  let remainder = totalCents - base * count;

  return Array.from({ length: count }, () => {
    if (remainder > 0) {
      remainder -= 1;
      return base + 1;
    }
    if (remainder < 0) {
      remainder += 1;
      return base - 1;
    }
    return base;
  });
}

function getBattleTier(rank: number) {
  if (rank <= 8) return { k: 1, label: "T1" };
  if (rank <= 22) return { k: 1.2, label: "T2" };
  return { k: 1.5, label: "T3" };
}

function getBattleSafeThreshold(gradeRank: number) {
  if (gradeRank <= 50) return 1;
  if (gradeRank <= 150) return 10;
  if (gradeRank <= 400) return 30;
  if (gradeRank <= 600) return 60;
  return 100;
}

function getBattleExamById(exams: LegacyBattleExam[], examId: string | null) {
  if (!examId) return null;
  return exams.find((exam) => exam.id === examId) || null;
}

function getBattleRankFromExam(exam: LegacyBattleExam | null, studentId: string) {
  if (!exam) return null;
  return exam.ranks[studentId] || null;
}

function createLegacyBattleLog(msg: string) {
  return {
    id: `battle-log-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    time: new Date().toLocaleString("zh-CN"),
    msg
  };
}

function simulateLegacyBattleSettlement(
  battle: LegacyBattleData,
  studentsById: Map<
    string,
    {
      id: string;
      name: string;
      account: {
        id: string;
        totalPoints: number;
        balancePoints: number;
        penaltyPoints: number;
        version: number;
      };
    }
  >,
  totalStudents: number,
  occurredAt: Date,
  reply: any
) {
  if (!battle.teamBaseExamId || !battle.settleExamId) {
    throw reply.badRequest("Legacy battle exams not configured");
  }
  if (battle.battles.length === 0) {
    throw reply.badRequest("Legacy battle has no pending matches");
  }

  const teamBaseExam = getBattleExamById(battle.exams, battle.teamBaseExamId);
  const settleExam = getBattleExamById(battle.exams, battle.settleExamId);
  if (!teamBaseExam || !settleExam) {
    throw reply.badRequest("Legacy battle exam not found");
  }

  const buildMemberDetail = (studentId: string) => {
    const baseRank = getBattleRankFromExam(teamBaseExam, studentId);
    const settleRank = getBattleRankFromExam(settleExam, studentId);
    const baseClassRank = Number(baseRank?.c) || totalStudents;
    const baseGradeRank = Number(baseRank?.g) || Number(settleRank?.g) || totalStudents * 10;
    const newClassRank = Number(settleRank?.c) || baseClassRank;
    const newGradeRank = Number(settleRank?.g) || baseGradeRank;
    const abs = round2((totalStudents + 1 - newClassRank) * 1.5);
    let delta = baseClassRank - newClassRank;
    if (newClassRank <= 5 && delta >= 0) {
      if (newClassRank === 1) delta = Math.max(delta, 5);
      else if (newClassRank <= 3) delta = Math.max(delta, 3);
      else delta = Math.max(delta, 2);
    }
    const prog = round2(delta * 5);
    const total = round2(Math.max(10, abs + prog));
    const gradeImp = round2(baseGradeRank - newGradeRank);
    const safe = gradeImp >= getBattleSafeThreshold(baseGradeRank);
    const tier = getBattleTier(baseClassRank);

    return {
      studentId,
      studentName: studentsById.get(studentId)?.name || studentId,
      base: {
        c: baseClassRank,
        g: baseGradeRank
      },
      settle: {
        c: newClassRank,
        g: newGradeRank
      },
      abs,
      delta: round2(delta),
      prog,
      total,
      gradeImp,
      safe,
      tierLabel: tier.label,
      tierK: tier.k
    };
  };

  const teamResults = battle.teams.map((team) => {
    const memberIds = Array.from(new Set(team.memberStudentIds.filter(Boolean)));
    const memberDetails = memberIds.map(buildMemberDetail);
    const currentPoints = round2(Number(team.points) || 0);
    const tierAverage = memberDetails.length
      ? round2(memberDetails.reduce((sum, item) => sum + item.tierK, 0) / memberDetails.length)
      : 1;
    const cp = memberDetails.length ? round2(memberDetails.reduce((sum, item) => sum + item.total, 0) * tierAverage) : 0;

    return {
      id: team.id,
      name: team.name,
      memberStudentIds: memberIds,
      currentPoints,
      newPoints: currentPoints,
      cp,
      k: tierAverage,
      isSafe: memberDetails.some((item) => item.safe),
      memberDetails,
      memberNames: memberIds.map((studentId) => studentsById.get(studentId)?.name || studentId),
      won: false,
      messages: [] as string[]
    };
  });

  const teamResultById = new Map(teamResults.map((team) => [team.id, team]));
  const simulatedMatches = battle.battles.map((match) => {
    const teamA = teamResultById.get(match.teamAId);
    const teamB = teamResultById.get(match.teamBId);
    if (!teamA || !teamB) {
      return {
        ...match,
        outcomeTag: "无效对战",
        winId: null,
        detail: null
      };
    }

    let winner: "A" | "B" | null = null;
    if (teamA.cp > teamB.cp) {
      winner = "A";
    } else if (teamB.cp > teamA.cp) {
      winner = "B";
    }

    let outcomeTag = "平局";
    let formulaA = "不变";
    let formulaB = "不变";
    const stake = round2(Number(match.stake) || 0);

    if (winner === "A") {
      teamA.won = true;
      if (match.isUnderdog) {
        teamA.newPoints = round2(teamA.currentPoints * 2 + stake);
        teamB.newPoints = round2(teamB.currentPoints - stake);
        teamA.messages.push("下克上翻倍");
        outcomeTag = "下克上成立";
        formulaA = `当前积分×2 + 赌注(${stake})`;
        formulaB = `当前积分 - 赌注(${stake})`;
      } else {
        teamA.newPoints = round2(teamA.currentPoints * 2 + stake);
        teamB.newPoints = round2(-20 - stake);
        outcomeTag = "常规胜";
        formulaA = `当前积分×2 + 赌注(${stake})`;
        formulaB = `-20 - 赌注(${stake})`;
      }
    } else if (winner === "B") {
      teamB.won = true;
      if (match.isUnderdog) {
        teamA.newPoints = round2(teamA.currentPoints * 0.5 - stake);
        teamB.newPoints = round2(teamB.currentPoints * 2 + stake);
        teamA.messages.push("下克上抚恤");
        outcomeTag = "下克上失败";
        formulaA = `当前积分×0.5 - 赌注(${stake})`;
        formulaB = `当前积分×2 + 赌注(${stake})`;
      } else if (teamA.isSafe) {
        teamA.newPoints = round2(teamA.currentPoints * 0.5 - stake);
        teamB.newPoints = round2(teamB.currentPoints * 2 + stake);
        teamA.messages.push("外战保护");
        outcomeTag = "外战保护";
        formulaA = `当前积分×0.5 - 赌注(${stake})`;
        formulaB = `当前积分×2 + 赌注(${stake})`;
      } else {
        teamA.newPoints = round2(-20 - stake);
        teamB.newPoints = round2(teamB.currentPoints * 2 + stake);
        outcomeTag = "常规胜";
        formulaA = `-20 - 赌注(${stake})`;
        formulaB = `当前积分×2 + 赌注(${stake})`;
      }
    }

    return {
      ...match,
      outcomeTag,
      winId: winner === "A" ? teamA.id : winner === "B" ? teamB.id : null,
      detail: {
        teamA: {
          id: teamA.id,
          name: teamA.name,
          currentPoints: teamA.currentPoints,
          newPoints: teamA.newPoints,
          delta: round2(teamA.newPoints - teamA.currentPoints),
          cp: teamA.cp,
          k: teamA.k,
          isSafe: teamA.isSafe,
          members: teamA.memberNames,
          memberDetails: teamA.memberDetails,
          formula: formulaA,
          messages: [...teamA.messages]
        },
        teamB: {
          id: teamB.id,
          name: teamB.name,
          currentPoints: teamB.currentPoints,
          newPoints: teamB.newPoints,
          delta: round2(teamB.newPoints - teamB.currentPoints),
          cp: teamB.cp,
          k: teamB.k,
          isSafe: teamB.isSafe,
          members: teamB.memberNames,
          memberDetails: teamB.memberDetails,
          formula: formulaB,
          messages: [...teamB.messages]
        }
      }
    };
  });

  const squadBonuses = battle.squads
    .map((squad) => {
      const [firstTeamId, secondTeamId] = squad.teamIds;
      const teamA = firstTeamId ? teamResultById.get(firstTeamId) : null;
      const teamB = secondTeamId ? teamResultById.get(secondTeamId) : null;
      if (teamA?.won && teamB?.won) {
        teamA.newPoints = round2(teamA.newPoints * 1.2);
        teamB.newPoints = round2(teamB.newPoints * 1.2);
        teamA.messages.push("共鸣 +20%");
        teamB.messages.push("共鸣 +20%");
        return squad.name;
      }
      return null;
    })
    .filter((item): item is string => Boolean(item));

  const finalMatches = simulatedMatches.map((match) => {
    if (!match.detail) {
      return match;
    }
    const teamA = teamResultById.get(match.teamAId);
    const teamB = teamResultById.get(match.teamBId);
    if (!teamA || !teamB) {
      return match;
    }
    return {
      ...match,
      detail: {
        teamA: {
          ...match.detail.teamA,
          newPoints: teamA.newPoints,
          delta: round2(teamA.newPoints - teamA.currentPoints),
          messages: [...teamA.messages]
        },
        teamB: {
          ...match.detail.teamB,
          newPoints: teamB.newPoints,
          delta: round2(teamB.newPoints - teamB.currentPoints),
          messages: [...teamB.messages]
        }
      }
    };
  });

  const adjustments = teamResults.flatMap((team) => {
    const validMembers = team.memberStudentIds.filter((studentId) => studentsById.has(studentId));
    if (!validMembers.length) {
      return [];
    }

    const totalDeltaCents = Math.round((team.newPoints - team.currentPoints) * 100);
    if (totalDeltaCents === 0) {
      return [];
    }

    return splitCentsEvenly(totalDeltaCents, validMembers.length)
      .filter((valueCents) => valueCents !== 0)
      .map((valueCents, index) => {
        const studentId = validMembers[index];
        return {
          studentId,
          studentName: studentsById.get(studentId)?.name || studentId,
          teamId: team.id,
          teamName: team.name,
          value: valueCents / 100,
          transactionType: valueCents >= 0 ? "bonus" : "penalty"
        };
      });
  });

  const summaryText = finalMatches
    .map((match) => {
      const teamA = battle.teams.find((team) => team.id === match.teamAId);
      const teamB = battle.teams.find((team) => team.id === match.teamBId);
      const winnerName =
        match.winId === teamA?.id ? teamA?.name : match.winId === teamB?.id ? teamB?.name : "平局";
      return `${winnerName} ${match.outcomeTag}`;
    })
    .join(" / ");

  const settlementRecord = {
    id: `settlement-${Date.now()}`,
    ts: occurredAt.getTime(),
    teamBaseExamId: battle.teamBaseExamId,
    settleExamId: battle.settleExamId,
    teamBaseExamName: teamBaseExam.name,
    settleExamName: settleExam.name,
    squadBonuses,
    battles: finalMatches.map((match) => ({
      id: match.id,
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      stake: match.stake,
      isUnderdog: match.isUnderdog,
      outcomeTag: match.outcomeTag,
      winId: match.winId,
      teamA: match.detail?.teamA || null,
      teamB: match.detail?.teamB || null
    }))
  };

  return {
    occurredAt,
    teamResults,
    adjustments,
    settlementRecord,
    summaryText,
    squadBonuses
  };
}

function isNowWithinTaskWindow(task: LegacyTask, occurredAt: Date, reply: any) {
  if (task.startTime) {
    const startTime = new Date(task.startTime);
    if (!Number.isNaN(startTime.getTime()) && occurredAt.getTime() < startTime.getTime()) {
      throw reply.badRequest("Legacy task not started");
    }
  }

  if (task.endTime) {
    const endTime = new Date(task.endTime);
    if (!Number.isNaN(endTime.getTime()) && occurredAt.getTime() > endTime.getTime()) {
      throw reply.badRequest("Legacy task ended");
    }
  }
}

function getZonedDateKey(date: Date, timeZone: string | null | undefined) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timeZone || "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((item) => item.type === "year")?.value || "1970";
  const month = parts.find((item) => item.type === "month")?.value || "01";
  const day = parts.find((item) => item.type === "day")?.value || "01";
  return `${year}-${month}-${day}`;
}

function getLegacyShopPrice(studentId: string, item: LegacyShopTreasure, redemptionHistory: LegacyShopData["redemptionHistory"]) {
  if (!item.ladderPrices.length) {
    return item.price;
  }

  const history = redemptionHistory[studentId] || {};
  const count = history[item.id] || 0;
  const index = Math.min(count, item.ladderPrices.length - 1);
  return item.ladderPrices[index];
}

function getLegacyShopRefundPrice(
  studentId: string,
  item: LegacyShopTreasure,
  redemptionHistory: LegacyShopData["redemptionHistory"]
) {
  if (!item.ladderPrices.length) {
    return item.price;
  }

  const history = redemptionHistory[studentId] || {};
  const count = history[item.id] || 0;
  if (count <= 0) {
    return item.price;
  }

  const index = Math.min(count - 1, item.ladderPrices.length - 1);
  return item.ladderPrices[index];
}

function getStorageCount(storage: LegacyShopData["storage"], studentId: string, itemId: string) {
  return storage[studentId]?.[itemId] || 0;
}

function buildLegacyShopLog(studentName: string, action: string, item: LegacyShopTreasure, cost: number, note = ""): LegacyShopLog {
  return {
    id: `log-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    ts: Date.now(),
    studentName,
    action,
    itemName: item.name,
    rarity: item.rarity || null,
    cost,
    note: note || null
  };
}

function getLegacyGachaCost(times: 1 | 10) {
  return times === 10 ? 120 : 15;
}

function pickLegacyGachaTargetRarity() {
  const roll = Math.random() * 100;
  if (roll < 0.05) return "SSR";
  if (roll < 5) return "SR";
  if (roll < 30) return "R";
  return "N";
}

function findLegacyGachaPool(
  treasures: LegacyShopTreasure[],
  stockById: Map<string, number>,
  targetRarity: string
) {
  const rarityOrder = ["SSR", "SR", "R", "N"];
  const startIndex = Math.max(0, rarityOrder.indexOf(targetRarity));

  for (let index = startIndex; index < rarityOrder.length; index += 1) {
    const rarity = rarityOrder[index];
    const pool = treasures.filter((item) => item.rarity === rarity && (stockById.get(item.id) || 0) > 0);
    if (pool.length > 0) {
      return pool;
    }
  }

  return treasures.filter((item) => (stockById.get(item.id) || 0) > 0);
}

function performLegacyGachaDraws(
  treasures: LegacyShopTreasure[],
  times: 1 | 10,
  reply: any
) {
  const stockById = new Map(treasures.map((item) => [item.id, Math.max(0, Number(item.stock) || 0)]));
  const totalStock = Array.from(stockById.values()).reduce((sum, value) => sum + value, 0);
  if (totalStock < times) {
    throw reply.badRequest("Legacy shop gacha stock insufficient");
  }

  const results: LegacyGachaResultItem[] = [];

  for (let index = 0; index < times; index += 1) {
    const pool = findLegacyGachaPool(treasures, stockById, pickLegacyGachaTargetRarity());
    if (!pool.length) {
      throw reply.badRequest("Legacy shop gacha stock insufficient");
    }
    const picked = pool[Math.floor(Math.random() * pool.length)];
    stockById.set(picked.id, (stockById.get(picked.id) || 0) - 1);
    results.push({
      id: picked.id,
      name: picked.name,
      rarity: picked.rarity || "N"
    });
  }

  return {
    results,
    stockById
  };
}

async function loadLegacyCompatConfig(app: any, classId: string, reply: any) {
  const currentConfig = await app.prisma.classConfig.findUnique({
    where: {
      classId
    },
    select: {
      extra: true
    }
  });

  if (!currentConfig) {
    throw reply.notFound("Class config not found");
  }

  const rawExtra =
    currentConfig.extra && typeof currentConfig.extra === "object" && !Array.isArray(currentConfig.extra)
      ? (currentConfig.extra as Record<string, unknown>)
      : {};

  return {
    rawExtra,
    legacyCompat: normalizeLegacyCompat(rawExtra.legacyCompat),
    dailyParticipantStatusValues: getDailyParticipantStatusValues(rawExtra.studentStatusOptions)
  };
}

async function findDailyParticipantStudentWithAccount(
  app: any,
  classId: string,
  studentId: string,
  dailyParticipantStatusValues: string[],
  reply: any,
  message: string
) {
  const student = await app.prisma.student.findFirst({
    where: {
      id: studentId,
      classId,
      status: {
        in: dailyParticipantStatusValues
      }
    },
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

  if (!student || !student.account) {
    throw reply.notFound(message);
  }

  return student;
}

async function findDailyParticipantStudentBasic(
  app: any,
  classId: string,
  studentId: string,
  dailyParticipantStatusValues: string[],
  reply: any,
  message: string
) {
  const student = await app.prisma.student.findFirst({
    where: {
      id: studentId,
      classId,
      status: {
        in: dailyParticipantStatusValues
      }
    },
    select: {
      id: true,
      name: true
    }
  });

  if (!student) {
    throw reply.notFound(message);
  }

  return student;
}

export const legacyRoutes: FastifyPluginAsync = async (app) => {
  app.post("/classes/:classId/legacy/tasks/:taskId/claim", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = taskClaimParamsSchema.parse(request.params);
    const body = taskClaimBodySchema.parse(request.body);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const taskIndex = legacyCompat.tasks.findIndex((item) => item.id === params.taskId);
    if (taskIndex === -1) {
      throw reply.notFound("Legacy task not found");
    }

    const currentTask = legacyCompat.tasks[taskIndex];
    if (currentTask.claimedByStudentIds.length > 0) {
      throw reply.badRequest("Legacy task already claimed");
    }
    isNowWithinTaskWindow(currentTask, occurredAt, reply);

    const student = await findDailyParticipantStudentWithAccount(
      app,
      params.classId,
      body.studentId,
      dailyParticipantStatusValues,
      reply,
      "Legacy task student not found"
    );

    const nextTask = {
      ...currentTask,
      claimedByStudentIds: [student.id]
    };
    const nextTasks = legacyCompat.tasks.map((item, index) => (index === taskIndex ? nextTask : item));
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        tasks: nextTasks
      }
    };

    const value = Number(currentTask.points || 0);
    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: student.account.id,
          transactionType: "reward",
          value,
          reason: `任务领取：${currentTask.title}`,
          scene: "任务",
          category: "旧系统兼容",
          sourceModule: "legacy_tasks",
          sourceType: "legacy_task_claim",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt,
          metadata: {
            taskId: currentTask.id,
            taskTitle: currentTask.title
          }
        }
      });

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: student.account.id
        },
        data: {
          totalPoints: Number(student.account.totalPoints) + value,
          balancePoints: Number(student.account.balancePoints) + value,
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

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.task.claim",
          targetType: "class_config",
          beforeData: {
            taskId: currentTask.id,
            claimedByStudentIds: currentTask.claimedByStudentIds
          },
          afterData: {
            taskId: nextTask.id,
            taskTitle: nextTask.title,
            claimedByStudentIds: nextTask.claimedByStudentIds,
            studentId: student.id,
            studentName: student.name,
            value
          },
          metadata: {
            sourceModule: "legacy_tasks"
          }
        }
      });

      return {
        transaction,
        account: updatedAccount
      };
    });

    return {
      task: {
        id: nextTask.id,
        title: nextTask.title,
        points: nextTask.points,
        claimedByStudentIds: nextTask.claimedByStudentIds
      },
      student: {
        id: student.id,
        name: student.name
      },
      transaction: {
        id: result.transaction.id,
        transactionType: result.transaction.transactionType,
        value: result.transaction.value.toString(),
        reason: result.transaction.reason,
        occurredAt: result.transaction.occurredAt.toISOString()
      },
      account: {
        id: result.account.id,
        totalPoints: result.account.totalPoints.toString(),
        balancePoints: result.account.balancePoints.toString(),
        penaltyPoints: result.account.penaltyPoints.toString(),
        version: result.account.version
      }
    };
  });

  app.post("/classes/:classId/legacy/shop/redeem", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = legacyShopActionParamsSchema.parse(request.params);
    const body = legacyShopActionBodySchema.parse(request.body);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const currentShop = legacyCompat.shop;
    const itemIndex = currentShop.treasures.findIndex((item) => item.id === body.itemId);
    if (itemIndex === -1) {
      throw reply.notFound("Legacy shop item not found");
    }

    const currentItem = currentShop.treasures[itemIndex];
    if (currentItem.stock <= 0) {
      throw reply.badRequest("Legacy shop item out of stock");
    }

    const student = await findDailyParticipantStudentWithAccount(
      app,
      params.classId,
      body.studentId,
      dailyParticipantStatusValues,
      reply,
      "Legacy shop student not found"
    );

    const currentPrice = getLegacyShopPrice(student.id, currentItem, currentShop.redemptionHistory);
    const currentBalance = Number(student.account.balancePoints);
    if (currentItem.price < 0) {
      if (currentBalance >= 0) {
        throw reply.badRequest("Negative price item requires negative balance");
      }
      if (currentBalance - currentPrice > 0) {
        throw reply.badRequest("Negative price item cannot push balance above zero");
      }
    } else if (currentBalance < currentPrice) {
      throw reply.badRequest("Legacy shop balance insufficient");
    }

    const todayKey = getZonedDateKey(occurredAt, classRecord.timezone);
    const nextItem = {
      ...currentItem,
      stock: currentItem.stock - 1
    };
    const nextTreasures = currentShop.treasures.map((item, index) => (index === itemIndex ? nextItem : item));
    const nextStorage = {
      ...currentShop.storage,
      [student.id]: {
        ...(currentShop.storage[student.id] || {}),
        [currentItem.id]: getStorageCount(currentShop.storage, student.id, currentItem.id) + 1
      }
    };
    const nextRedemptionHistory = {
      ...currentShop.redemptionHistory,
      [student.id]: {
        ...(currentShop.redemptionHistory[student.id] || {}),
        [currentItem.id]: (currentShop.redemptionHistory[student.id]?.[currentItem.id] || 0) + 1
      }
    };
    const nextDailyRedemptionCounts = {
      ...currentShop.dailyRedemptionCounts,
      [todayKey]: {
        ...(currentShop.dailyRedemptionCounts[todayKey] || {}),
        [currentItem.id]: (currentShop.dailyRedemptionCounts[todayKey]?.[currentItem.id] || 0) + 1
      }
    };
    const nextLogs = [buildLegacyShopLog(student.name, "兑换", currentItem, currentPrice), ...currentShop.logs];
    const nextShop = {
      ...currentShop,
      treasures: nextTreasures,
      storage: nextStorage,
      logs: nextLogs,
      redemptionHistory: nextRedemptionHistory,
      dailyRedemptionCounts: nextDailyRedemptionCounts
    };
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        shop: nextShop
      }
    };
    const balanceDelta = -currentPrice;

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: student.account.id,
          transactionType: "adjustment",
          value: balanceDelta,
          reason: `兑换: ${currentItem.name}`,
          scene: "班级",
          category: "兑奖",
          sourceModule: "legacy_shop",
          sourceType: "legacy_shop_redeem",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt,
          metadata: {
            itemId: currentItem.id,
            itemName: currentItem.name,
            itemPrice: currentPrice,
            balanceDelta,
            affectsTotalPoints: false,
            affectsBalancePoints: true
          }
        }
      });

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: student.account.id
        },
        data: {
          balancePoints: currentBalance + balanceDelta,
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

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.shop.redeem",
          targetType: "class_config",
          beforeData: {
            studentId: student.id,
            itemId: currentItem.id,
            stock: currentItem.stock,
            storageCount: getStorageCount(currentShop.storage, student.id, currentItem.id),
            balancePoints: currentBalance
          },
          afterData: {
            studentId: student.id,
            studentName: student.name,
            itemId: currentItem.id,
            itemName: currentItem.name,
            stock: nextItem.stock,
            storageCount: getStorageCount(nextStorage, student.id, currentItem.id),
            price: currentPrice,
            balancePoints: updatedAccount.balancePoints
          },
          metadata: {
            sourceModule: "legacy_shop"
          }
        }
      });

      return {
        transaction,
        account: updatedAccount
      };
    });

    return {
      action: "兑换",
      student: {
        id: student.id,
        name: student.name
      },
      item: {
        id: currentItem.id,
        name: currentItem.name,
        rarity: currentItem.rarity,
        stock: nextItem.stock,
        storageCount: getStorageCount(nextStorage, student.id, currentItem.id)
      },
      price: currentPrice,
      transaction: {
        id: result.transaction.id,
        transactionType: result.transaction.transactionType,
        value: result.transaction.value.toString(),
        reason: result.transaction.reason,
        occurredAt: result.transaction.occurredAt.toISOString()
      },
      account: {
        id: result.account.id,
        totalPoints: result.account.totalPoints.toString(),
        balancePoints: result.account.balancePoints.toString(),
        penaltyPoints: result.account.penaltyPoints.toString(),
        version: result.account.version
      }
    };
  });

  app.post("/classes/:classId/legacy/shop/gacha", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = legacyShopActionParamsSchema.parse(request.params);
    const body = legacyShopGachaBodySchema.parse(request.body);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const currentShop = legacyCompat.shop;
    const student = await findDailyParticipantStudentWithAccount(
      app,
      params.classId,
      body.studentId,
      dailyParticipantStatusValues,
      reply,
      "Legacy shop student not found"
    );

    const cost = getLegacyGachaCost(body.times);
    const currentBalance = Number(student.account.balancePoints);
    if (currentBalance < cost) {
      throw reply.badRequest("Legacy shop balance insufficient");
    }

    const { results, stockById } = performLegacyGachaDraws(currentShop.treasures, body.times, reply);
    const resultCountByItemId = results.reduce<Record<string, number>>((accumulator, item) => {
      accumulator[item.id] = (accumulator[item.id] || 0) + 1;
      return accumulator;
    }, {});

    const nextTreasures = currentShop.treasures.map((item) => ({
      ...item,
      stock: stockById.get(item.id) || 0
    }));
    const currentStudentStorage = currentShop.storage[student.id] || {};
    const nextStorage = {
      ...currentShop.storage,
      [student.id]: Object.entries({
        ...currentStudentStorage,
        ...Object.fromEntries(
          Object.entries(resultCountByItemId).map(([itemId, count]) => [itemId, (currentStudentStorage[itemId] || 0) + count])
        )
      }).reduce<Record<string, number>>((accumulator, [itemId, count]) => {
        if (count > 0) {
          accumulator[itemId] = count;
        }
        return accumulator;
      }, {})
    };
    const nextLogs = [
      {
        id: `log-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
        ts: occurredAt.getTime(),
        studentName: student.name,
        action: "祈愿",
        itemName: body.times === 10 ? "10连抽" : "1连抽",
        rarity: "MIX",
        cost,
        note: results.map((item) => item.name).join(" / ")
      },
      ...currentShop.logs
    ];
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        shop: {
          ...currentShop,
          treasures: nextTreasures,
          storage: nextStorage,
          logs: nextLogs
        }
      }
    };
    const balanceDelta = -cost;

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: student.account.id,
          transactionType: "adjustment",
          value: balanceDelta,
          reason: `祈愿 x${body.times}`,
          scene: "班级",
          category: "兑奖",
          sourceModule: "legacy_shop",
          sourceType: "legacy_shop_gacha",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt,
          metadata: {
            times: body.times,
            cost,
            results,
            affectsTotalPoints: false,
            affectsBalancePoints: true
          }
        }
      });

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: student.account.id
        },
        data: {
          balancePoints: currentBalance + balanceDelta,
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

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.shop.gacha",
          targetType: "class_config",
          beforeData: {
            studentId: student.id,
            balancePoints: currentBalance
          },
          afterData: {
            studentId: student.id,
            studentName: student.name,
            times: body.times,
            cost,
            results,
            balancePoints: updatedAccount.balancePoints
          },
          metadata: {
            sourceModule: "legacy_shop"
          }
        }
      });

      return {
        transaction,
        account: updatedAccount
      };
    });

    return {
      action: "祈愿",
      student: {
        id: student.id,
        name: student.name
      },
      times: body.times,
      cost,
      results,
      transaction: {
        id: result.transaction.id,
        transactionType: result.transaction.transactionType,
        value: result.transaction.value.toString(),
        reason: result.transaction.reason,
        occurredAt: result.transaction.occurredAt.toISOString()
      },
      account: {
        id: result.account.id,
        totalPoints: result.account.totalPoints.toString(),
        balancePoints: result.account.balancePoints.toString(),
        penaltyPoints: result.account.penaltyPoints.toString(),
        version: result.account.version
      }
    };
  });

  app.post("/classes/:classId/legacy/shop/use", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = legacyShopActionParamsSchema.parse(request.params);
    const body = legacyShopActionBodySchema.parse(request.body);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const currentShop = legacyCompat.shop;
    const currentItem = currentShop.treasures.find((item) => item.id === body.itemId);
    if (!currentItem) {
      throw reply.notFound("Legacy shop item not found");
    }

    const student = await findDailyParticipantStudentBasic(
      app,
      params.classId,
      body.studentId,
      dailyParticipantStatusValues,
      reply,
      "Legacy shop student not found"
    );

    const currentStorageCount = getStorageCount(currentShop.storage, student.id, currentItem.id);
    if (currentStorageCount <= 0) {
      throw reply.badRequest("Legacy shop storage item insufficient");
    }

    const todayKey = getZonedDateKey(occurredAt, classRecord.timezone);
    const currentUsageCount = currentShop.dailyUsageCounts[todayKey]?.[currentItem.id] || 0;
    if (currentItem.dailyLimit > 0 && currentUsageCount >= currentItem.dailyLimit) {
      throw reply.badRequest("Legacy shop daily usage limit reached");
    }

    const nextStorage = {
      ...currentShop.storage
    };
    const nextStudentStorage = {
      ...(nextStorage[student.id] || {})
    };
    const nextStorageCount = currentStorageCount - 1;
    if (nextStorageCount > 0) {
      nextStudentStorage[currentItem.id] = nextStorageCount;
    } else {
      delete nextStudentStorage[currentItem.id];
    }
    if (Object.keys(nextStudentStorage).length > 0) {
      nextStorage[student.id] = nextStudentStorage;
    } else {
      delete nextStorage[student.id];
    }

    const nextDailyUsageCounts = {
      ...currentShop.dailyUsageCounts,
      [todayKey]: {
        ...(currentShop.dailyUsageCounts[todayKey] || {}),
        [currentItem.id]: currentUsageCount + 1
      }
    };
    const nextLogs = [buildLegacyShopLog(student.name, "使用", currentItem, 0), ...currentShop.logs];
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        shop: {
          ...currentShop,
          storage: nextStorage,
          logs: nextLogs,
          dailyUsageCounts: nextDailyUsageCounts
        }
      }
    };

    await app.prisma.$transaction(async (tx) => {
      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.shop.use",
          targetType: "class_config",
          beforeData: {
            studentId: student.id,
            itemId: currentItem.id,
            storageCount: currentStorageCount,
            dailyUsageCount: currentUsageCount
          },
          afterData: {
            studentId: student.id,
            studentName: student.name,
            itemId: currentItem.id,
            itemName: currentItem.name,
            storageCount: getStorageCount(nextStorage, student.id, currentItem.id),
            dailyUsageCount: currentUsageCount + 1
          },
          metadata: {
            sourceModule: "legacy_shop"
          }
        }
      });
    });

    return {
      action: "使用",
      student,
      item: {
        id: currentItem.id,
        name: currentItem.name,
        rarity: currentItem.rarity,
        stock: currentItem.stock,
        storageCount: getStorageCount(nextStorage, student.id, currentItem.id),
        dailyUsageCount: currentUsageCount + 1
      }
    };
  });

  app.post("/classes/:classId/legacy/shop/return", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = legacyShopActionParamsSchema.parse(request.params);
    const body = legacyShopActionBodySchema.parse(request.body);
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const currentShop = legacyCompat.shop;
    const itemIndex = currentShop.treasures.findIndex((item) => item.id === body.itemId);
    if (itemIndex === -1) {
      throw reply.notFound("Legacy shop item not found");
    }

    const currentItem = currentShop.treasures[itemIndex];
    const student = await findDailyParticipantStudentWithAccount(
      app,
      params.classId,
      body.studentId,
      dailyParticipantStatusValues,
      reply,
      "Legacy shop student not found"
    );

    const currentStorageCount = getStorageCount(currentShop.storage, student.id, currentItem.id);
    if (currentStorageCount <= 0) {
      throw reply.badRequest("Legacy shop storage item insufficient");
    }

    const refundPrice = getLegacyShopRefundPrice(student.id, currentItem, currentShop.redemptionHistory);
    const currentBalance = Number(student.account.balancePoints);
    const nextStorage = {
      ...currentShop.storage
    };
    const nextStudentStorage = {
      ...(nextStorage[student.id] || {})
    };
    const nextStorageCount = currentStorageCount - 1;
    if (nextStorageCount > 0) {
      nextStudentStorage[currentItem.id] = nextStorageCount;
    } else {
      delete nextStudentStorage[currentItem.id];
    }
    if (Object.keys(nextStudentStorage).length > 0) {
      nextStorage[student.id] = nextStudentStorage;
    } else {
      delete nextStorage[student.id];
    }

    const nextItem = {
      ...currentItem,
      stock: currentItem.stock + 1
    };
    const nextTreasures = currentShop.treasures.map((item, index) => (index === itemIndex ? nextItem : item));
    const nextRedemptionHistory = {
      ...currentShop.redemptionHistory
    };
    const nextStudentHistory = {
      ...(nextRedemptionHistory[student.id] || {})
    };
    const historyCount = nextStudentHistory[currentItem.id] || 0;
    const nextHistoryCount = historyCount - 1;
    if (nextHistoryCount > 0) {
      nextStudentHistory[currentItem.id] = nextHistoryCount;
    } else {
      delete nextStudentHistory[currentItem.id];
    }
    if (Object.keys(nextStudentHistory).length > 0) {
      nextRedemptionHistory[student.id] = nextStudentHistory;
    } else {
      delete nextRedemptionHistory[student.id];
    }

    const nextLogs = [buildLegacyShopLog(student.name, "退宝物", currentItem, refundPrice), ...currentShop.logs];
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        shop: {
          ...currentShop,
          treasures: nextTreasures,
          storage: nextStorage,
          logs: nextLogs,
          redemptionHistory: nextRedemptionHistory
        }
      }
    };
    const balanceDelta = refundPrice;

    const result = await app.prisma.$transaction(async (tx) => {
      const transaction = await tx.pointTransaction.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          studentId: student.id,
          pointAccountId: student.account.id,
          transactionType: "adjustment",
          value: balanceDelta,
          reason: `退宝物: ${currentItem.name}`,
          scene: "班级",
          category: "兑奖",
          sourceModule: "legacy_shop",
          sourceType: "legacy_shop_return",
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          occurredAt,
          metadata: {
            itemId: currentItem.id,
            itemName: currentItem.name,
            refundPrice,
            balanceDelta,
            affectsTotalPoints: false,
            affectsBalancePoints: true
          }
        }
      });

      const updatedAccount = await tx.pointAccount.update({
        where: {
          id: student.account.id
        },
        data: {
          balancePoints: currentBalance + balanceDelta,
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

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.shop.return",
          targetType: "class_config",
          beforeData: {
            studentId: student.id,
            itemId: currentItem.id,
            stock: currentItem.stock,
            storageCount: currentStorageCount,
            refundPrice,
            balancePoints: currentBalance
          },
          afterData: {
            studentId: student.id,
            studentName: student.name,
            itemId: currentItem.id,
            itemName: currentItem.name,
            stock: nextItem.stock,
            storageCount: getStorageCount(nextStorage, student.id, currentItem.id),
            balancePoints: updatedAccount.balancePoints
          },
          metadata: {
            sourceModule: "legacy_shop"
          }
        }
      });

      return {
        transaction,
        account: updatedAccount
      };
    });

    return {
      action: "退宝物",
      student: {
        id: student.id,
        name: student.name
      },
      item: {
        id: currentItem.id,
        name: currentItem.name,
        rarity: currentItem.rarity,
        stock: nextItem.stock,
        storageCount: getStorageCount(nextStorage, student.id, currentItem.id)
      },
      refundPrice,
      transaction: {
        id: result.transaction.id,
        transactionType: result.transaction.transactionType,
        value: result.transaction.value.toString(),
        reason: result.transaction.reason,
        occurredAt: result.transaction.occurredAt.toISOString()
      },
      account: {
        id: result.account.id,
        totalPoints: result.account.totalPoints.toString(),
        balancePoints: result.account.balancePoints.toString(),
        penaltyPoints: result.account.penaltyPoints.toString(),
        version: result.account.version
      }
    };
  });

  app.post("/classes/:classId/legacy/battle/settle", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = legacyBattleSettleParamsSchema.parse(request.params);
    const body = legacyBattleSettleBodySchema.parse(request.body || {});
    const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
    const { classRecord, membership } = await requireClassAccess(app, auth.sub, params.classId, reply);
    requirePointsWritePermission(membership, reply);
    await requireClassNotFrozen(app, params.classId, reply);

    const { rawExtra, legacyCompat, dailyParticipantStatusValues } = await loadLegacyCompatConfig(app, params.classId, reply);
    const currentBattle = legacyCompat.battle;
    if (!currentBattle) {
      throw reply.notFound("Legacy battle not found");
    }

    const dailyParticipantStudents = await app.prisma.student.findMany({
      where: {
        classId: params.classId,
        status: {
          in: dailyParticipantStatusValues
        }
      },
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

    const studentMap = new Map(
      dailyParticipantStudents
        .filter((student) => student.account)
        .map((student) => [
          student.id,
          {
            id: student.id,
            name: student.name,
            account: {
              id: student.account!.id,
              totalPoints: Number(student.account!.totalPoints),
              balancePoints: Number(student.account!.balancePoints),
              penaltyPoints: Number(student.account!.penaltyPoints),
              version: student.account!.version
            }
          }
        ])
    );

    const simulation = simulateLegacyBattleSettlement(
      currentBattle,
      studentMap,
      Math.max(dailyParticipantStudents.length, 1),
      occurredAt,
      reply
    );

    const nextBattle = {
      ...currentBattle,
      teams: currentBattle.teams.map((team) => {
        const result = simulation.teamResults.find((item) => item.id === team.id);
        return result
          ? {
              ...team,
              points: result.newPoints
            }
          : team;
      }),
      battles: [],
      logs: [
        createLegacyBattleLog(simulation.summaryText || "双子星结算完成"),
        ...currentBattle.logs
      ],
      settlements: [simulation.settlementRecord, ...currentBattle.settlements]
    };
    const nextExtra = {
      ...rawExtra,
      legacyCompat: {
        ...legacyCompat,
        battle: nextBattle
      }
    };

    const result = await app.prisma.$transaction(async (tx) => {
      const accountSnapshots = new Map(
        Array.from(studentMap.entries()).map(([studentId, student]) => [
          studentId,
          {
            ...student.account
          }
        ])
      );
      const transactions = [];

      for (const adjustment of simulation.adjustments) {
        const snapshot = accountSnapshots.get(adjustment.studentId);
        const student = studentMap.get(adjustment.studentId);
        if (!snapshot || !student) {
          continue;
        }

        const signedValue = round2(adjustment.value);
        const nextTotal = round2(snapshot.totalPoints + signedValue);
        const nextBalance = round2(snapshot.balancePoints + signedValue);
        const nextPenalty =
          adjustment.transactionType === "penalty"
            ? round2(snapshot.penaltyPoints + Math.abs(signedValue))
            : snapshot.penaltyPoints;

        const pointTransaction = await tx.pointTransaction.create({
          data: {
            tenantId: classRecord.tenantId,
            classId: params.classId,
            studentId: adjustment.studentId,
            pointAccountId: snapshot.id,
            transactionType: adjustment.transactionType,
            value: signedValue,
            reason: `双子星结算-${adjustment.teamName}`,
            scene: "班级",
            category: "学业",
            sourceModule: "legacy_battle",
            sourceType: "legacy_battle_settle",
            actorUserId: auth.sub,
            actorMembershipId: membership.id,
            occurredAt,
            metadata: {
              teamId: adjustment.teamId,
              teamName: adjustment.teamName,
              settlementId: simulation.settlementRecord.id
            }
          }
        });

        const updatedAccount = await tx.pointAccount.update({
          where: {
            id: snapshot.id
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

        accountSnapshots.set(adjustment.studentId, {
          id: updatedAccount.id,
          totalPoints: Number(updatedAccount.totalPoints),
          balancePoints: Number(updatedAccount.balancePoints),
          penaltyPoints: Number(updatedAccount.penaltyPoints),
          version: updatedAccount.version
        });

        transactions.push({
          studentId: adjustment.studentId,
          studentName: student.name,
          teamId: adjustment.teamId,
          teamName: adjustment.teamName,
          transaction: pointTransaction,
          account: updatedAccount
        });
      }

      await tx.classConfig.update({
        where: {
          classId: params.classId
        },
        data: {
          extra: nextExtra
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: classRecord.tenantId,
          classId: params.classId,
          actorUserId: auth.sub,
          actorMembershipId: membership.id,
          action: "legacy.battle.settle",
          targetType: "class_config",
          beforeData: {
            battleCount: currentBattle.battles.length,
            settlementCount: currentBattle.settlements.length
          },
          afterData: {
            settlementId: simulation.settlementRecord.id,
            battleCount: nextBattle.battles.length,
            settlementCount: nextBattle.settlements.length,
            summaryText: simulation.summaryText,
            adjustmentCount: simulation.adjustments.length
          },
          metadata: {
            sourceModule: "legacy_battle"
          }
        }
      });

      return {
        transactions
      };
    });

    return {
      settlement: {
        id: simulation.settlementRecord.id,
        occurredAt: occurredAt.toISOString(),
        teamBaseExamId: currentBattle.teamBaseExamId,
        settleExamId: currentBattle.settleExamId,
        teamBaseExamName: simulation.settlementRecord.teamBaseExamName,
        settleExamName: simulation.settlementRecord.settleExamName,
        squadBonuses: simulation.squadBonuses,
        summaryText: simulation.summaryText
      },
      teams: simulation.teamResults.map((team) => ({
        id: team.id,
        name: team.name,
        currentPoints: team.currentPoints,
        newPoints: team.newPoints,
        delta: round2(team.newPoints - team.currentPoints),
        won: team.won
      })),
      adjustments: result.transactions.map((item) => ({
        studentId: item.studentId,
        studentName: item.studentName,
        teamId: item.teamId,
        teamName: item.teamName,
        transactionType: item.transaction.transactionType,
        value: item.transaction.value.toString(),
        balancePoints: item.account.balancePoints.toString(),
        totalPoints: item.account.totalPoints.toString()
      }))
    };
  });
};
