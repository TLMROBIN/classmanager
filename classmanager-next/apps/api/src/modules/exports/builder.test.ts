import assert from "node:assert/strict";
import test from "node:test";

import { buildStructuredExportBody } from "./builder.js";

function createBaseClassRecord() {
  return {
    id: "class-1",
    tenantId: "tenant-1",
    name: "测试班级",
    code: "legacy-class-1",
    timezone: "Asia/Shanghai",
    tenant: {
      id: "tenant-1",
      name: "测试租户",
      slug: "tenant-test"
    }
  };
}

test("buildStructuredExportBody(points) normalizes numeric fields and preserves filters", async () => {
  const app = {
    prisma: {
      pointTransaction: {
        findMany: async () => [
          {
            id: "tx-1",
            studentId: "student-1",
            transactionType: "manual_adjustment",
            value: 1.5,
            reason: "写接口验证",
            scene: "班级",
            category: "纪律",
            sourceModule: "points",
            sourceType: "manual",
            occurredAt: new Date("2026-03-08T08:00:00.000Z"),
            isReverted: false,
            revertedByTransactionId: null,
            legacyNumericId: 123n,
            metadata: null,
            reasonTemplateId: null
          }
        ]
      }
    }
  };

  const body = await buildStructuredExportBody(app, createBaseClassRecord(), "points", {
    dateFrom: "2026-03-08",
    dateTo: "2026-03-09"
  });
  const pointsBody = body as any;

  assert.equal(pointsBody.exportType, "points");
  assert.deepEqual(pointsBody.filters, {
    dateFrom: "2026-03-08",
    dateTo: "2026-03-09"
  });
  assert.equal(pointsBody.counts.pointTransactions, 1);
  assert.equal(pointsBody.points.transactions[0].legacyNumericId, "123");
  assert.equal(pointsBody.points.transactions[0].value, 1.5);
});

test("buildStructuredExportBody(homework) parses missing/register events and strips revert prefix", async () => {
  const app = {
    prisma: {
      pointTransaction: {
        findMany: async () => [
          {
            id: "tx-1",
            occurredAt: new Date("2026-03-08T08:00:00.000Z"),
            transactionType: "deduction",
            value: -1,
            reason: "语文作业未交 2026-03-08",
            scene: "作业",
            category: "未交",
            student: {
              id: "student-1",
              name: "张三",
              legacyId: 1n
            }
          },
          {
            id: "tx-2",
            occurredAt: new Date("2026-03-08T09:00:00.000Z"),
            transactionType: "revert",
            value: 1,
            reason: "撤销扣分: 英语作业未交 2026-03-08",
            scene: "作业",
            category: "撤销",
            student: {
              id: "student-2",
              name: "李四",
              legacyId: 2n
            }
          },
          {
            id: "tx-3",
            occurredAt: new Date("2026-03-08T10:00:00.000Z"),
            transactionType: "bonus",
            value: 0.5,
            reason: "数学作业登记 2026-03-08",
            scene: "作业",
            category: "登记",
            student: {
              id: "student-3",
              name: "王五",
              legacyId: 3n
            }
          },
          {
            id: "tx-4",
            occurredAt: new Date("2026-03-08T11:00:00.000Z"),
            transactionType: "bonus",
            value: 1,
            reason: "普通积分原因",
            scene: "班级",
            category: "其他",
            student: {
              id: "student-4",
              name: "赵六",
              legacyId: 4n
            }
          }
        ]
      }
    }
  };

  const body = await buildStructuredExportBody(app, createBaseClassRecord(), "homework", {
    dateFrom: "2026-03-08",
    dateTo: "2026-03-08"
  });
  const homeworkBody = body as any;

  assert.equal(homeworkBody.exportType, "homework");
  assert.equal(homeworkBody.counts.homeworkEvents, 3);
  assert.equal(homeworkBody.counts.missingCount, 2);
  assert.equal(homeworkBody.counts.registerCount, 1);
  assert.equal(homeworkBody.homework.events[1].subjectName, "英语");
  assert.equal(homeworkBody.homework.events[1].eventType, "missing");
  assert.equal(homeworkBody.homework.events[2].eventType, "register");
  assert.equal(homeworkBody.homework.events[0].student.legacyId, "1");
});

test("buildStructuredExportBody(full) merges counts from all export domains", async () => {
  const app = {
    prisma: {
      classConfig: {
        findUnique: async () => ({
          id: "cfg-1",
          className: "测试班级",
          timezone: "Asia/Shanghai",
          extra: {
            legacyCompat: {
              strategyDates: {
                lastPeriodicTaskDate: "2026-01-26",
                lastPenaltyReductionDate: "2026-01-27"
              }
            }
          }
        })
      },
      featureFlag: { findMany: async () => [{ code: "points.write" }] },
      group: { findMany: async () => [{ id: "group-1", name: "一组" }] },
      dormitory: { findMany: async () => [{ id: "dorm-1", name: "101" }] },
      position: { findMany: async () => [{ id: "pos-1", name: "班长" }] },
      pointReasonTemplate: { findMany: async () => [{ id: "tpl-1", name: "加分", value: 1, multiplier: 1 }] },
      attendancePolicy: {
        findUnique: async () => ({
          id: "policy-1",
          latePenaltyValue: -1,
          absentPenaltyValue: -5,
          perfectAttendanceBonusValue: 10
        })
      },
      attendanceSchedule: { findMany: async () => [{ id: "sch-1", name: "早读" }] },
      student: {
        findMany: async () => [
          {
            id: "student-1",
            legacyId: 1n,
            studentNo: "01",
            name: "张三",
            gender: "male",
            status: "active",
            sortOrder: 1,
            joinedAt: null,
            leftAt: null,
            account: {
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            },
            profile: {
              titleLeft: "纪律标兵",
              titleRight: "进步之星",
              notes: "已迁移"
            },
            groups: [],
            dorms: [],
            positions: []
          }
        ]
      },
      migrationMapping: {
        findMany: async () => [
          {
            newId: "student-1",
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,happy",
                normal: null,
                sad: "data:image/jpeg;base64,sad"
              }
            }
          }
        ]
      },
      pointTransaction: {
        findMany: async () => []
      },
      attendanceSession: { findMany: async () => [{ id: "session-1" }] },
      attendanceRecord: { findMany: async () => [{ id: "record-1", legacyTimestamp: 10n }] }
    }
  };

  const body = await buildStructuredExportBody(app, createBaseClassRecord(), "full", {});
  const fullBody = body as any;

  assert.equal(fullBody.exportType, "full");
  assert.equal(fullBody.counts.groups, 1);
  assert.equal(fullBody.counts.students, 1);
  assert.equal(fullBody.counts.attendanceSessions, 1);
  assert.equal(fullBody.counts.attendanceRecords, 1);
  assert.equal(fullBody.counts.homeworkEvents, 0);
  assert.equal(fullBody.students[0].legacyId, "1");
  assert.equal(fullBody.students[0].profile.titleLeft, "纪律标兵");
  assert.equal(fullBody.students[0].profile.avatarHappyData, "data:image/jpeg;base64,happy");
  assert.equal(fullBody.students[0].profile.avatarSadData, "data:image/jpeg;base64,sad");
  assert.equal(fullBody.settings.classConfig.extra.legacyCompat.strategyDates.lastPeriodicTaskDate, "2026-01-26");
  assert.equal(fullBody.settings.classConfig.extra.legacyCompat.strategyDates.lastPenaltyReductionDate, "2026-01-27");
});

test("buildStructuredExportBody(students) prefers structured-full avatar mapping and merges missing fields", async () => {
  const app = {
    prisma: {
      student: {
        findMany: async () => [
          {
            id: "student-1",
            legacyId: 1n,
            studentNo: "01",
            name: "张三",
            gender: "male",
            status: "active",
            sortOrder: 1,
            joinedAt: null,
            leftAt: null,
            account: null,
            profile: null,
            groups: [],
            dorms: [],
            positions: []
          }
        ]
      },
      migrationMapping: {
        findMany: async () => [
          {
            newId: "student-1",
            legacyScope: "tenant-test",
            createdAt: new Date("2026-03-17T08:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,tenant-happy",
                normal: "data:image/jpeg;base64,tenant-normal",
                sad: null
              }
            }
          },
          {
            newId: "student-1",
            legacyScope: "structured-full:class-1",
            createdAt: new Date("2026-03-18T08:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,full-happy",
                normal: null,
                sad: "data:image/jpeg;base64,full-sad"
              }
            }
          }
        ]
      }
    }
  };

  const body = await buildStructuredExportBody(app, createBaseClassRecord(), "students", {});
  const studentsBody = body as any;

  assert.equal(studentsBody.exportType, "students");
  assert.equal(studentsBody.students[0].profile.avatarHappyData, "data:image/jpeg;base64,full-happy");
  assert.equal(studentsBody.students[0].profile.avatarNormalData, "data:image/jpeg;base64,tenant-normal");
  assert.equal(studentsBody.students[0].profile.avatarSadData, "data:image/jpeg;base64,full-sad");
});

test("buildStructuredExportBody(students) falls back deterministically to tenant avatar mapping", async () => {
  const app = {
    prisma: {
      student: {
        findMany: async () => [
          {
            id: "student-1",
            legacyId: 1n,
            studentNo: "01",
            name: "张三",
            gender: "male",
            status: "active",
            sortOrder: 1,
            joinedAt: null,
            leftAt: null,
            account: null,
            profile: null,
            groups: [],
            dorms: [],
            positions: []
          }
        ]
      },
      migrationMapping: {
        findMany: async () => [
          {
            newId: "student-1",
            legacyScope: "legacy-other-scope",
            createdAt: new Date("2026-03-18T09:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,other-happy",
                normal: null,
                sad: null
              }
            }
          },
          {
            newId: "student-1",
            legacyScope: "tenant-test",
            createdAt: new Date("2026-03-17T09:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,tenant-happy",
                normal: null,
                sad: null
              }
            }
          }
        ]
      }
    }
  };

  const body = await buildStructuredExportBody(app, createBaseClassRecord(), "students", {});
  const studentsBody = body as any;

  assert.equal(studentsBody.students[0].profile.avatarHappyData, "data:image/jpeg;base64,tenant-happy");
});
