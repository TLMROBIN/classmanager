import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import * as XLSX from "xlsx";

import {
  createBattleBackupPayload,
  normalizeImportedBattleBackup,
  parseImportedBattleExamRows
} from "../lib/legacyCompat";
import { isStudentDailyParticipant } from "../lib/studentStatus";
import type { LegacyCompatData, LegacyShopGachaResponse, StudentItem, StudentStatusOptionItem } from "../types";

type LegacyPanelProps = {
  legacyCompat: LegacyCompatData | null;
  students: StudentItem[];
  statusOptions: StudentStatusOptionItem[];
  canManageLegacy: boolean;
  classFrozen: boolean;
  updatingLegacyCompat: boolean;
  claimingTaskId: string;
  redeemingItemId: string;
  rollingGacha: boolean;
  usingItemId: string;
  returningItemId: string;
  settlingBattle: boolean;
  legacyWriteMessage: string;
  latestGachaResult: LegacyShopGachaResponse | null;
  onUpdateLegacyCompat: (input: { legacyCompat: LegacyCompatData | null }) => void;
  onClaimTask: (input: { taskId: string; studentId: string }) => void;
  onRedeemItem: (input: { studentId: string; itemId: string }) => void;
  onGacha: (input: { studentId: string; times: 1 | 10 }) => Promise<LegacyShopGachaResponse | null> | void;
  onUseItem: (input: { studentId: string; itemId: string }) => void;
  onReturnItem: (input: { studentId: string; itemId: string }) => void;
  onSettleBattle: () => void;
};

type TreasureFormState = {
  name: string;
  rarity: string;
  price: string;
  stock: string;
  desc: string;
  ladderPrices: string;
  dailyLimit: string;
};

type LegacyBattleData = NonNullable<LegacyCompatData["battle"]>;

type BattleTeamFormState = {
  name: string;
  points: string;
  memberStudentIds: string[];
};

type BattleMatchFormState = {
  teamAId: string;
  teamBId: string;
  stake: string;
  isUnderdog: boolean;
};

type BattleSquadFormState = {
  name: string;
  teamIds: string[];
};

type BattleConfigFormState = {
  season: string;
  teamBaseExamId: string;
  settleExamId: string;
};

type LegacyBattleExam = {
  id: string;
  name: string;
  ts: number | null;
  ranks: Record<string, { c?: number | null; g?: number | null }>;
};

type LegacyBattleSettlement = {
  id: string;
  ts: number | null;
  teamBaseExamName: string | null;
  settleExamName: string | null;
  battles: Array<{
    id: string;
    teamAId: string;
    teamBId: string;
    stake: number;
    isUnderdog: boolean;
    outcomeTag: string | null;
    winId: string | null;
  }>;
};

type LegacyBattleHistory = {
  id: string;
  date: string | null;
  results: Array<{
    name: string;
    finalPts: number;
  }>;
  battles: unknown[];
};

function createEmptyLegacyCompat(): LegacyCompatData {
  return {
    strategyDates: null,
    messages: [],
    teacherMessages: [],
    tasks: [],
    shop: {
      treasures: [],
      storage: {},
      logs: [],
      redemptionHistory: {},
      dailyRedemptionCounts: {},
      dailyUsageCounts: {}
    },
    battle: null
  };
}

function getTaskState(task: LegacyCompatData["tasks"][number], now: Date) {
  const startTime = task.startTime ? new Date(task.startTime) : null;
  const endTime = task.endTime ? new Date(task.endTime) : null;
  const isStarted = !startTime || Number.isNaN(startTime.getTime()) || now.getTime() >= startTime.getTime();
  const isEnded = Boolean(endTime && !Number.isNaN(endTime.getTime()) && now.getTime() > endTime.getTime());
  const isClaimed = task.claimedByStudentIds.length > 0;

  if (isClaimed) return "claimed";
  if (!isStarted) return "upcoming";
  if (isEnded) return "ended";
  return "active";
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN");
}

function formatMessageTime(date: string | null, time: string | null) {
  if (date && time) return `${date} ${time}`;
  if (date) return date;
  if (time) return time;
  return "-";
}

function formatLogTime(ts: number | null) {
  if (!ts) return "-";
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return String(ts);
  return date.toLocaleString("zh-CN");
}

function buildConfirmMessage(lines: Array<string | null | undefined | false>) {
  return lines.filter(Boolean).join("\n");
}

function formatPreview(labels: string[], limit = 4, unit = "项") {
  const normalized = Array.from(
    new Set(
      labels
        .map((label) => label.trim())
        .filter(Boolean)
    )
  );
  if (!normalized.length) return null;
  const preview = normalized.slice(0, limit);
  return normalized.length > limit ? `${preview.join("、")} 等 ${normalized.length} ${unit}` : preview.join("、");
}

function formatStudentPreview(students: StudentItem[], studentIds: string[], limit = 4) {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  return formatPreview(
    studentIds
      .map((studentId) => studentMap.get(studentId))
      .filter((student): student is StudentItem => Boolean(student))
      .map((student) => `${student.sortOrder}. ${student.name}`),
    limit,
    "人"
  );
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getLegacyPrice(
  studentId: string,
  item: LegacyCompatData["shop"]["treasures"][number],
  redemptionHistory: LegacyCompatData["shop"]["redemptionHistory"]
) {
  if (!item.ladderPrices.length) return item.price;
  const history = redemptionHistory[studentId] || {};
  const count = history[item.id] || 0;
  const index = Math.min(count, item.ladderPrices.length - 1);
  return item.ladderPrices[index];
}

function getLegacyRefundPrice(
  studentId: string,
  item: LegacyCompatData["shop"]["treasures"][number],
  redemptionHistory: LegacyCompatData["shop"]["redemptionHistory"]
) {
  if (!item.ladderPrices.length) return item.price;
  const history = redemptionHistory[studentId] || {};
  const count = history[item.id] || 0;
  if (count <= 0) return item.price;
  const index = Math.min(count - 1, item.ladderPrices.length - 1);
  return item.ladderPrices[index];
}

function createEmptyTreasureForm(): TreasureFormState {
  return {
    name: "",
    rarity: "N",
    price: "10",
    stock: "10",
    desc: "",
    ladderPrices: "",
    dailyLimit: "0"
  };
}

function createLegacyShopManagementLog(
  item: LegacyCompatData["shop"]["treasures"][number],
  note: string
): LegacyCompatData["shop"]["logs"][number] {
  return {
    id: `log-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    ts: Date.now(),
    studentName: "系统",
    action: "管理",
    itemName: item.name,
    rarity: item.rarity || null,
    cost: 0,
    note
  };
}

function createEmptyLegacyBattle(): LegacyBattleData {
  return {
    version: 1,
    teams: [],
    squads: [],
    battles: [],
    logs: [],
    history: [],
    settlements: [],
    season: 1,
    rules: {},
    exams: [],
    teamBaseExamId: null,
    settleExamId: null
  };
}

function createEmptyBattleTeamForm(): BattleTeamFormState {
  return {
    name: "",
    points: "50",
    memberStudentIds: []
  };
}

function createEmptyBattleMatchForm(): BattleMatchFormState {
  return {
    teamAId: "",
    teamBId: "",
    stake: "5",
    isUnderdog: false
  };
}

function createEmptyBattleSquadForm(): BattleSquadFormState {
  return {
    name: "",
    teamIds: []
  };
}

function createBattleConfigForm(battle: LegacyBattleData | null): BattleConfigFormState {
  return {
    season: String(battle?.season ?? 1),
    teamBaseExamId: battle?.teamBaseExamId || "",
    settleExamId: battle?.settleExamId || ""
  };
}

function createBattleLog(msg: string): LegacyBattleData["logs"][number] {
  return {
    id: `battle-log-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
    time: new Date().toLocaleString("zh-CN"),
    msg
  };
}

function normalizeBattleExams(value: unknown[]): LegacyBattleExam[] {
  return value.reduce<LegacyBattleExam[]>((accumulator, item, index) => {
    const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
    const id = row.id == null ? `exam-${index + 1}` : String(row.id).trim();
    const name = row.name == null ? "" : String(row.name).trim();
    if (!id || !name) {
      return accumulator;
    }

    accumulator.push({
      id,
      name,
      ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : null,
      ranks:
        row.ranks && typeof row.ranks === "object" && !Array.isArray(row.ranks)
          ? (row.ranks as Record<string, { c?: number | null; g?: number | null }>)
          : {}
    });
    return accumulator;
  }, []);
}

function normalizeBattleSettlements(value: unknown[]): LegacyBattleSettlement[] {
  return value
    .map((item, index) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const id = row.id == null ? `settlement-${index + 1}` : String(row.id).trim();
      if (!id) return null;
      return {
        id,
        ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : null,
        teamBaseExamName: row.teamBaseExamName == null ? null : String(row.teamBaseExamName).trim() || null,
        settleExamName: row.settleExamName == null ? null : String(row.settleExamName).trim() || null,
        battles: Array.isArray(row.battles)
          ? row.battles
              .map((battle, battleIndex) => {
                const battleRow =
                  battle && typeof battle === "object" && !Array.isArray(battle)
                    ? (battle as Record<string, unknown>)
                    : {};
                const battleId = battleRow.id == null ? `settlement-battle-${battleIndex + 1}` : String(battleRow.id).trim();
                const teamAId = battleRow.teamAId == null ? "" : String(battleRow.teamAId).trim();
                const teamBId = battleRow.teamBId == null ? "" : String(battleRow.teamBId).trim();
                if (!battleId || !teamAId || !teamBId) return null;
                return {
                  id: battleId,
                  teamAId,
                  teamBId,
                  stake: Number.isFinite(Number(battleRow.stake)) ? Number(battleRow.stake) : 0,
                  isUnderdog: Boolean(battleRow.isUnderdog),
                  outcomeTag: battleRow.outcomeTag == null ? null : String(battleRow.outcomeTag).trim() || null,
                  winId: battleRow.winId == null ? null : String(battleRow.winId).trim() || null
                };
              })
              .filter(
                (
                  battle
                ): battle is {
                  id: string;
                  teamAId: string;
                  teamBId: string;
                  stake: number;
                  isUnderdog: boolean;
                  outcomeTag: string | null;
                  winId: string | null;
                } => Boolean(battle)
              )
          : []
      };
    })
    .filter((item): item is LegacyBattleSettlement => Boolean(item));
}

function normalizeBattleHistory(value: unknown[]): LegacyBattleHistory[] {
  return value
    .map((item, index) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      const rawId = row.id == null ? `history-${index + 1}` : row.id;
      return {
        id: String(rawId).trim() || `history-${index + 1}`,
        date: row.date == null ? null : String(row.date).trim() || null,
        results: Array.isArray(row.results)
          ? row.results
              .map((result) => {
                const resultRow =
                  result && typeof result === "object" && !Array.isArray(result)
                    ? (result as Record<string, unknown>)
                    : {};
                const name = resultRow.name == null ? "" : String(resultRow.name).trim();
                if (!name) return null;
                return {
                  name,
                  finalPts: Number.isFinite(Number(resultRow.finalPts)) ? Number(resultRow.finalPts) : 0
                };
              })
              .filter((result): result is { name: string; finalPts: number } => Boolean(result))
          : [],
        battles: Array.isArray(row.battles) ? row.battles : []
      };
    })
    .filter((item): item is LegacyBattleHistory => Boolean(item));
}

function getTodayLabel() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export function LegacyPanel({
  legacyCompat,
  students,
  statusOptions,
  canManageLegacy,
  classFrozen,
  updatingLegacyCompat,
  claimingTaskId,
  redeemingItemId,
  rollingGacha,
  usingItemId,
  returningItemId,
  settlingBattle,
  legacyWriteMessage,
  latestGachaResult,
  onUpdateLegacyCompat,
  onClaimTask,
  onRedeemItem,
  onGacha,
  onUseItem,
  onReturnItem,
  onSettleBattle
}: LegacyPanelProps) {
  const compat = legacyCompat ?? createEmptyLegacyCompat();
  const [messageType, setMessageType] = useState<"messages" | "teacherMessages">("teacherMessages");
  const [messageContent, setMessageContent] = useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [taskSearch, setTaskSearch] = useState("");
  const [shopSearch, setShopSearch] = useState("");
  const [claimStudentId, setClaimStudentId] = useState("");
  const [shopStudentId, setShopStudentId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDesc, setNewTaskDesc] = useState("");
  const [newTaskPoints, setNewTaskPoints] = useState("5");
  const [newTaskStartTime, setNewTaskStartTime] = useState("");
  const [newTaskEndTime, setNewTaskEndTime] = useState("");
  const [editingTreasureId, setEditingTreasureId] = useState("");
  const [treasureForm, setTreasureForm] = useState<TreasureFormState>(() => createEmptyTreasureForm());
  const [editingBattleTeamId, setEditingBattleTeamId] = useState("");
  const [battleTeamForm, setBattleTeamForm] = useState<BattleTeamFormState>(() => createEmptyBattleTeamForm());
  const [battleMatchForm, setBattleMatchForm] = useState<BattleMatchFormState>(() => createEmptyBattleMatchForm());
  const [editingBattleSquadId, setEditingBattleSquadId] = useState("");
  const [battleSquadForm, setBattleSquadForm] = useState<BattleSquadFormState>(() => createEmptyBattleSquadForm());
  const [battleConfigForm, setBattleConfigForm] = useState<BattleConfigFormState>(() => createBattleConfigForm(null));
  const [panelError, setPanelError] = useState("");
  const battleBackupInputRef = useRef<HTMLInputElement | null>(null);
  const battleExamInputRef = useRef<HTMLInputElement | null>(null);

  const studentNameById = useMemo(
    () => new Map(students.map((student) => [student.id, student.name])),
    [students]
  );
  const dailyParticipantStudents = useMemo(
    () => students.filter((student) => isStudentDailyParticipant(student.status, statusOptions)),
    [statusOptions, students]
  );
  const selectedShopStudent = useMemo(
    () =>
      dailyParticipantStudents.find((student) => student.id === shopStudentId) ?? dailyParticipantStudents[0] ?? null,
    [dailyParticipantStudents, shopStudentId]
  );
  const selectedShopStudentId = selectedShopStudent?.id || "";
  const selectedShopStudentBalance = selectedShopStudent?.account?.balancePoints ?? "0";
  const treasureById = useMemo(
    () => new Map(compat.shop.treasures.map((item) => [item.id, item])),
    [compat.shop.treasures]
  );
  const filteredMessages = useMemo(() => {
    const keyword = messageSearch.trim();
    return {
      messages: compat.messages.filter((item) =>
        !keyword || [item.content, item.date || "", item.time || ""].some((value) => value.includes(keyword))
      ),
      teacherMessages: compat.teacherMessages.filter((item) =>
        !keyword || [item.content, item.date || "", item.time || ""].some((value) => value.includes(keyword))
      )
    };
  }, [compat.messages, compat.teacherMessages, messageSearch]);
  const filteredTasks = useMemo(() => {
    const keyword = taskSearch.trim();
    const now = new Date();
    return compat.tasks
      .filter((item) =>
        !keyword ||
        [item.title, item.desc, String(item.points), item.startTime || "", item.endTime || ""].some((value) =>
          value.includes(keyword)
        )
      )
      .slice()
      .sort((left, right) => {
        const leftState = getTaskState(left, now);
        const rightState = getTaskState(right, now);
        const stateRank = {
          active: 0,
          upcoming: 1,
          claimed: 2,
          ended: 3
        } as const;
        if (stateRank[leftState] !== stateRank[rightState]) {
          return stateRank[leftState] - stateRank[rightState];
        }
        return (right.startTime || "").localeCompare(left.startTime || "");
      });
  }, [compat.tasks, taskSearch]);
  const filteredTreasures = useMemo(() => {
    const keyword = shopSearch.trim();
    return compat.shop.treasures
      .filter((item) =>
        !keyword ||
        [item.name, item.desc, item.rarity, String(item.price), item.ladderPrices.join("/")].some((value) =>
          value.includes(keyword)
        )
      )
      .slice()
      .sort((left, right) => {
        if ((left.stock > 0) !== (right.stock > 0)) {
          return left.stock > 0 ? -1 : 1;
        }
        return left.name.localeCompare(right.name, "zh-CN");
      });
  }, [compat.shop.treasures, shopSearch]);
  const selectedStudentStorage = useMemo(() => {
    if (!selectedShopStudentId) return [];
    return Object.entries(compat.shop.storage[selectedShopStudentId] || {})
      .map(([itemId, count]) => {
        const item = treasureById.get(itemId);
        return {
          itemId,
          count,
          item:
            item || {
              id: itemId,
              name: itemId,
              rarity: "N",
              price: 0,
              stock: 0,
              desc: "",
              ladderPrices: [],
              dailyLimit: 0
            }
        };
      })
      .sort((left, right) => left.item.name.localeCompare(right.item.name, "zh-CN"));
  }, [compat.shop.storage, selectedShopStudentId, treasureById]);
  const recentLogs = useMemo(() => compat.shop.logs.slice(0, 30), [compat.shop.logs]);
  const latestGachaSummary = useMemo(() => {
    if (!latestGachaResult) return [];
    return Array.from(
      latestGachaResult.results.reduce((accumulator, item) => {
        accumulator.set(`${item.name} [${item.rarity}]`, (accumulator.get(`${item.name} [${item.rarity}]`) || 0) + 1);
        return accumulator;
      }, new Map<string, number>())
    );
  }, [latestGachaResult]);
  const todayUsageCounts = compat.shop.dailyUsageCounts[getTodayKey()] || {};
  const shopBusy = Boolean(redeemingItemId || rollingGacha || usingItemId || returningItemId);
  const managingLegacyShop = updatingLegacyCompat || shopBusy;
  const battleCompat = compat.battle;
  const battleTeams = battleCompat?.teams ?? [];
  const battleSquads = battleCompat?.squads ?? [];
  const battleMatches = battleCompat?.battles ?? [];
  const battleLogs = useMemo(() => (battleCompat?.logs ?? []).slice(0, 20), [battleCompat?.logs]);
  const battleExams = useMemo(() => normalizeBattleExams(battleCompat?.exams ?? []), [battleCompat?.exams]);
  const battleSettlements = useMemo(
    () => normalizeBattleSettlements(battleCompat?.settlements ?? []).slice(0, 10),
    [battleCompat?.settlements]
  );
  const battleHistory = useMemo(
    () => normalizeBattleHistory(battleCompat?.history ?? []).slice(0, 10),
    [battleCompat?.history]
  );

  useEffect(() => {
    setBattleConfigForm(createBattleConfigForm(battleCompat));
  }, [battleCompat?.season, battleCompat?.teamBaseExamId, battleCompat?.settleExamId]);

  function pushLegacyCompat(nextCompat: LegacyCompatData) {
    setPanelError("");
    onUpdateLegacyCompat({
      legacyCompat: nextCompat
    });
  }

  function handleAddMessage() {
    const content = messageContent.trim();
    if (!content) {
      setPanelError("留言内容不能为空。");
      return;
    }

    const now = new Date();
    const nextItem = {
      id: `${messageType}-${Date.now()}`,
      content,
      date: now.toISOString().slice(0, 10),
      time: now.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false })
    };

    pushLegacyCompat({
      ...compat,
      [messageType]: [nextItem, ...compat[messageType]]
    });
    setMessageContent("");
  }

  function handleDeleteMessage(type: "messages" | "teacherMessages", id: string) {
    if (!window.confirm("确认删除这条留言？")) return;

    pushLegacyCompat({
      ...compat,
      [type]: compat[type].filter((item) => item.id !== id)
    });
  }

  function handleAddTask() {
    const title = newTaskTitle.trim();
    const points = Number(newTaskPoints);
    if (!title) {
      setPanelError("任务标题不能为空。");
      return;
    }
    if (!Number.isFinite(points) || points <= 0 || points > 1000) {
      setPanelError("任务积分必须是 1 到 1000 之间的数字。");
      return;
    }
    if (!newTaskStartTime || !newTaskEndTime) {
      setPanelError("任务开始和结束时间不能为空。");
      return;
    }
    if (newTaskStartTime >= newTaskEndTime) {
      setPanelError("任务结束时间必须晚于开始时间。");
      return;
    }

    pushLegacyCompat({
      ...compat,
      tasks: [
        ...compat.tasks,
        {
          id: `task-${Date.now()}`,
          title,
          desc: newTaskDesc.trim(),
          points,
          startTime: new Date(newTaskStartTime).toISOString(),
          endTime: new Date(newTaskEndTime).toISOString(),
          claimedByStudentIds: []
        }
      ]
    });
    setNewTaskTitle("");
    setNewTaskDesc("");
    setNewTaskPoints("5");
    setNewTaskStartTime("");
    setNewTaskEndTime("");
  }

  function resetTreasureForm() {
    setEditingTreasureId("");
    setTreasureForm(createEmptyTreasureForm());
  }

  function handleDeleteTask(taskId: string) {
    const task = compat.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const claimedPreview = formatStudentPreview(students, task.claimedByStudentIds);
    if (
      !window.confirm(
        buildConfirmMessage([
          "确认删除这项任务？",
          `任务：${task.title}`,
          `奖励：+${task.points} 分`,
          `时间：${formatDateTime(task.startTime)} ~ ${formatDateTime(task.endTime)}`,
          task.desc ? `说明：${task.desc}` : "",
          `已领取：${task.claimedByStudentIds.length} 人`,
          claimedPreview ? `领取预览：${claimedPreview}` : "",
          "删除后会直接移除兼容区任务定义和领取状态。"
        ])
      )
    )
      return;

    pushLegacyCompat({
      ...compat,
      tasks: compat.tasks.filter((item) => item.id !== taskId)
    });
  }

  function handleEditTreasure(item: LegacyCompatData["shop"]["treasures"][number]) {
    setPanelError("");
    setEditingTreasureId(item.id);
    setTreasureForm({
      name: item.name,
      rarity: item.rarity || "N",
      price: String(item.price),
      stock: String(item.stock),
      desc: item.desc || "",
      ladderPrices: item.ladderPrices.join(", "),
      dailyLimit: String(item.dailyLimit || 0)
    });
  }

  function handleSaveTreasure() {
    const name = treasureForm.name.trim();
    const price = Number(treasureForm.price);
    const stock = Number(treasureForm.stock);
    const dailyLimit = Number(treasureForm.dailyLimit);
    const ladderPrices = treasureForm.ladderPrices
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));

    if (!name) {
      setPanelError("宝物名称不能为空。");
      return;
    }
    if (!Number.isFinite(price) || Math.abs(price) > 10000) {
      setPanelError("宝物价格必须是有效数字，且绝对值不超过 10000。");
      return;
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
      setPanelError("库存必须是 0 到 100000 之间的整数。");
      return;
    }
    if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 100000) {
      setPanelError("每日上限必须是 0 到 100000 之间的整数。");
      return;
    }

    const nextItem = {
      id: editingTreasureId || `treasure-${Date.now()}`,
      name,
      rarity: treasureForm.rarity || "N",
      price,
      stock,
      desc: treasureForm.desc.trim(),
      ladderPrices,
      dailyLimit
    };
    const nextTreasures = editingTreasureId
      ? compat.shop.treasures.map((item) => (item.id === editingTreasureId ? nextItem : item))
      : [...compat.shop.treasures, nextItem];
    const nextLogs = [
      createLegacyShopManagementLog(
        nextItem,
        editingTreasureId
          ? `更新了 ${nextItem.name} (库存:${nextItem.stock}, 价格:${nextItem.price})`
          : `添加了 ${nextItem.name}`
      ),
      ...compat.shop.logs
    ];

    pushLegacyCompat({
      ...compat,
      shop: {
        ...compat.shop,
        treasures: nextTreasures,
        logs: nextLogs
      }
    });
    resetTreasureForm();
  }

  function handleDeleteTreasure(item: LegacyCompatData["shop"]["treasures"][number]) {
    const storageStudentIds = Object.entries(compat.shop.storage)
      .filter(([, itemMap]) => (itemMap[item.id] || 0) > 0)
      .map(([studentId]) => studentId);
    const totalStorageCount = storageStudentIds.reduce(
      (sum, studentId) => sum + (compat.shop.storage[studentId]?.[item.id] || 0),
      0
    );
    const redemptionStudentIds = Object.entries(compat.shop.redemptionHistory)
      .filter(([, itemMap]) => (itemMap[item.id] || 0) > 0)
      .map(([studentId]) => studentId);
    const totalRedemptionCount = redemptionStudentIds.reduce(
      (sum, studentId) => sum + (compat.shop.redemptionHistory[studentId]?.[item.id] || 0),
      0
    );
    const storagePreview = formatStudentPreview(students, storageStudentIds);
    if (
      !window.confirm(
        buildConfirmMessage([
          `确认删除宝物“${item.name}”？`,
          `稀有度：${item.rarity || "N"}`,
          `价格：${item.price} 分`,
          `库存：${item.stock} 件`,
          item.dailyLimit ? `每日上限：${item.dailyLimit} 次` : "",
          item.ladderPrices.length ? `阶梯价：${item.ladderPrices.join(" / ")} 分` : "",
          `受影响储物箱：${storageStudentIds.length} 人，共 ${totalStorageCount} 件`,
          totalRedemptionCount ? `累计兑换：${totalRedemptionCount} 次` : "",
          storagePreview ? `持有人预览：${storagePreview}` : "",
          "这会同步清理储物箱、兑换统计和相关日志上下文。"
        ])
      )
    )
      return;

    const nextStorage = Object.fromEntries(
      Object.entries(compat.shop.storage)
        .map(([studentId, itemMap]) => {
          const nextItemMap = Object.fromEntries(
            Object.entries(itemMap).filter(([itemId]) => itemId !== item.id)
          );
          return Object.keys(nextItemMap).length > 0 ? [studentId, nextItemMap] : null;
        })
        .filter((entry): entry is [string, Record<string, number>] => Boolean(entry))
    );
    const nextRedemptionHistory = Object.fromEntries(
      Object.entries(compat.shop.redemptionHistory)
        .map(([studentId, itemMap]) => {
          const nextItemMap = Object.fromEntries(
            Object.entries(itemMap).filter(([itemId]) => itemId !== item.id)
          );
          return Object.keys(nextItemMap).length > 0 ? [studentId, nextItemMap] : null;
        })
        .filter((entry): entry is [string, Record<string, number>] => Boolean(entry))
    );
    const nextDailyRedemptionCounts = Object.fromEntries(
      Object.entries(compat.shop.dailyRedemptionCounts)
        .map(([date, itemMap]) => {
          const nextItemMap = Object.fromEntries(
            Object.entries(itemMap).filter(([itemId]) => itemId !== item.id)
          );
          return Object.keys(nextItemMap).length > 0 ? [date, nextItemMap] : null;
        })
        .filter((entry): entry is [string, Record<string, number>] => Boolean(entry))
    );
    const nextDailyUsageCounts = Object.fromEntries(
      Object.entries(compat.shop.dailyUsageCounts)
        .map(([date, itemMap]) => {
          const nextItemMap = Object.fromEntries(
            Object.entries(itemMap).filter(([itemId]) => itemId !== item.id)
          );
          return Object.keys(nextItemMap).length > 0 ? [date, nextItemMap] : null;
        })
        .filter((entry): entry is [string, Record<string, number>] => Boolean(entry))
    );
    const nextLogs = [createLegacyShopManagementLog(item, `删除了 ${item.name}`), ...compat.shop.logs];

    pushLegacyCompat({
      ...compat,
      shop: {
        ...compat.shop,
        treasures: compat.shop.treasures.filter((current) => current.id !== item.id),
        storage: nextStorage,
        logs: nextLogs,
        redemptionHistory: nextRedemptionHistory,
        dailyRedemptionCounts: nextDailyRedemptionCounts,
        dailyUsageCounts: nextDailyUsageCounts
      }
    });
    if (editingTreasureId === item.id) {
      resetTreasureForm();
    }
  }

  function pushBattle(nextBattle: LegacyBattleData | null) {
    pushLegacyCompat({
      ...compat,
      battle: nextBattle
    });
  }

  function resetBattleTeamForm() {
    setEditingBattleTeamId("");
    setBattleTeamForm(createEmptyBattleTeamForm());
  }

  function resetBattleSquadForm() {
    setEditingBattleSquadId("");
    setBattleSquadForm(createEmptyBattleSquadForm());
  }

  function handleInitializeBattle() {
    const dailyParticipants = students.filter((student) => isStudentDailyParticipant(student.status, statusOptions));
    if (
      !window.confirm(
        buildConfirmMessage([
          "确认初始化双子星兼容数据？",
          `可选学生：${dailyParticipants.length} 人`,
          dailyParticipants.length ? `学生预览：${formatPreview(dailyParticipants.map((item) => `${item.sortOrder}. ${item.name}`), 5, "人")}` : "",
          "会创建一个空的赛季 1 对战区，后续可继续导入备份、考试和战队配置。"
        ])
      )
    )
      return;
    pushBattle(createEmptyLegacyBattle());
    resetBattleTeamForm();
    resetBattleSquadForm();
    setBattleMatchForm(createEmptyBattleMatchForm());
  }

  function handleEditBattleTeam(team: LegacyBattleData["teams"][number]) {
    setPanelError("");
    setEditingBattleTeamId(team.id);
    setBattleTeamForm({
      name: team.name,
      points: String(team.points),
      memberStudentIds: team.memberStudentIds
    });
  }

  function handleSaveBattleTeam() {
    const currentBattle = battleCompat ?? createEmptyLegacyBattle();
    const name = battleTeamForm.name.trim();
    const points = Number(battleTeamForm.points);
    const memberStudentIds = Array.from(new Set(battleTeamForm.memberStudentIds.filter(Boolean)));

    if (!name) {
      setPanelError("战队名称不能为空。");
      return;
    }
    if (!Number.isFinite(points) || Math.abs(points) > 100000) {
      setPanelError("战队积分必须是有效数字，且绝对值不超过 100000。");
      return;
    }

    const nextTeam = {
      id: editingBattleTeamId || `team-${Date.now()}`,
      name,
      memberStudentIds,
      points
    };

    pushBattle({
      ...currentBattle,
      teams: editingBattleTeamId
        ? currentBattle.teams.map((team) => (team.id === editingBattleTeamId ? nextTeam : team))
        : [...currentBattle.teams, nextTeam],
      logs: [
        createBattleLog(
          editingBattleTeamId
            ? `更新战队 ${nextTeam.name}，成员 ${nextTeam.memberStudentIds.length} 人，积分 ${nextTeam.points}`
            : `新增战队 ${nextTeam.name}`
        ),
        ...currentBattle.logs
      ]
    });
    resetBattleTeamForm();
  }

  function handleEditBattleSquad(squad: LegacyBattleData["squads"][number]) {
    setPanelError("");
    setEditingBattleSquadId(squad.id);
    setBattleSquadForm({
      name: squad.name,
      teamIds: squad.teamIds
    });
  }

  function handleSaveBattleSquad() {
    const currentBattle = battleCompat ?? createEmptyLegacyBattle();
    const name = battleSquadForm.name.trim();
    const teamIds = Array.from(new Set(battleSquadForm.teamIds.filter(Boolean))).slice(0, 2);

    if (!name) {
      setPanelError("共鸣小队名称不能为空。");
      return;
    }
    if (teamIds.length === 0) {
      setPanelError("请至少选择一支战队。");
      return;
    }

    const nextSquad = {
      id: editingBattleSquadId || `squad-${Date.now()}`,
      name,
      teamIds
    };

    pushBattle({
      ...currentBattle,
      squads: editingBattleSquadId
        ? currentBattle.squads.map((squad) => (squad.id === editingBattleSquadId ? nextSquad : squad))
        : [...currentBattle.squads, nextSquad],
      logs: [
        createBattleLog(editingBattleSquadId ? `更新共鸣 ${nextSquad.name}` : `新增共鸣 ${nextSquad.name}`),
        ...currentBattle.logs
      ]
    });
    resetBattleSquadForm();
  }

  function handleDeleteBattleTeam(team: LegacyBattleData["teams"][number]) {
    if (!battleCompat) return;
    const affectedSquads = battleCompat.squads.filter((squad) => squad.teamIds.includes(team.id));
    const affectedMatches = battleCompat.battles.filter((battle) => battle.teamAId === team.id || battle.teamBId === team.id);
    const memberPreview = formatStudentPreview(students, team.memberStudentIds);
    const squadPreview = formatPreview(affectedSquads.map((squad) => squad.name), 4, "组");
    if (
      !window.confirm(
        buildConfirmMessage([
          `确认删除战队“${team.name}”？`,
          `当前积分：${team.points} 分`,
          `成员：${team.memberStudentIds.length} 人`,
          memberPreview ? `成员预览：${memberPreview}` : "",
          `关联共鸣：${affectedSquads.length} 组`,
          squadPreview ? `共鸣预览：${squadPreview}` : "",
          `关联挑战：${affectedMatches.length} 场`,
          "这会同步清理关联挑战与小队引用。"
        ])
      )
    )
      return;

    pushBattle({
      ...battleCompat,
      teams: battleCompat.teams.filter((item) => item.id !== team.id),
      squads: battleCompat.squads.map((squad) => ({
        ...squad,
        teamIds: squad.teamIds.filter((teamId) => teamId !== team.id)
      })),
      battles: battleCompat.battles.filter((battle) => battle.teamAId !== team.id && battle.teamBId !== team.id),
      logs: [createBattleLog(`删除战队 ${team.name}`), ...battleCompat.logs]
    });
    if (editingBattleTeamId === team.id) {
      resetBattleTeamForm();
    }
    setBattleMatchForm((current) => ({
      ...current,
      teamAId: current.teamAId === team.id ? "" : current.teamAId,
      teamBId: current.teamBId === team.id ? "" : current.teamBId
    }));
    setBattleSquadForm((current) => ({
      ...current,
      teamIds: current.teamIds.filter((teamId) => teamId !== team.id)
    }));
  }

  function handleDeleteBattleSquad(squad: LegacyBattleData["squads"][number]) {
    if (!battleCompat) return;
    const linkedTeams = squad.teamIds
      .map((teamId) => battleCompat.teams.find((team) => team.id === teamId)?.name || teamId)
      .filter(Boolean);
    if (
      !window.confirm(
        buildConfirmMessage([
          `确认删除共鸣“${squad.name}”？`,
          `关联战队：${squad.teamIds.length} 队`,
          linkedTeams.length ? `战队预览：${formatPreview(linkedTeams, 4, "队")}` : "",
          "删除后不会影响战队本身，但会移除这条共鸣关系。"
        ])
      )
    )
      return;

    pushBattle({
      ...battleCompat,
      squads: battleCompat.squads.filter((item) => item.id !== squad.id),
      logs: [createBattleLog(`删除共鸣 ${squad.name}`), ...battleCompat.logs]
    });
    if (editingBattleSquadId === squad.id) {
      resetBattleSquadForm();
    }
  }

  function handleSaveBattleConfig() {
    const currentBattle = battleCompat ?? createEmptyLegacyBattle();
    const nextSeason = Math.max(1, Number(battleConfigForm.season) || 1);

    pushBattle({
      ...currentBattle,
      season: nextSeason,
      teamBaseExamId: battleConfigForm.teamBaseExamId || null,
      settleExamId: battleConfigForm.settleExamId || null,
      logs: [createBattleLog("更新双子星配置"), ...currentBattle.logs]
    });
  }

  function handleResetBattlePoints() {
    if (!battleCompat) return;
    if (
      !window.confirm(
        buildConfirmMessage([
          "确认将所有战队积分重置为 50 分？",
          `战队数量：${battleCompat.teams.length} 队`,
          battleCompat.teams.length
            ? `当前积分预览：${formatPreview(
                battleCompat.teams
                  .slice()
                  .sort((left, right) => right.points - left.points)
                  .map((team) => `${team.name} ${team.points} 分`),
                4,
                "队"
              )}`
            : "",
          "重置后所有战队都会回到 50 分。"
        ])
      )
    )
      return;

    pushBattle({
      ...battleCompat,
      teams: battleCompat.teams.map((team) => ({
        ...team,
        points: 50
      })),
      logs: [createBattleLog("重置全部战队积分为 50"), ...battleCompat.logs]
    });
  }

  function handleArchiveBattleSeason() {
    const currentBattle = battleCompat ?? createEmptyLegacyBattle();
    if (!currentBattle.teams.length) {
      setPanelError("当前没有战队，无法归档赛季。");
      return;
    }
    if (
      !window.confirm(
        buildConfirmMessage([
          `确认归档第 ${currentBattle.season} 赛季并开启下一赛季？`,
          `战队：${currentBattle.teams.length} 队`,
          `共鸣：${currentBattle.squads.length} 组`,
          `待归档挑战：${currentBattle.battles.length} 场`,
          battleExams.length ? `考试：${battleExams.length} 份` : "",
          battleSettlements.length ? `历史结算：${battleSettlements.length} 条` : "",
          `赛季排行预览：${formatPreview(
            currentBattle.teams
              .slice()
              .sort((left, right) => right.points - left.points)
              .map((team) => `${team.name} ${team.points} 分`),
            4,
            "队"
          )}`,
          "归档后会保留本赛季历史，清空挑战列表，并把所有战队积分重置为 50 分。"
        ])
      )
    )
      return;

    const today = new Date().toLocaleDateString("zh-CN");
    const seasonLabel = `第 ${currentBattle.season} 赛季`;
    pushBattle({
      ...currentBattle,
      history: [
        {
          id: `history-${Date.now()}`,
          date: today,
          results: currentBattle.teams
            .slice()
            .sort((left, right) => right.points - left.points)
            .map((team) => ({
              name: team.name,
              finalPts: team.points
            })),
          battles: currentBattle.battles
        },
        ...currentBattle.history
      ],
      season: currentBattle.season + 1,
      teams: currentBattle.teams.map((team) => ({
        ...team,
        points: 50
      })),
      battles: [],
      logs: [createBattleLog(`${seasonLabel} 已归档，新赛季已开启`), ...currentBattle.logs]
    });
  }

  function handleDeleteBattleExam(examId: string) {
    if (!battleCompat) return;
    const exam = battleExams.find((item) => item.id === examId);
    if (!exam) return;
    if (
      !window.confirm(
        buildConfirmMessage([
          `确认删除考试“${exam.name}”？`,
          exam.ts ? `导入时间：${formatLogTime(exam.ts)}` : "",
          `匹配学生：${Object.keys(exam.ranks).length} 人`,
          battleCompat.teamBaseExamId === examId ? "当前正作为组队基准考试使用。" : "",
          battleCompat.settleExamId === examId ? "当前正作为结算考试使用。" : "",
          "删除后会自动回退到下一份可用考试或清空对应配置。"
        ])
      )
    )
      return;

    const nextExams = battleCompat.exams.filter((item) => {
      const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
      return String(row.id ?? "").trim() !== examId;
    });
    const fallbackExamId = normalizeBattleExams(nextExams)[0]?.id ?? null;
    pushBattle({
      ...battleCompat,
      exams: nextExams,
      teamBaseExamId: battleCompat.teamBaseExamId === examId ? fallbackExamId : battleCompat.teamBaseExamId,
      settleExamId: battleCompat.settleExamId === examId ? fallbackExamId : battleCompat.settleExamId,
      logs: [createBattleLog(`删除考试 ${exam.name}`), ...battleCompat.logs]
    });
  }

  function handleSaveBattleMatch() {
    const currentBattle = battleCompat ?? createEmptyLegacyBattle();
    const stake = Number(battleMatchForm.stake);

    if (!battleMatchForm.teamAId || !battleMatchForm.teamBId) {
      setPanelError("请先选择挑战双方战队。");
      return;
    }
    if (battleMatchForm.teamAId === battleMatchForm.teamBId) {
      setPanelError("挑战双方不能是同一支战队。");
      return;
    }
    if (!Number.isFinite(stake) || stake <= 0 || stake > 100000) {
      setPanelError("挑战赌注必须是 1 到 100000 之间的数字。");
      return;
    }

    const teamAName = currentBattle.teams.find((team) => team.id === battleMatchForm.teamAId)?.name || battleMatchForm.teamAId;
    const teamBName = currentBattle.teams.find((team) => team.id === battleMatchForm.teamBId)?.name || battleMatchForm.teamBId;

    pushBattle({
      ...currentBattle,
      battles: [
        ...currentBattle.battles,
        {
          id: `battle-${Date.now()}`,
          teamAId: battleMatchForm.teamAId,
          teamBId: battleMatchForm.teamBId,
          stake,
          isUnderdog: battleMatchForm.isUnderdog
        }
      ],
      logs: [
        createBattleLog(
          `新增挑战 ${teamAName} vs ${teamBName}，赌注 ${stake}${battleMatchForm.isUnderdog ? "，以下克上" : ""}`
        ),
        ...currentBattle.logs
      ]
    });
    setBattleMatchForm(createEmptyBattleMatchForm());
  }

  function handleDeleteBattleMatch(match: LegacyBattleData["battles"][number]) {
    if (!battleCompat) return;
    const teamAName = battleCompat.teams.find((team) => team.id === match.teamAId)?.name || match.teamAId;
    const teamBName = battleCompat.teams.find((team) => team.id === match.teamBId)?.name || match.teamBId;

    if (
      !window.confirm(
        buildConfirmMessage([
          `确认删除挑战“${teamAName} vs ${teamBName}”？`,
          `赌注：${match.stake} 分`,
          match.isUnderdog ? "规则：以下克上" : "规则：常规对局",
          "删除后这场挑战不会再参与后续双子星结算。"
        ])
      )
    )
      return;

    pushBattle({
      ...battleCompat,
      battles: battleCompat.battles.filter((item) => item.id !== match.id),
      logs: [createBattleLog(`删除挑战 ${teamAName} vs ${teamBName}`), ...battleCompat.logs]
    });
  }

  function handleResetTasks() {
    const claimedTasks = compat.tasks.filter((item) => item.claimedByStudentIds.length > 0);
    const claimedStudentIds = Array.from(new Set(claimedTasks.flatMap((item) => item.claimedByStudentIds)));
    if (
      !window.confirm(
        buildConfirmMessage([
          "确认把所有任务重置为未领取状态？",
          `任务总数：${compat.tasks.length} 项`,
          `已领取任务：${claimedTasks.length} 项`,
          `受影响学生：${claimedStudentIds.length} 人`,
          claimedTasks.length ? `任务预览：${formatPreview(claimedTasks.map((item) => item.title), 4, "项")}` : "",
          formatStudentPreview(students, claimedStudentIds) ? `学生预览：${formatStudentPreview(students, claimedStudentIds)}` : "",
          "这会清空所有任务的领取状态，但不会删除任务本身。"
        ])
      )
    )
      return;

    pushLegacyCompat({
      ...compat,
      tasks: compat.tasks.map((item) => ({
        ...item,
        claimedByStudentIds: []
      }))
    });
  }

  function handleRedeem(itemId: string) {
    if (!selectedShopStudentId) {
      setPanelError("请先选择需要操作的学生。");
      return;
    }
    setPanelError("");
    onRedeemItem({
      studentId: selectedShopStudentId,
      itemId
    });
  }

  function handleUse(itemId: string) {
    if (!selectedShopStudentId) {
      setPanelError("请先选择需要操作的学生。");
      return;
    }
    setPanelError("");
    onUseItem({
      studentId: selectedShopStudentId,
      itemId
    });
  }

  function handleReturn(itemId: string) {
    if (!selectedShopStudentId) {
      setPanelError("请先选择需要操作的学生。");
      return;
    }
    setPanelError("");
    onReturnItem({
      studentId: selectedShopStudentId,
      itemId
    });
  }

  function handleGacha(times: 1 | 10) {
    if (!selectedShopStudentId) {
      setPanelError("请先选择祈愿对象。");
      return;
    }
    setPanelError("");
    void onGacha({
      studentId: selectedShopStudentId,
      times
    });
  }

  function handleExportBattleBackup() {
    if (!battleCompat) {
      setPanelError("当前还没有双子星兼容数据，无法导出备份。");
      return;
    }
    setPanelError("");
    downloadTextFile(
      `battle_backup_${getTodayLabel()}.json`,
      JSON.stringify(createBattleBackupPayload(battleCompat, students), null, 2),
      "application/json;charset=utf-8"
    );
  }

  async function handleImportBattleBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const raw = JSON.parse(await file.text());
      const importedBattle = normalizeImportedBattleBackup(raw, students);
      if (
        !window.confirm(
          buildConfirmMessage([
            "确认导入该对战备份并覆盖当前双子星兼容数据？",
            `文件：${file.name}`,
            battleCompat
              ? `当前数据：第 ${battleCompat.season} 赛季 / ${battleCompat.teams.length} 队 / ${battleCompat.battles.length} 场 / ${battleExams.length} 份考试`
              : "当前数据：未初始化",
            `导入内容：第 ${importedBattle.season} 赛季 / ${importedBattle.teams.length} 队 / ${importedBattle.battles.length} 场 / ${importedBattle.exams.length} 份考试`,
            importedBattle.settlements.length ? `导入结算：${importedBattle.settlements.length} 条` : "",
            importedBattle.history.length ? `导入历史：${importedBattle.history.length} 条` : "",
            "导入后会整体替换当前双子星兼容数据。"
          ])
        )
      )
        return;
      pushBattle({
        ...importedBattle,
        logs: [createBattleLog(`导入对战备份 ${file.name}`), ...importedBattle.logs]
      });
    } catch (error) {
      setPanelError(error instanceof Error ? `导入对战备份失败：${error.message}` : "导入对战备份失败。");
    }
  }

  async function handleImportBattleExam(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!data.length) {
        setPanelError("Excel 为空，无法导入考试成绩。");
        return;
      }

      const ranks = parseImportedBattleExamRows(data, students);
      const defaultExamName = file.name ? file.name.replace(/\.[^/.]+$/, "") : `考试${getTodayLabel()}`;
      const examName = (window.prompt("请输入考试名称", defaultExamName) || defaultExamName).trim();
      if (!examName) {
        setPanelError("考试名称不能为空。");
        return;
      }

      const currentBattle = battleCompat ?? createEmptyLegacyBattle();
      const examId = `exam-${Date.now()}`;
      if (
        !window.confirm(
          buildConfirmMessage([
            "确认导入这份考试成绩？",
            `文件：${file.name}`,
            `考试名称：${examName}`,
            `匹配学生：${Object.keys(ranks).length} 人`,
            `当前考试：${currentBattle.exams.length} 份`,
            "导入后会追加到当前双子星考试列表，不会覆盖既有考试。"
          ])
        )
      )
        return;
      pushBattle({
        ...currentBattle,
        exams: [
          ...currentBattle.exams,
          {
            id: examId,
            name: examName,
            ts: Date.now(),
            ranks
          }
        ],
        logs: [createBattleLog(`导入考试 ${examName}，匹配 ${Object.keys(ranks).length} 人`), ...currentBattle.logs]
      });
    } catch (error) {
      setPanelError(error instanceof Error ? `导入考试失败：${error.message}` : "导入考试失败。");
    }
  }

  const summary = {
    strategyDateCount: [compat.strategyDates?.lastPeriodicTaskDate, compat.strategyDates?.lastPenaltyReductionDate].filter(
      Boolean
    ).length,
    lastPeriodicTaskDate: compat.strategyDates?.lastPeriodicTaskDate || "未保留",
    lastPenaltyReductionDate: compat.strategyDates?.lastPenaltyReductionDate || "未保留",
    studentMessages: compat.messages.length,
    teacherMessages: compat.teacherMessages.length,
    tasks: compat.tasks.length,
    claimedTasks: compat.tasks.filter((item) => item.claimedByStudentIds.length > 0).length,
    treasures: compat.shop.treasures.length,
    storageItems: Object.values(compat.shop.storage).reduce(
      (count, itemMap) => count + Object.values(itemMap).reduce((sum, value) => sum + value, 0),
      0
    ),
    battleTeams: compat.battle?.teams.length || 0,
    battleMatches: compat.battle?.battles.length || 0
  };

  return (
    <section className="panel-shell">
      <div className="panel-header">
        <div>
          <h2>旧功能兼容</h2>
          <p className="muted">当前已接住留言、任务、藏宝阁主流程，并补上祈愿、双子星备份导入导出和考试成绩导入。</p>
        </div>
        <div className="transaction-actions">
          <span className="muted">当前可直接用：留言、任务、藏宝阁、祈愿、双子星备份/考试导入</span>
        </div>
      </div>

      <div className="attendance-summary-strip">
        <div>
          <span>策略日期</span>
          <strong>{summary.strategyDateCount}</strong>
        </div>
        <div>
          <span>学生留言</span>
          <strong>{summary.studentMessages}</strong>
        </div>
        <div>
          <span>教师留言</span>
          <strong>{summary.teacherMessages}</strong>
        </div>
        <div>
          <span>任务</span>
          <strong>{summary.tasks}</strong>
        </div>
        <div>
          <span>已领取任务</span>
          <strong>{summary.claimedTasks}</strong>
        </div>
        <div>
          <span>兼容宝物</span>
          <strong>{summary.treasures}</strong>
        </div>
        <div>
          <span>储物箱件数</span>
          <strong>{summary.storageItems}</strong>
        </div>
        <div>
          <span>兼容战队</span>
          <strong>{summary.battleTeams}</strong>
        </div>
        <div>
          <span>兼容挑战</span>
          <strong>{summary.battleMatches}</strong>
        </div>
      </div>

      {summary.strategyDateCount > 0 ? (
        <div className="transaction-list">
          <div className="transaction-row">
            <div>
              <strong>旧系统策略日期</strong>
              <span>
                周期任务：{summary.lastPeriodicTaskDate}；惩罚衰减：{summary.lastPenaltyReductionDate}
              </span>
            </div>
          </div>
        </div>
      ) : null}

      {legacyWriteMessage ? <p className="success-text">{legacyWriteMessage}</p> : null}
      {panelError ? <p className="warning-text">{panelError}</p> : null}
      {!canManageLegacy ? <p className="muted">当前账号没有旧功能写权限，仅可查看。</p> : null}
      {classFrozen ? <p className="muted">当前班级已冻结，旧功能写操作已暂停。</p> : null}

      <div className="content-grid overview-grid">
        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>留言板</h3>
            <span>{filteredMessages.messages.length + filteredMessages.teacherMessages.length} 条</span>
          </div>
          <div className="student-filters">
            <label>
              <span>关键词</span>
              <input value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} placeholder="按内容或日期筛选" />
            </label>
            <label>
              <span>留言类型</span>
              <select value={messageType} onChange={(event) => setMessageType(event.target.value as "messages" | "teacherMessages")}>
                <option value="teacherMessages">教师留言</option>
                <option value="messages">学生留言</option>
              </select>
            </label>
          </div>
          <label>
            <span>新增留言</span>
            <textarea
              rows={4}
              value={messageContent}
              onChange={(event) => setMessageContent(event.target.value)}
              placeholder="输入留言内容"
              disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
            />
          </label>
          <div className="import-footer">
            <button
              type="button"
              className="adjustment-submit"
              disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              onClick={handleAddMessage}
            >
              {updatingLegacyCompat ? "提交中..." : "保存留言"}
            </button>
            <span className="muted">当前阶段通过兼容层直接维护留言数据。</span>
          </div>
          <div className="transaction-list">
            {filteredMessages.teacherMessages.map((item) => (
              <div key={item.id} className="transaction-row">
                <div>
                  <strong>教师留言</strong>
                  <span>{item.content}</span>
                  <span className="muted">{formatMessageTime(item.date, item.time)}</span>
                </div>
                <div className="transaction-actions">
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                    onClick={() => handleDeleteMessage("teacherMessages", item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {filteredMessages.messages.map((item) => (
              <div key={item.id} className="transaction-row">
                <div>
                  <strong>学生留言</strong>
                  <span>{item.content}</span>
                  <span className="muted">{formatMessageTime(item.date, item.time)}</span>
                </div>
                <div className="transaction-actions">
                  <button
                    type="button"
                    className="inline-action-button"
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                    onClick={() => handleDeleteMessage("messages", item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
            {!filteredMessages.messages.length && !filteredMessages.teacherMessages.length ? (
              <p className="muted">暂无兼容留言数据</p>
            ) : null}
          </div>
        </div>

        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>任务板</h3>
            <span>{filteredTasks.length} 项</span>
          </div>
          <div className="student-filters">
            <label>
              <span>任务筛选</span>
              <input value={taskSearch} onChange={(event) => setTaskSearch(event.target.value)} placeholder="按标题、描述、时间筛选" />
            </label>
            <label>
              <span>领取学生</span>
              <select value={claimStudentId} onChange={(event) => setClaimStudentId(event.target.value)}>
                <option value="">请选择学生</option>
                {dailyParticipantStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.sortOrder}. {student.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="student-filters">
            <label>
              <span>新任务标题</span>
              <input
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              />
            </label>
            <label>
              <span>积分</span>
              <input
                type="number"
                min="1"
                max="1000"
                value={newTaskPoints}
                onChange={(event) => setNewTaskPoints(event.target.value)}
                disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              />
            </label>
          </div>
          <label>
            <span>任务说明</span>
            <textarea
              rows={3}
              value={newTaskDesc}
              onChange={(event) => setNewTaskDesc(event.target.value)}
              disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
            />
          </label>
          <div className="student-filters">
            <label>
              <span>开始时间</span>
              <input
                type="datetime-local"
                value={newTaskStartTime}
                onChange={(event) => setNewTaskStartTime(event.target.value)}
                disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              />
            </label>
            <label>
              <span>结束时间</span>
              <input
                type="datetime-local"
                value={newTaskEndTime}
                onChange={(event) => setNewTaskEndTime(event.target.value)}
                disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              />
            </label>
          </div>
          <div className="import-footer">
            <button
              type="button"
              className="inline-action-button"
              disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
              onClick={handleAddTask}
            >
              新增任务
            </button>
            <button
              type="button"
              className="inline-action-button"
              disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || !compat.tasks.length}
              onClick={handleResetTasks}
            >
              重置领取状态
            </button>
            <span className="muted">任务领取会写入兼容任务状态，并同步发放积分。</span>
          </div>
          <div className="transaction-list">
            {filteredTasks.map((item) => {
              const state = getTaskState(item, new Date());
              const claimedStudentName = item.claimedByStudentIds.map((id) => studentNameById.get(id) || id).join(" / ");
              const canClaim = state === "active" && !claimingTaskId && Boolean(claimStudentId) && canManageLegacy && !classFrozen;
              const stateLabel =
                state === "claimed"
                  ? `已领取${claimedStudentName ? ` · ${claimedStudentName}` : ""}`
                  : state === "upcoming"
                    ? "未开始"
                    : state === "ended"
                      ? "已结束"
                      : "可领取";

              return (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>{item.title}</strong>
                    <span>{item.desc || "无任务说明"}</span>
                    <span className="muted">
                      {formatDateTime(item.startTime)} 至 {formatDateTime(item.endTime)} · {item.points} 分
                    </span>
                    <span className="muted">{stateLabel}</span>
                  </div>
                  <div className="transaction-actions">
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canClaim || claimingTaskId === item.id}
                      onClick={() => onClaimTask({ taskId: item.id, studentId: claimStudentId })}
                    >
                      {claimingTaskId === item.id ? "领取中..." : "领取任务"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                      onClick={() => handleDeleteTask(item.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              );
            })}
            {!filteredTasks.length ? <p className="muted">暂无兼容任务数据</p> : null}
          </div>
        </div>
      </div>

      <div className="content-grid overview-grid">
        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>藏宝阁</h3>
            <span>{filteredTreasures.length} 件</span>
          </div>
          <div className="student-filters">
            <label>
              <span>操作学生</span>
              <select value={selectedShopStudentId} onChange={(event) => setShopStudentId(event.target.value)}>
                {dailyParticipantStudents.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.sortOrder}. {student.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>宝物筛选</span>
              <input value={shopSearch} onChange={(event) => setShopSearch(event.target.value)} placeholder="按名称、描述、价格筛选" />
            </label>
          </div>
          <div className="import-footer">
            <span className="muted">
              {selectedShopStudent
                ? `${selectedShopStudent.name} 当前余额 ${selectedShopStudentBalance}，已持有 ${
                    Object.values(compat.shop.storage[selectedShopStudentId] || {}).reduce((sum, value) => sum + value, 0)
                  } 件宝物`
                : "当前没有可操作的参与日常学生"}
            </span>
          </div>
          <div className="transaction-list">
            {filteredTreasures.map((item) => {
              const currentPrice = selectedShopStudentId
                ? getLegacyPrice(selectedShopStudentId, item, compat.shop.redemptionHistory)
                : item.price;
              const nextStorageCount = selectedShopStudentId ? compat.shop.storage[selectedShopStudentId]?.[item.id] || 0 : 0;
              const currentUsageCount = todayUsageCounts[item.id] || 0;
              const redeemBusy = redeemingItemId === item.id;

              return (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>
                      {item.name} <span className="muted">[{item.rarity}]</span>
                    </strong>
                    <span>{item.desc || "无描述"}</span>
                    <span className="muted">
                      当前兑换价 {currentPrice} · 库存 {item.stock}
                      {item.ladderPrices.length > 0 ? ` · 阶梯价 ${item.ladderPrices.join(" / ")}` : ""}
                    </span>
                    <span className="muted">
                      已持有 {nextStorageCount} 件
                      {item.dailyLimit > 0 ? ` · 今日已使用 ${currentUsageCount}/${item.dailyLimit}` : " · 今日不限次"}
                    </span>
                  </div>
                  <div className="transaction-actions">
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || shopBusy || !selectedShopStudentId}
                      onClick={() => handleRedeem(item.id)}
                    >
                      {redeemBusy ? "兑换中..." : "兑换"}
                    </button>
                  </div>
                </div>
              );
            })}
            {!filteredTreasures.length ? <p className="muted">暂无兼容宝物数据</p> : null}
          </div>
        </div>

        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>储物箱</h3>
            <span>{selectedStudentStorage.length} 种</span>
          </div>
          <div className="import-footer">
            <span className="muted">
              {selectedShopStudent ? `当前查看：${selectedShopStudent.name}` : "当前没有可查看的学生"}
            </span>
          </div>
          <div className="transaction-list">
            {selectedStudentStorage.map(({ itemId, count, item }) => {
              const refundPrice = selectedShopStudentId
                ? getLegacyRefundPrice(selectedShopStudentId, item, compat.shop.redemptionHistory)
                : item.price;
              const useBusy = usingItemId === itemId;
              const returnBusy = returningItemId === itemId;
              const currentUsageCount = todayUsageCounts[itemId] || 0;

              return (
                <div key={itemId} className="transaction-row">
                  <div>
                    <strong>
                      {item.name} <span className="muted">[{item.rarity}]</span>
                    </strong>
                    <span>数量 {count}</span>
                    <span className="muted">
                      退回价 {refundPrice}
                      {item.dailyLimit > 0 ? ` · 今日已使用 ${currentUsageCount}/${item.dailyLimit}` : " · 今日不限次"}
                    </span>
                  </div>
                  <div className="transaction-actions">
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || shopBusy || !selectedShopStudentId}
                      onClick={() => handleUse(itemId)}
                    >
                      {useBusy ? "使用中..." : "使用"}
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || shopBusy || !selectedShopStudentId}
                      onClick={() => handleReturn(itemId)}
                    >
                      {returnBusy ? "退回中..." : "退回"}
                    </button>
                  </div>
                </div>
              );
            })}
            {!selectedStudentStorage.length ? <p className="muted">当前学生储物箱为空</p> : null}
          </div>
        </div>

        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>祈愿</h3>
            <span>{selectedShopStudent ? selectedShopStudent.name : "未选择学生"}</span>
          </div>
          <p className="muted">1 次 15 分，10 连 120 分。稀有度概率沿用旧版：SSR 0.05% / SR 4.95% / R 25% / N 70%。</p>
          <div className="import-footer">
            <button
              type="button"
              className="inline-action-button"
              disabled={!canManageLegacy || classFrozen || shopBusy || !selectedShopStudentId}
              onClick={() => handleGacha(1)}
            >
              {rollingGacha ? "祈愿中..." : "祈愿 1 次"}
            </button>
            <button
              type="button"
              className="inline-action-button"
              disabled={!canManageLegacy || classFrozen || shopBusy || !selectedShopStudentId}
              onClick={() => handleGacha(10)}
            >
              {rollingGacha ? "祈愿中..." : "祈愿 10 次"}
            </button>
            <span className="muted">
              {selectedShopStudent
                ? `${selectedShopStudent.name} 当前余额 ${selectedShopStudentBalance}`
                : "当前没有可祈愿的 active 学生"}
            </span>
          </div>
          <div className="transaction-list">
            {latestGachaResult ? (
              <div className="transaction-row">
                <div>
                  <strong>
                    {latestGachaResult.student.name} · {latestGachaResult.times === 10 ? "10 连抽" : "1 连抽"}
                  </strong>
                  <span>
                    {latestGachaSummary.map(([label, count]) => `${label}${count > 1 ? ` x${count}` : ""}`).join(" / ") || "暂无结果"}
                  </span>
                  <span className="muted">
                    消耗 {latestGachaResult.cost} 分 ·
                    {" "}
                    {latestGachaResult.results.map((item) => item.name).join(" / ")}
                  </span>
                </div>
              </div>
            ) : (
              <p className="muted">最近一次祈愿结果会显示在这里。</p>
            )}
          </div>
        </div>
      </div>

      <div className="content-grid single-column">
        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>宝物管理</h3>
            <span>{compat.shop.treasures.length} 件</span>
          </div>
          <div className="student-filters">
            <label>
              <span>宝物名称</span>
              <input
                value={treasureForm.name}
                onChange={(event) => setTreasureForm((current) => ({ ...current, name: event.target.value }))}
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              />
            </label>
            <label>
              <span>稀有度</span>
              <select
                value={treasureForm.rarity}
                onChange={(event) => setTreasureForm((current) => ({ ...current, rarity: event.target.value }))}
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              >
                {["N", "R", "SR", "SSR"].map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="student-filters">
            <label>
              <span>价格</span>
              <input
                type="number"
                value={treasureForm.price}
                onChange={(event) => setTreasureForm((current) => ({ ...current, price: event.target.value }))}
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              />
            </label>
            <label>
              <span>库存</span>
              <input
                type="number"
                min="0"
                value={treasureForm.stock}
                onChange={(event) => setTreasureForm((current) => ({ ...current, stock: event.target.value }))}
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              />
            </label>
          </div>
          <label>
            <span>描述</span>
            <textarea
              rows={3}
              value={treasureForm.desc}
              onChange={(event) => setTreasureForm((current) => ({ ...current, desc: event.target.value }))}
              disabled={!canManageLegacy || classFrozen || managingLegacyShop}
            />
          </label>
          <div className="student-filters">
            <label>
              <span>阶梯价</span>
              <input
                value={treasureForm.ladderPrices}
                onChange={(event) => setTreasureForm((current) => ({ ...current, ladderPrices: event.target.value }))}
                placeholder="如 10, 20, 30"
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              />
            </label>
            <label>
              <span>每日使用上限</span>
              <input
                type="number"
                min="0"
                value={treasureForm.dailyLimit}
                onChange={(event) => setTreasureForm((current) => ({ ...current, dailyLimit: event.target.value }))}
                disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              />
            </label>
          </div>
          <div className="import-footer">
            <button
              type="button"
              className="inline-action-button"
              disabled={!canManageLegacy || classFrozen || managingLegacyShop}
              onClick={handleSaveTreasure}
            >
              {editingTreasureId ? (updatingLegacyCompat ? "保存中..." : "保存宝物") : updatingLegacyCompat ? "新增中..." : "新增宝物"}
            </button>
            <button
              type="button"
              className="inline-action-button"
              disabled={(!editingTreasureId && treasureForm.name.length === 0) || managingLegacyShop}
              onClick={resetTreasureForm}
            >
              {editingTreasureId ? "取消编辑" : "清空"}
            </button>
            <span className="muted">支持负价格、阶梯价和每日使用上限。</span>
          </div>
          <div className="transaction-list">
            {compat.shop.treasures
              .slice()
              .sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
              .map((item) => (
                <div key={item.id} className="transaction-row">
                  <div>
                    <strong>
                      {item.name} <span className="muted">[{item.rarity}]</span>
                    </strong>
                    <span>{item.desc || "无描述"}</span>
                    <span className="muted">
                      库存 {item.stock} · 价格 {item.price}
                      {item.ladderPrices.length > 0 ? ` · 阶梯价 ${item.ladderPrices.join(" / ")}` : ""}
                      {item.dailyLimit > 0 ? ` · 每日上限 ${item.dailyLimit}` : ""}
                    </span>
                    <span className="muted">ID: {item.id}</span>
                  </div>
                  <div className="transaction-actions">
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || managingLegacyShop}
                      onClick={() => handleEditTreasure(item)}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="inline-action-button"
                      disabled={!canManageLegacy || classFrozen || managingLegacyShop}
                      onClick={() => handleDeleteTreasure(item)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            {!compat.shop.treasures.length ? <p className="muted">暂无兼容宝物数据</p> : null}
          </div>
        </div>

        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>操作日志</h3>
            <span>{recentLogs.length} 条</span>
          </div>
          <div className="transaction-list">
            {recentLogs.map((log) => (
              <div key={log.id} className="transaction-row">
                <div>
                  <strong>
                    {log.action} · {log.itemName}
                  </strong>
                  <span>
                    {log.studentName || "未标记学生"}
                    {log.rarity ? ` · ${log.rarity}` : ""}
                    {log.note ? ` · ${log.note}` : ""}
                  </span>
                  <span className="muted">
                    {formatLogTime(log.ts)} · 变动 {log.cost}
                  </span>
                </div>
              </div>
            ))}
            {!recentLogs.length ? <p className="muted">暂无藏宝阁操作日志</p> : null}
          </div>
        </div>

        <div className="adjustment-form">
          <div className="panel-header compact">
            <h3>双子星</h3>
            <span>{battleCompat ? `${battleTeams.length} 队 / ${battleMatches.length} 场` : "未初始化"}</span>
          </div>
          {!battleCompat ? (
            <>
              <p className="muted">当前还没有双子星兼容数据。可以直接初始化，也可以导入旧版备份或先导入考试成绩。</p>
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={handleInitializeBattle}
                >
                  初始化双子星
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={() => battleBackupInputRef.current?.click()}
                >
                  导入对战备份
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={() => battleExamInputRef.current?.click()}
                >
                  导入考试成绩
                </button>
              </div>
              <input
                ref={battleBackupInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={handleImportBattleBackup}
              />
              <input
                ref={battleExamInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={handleImportBattleExam}
              />
            </>
          ) : (
            <>
              <div className="attendance-summary-strip">
                <div>
                  <span>赛季</span>
                  <strong>{battleCompat.season}</strong>
                </div>
                <div>
                  <span>战队</span>
                  <strong>{battleTeams.length}</strong>
                </div>
                <div>
                  <span>挑战</span>
                  <strong>{battleMatches.length}</strong>
                </div>
                <div>
                  <span>小队</span>
                  <strong>{battleSquads.length}</strong>
                </div>
                <div>
                  <span>结算记录</span>
                  <strong>{battleCompat.settlements.length}</strong>
                </div>
                <div>
                  <span>历史赛季</span>
                  <strong>{battleCompat.history.length}</strong>
                </div>
              </div>

              <div className="student-filters">
                <label>
                  <span>当前赛季</span>
                  <input
                    type="number"
                    min="1"
                    value={battleConfigForm.season}
                    onChange={(event) =>
                      setBattleConfigForm((current) => ({
                        ...current,
                        season: event.target.value
                      }))
                    }
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  />
                </label>
                <label>
                  <span>组队基准考试</span>
                  <select
                    value={battleConfigForm.teamBaseExamId}
                    onChange={(event) =>
                      setBattleConfigForm((current) => ({
                        ...current,
                        teamBaseExamId: event.target.value
                      }))
                    }
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || battleExams.length === 0}
                  >
                    <option value="">未选择</option>
                    {battleExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>结算考试</span>
                  <select
                    value={battleConfigForm.settleExamId}
                    onChange={(event) =>
                      setBattleConfigForm((current) => ({
                        ...current,
                        settleExamId: event.target.value
                      }))
                    }
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || battleExams.length === 0}
                  >
                    <option value="">未选择</option>
                    {battleExams.map((exam) => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="import-footer">
                <button type="button" className="inline-action-button" onClick={handleExportBattleBackup}>
                  导出对战备份
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={() => battleBackupInputRef.current?.click()}
                >
                  导入对战备份
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={() => battleExamInputRef.current?.click()}
                >
                  导入考试成绩
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={handleSaveBattleConfig}
                >
                  保存配置
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || battleTeams.length === 0}
                  onClick={handleResetBattlePoints}
                >
                  重置战队积分
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || battleTeams.length === 0}
                  onClick={handleArchiveBattleSeason}
                >
                  归档并开启新赛季
                </button>
                <span className="muted">当前可直接做赛季维护、备份迁移、考试导入和结算。</span>
              </div>
              <input
                ref={battleBackupInputRef}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={handleImportBattleBackup}
              />
              <input
                ref={battleExamInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                hidden
                onChange={handleImportBattleExam}
              />

              <div className="student-filters">
                <label>
                  <span>战队名称</span>
                  <input
                    value={battleTeamForm.name}
                    onChange={(event) => setBattleTeamForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  />
                </label>
                <label>
                  <span>战队积分</span>
                  <input
                    type="number"
                    value={battleTeamForm.points}
                    onChange={(event) => setBattleTeamForm((current) => ({ ...current, points: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  />
                </label>
              </div>
              <label>
                <span>战队成员</span>
                <select
                  multiple
                  value={battleTeamForm.memberStudentIds}
                  onChange={(event) =>
                    setBattleTeamForm((current) => ({
                      ...current,
                      memberStudentIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
                    }))
                  }
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                >
                  {dailyParticipantStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.sortOrder}. {student.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={handleSaveBattleTeam}
                >
                  {editingBattleTeamId ? "保存战队" : "新增战队"}
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={updatingLegacyCompat}
                  onClick={resetBattleTeamForm}
                >
                  {editingBattleTeamId ? "取消编辑" : "清空"}
                </button>
                <span className="muted">先承接战队成员、积分和挑战列表，复杂结算继续沿用兼容数据。</span>
              </div>
              <div className="transaction-list">
                {battleTeams
                  .slice()
                  .sort((left, right) => right.points - left.points || left.name.localeCompare(right.name, "zh-CN"))
                  .map((team) => (
                    <div key={team.id} className="transaction-row">
                      <div>
                        <strong>{team.name}</strong>
                        <span>{team.memberStudentIds.map((id) => studentNameById.get(id) || id).join(" / ") || "暂无成员"}</span>
                        <span className="muted">积分 {team.points} · ID: {team.id}</span>
                      </div>
                      <div className="transaction-actions">
                        <button
                          type="button"
                          className="inline-action-button"
                          disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                          onClick={() => handleEditBattleTeam(team)}
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          className="inline-action-button"
                          disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                          onClick={() => handleDeleteBattleTeam(team)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                {!battleTeams.length ? <p className="muted">暂无兼容战队数据</p> : null}
              </div>

              <div className="student-filters">
                <label>
                  <span>共鸣名称</span>
                  <input
                    value={battleSquadForm.name}
                    onChange={(event) => setBattleSquadForm((current) => ({ ...current, name: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  />
                </label>
                <label>
                  <span>共鸣战队</span>
                  <select
                    multiple
                    value={battleSquadForm.teamIds}
                    onChange={(event) =>
                      setBattleSquadForm((current) => ({
                        ...current,
                        teamIds: Array.from(event.currentTarget.selectedOptions).map((option) => option.value)
                      }))
                    }
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  >
                    {battleTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  onClick={handleSaveBattleSquad}
                >
                  {editingBattleSquadId ? "保存共鸣" : "新增共鸣"}
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={updatingLegacyCompat}
                  onClick={resetBattleSquadForm}
                >
                  {editingBattleSquadId ? "取消编辑" : "清空"}
                </button>
                <span className="muted">共鸣用于保留旧版双子星小队结构。</span>
              </div>
              <div className="transaction-list">
                {battleSquads.map((squad) => (
                  <div key={squad.id} className="transaction-row">
                    <div>
                      <strong>{squad.name}</strong>
                      <span>{squad.teamIds.map((id) => battleTeams.find((team) => team.id === id)?.name || id).join(" / ") || "暂无关联战队"}</span>
                      <span className="muted">ID: {squad.id}</span>
                    </div>
                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                        onClick={() => handleEditBattleSquad(squad)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                        onClick={() => handleDeleteBattleSquad(squad)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                {!battleSquads.length ? <p className="muted">暂无共鸣小队数据</p> : null}
              </div>

              <div className="student-filters">
                <label>
                  <span>挑战方</span>
                  <select
                    value={battleMatchForm.teamAId}
                    onChange={(event) => setBattleMatchForm((current) => ({ ...current, teamAId: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  >
                    <option value="">请选择战队</option>
                    {battleTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>应战方</span>
                  <select
                    value={battleMatchForm.teamBId}
                    onChange={(event) => setBattleMatchForm((current) => ({ ...current, teamBId: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  >
                    <option value="">请选择战队</option>
                    {battleTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="student-filters">
                <label>
                  <span>赌注</span>
                  <input
                    type="number"
                    min="1"
                    value={battleMatchForm.stake}
                    onChange={(event) => setBattleMatchForm((current) => ({ ...current, stake: event.target.value }))}
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  />
                </label>
                <label>
                  <span>特殊规则</span>
                  <select
                    value={battleMatchForm.isUnderdog ? "1" : "0"}
                    onChange={(event) =>
                      setBattleMatchForm((current) => ({ ...current, isUnderdog: event.target.value === "1" }))
                    }
                    disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                  >
                    <option value="0">常规挑战</option>
                    <option value="1">以下克上</option>
                  </select>
                </label>
              </div>
              <div className="import-footer">
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || battleTeams.length < 2}
                  onClick={handleSaveBattleMatch}
                >
                  新增挑战
                </button>
                <button
                  type="button"
                  className="inline-action-button"
                  disabled={!canManageLegacy || classFrozen || updatingLegacyCompat || settlingBattle || battleMatches.length === 0}
                  onClick={onSettleBattle}
                >
                  {settlingBattle ? "结算中..." : "执行双子星结算"}
                </button>
                <span className="muted">
                  当前已保留 {battleExams.length} 份考试数据、{battleCompat.settlements.length} 条结算记录。
                </span>
              </div>
              <div className="transaction-list">
                {battleMatches.map((match) => {
                  const teamAName = battleTeams.find((team) => team.id === match.teamAId)?.name || match.teamAId;
                  const teamBName = battleTeams.find((team) => team.id === match.teamBId)?.name || match.teamBId;
                  return (
                    <div key={match.id} className="transaction-row">
                      <div>
                        <strong>
                          {teamAName} vs {teamBName}
                        </strong>
                        <span>{match.isUnderdog ? "以下克上" : "常规挑战"}</span>
                        <span className="muted">赌注 {match.stake} · ID: {match.id}</span>
                      </div>
                      <div className="transaction-actions">
                        <button
                          type="button"
                          className="inline-action-button"
                          disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                          onClick={() => handleDeleteBattleMatch(match)}
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!battleMatches.length ? <p className="muted">暂无兼容挑战数据</p> : null}
              </div>

              <div className="panel-header compact">
                <h3>考试与归档</h3>
                <span>{battleExams.length} 份考试 / {battleSettlements.length} 条结算 / {battleHistory.length} 条历史</span>
              </div>
              <div className="transaction-list">
                {battleExams.map((exam) => (
                  <div key={exam.id} className="transaction-row">
                    <div>
                      <strong>{exam.name}</strong>
                      <span>{exam.ts ? formatLogTime(exam.ts) : "无导入时间"}</span>
                      <span className="muted">成绩人数 {Object.keys(exam.ranks).length} · ID: {exam.id}</span>
                    </div>
                    <div className="transaction-actions">
                      <button
                        type="button"
                        className="inline-action-button"
                        disabled={!canManageLegacy || classFrozen || updatingLegacyCompat}
                        onClick={() => handleDeleteBattleExam(exam.id)}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
                {!battleExams.length ? <p className="muted">暂无兼容考试数据</p> : null}
              </div>

              <div className="transaction-list">
                {battleSettlements.map((settlement) => (
                  <div key={settlement.id} className="transaction-row">
                    <div>
                      <strong>
                        {settlement.teamBaseExamName || "基准未标记"} → {settlement.settleExamName || "结算未标记"}
                      </strong>
                      <span>{settlement.ts ? formatLogTime(settlement.ts) : "无结算时间"}</span>
                      <span className="muted">对战 {settlement.battles.length} 场 · ID: {settlement.id}</span>
                    </div>
                  </div>
                ))}
                {!battleSettlements.length ? <p className="muted">暂无双子星结算记录</p> : null}
              </div>

              <div className="transaction-list">
                {battleHistory.map((history) => (
                  <div key={history.id} className="transaction-row">
                    <div>
                      <strong>{history.date || "未标记日期"}</strong>
                      <span>
                        {history.results
                          .slice(0, 3)
                          .map((result) => `${result.name} ${result.finalPts}`)
                          .join(" / ") || "暂无战队结果"}
                      </span>
                      <span className="muted">归档对战 {history.battles.length} 场 · ID: {history.id}</span>
                    </div>
                  </div>
                ))}
                {!battleHistory.length ? <p className="muted">暂无赛季历史归档</p> : null}
              </div>

              <div className="transaction-list">
                {battleLogs.map((log) => (
                  <div key={log.id} className="transaction-row">
                    <div>
                      <strong>战队日志</strong>
                      <span>{log.msg}</span>
                      <span className="muted">{log.time || "-"}</span>
                    </div>
                  </div>
                ))}
                {!battleLogs.length ? <p className="muted">暂无双子星日志</p> : null}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
