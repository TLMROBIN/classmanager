import assert from "node:assert/strict";
import test from "node:test";

import { restoreStructuredFullBackup } from "./restore.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";

test("restoreStructuredFullBackup preserves classConfig.extra legacy compat strategy dates", async () => {
  const classConfigUpserts: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    $transaction: async (callback: any) =>
      callback({
        importJob: {
          async create() {
            return { id: "import-job-1" };
          },
          async update() {
            return null;
          }
        },
        class: {
          async update() {
            return null;
          }
        },
        student: {
          async findMany() {
            return [];
          },
          async deleteMany() {
            return null;
          }
        },
        attendanceRecord: {
          async deleteMany() {
            return null;
          }
        },
        attendanceSession: {
          async deleteMany() {
            return null;
          }
        },
        pointTransaction: {
          async deleteMany() {
            return null;
          }
        },
        pointReasonTemplate: {
          async deleteMany() {
            return null;
          }
        },
        attendanceSchedule: {
          async deleteMany() {
            return null;
          }
        },
        featureFlag: {
          async deleteMany() {
            return null;
          }
        },
        position: {
          async deleteMany() {
            return null;
          }
        },
        dormitory: {
          async deleteMany() {
            return null;
          }
        },
        group: {
          async deleteMany() {
            return null;
          }
        },
        classConfig: {
          async upsert(input: any) {
            classConfigUpserts.push(input);
            return input;
          }
        },
        attendancePolicy: {
          async deleteMany() {
            return null;
          }
        },
        migrationMapping: {
          async deleteMany() {
            return null;
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
            return input;
          }
        }
      })
  };

  const backup = {
    exportType: "full" as const,
    exportedAt: "2026-03-16T08:00:00.000Z",
    class: {
      id: CLASS_ID,
      name: "14班",
      code: "14ban",
      timezone: "Asia/Shanghai"
    },
    settings: {
      classConfig: {
        className: "14班",
        timezone: "Asia/Shanghai",
        isFrozen: false,
        scheduleNotes: {},
        countdownEvents: [],
        extra: {
          duty: {
            mon: ["student-1"]
          },
          legacyCompat: {
            strategyDates: {
              lastPeriodicTaskDate: "2026-01-26",
              lastPenaltyReductionDate: "2026-01-27"
            }
          }
        }
      },
      groups: [],
      dormitories: [],
      positions: [],
      reasonTemplates: [],
      featureFlags: [],
      attendanceSchedules: []
    },
    students: [],
    points: {
      transactions: []
    },
    attendance: {
      sessions: [],
      records: []
    },
    filters: null
  };

  const result = await restoreStructuredFullBackup(prisma, {
    backup,
    classRecord: {
      id: CLASS_ID,
      tenantId: TENANT_ID,
      name: "14班",
      code: "14ban",
      timezone: "Asia/Shanghai"
    },
    actorUserId: "user-1",
    actorMembershipId: "membership-1",
    sourceFilename: "structured-full-test.json"
  });

  assert.equal(classConfigUpserts.length, 1);
  assert.deepEqual(classConfigUpserts[0].update.extra, {
    duty: {
      mon: ["student-1"]
    },
    legacyCompat: {
      strategyDates: {
        lastPeriodicTaskDate: "2026-01-26",
        lastPenaltyReductionDate: "2026-01-27"
      }
    }
  });
  assert.deepEqual(classConfigUpserts[0].create.extra, classConfigUpserts[0].update.extra);
  assert.equal(result.importJobId, "import-job-1");
  assert.equal(auditCreates.length, 1);
});

test("restoreStructuredFullBackup recreates student profile and avatar mapping from backup", async () => {
  const studentProfileCreates: any[] = [];
  const migrationMappingUpserts: any[] = [];

  const prisma = {
    $transaction: async (callback: any) =>
      callback({
        importJob: {
          async create() {
            return { id: "import-job-2" };
          },
          async update() {
            return null;
          }
        },
        class: {
          async update() {
            return null;
          }
        },
        student: {
          async findMany() {
            return [{ id: "student-1" }];
          },
          async deleteMany() {
            return null;
          },
          async upsert() {
            return null;
          }
        },
        attendanceRecord: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        attendanceSession: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        pointTransaction: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          },
          async update() {
            return null;
          }
        },
        studentPositionAssignment: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        studentDormAssignment: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        studentGroupAssignment: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        pointAccount: {
          async deleteMany() {
            return null;
          },
          async create() {
            return { id: "account-1" };
          }
        },
        pointReasonTemplate: {
          async deleteMany() {
            return null;
          }
        },
        attendanceSchedule: {
          async deleteMany() {
            return null;
          }
        },
        featureFlag: {
          async deleteMany() {
            return null;
          }
        },
        position: {
          async deleteMany() {
            return null;
          }
        },
        dormitory: {
          async deleteMany() {
            return null;
          }
        },
        group: {
          async deleteMany() {
            return null;
          }
        },
        classConfig: {
          async upsert() {
            return null;
          }
        },
        attendancePolicy: {
          async deleteMany() {
            return null;
          }
        },
        studentProfile: {
          async deleteMany() {
            return null;
          },
          async create(input: any) {
            studentProfileCreates.push(input);
            return input;
          }
        },
        migrationMapping: {
          async deleteMany() {
            return null;
          },
          async upsert(input: any) {
            migrationMappingUpserts.push(input);
            return input;
          }
        },
        auditLog: {
          async create() {
            return null;
          }
        }
      })
  };

  await restoreStructuredFullBackup(prisma, {
    backup: {
      exportType: "full",
      exportedAt: "2026-03-16T08:00:00.000Z",
      class: {
        id: CLASS_ID,
        name: "14班",
        code: "14ban",
        timezone: "Asia/Shanghai"
      },
      settings: {
        classConfig: {
          className: "14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          scheduleNotes: {},
          countdownEvents: [],
          extra: {}
        },
        groups: [],
        dormitories: [],
        positions: [],
        reasonTemplates: [],
        featureFlags: [],
        attendanceSchedules: []
      },
      students: [
        {
          id: "student-1",
          legacyId: "1",
          studentNo: "01",
          name: "张三",
          gender: "male",
          status: "active",
          sortOrder: 1,
          joinedAt: null,
          leftAt: null,
          account: {
            totalPoints: "10",
            balancePoints: "8",
            penaltyPoints: "2",
            version: 1
          },
          profile: {
            titleLeft: "纪律标兵",
            titleRight: "进步之星",
            notes: "保留头像",
            avatarHappyData: "data:image/jpeg;base64,happy",
            avatarNormalData: null,
            avatarSadData: "data:image/jpeg;base64,sad"
          },
          groups: [],
          dorms: [],
          positions: []
        }
      ],
      points: {
        transactions: []
      },
      attendance: {
        sessions: [],
        records: []
      },
      filters: null
    },
    classRecord: {
      id: CLASS_ID,
      tenantId: TENANT_ID,
      name: "14班",
      code: "14ban",
      timezone: "Asia/Shanghai"
    },
    actorUserId: "user-1",
    actorMembershipId: "membership-1",
    sourceFilename: "structured-full-test.json"
  });

  assert.equal(studentProfileCreates.length, 1);
  assert.deepEqual(studentProfileCreates[0].data, {
    studentId: "student-1",
    titleLeft: "纪律标兵",
    titleRight: "进步之星",
    notes: "保留头像"
  });
  assert.equal(migrationMappingUpserts.length, 1);
  assert.equal(
    migrationMappingUpserts[0].create.metadata.avatarData.happy,
    "data:image/jpeg;base64,happy"
  );
  assert.equal(
    migrationMappingUpserts[0].create.metadata.avatarData.sad,
    "data:image/jpeg;base64,sad"
  );
});

test("restoreStructuredFullBackup clears legacy import mappings for target tenant scope", async () => {
  const migrationMappingDeletes: any[] = [];

  const prisma = {
    $transaction: async (callback: any) =>
      callback({
        importJob: {
          async create() {
            return { id: "import-job-3" };
          },
          async update() {
            return null;
          }
        },
        class: {
          async update() {
            return null;
          }
        },
        student: {
          async findMany() {
            return [];
          },
          async deleteMany() {
            return null;
          }
        },
        attendanceRecord: {
          async deleteMany() {
            return null;
          }
        },
        attendanceSession: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          }
        },
        pointTransaction: {
          async deleteMany() {
            return null;
          },
          async create() {
            return null;
          },
          async update() {
            return null;
          }
        },
        studentPositionAssignment: {
          async deleteMany() {
            return null;
          }
        },
        studentDormAssignment: {
          async deleteMany() {
            return null;
          }
        },
        studentGroupAssignment: {
          async deleteMany() {
            return null;
          }
        },
        pointAccount: {
          async deleteMany() {
            return null;
          }
        },
        studentProfile: {
          async deleteMany() {
            return null;
          }
        },
        pointReasonTemplate: {
          async deleteMany() {
            return null;
          }
        },
        attendanceSchedule: {
          async deleteMany() {
            return null;
          }
        },
        featureFlag: {
          async deleteMany() {
            return null;
          }
        },
        position: {
          async deleteMany() {
            return null;
          }
        },
        dormitory: {
          async deleteMany() {
            return null;
          }
        },
        group: {
          async deleteMany() {
            return null;
          }
        },
        classConfig: {
          async deleteMany() {
            return null;
          }
        },
        attendancePolicy: {
          async deleteMany() {
            return null;
          }
        },
        migrationMapping: {
          async deleteMany(input: any) {
            migrationMappingDeletes.push(input);
            return null;
          }
        },
        auditLog: {
          async create() {
            return null;
          }
        }
      })
  };

  await restoreStructuredFullBackup(prisma, {
    backup: {
      exportType: "full",
      exportedAt: "2026-03-16T08:00:00.000Z",
      tenant: {
        slug: "tenant-test"
      },
      class: {
        id: CLASS_ID,
        name: "14班",
        code: "14ban",
        timezone: "Asia/Shanghai"
      },
      settings: {
        groups: [],
        dormitories: [],
        positions: [],
        reasonTemplates: [],
        featureFlags: [],
        attendanceSchedules: []
      },
      students: [],
      points: {
        transactions: []
      },
      attendance: {
        sessions: [],
        records: []
      },
      filters: null
    },
    classRecord: {
      id: CLASS_ID,
      tenantId: TENANT_ID,
      name: "14班",
      code: "14ban",
      timezone: "Asia/Shanghai",
      tenant: {
        slug: "tenant-test"
      }
    },
    actorUserId: "user-1",
    actorMembershipId: "membership-1",
    sourceFilename: "structured-full-test.json"
  });

  assert.equal(migrationMappingDeletes.length, 1);
  assert.deepEqual(migrationMappingDeletes[0], {
    where: {
      tenantId: TENANT_ID,
      OR: [
        {
          entityType: "student_avatar",
          legacyScope: `structured-full:${CLASS_ID}`
        },
        {
          entityType: {
            in: [
              "group",
              "dormitory",
              "position",
              "student",
              "student_avatar",
              "point_transaction",
              "attendance_session",
              "attendance_record"
            ]
          },
          legacyScope: "tenant-test"
        }
      ]
    }
  });
});
