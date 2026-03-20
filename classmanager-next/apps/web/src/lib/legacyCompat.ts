import type { LegacyCompatData, StudentItem } from "../types";

type LegacyBattleData = NonNullable<LegacyCompatData["battle"]>;

type LegacyBattleExam = {
  id: string;
  name: string;
  ts: number | null;
  ranks: Record<string, { c: number | null; g: number | null }>;
};

export function battleParseRank(value: unknown) {
  if (value === undefined || value === null || value === "") return Number.NaN;
  if (typeof value === "number") return value;
  const match = String(value).match(/(\d+)/);
  return match ? Number.parseInt(match[0], 10) : Number.NaN;
}

export function createBattleBackupPayload(battle: LegacyBattleData, students: StudentItem[]) {
  return {
    version: 1,
    students: students.map((student) => ({
      id: student.id,
      name: student.name,
      sortOrder: student.sortOrder,
      legacyId: student.legacyId
    })),
    teams: battle.teams,
    squads: battle.squads,
    battles: battle.battles,
    logs: battle.logs,
    history: battle.history,
    settlements: battle.settlements,
    season: battle.season,
    exams: battle.exams,
    teamBaseExamId: battle.teamBaseExamId,
    settleExamId: battle.settleExamId
  };
}

export function normalizeImportedBattleBackup(raw: unknown, students: StudentItem[]): LegacyBattleData {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const payload =
    source.battle && typeof source.battle === "object" && !Array.isArray(source.battle)
      ? (source.battle as Record<string, unknown>)
      : source;
  const importedStudents = Array.isArray(source.students)
    ? source.students
    : Array.isArray(payload.students)
      ? payload.students
      : [];
  const currentNameToId = new Map(students.map((student) => [student.name.trim(), student.id]));
  const currentIds = new Set(students.map((student) => student.id));
  const oldIdToName = new Map(
    importedStudents
      .map((item) => {
        const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
        const id = row.id == null ? "" : String(row.id).trim();
        const name = row.name == null ? "" : String(row.name).trim();
        if (!id || !name) return null;
        return [id, name] as const;
      })
      .filter((item): item is readonly [string, string] => Boolean(item))
  );
  const mapStudentId = (value: unknown) => {
    const rawId = value == null ? "" : String(value).trim();
    if (!rawId) return "";
    if (currentIds.has(rawId)) return rawId;
    const name = oldIdToName.get(rawId);
    return name ? currentNameToId.get(name) || "" : "";
  };

  const teams = Array.isArray(payload.teams)
    ? payload.teams
        .map((item, index) => {
          const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
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
            memberStudentIds: Array.from(new Set(memberSource.map(mapStudentId).filter(Boolean))),
            points: Number.isFinite(Number(row.points)) ? Number(row.points) : 0
          };
        })
        .filter((item): item is LegacyBattleData["teams"][number] => Boolean(item))
    : [];
  const validTeamIds = new Set(teams.map((team) => team.id));
  const squads = Array.isArray(payload.squads)
    ? payload.squads
        .map((item, index) => {
          const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
          const id = row.id == null ? `squad-${index + 1}` : String(row.id).trim();
          const name = row.name == null ? "" : String(row.name).trim();
          if (!id || !name) return null;
          const teamIds = Array.isArray(row.teamIds)
            ? Array.from(new Set(row.teamIds.map((teamId) => String(teamId).trim()).filter((teamId) => validTeamIds.has(teamId))))
            : [];

          return {
            id,
            name,
            teamIds
          };
        })
        .filter((item): item is LegacyBattleData["squads"][number] => Boolean(item))
    : [];
  const battles = Array.isArray(payload.battles)
    ? payload.battles
        .map((item, index) => {
          const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
          const id = row.id == null ? `battle-${index + 1}` : String(row.id).trim();
          const teamAId = row.teamAId == null ? "" : String(row.teamAId).trim();
          const teamBId = row.teamBId == null ? "" : String(row.teamBId).trim();
          if (!id || !validTeamIds.has(teamAId) || !validTeamIds.has(teamBId)) return null;
          return {
            id,
            teamAId,
            teamBId,
            stake: Number.isFinite(Number(row.stake)) ? Number(row.stake) : 0,
            isUnderdog: Boolean(row.isUnderdog)
          };
        })
        .filter((item): item is LegacyBattleData["battles"][number] => Boolean(item))
    : [];
  const exams = Array.isArray(payload.exams)
    ? payload.exams.reduce<LegacyBattleExam[]>((accumulator, item, index) => {
        const row = item && typeof item === "object" && !Array.isArray(item) ? (item as Record<string, unknown>) : {};
        const id = row.id == null ? `exam-${index + 1}` : String(row.id).trim();
        const name = row.name == null ? "" : String(row.name).trim();
        if (!id || !name) {
          return accumulator;
        }

        const ranksSource =
          row.ranks && typeof row.ranks === "object" && !Array.isArray(row.ranks)
            ? (row.ranks as Record<string, unknown>)
            : {};
        const ranks = Object.fromEntries(
          Object.entries(ranksSource)
            .map(([studentId, rankValue]) => {
              const mappedStudentId = mapStudentId(studentId);
              if (!mappedStudentId) return null;
              const rankRow =
                rankValue && typeof rankValue === "object" && !Array.isArray(rankValue)
                  ? (rankValue as Record<string, unknown>)
                  : {};
              const c = Number.isFinite(Number(rankRow.c)) ? Number(rankRow.c) : null;
              const g = Number.isFinite(Number(rankRow.g)) ? Number(rankRow.g) : null;
              return [mappedStudentId, { c, g }] as const;
            })
            .filter((entry): entry is readonly [string, { c: number | null; g: number | null }] => Boolean(entry))
        );

        accumulator.push({
          id,
          name,
          ts: Number.isFinite(Number(row.ts)) ? Number(row.ts) : null,
          ranks
        });
        return accumulator;
      }, [])
    : [];
  const validExamIds = new Set(exams.map((exam) => exam.id).filter(Boolean));

  return {
    version: Number.isFinite(Number(payload.version)) ? Number(payload.version) : 1,
    teams,
    squads,
    battles,
    logs: Array.isArray(payload.logs) ? payload.logs : [],
    history: Array.isArray(payload.history) ? payload.history : [],
    settlements: Array.isArray(payload.settlements) ? payload.settlements : [],
    season: Number.isFinite(Number(payload.season)) ? Number(payload.season) : 1,
    rules:
      payload.rules && typeof payload.rules === "object" && !Array.isArray(payload.rules)
        ? (payload.rules as Record<string, unknown>)
        : {},
    exams,
    teamBaseExamId:
      payload.teamBaseExamId != null && validExamIds.has(String(payload.teamBaseExamId).trim())
        ? String(payload.teamBaseExamId).trim()
        : exams[0]?.id || null,
    settleExamId:
      payload.settleExamId != null && validExamIds.has(String(payload.settleExamId).trim())
        ? String(payload.settleExamId).trim()
        : exams[0]?.id || null
  };
}

export function parseImportedBattleExamRows(data: Record<string, unknown>[], students: StudentItem[]) {
  if (!data.length) {
    throw new Error("Excel 为空，无法导入考试成绩。");
  }

  const headers = Object.keys(data[0] || {});
  const nameKey = headers.find((key) => key.includes("姓名") || key.toLowerCase().includes("name"));
  const classRankKey = headers.find((key) => key.includes("班排"));
  const gradeRankKey = headers.find((key) => key.includes("级排"));
  if (!nameKey) {
    throw new Error("导入失败：表头中缺少“姓名”列。");
  }

  const studentIdByName = new Map(students.map((student) => [student.name.trim(), student.id]));
  return Object.fromEntries(
    data
      .map((row, index) => {
        const studentName = row[nameKey] == null ? "" : String(row[nameKey]).trim();
        const studentId = studentIdByName.get(studentName);
        if (!studentId) return null;

        let classRank = classRankKey ? battleParseRank(row[classRankKey]) : Number.NaN;
        let gradeRank = gradeRankKey ? battleParseRank(row[gradeRankKey]) : Number.NaN;
        if (Number.isNaN(classRank)) classRank = index + 1;
        if (Number.isNaN(gradeRank)) gradeRank = (index + 1) * 10;

        return [studentId, { c: classRank, g: gradeRank }] as const;
      })
      .filter((entry): entry is readonly [string, { c: number; g: number }] => Boolean(entry))
  );
}
