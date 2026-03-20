import assert from "node:assert/strict";
import test from "node:test";

import {
  battleParseRank,
  createBattleBackupPayload,
  normalizeImportedBattleBackup,
  parseImportedBattleExamRows
} from "./legacyCompat.js";
import type { LegacyCompatData, StudentItem } from "../types.js";

type LegacyBattleData = NonNullable<LegacyCompatData["battle"]>;

function createStudents(): StudentItem[] {
  return [
    {
      id: "student-a",
      legacyId: "legacy-a",
      name: "徐青阳",
      gender: "M",
      status: "active",
      sortOrder: 1,
      account: null,
      primaryGroup: null,
      primaryDorm: null
    },
    {
      id: "student-b",
      legacyId: "legacy-b",
      name: "赵雨泽",
      gender: "M",
      status: "active",
      sortOrder: 2,
      account: null,
      primaryGroup: null,
      primaryDorm: null
    }
  ];
}

function createBattle(): LegacyBattleData {
  return {
    version: 1,
    teams: [
      {
        id: "team-1",
        name: "一队",
        memberStudentIds: ["student-a"],
        points: 50
      }
    ],
    squads: [],
    battles: [],
    logs: [],
    history: [],
    settlements: [],
    season: 2,
    rules: {},
    exams: [
      {
        id: "exam-1",
        name: "摸底考",
        ts: 1,
        ranks: {
          "student-a": { c: 1, g: 10 }
        }
      }
    ],
    teamBaseExamId: "exam-1",
    settleExamId: "exam-1"
  };
}

test("battleParseRank extracts numeric rank from mixed content", () => {
  assert.equal(battleParseRank("班排 12 / 50"), 12);
  assert.equal(Number.isNaN(battleParseRank("未排名")), true);
});

test("createBattleBackupPayload keeps battle state and student snapshot", () => {
  const students = createStudents();
  const payload = createBattleBackupPayload(createBattle(), students);

  assert.equal(payload.students.length, 2);
  assert.deepEqual(payload.students[0], {
    id: "student-a",
    name: "徐青阳",
    sortOrder: 1,
    legacyId: "legacy-a"
  });
  assert.equal(payload.season, 2);
  assert.equal(payload.teams[0].memberStudentIds[0], "student-a");
});

test("normalizeImportedBattleBackup remaps imported student ids by name and filters broken references", () => {
  const students = createStudents();
  const normalized = normalizeImportedBattleBackup(
    {
      students: [
        { id: "old-1", name: "徐青阳" },
        { id: "old-2", name: "赵雨泽" },
        { id: "old-3", name: "不存在" }
      ],
      teams: [
        { id: "team-a", name: "甲队", memberStudentIds: ["old-1", "missing-id"], points: 40 },
        { id: "team-b", name: "乙队", memberIds: ["old-2"], points: 45 }
      ],
      squads: [
        { id: "squad-1", name: "共鸣", teamIds: ["team-a", "team-b", "ghost-team"] }
      ],
      battles: [
        { id: "battle-1", teamAId: "team-a", teamBId: "team-b", stake: 5, isUnderdog: true },
        { id: "battle-2", teamAId: "team-a", teamBId: "ghost-team", stake: 5, isUnderdog: false }
      ],
      exams: [
        {
          id: "exam-a",
          name: "第一次",
          ts: 123,
          ranks: {
            "old-1": { c: 2, g: 20 },
            "old-2": { c: 5, g: 50 },
            "old-9": { c: 9, g: 90 }
          }
        }
      ],
      teamBaseExamId: "missing-exam",
      settleExamId: "exam-a"
    },
    students
  );

  assert.deepEqual(normalized.teams, [
    { id: "team-a", name: "甲队", memberStudentIds: ["student-a"], points: 40 },
    { id: "team-b", name: "乙队", memberStudentIds: ["student-b"], points: 45 }
  ]);
  assert.deepEqual(normalized.squads, [{ id: "squad-1", name: "共鸣", teamIds: ["team-a", "team-b"] }]);
  assert.deepEqual(normalized.battles, [
    { id: "battle-1", teamAId: "team-a", teamBId: "team-b", stake: 5, isUnderdog: true }
  ]);
  assert.deepEqual(normalized.exams, [
    {
      id: "exam-a",
      name: "第一次",
      ts: 123,
      ranks: {
        "student-a": { c: 2, g: 20 },
        "student-b": { c: 5, g: 50 }
      }
    }
  ]);
  assert.equal(normalized.teamBaseExamId, "exam-a");
  assert.equal(normalized.settleExamId, "exam-a");
});

test("parseImportedBattleExamRows maps names and falls back to generated ranks", () => {
  const students = createStudents();
  const ranks = parseImportedBattleExamRows(
    [
      { 姓名: "徐青阳", 班排: "第 3 名", 级排: "30" },
      { 姓名: "赵雨泽", 班排: "", 级排: "" },
      { 姓名: "未匹配学生", 班排: "1", 级排: "10" }
    ],
    students
  );

  assert.deepEqual(ranks, {
    "student-a": { c: 3, g: 30 },
    "student-b": { c: 2, g: 20 }
  });
});

test("parseImportedBattleExamRows rejects sheets without a name column", () => {
  assert.throws(
    () =>
      parseImportedBattleExamRows(
        [
          { 学号: "001", 班排: "1" }
        ],
        createStudents()
      ),
    /导入失败：表头中缺少“姓名”列。/
  );
});
