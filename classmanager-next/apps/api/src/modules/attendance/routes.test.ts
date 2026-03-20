import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { attendanceRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const SESSION_ID = "55555555-5555-4555-8555-555555555555";
const RECORD_ID = "66666666-6666-4666-8666-666666666666";
const STUDENT_ID = "77777777-7777-4777-8777-777777777777";
const RECORD_ID_2 = "88888888-8888-4888-8888-888888888888";
const STUDENT_ID_2 = "99999999-9999-4999-8999-999999999999";

function createMembership(roleCodes: string[]) {
  return {
    id: MEMBERSHIP_ID,
    tenantId: TENANT_ID,
    status: "active",
    roles: roleCodes.map((code) => ({
      role: {
        code
      }
    }))
  };
}

async function createTestApp(prisma: any) {
  const app = Fastify();
  await app.register(sensible);
  app.decorate("prisma", prisma);
  app.decorate("authenticate", async (request: any) => {
    request.auth = {
      sub: USER_ID
    };
  });
  await app.register(attendanceRoutes, { prefix: "/api" });
  return app;
}

test("GET /attendance/overview counts imported migration data instead of all class attendance rows", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "legacy-demo"
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendancePolicy: {
      async findUnique() {
        return null;
      }
    },
    attendanceSchedule: {
      async findMany() {
        return [];
      }
    },
    featureFlag: {
      async findUnique() {
        return {
          enabled: true
        };
      }
    },
    migrationMapping: {
      async count({ where }: any) {
        if (where.entityType === "attendance_session") {
          return 2;
        }
        if (where.entityType === "attendance_record") {
          return 5;
        }
        return 0;
      }
    },
    importJob: {
      async findFirst({ where }: any) {
        if (where.jobType === "legacy_safe_subset_import") {
          return {
            id: "safe-subset-job",
            status: "succeeded",
            createdAt: new Date("2026-03-18T08:00:00.000Z"),
            finishedAt: new Date("2026-03-18T08:01:00.000Z"),
            summary: {
              deferredAttendanceSessions: 4,
              deferredAttendanceRecords: 8
            }
          };
        }

        if (where.jobType === "legacy_attendance_phase2_import") {
          return {
            id: "attendance-phase2-job",
            status: "succeeded",
            createdAt: new Date("2026-03-18T09:00:00.000Z"),
            finishedAt: new Date("2026-03-18T09:01:00.000Z"),
            summary: {
              importedSessions: 2,
              importedRecords: 5
            }
          };
        }

        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/overview`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    feature: {
      attendanceEnabled: true
    },
    policy: null,
    schedules: [],
    migration: {
      importedSessions: 2,
      importedRecords: 5,
      pendingSessions: 2,
      pendingRecords: 3,
      latestImportJob: {
        id: "attendance-phase2-job",
        status: "succeeded",
        createdAt: "2026-03-18T09:00:00.000Z",
        finishedAt: "2026-03-18T09:01:00.000Z",
        summary: {
          importedSessions: 2,
          importedRecords: 5
        }
      }
    }
  });

  await app.close();
});

test("GET /attendance/export returns maintenance export payload", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findMany() {
        return [
          {
            id: "schedule-1",
            code: "morning_reading",
            name: "早读",
            displayOrder: 1,
            isActive: true
          },
          {
            id: "schedule-2",
            code: "evening_self_study",
            name: "晚自习",
            displayOrder: 2,
            isActive: false
          }
        ];
      }
    },
    attendanceSession: {
      async findMany() {
        return [
          {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            sessionCode: "morning_reading",
            status: "closed",
            schedule: {
              name: "早读"
            }
          }
        ];
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            status: "present",
            checkInAt: new Date("2026-03-10T08:01:00.000Z"),
            recordedAt: new Date("2026-03-10T08:01:00.000Z"),
            note: null,
            source: "manual",
            legacyStudentName: "张三",
            student: {
              id: STUDENT_ID,
              name: "张三",
              sortOrder: 1
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/export?dateFrom=2026-03-01&dateTo=2026-03-31`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    filters: {
      dateFrom: "2026-03-01",
      dateTo: "2026-03-31",
      sessionCode: null
    },
    schedules: [
      {
        id: "schedule-1",
        code: "morning_reading",
        name: "早读",
        displayOrder: 1,
        isActive: true
      },
      {
        id: "schedule-2",
        code: "evening_self_study",
        name: "晚自习",
        displayOrder: 2,
        isActive: false
      }
    ],
    sessions: [
      {
        id: SESSION_ID,
        sessionDate: "2026-03-10",
        sessionCode: "morning_reading",
        sessionName: "早读",
        status: "closed"
      }
    ],
    items: [
      {
        recordId: RECORD_ID,
        sessionId: SESSION_ID,
        sessionDate: "2026-03-10",
        sessionCode: "morning_reading",
        sessionName: "早读",
        sessionStatus: "closed",
        studentId: STUDENT_ID,
        studentName: "张三",
        studentSortOrder: 1,
        status: "present",
        checkInAt: "2026-03-10T08:01:00.000Z",
        recordedAt: "2026-03-10T08:01:00.000Z",
        note: null,
        source: "manual",
        legacyStudentName: "张三"
      }
    ]
  });

  await app.close();
});

test("GET /attendance/issues returns filtered abnormal records", async () => {
  let capturedWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active"
        };
      }
    },
    attendanceRecord: {
      async findMany(input: any) {
        capturedWhere = input.where;
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            status: "absent",
            note: null,
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:00:00.000Z"),
            source: "legacy_import",
            pointTransactionId: null,
            session: {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open",
              schedule: {
                name: "早读"
              }
            },
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              sortOrder: 1
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/issues?dateFrom=2026-03-01&dateTo=2026-03-31&sessionCode=morning&status=absent&studentKeyword=张&limit=50`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedWhere.classId, CLASS_ID);
  assert.equal(capturedWhere.status, "absent");
  assert.equal(capturedWhere.session.is.sessionCode, "morning");
  assert.equal(response.json().filters.studentKeyword, "张");
  assert.equal(response.json().totals.settleableAbsent, 1);
  assert.equal(response.json().items[0].student.legacyId, "1");
  await app.close();
});

test("GET /attendance/issues includes excused records in default workbench scope", async () => {
  let capturedWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active"
        };
      }
    },
    attendanceRecord: {
      async findMany(input: any) {
        capturedWhere = input.where;
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            status: "excused",
            note: null,
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:00:00.000Z"),
            source: "legacy_import",
            pointTransactionId: null,
            session: {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open",
              schedule: {
                name: "早读"
              }
            },
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              sortOrder: 1
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/issues?limit=50`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedWhere.status.in, ["late", "absent", "excused"]);
  assert.equal(response.json().totals.excused, 1);
  assert.equal(response.json().items[0].status, "excused");
  await app.close();
});

test("GET /attendance/issues accepts excused status filter", async () => {
  let capturedWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active"
        };
      }
    },
    attendanceRecord: {
      async findMany(input: any) {
        capturedWhere = input.where;
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/issues?status=excused&limit=20`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedWhere.status, "excused");
  assert.equal(response.json().filters.status, "excused");
  await app.close();
});

test("PUT /attendance/issues/status updates abnormal records across sessions", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "absent",
            note: null,
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:00:00.000Z"),
            source: "legacy_import",
            pointTransactionId: null,
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              sortOrder: 1
            },
            session: {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open",
              schedule: {
                name: "早读"
              }
            }
          },
          {
            id: RECORD_ID_2,
            attendanceSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: STUDENT_ID_2,
            status: "late",
            note: null,
            checkInAt: new Date("2026-03-11T19:03:00.000Z"),
            recordedAt: new Date("2026-03-11T19:03:00.000Z"),
            source: "legacy_import",
            pointTransactionId: null,
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              legacyId: 2,
              sortOrder: 2
            },
            session: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sessionDate: new Date("2026-03-11T00:00:00.000Z"),
              sessionCode: "evening",
              status: "closed",
              schedule: {
                name: "晚自习"
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: input.where.id,
              attendanceSessionId:
                input.where.id === RECORD_ID ? SESSION_ID : "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              status: "present",
              note: null,
              checkInAt: input.where.id === RECORD_ID ? null : new Date("2026-03-11T19:03:00.000Z"),
              recordedAt: new Date("2026-03-12T08:00:00.000Z"),
              source: "manual_batch_update",
              pointTransactionId: null
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/issues/status`,
    payload: {
      recordIds: [RECORD_ID, RECORD_ID_2],
      status: "present"
    }
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 2);
  assert.ok(body.batchId);
  assert.equal(recordUpdates[0].data.batchId, body.batchId);
  assert.equal(auditCreates.length, 2);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_update");
  assert.equal(auditCreates[0].data.metadata.issueWorkbench, true);
  assert.equal(body.updatedCount, 2);
  assert.equal(body.items[1].session.sessionName, "晚自习");
  await app.close();
});

test("PUT /attendance/issues/status replaces settled penalty when abnormal status changes", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const recordUpdates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          latePenaltyValue: -1,
          absentPenaltyValue: -5
        };
      }
    },
    pointTransaction: {
      async findMany() {
        return [
          {
            id: "transaction-old-1",
            sourceModule: "attendance_issue_settlement"
          }
        ];
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "absent",
            note: null,
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:00:00.000Z"),
            source: "legacy_import",
            pointTransactionId: "transaction-old-1",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              sortOrder: 1
            },
            session: {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "closed",
              schedule: {
                name: "早读"
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async findFirst() {
            return {
              id: "transaction-old-1",
              pointAccountId: "account-1",
              transactionType: "penalty",
              value: -5,
              reason: "缺勤扣分: 2026-03-10 早读",
              scene: "班级",
              category: "出勤",
              sourceModule: "attendance_issue_settlement",
              isReverted: false
            };
          },
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: transactionCreates.length === 1 ? "transaction-revert-1" : "transaction-new-1"
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
          }
        },
        pointAccount: {
          async findUnique() {
            return {
              id: "account-1",
              totalPoints: 95,
              balancePoints: 90,
              penaltyPoints: 5
            };
          },
          async update(input: any) {
            pointAccountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "late",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-12T08:00:00.000Z"),
              source: "manual_batch_update",
              pointTransactionId: "transaction-new-1"
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/issues/status`,
    payload: {
      recordIds: [RECORD_ID],
      status: "late"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_status_reconciliation");
  assert.equal(transactionCreates[1].data.sourceModule, "attendance_issue_settlement");
  assert.equal(transactionCreates[1].data.value, -1);
  assert.equal(transactionUpdates.length, 1);
  assert.equal(pointAccountUpdates.length, 2);
  assert.equal(recordUpdates[0].data.pointTransactionId, "transaction-new-1");
  await app.close();
});

test("POST /attendance/issues/settle-absent settles eligible absent records", async () => {
  const transactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          absentPenaltyValue: -5
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "absent",
            pointTransactionId: null,
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              account: {
                id: "account-1",
                totalPoints: 100,
                balancePoints: 90,
                penaltyPoints: 10,
                version: 1
              }
            },
            session: {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open",
              schedule: {
                name: "早读"
              }
            }
          },
          {
            id: RECORD_ID_2,
            attendanceSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            studentId: STUDENT_ID_2,
            status: "absent",
            pointTransactionId: "old-transaction",
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              legacyId: 2,
              account: {
                id: "account-2",
                totalPoints: 95,
                balancePoints: 80,
                penaltyPoints: 15,
                version: 3
              }
            },
            session: {
              id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
              sessionDate: new Date("2026-03-11T00:00:00.000Z"),
              sessionCode: "evening",
              status: "closed",
              schedule: {
                name: "晚自习"
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: "transaction-new-1",
              value: -5
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/issues/settle-absent`,
    payload: {
      recordIds: [RECORD_ID, RECORD_ID_2]
    }
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_issue_settlement");
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(recordUpdates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.issue.absent_settle");
  assert.equal(body.settledCount, 1);
  assert.equal(body.skippedCount, 1);
  assert.equal(body.items[0].transactionId, "transaction-new-1");
  await app.close();
});

test("PUT /attendance/records updates record status and writes audit log", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "absent",
          note: null,
          checkInAt: null,
          source: "legacy_import",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_update"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "present"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.deepEqual(recordUpdates[0].data, {
    status: "present",
    source: "manual_update",
    recordedAt: recordUpdates[0].data.recordedAt,
    checkInAt: null,
    pointTransactionId: null,
    batchId: null,
    actorUserId: USER_ID,
    actorMembershipId: MEMBERSHIP_ID
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.update");
  assert.equal(response.json().record.status, "present");
  await app.close();
});

test("PUT /attendance/records updates check-in time when status stays the same", async () => {
  const recordUpdates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "present",
          note: null,
          checkInAt: new Date("2026-03-10T07:30:00.000Z"),
          source: "legacy_import",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: new Date("2026-03-10T07:45:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_update"
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "present",
      checkInAt: "2026-03-10T07:45:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(recordUpdates[0].data.checkInAt.toISOString(), "2026-03-10T07:45:00.000Z");
  await app.close();
});

test("PUT /attendance/records reverts settled penalty when correcting to present", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "absent",
          note: null,
          checkInAt: null,
          source: "legacy_import",
          pointTransactionId: "transaction-old-1",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1,
            account: {
              id: "account-1"
            }
          },
          session: {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          latePenaltyValue: -1,
          absentPenaltyValue: -5
        };
      }
    },
    pointTransaction: {
      async findFirst() {
        return {
          sourceModule: "attendance_issue_settlement"
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async findFirst() {
            return {
              id: "transaction-old-1",
              pointAccountId: "account-1",
              transactionType: "penalty",
              value: -5,
              reason: "缺勤扣分: 2026-03-10 早读",
              scene: "班级",
              category: "出勤",
              sourceModule: "attendance_issue_settlement",
              isReverted: false
            };
          },
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: "transaction-revert-1"
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
          }
        },
        pointAccount: {
          async findUnique() {
            return {
              id: "account-1",
              totalPoints: 95,
              balancePoints: 90,
              penaltyPoints: 5
            };
          },
          async update(input: any) {
            pointAccountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:20:00.000Z"),
              source: "manual_update"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "present"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_status_reconciliation");
  assert.equal(transactionCreates[0].data.value, 5);
  assert.equal(transactionUpdates.length, 1);
  assert.equal(transactionUpdates[0].data.isReverted, true);
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(recordUpdates[0].data.pointTransactionId, null);
  assert.equal(auditCreates[0].data.afterData.pointTransactionId, null);
  await app.close();
});

test("PUT /attendance/policy updates policy values and writes audit log", async () => {
  const policyUpdates: any[] = [];
  const auditCreates: any[] = [];
  const nextWeekendRules = {
    monday: ["morning"],
    sunday: ["evening"]
  };
  const nextSpecialRules = {
    sundaySpecialLateTime: {
      evening: "19:00"
    }
  };

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          id: "policy-1",
          latePenaltyValue: -1,
          absentPenaltyValue: -5,
          perfectAttendanceBonusValue: 10,
          weekendRules: {
            monday: ["morning"]
          },
          specialRules: {
            sundaySpecialLateTime: {
              evening: "18:50"
            }
          },
          isFrozen: false,
          updatedAt: new Date("2026-03-10T00:00:00.000Z")
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendancePolicy: {
          async update(input: any) {
            policyUpdates.push(input);
            return {
              latePenaltyValue: -2,
              absentPenaltyValue: -6,
              perfectAttendanceBonusValue: 12,
              weekendRules: nextWeekendRules,
              specialRules: nextSpecialRules,
              isFrozen: false,
              updatedAt: new Date("2026-03-11T00:00:00.000Z")
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/policy`,
    payload: {
      latePenaltyValue: -2,
      absentPenaltyValue: -6,
      perfectAttendanceBonusValue: 12,
      weekendRules: nextWeekendRules,
      specialRules: nextSpecialRules
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(policyUpdates.length, 1);
  assert.equal(policyUpdates[0].data.latePenaltyValue, -2);
  assert.deepEqual(policyUpdates[0].data.weekendRules, nextWeekendRules);
  assert.deepEqual(policyUpdates[0].data.specialRules, nextSpecialRules);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.policy.update");
  assert.deepEqual(auditCreates[0].data.beforeData.weekendRules, {
    monday: ["morning"]
  });
  assert.deepEqual(auditCreates[0].data.afterData.specialRules, nextSpecialRules);
  assert.equal(response.json().policy.latePenaltyValue, "-2");
  assert.deepEqual(response.json().policy.weekendRules, nextWeekendRules);
  assert.deepEqual(response.json().policy.specialRules, nextSpecialRules);
  await app.close();
});

test("PUT /attendance/policy rejects unchanged values", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          id: "policy-1",
          latePenaltyValue: -1,
          absentPenaltyValue: -5,
          perfectAttendanceBonusValue: 10,
          weekendRules: {},
          specialRules: {},
          isFrozen: false,
          updatedAt: new Date("2026-03-10T00:00:00.000Z")
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/policy`,
    payload: {
      latePenaltyValue: -1,
      absentPenaltyValue: -5,
      perfectAttendanceBonusValue: 10
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance policy unchanged");
  await app.close();
});

test("PUT /attendance/schedules updates schedules and remaps attendance rules", async () => {
  const scheduleUpdates: any[] = [];
  const scheduleCreates: any[] = [];
  const scheduleDeleteManyCalls: any[] = [];
  const policyUpdates: any[] = [];
  const auditCreates: any[] = [];

  const currentSchedules = [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      code: "morning",
      name: "早读",
      startTime: new Date("1970-01-01T07:00:00.000Z"),
      endTime: new Date("1970-01-01T07:30:00.000Z"),
      lateTime: new Date("1970-01-01T07:10:00.000Z"),
      isActive: true,
      displayOrder: 1
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      code: "evening",
      name: "晚自习",
      startTime: new Date("1970-01-01T18:30:00.000Z"),
      endTime: new Date("1970-01-01T21:00:00.000Z"),
      lateTime: new Date("1970-01-01T18:40:00.000Z"),
      isActive: true,
      displayOrder: 2
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      code: "noon_old",
      name: "午检",
      startTime: new Date("1970-01-01T12:20:00.000Z"),
      endTime: new Date("1970-01-01T12:40:00.000Z"),
      lateTime: new Date("1970-01-01T12:25:00.000Z"),
      isActive: true,
      displayOrder: 3
    }
  ];

  let attendanceScheduleFindManyCall = 0;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findMany() {
        attendanceScheduleFindManyCall += 1;
        if (attendanceScheduleFindManyCall === 1) {
          return currentSchedules;
        }
        return [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            code: "morning_reading",
            name: "早读",
            startTime: new Date("1970-01-01T07:05:00.000Z"),
            endTime: new Date("1970-01-01T07:35:00.000Z"),
            lateTime: new Date("1970-01-01T07:15:00.000Z"),
            isActive: true,
            displayOrder: 1
          },
          {
            id: "new-schedule-noon",
            code: "noon",
            name: "午练",
            startTime: new Date("1970-01-01T12:30:00.000Z"),
            endTime: new Date("1970-01-01T13:00:00.000Z"),
            lateTime: new Date("1970-01-01T12:40:00.000Z"),
            isActive: true,
            displayOrder: 2
          },
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            code: "evening",
            name: "晚自习",
            startTime: new Date("1970-01-01T18:30:00.000Z"),
            endTime: new Date("1970-01-01T21:00:00.000Z"),
            lateTime: new Date("1970-01-01T18:40:00.000Z"),
            isActive: false,
            displayOrder: 3
          }
        ];
      },
      async update() {
        return null;
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          id: "policy-1",
          weekendRules: {
            monday: ["morning"],
            sunday: ["evening"]
          },
          specialRules: {
            sundaySpecialLateTime: {
              evening: "19:00"
            }
          }
        };
      }
    },
    attendanceSession: {
      async count(input: any) {
        if (input.where.scheduleId === "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb") {
          return 2;
        }
        return 0;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceSchedule: {
          async deleteMany(input: any) {
            scheduleDeleteManyCalls.push(input);
            return { count: 1 };
          },
          async update(input: any) {
            scheduleUpdates.push(input);
            return input;
          },
          async create(input: any) {
            scheduleCreates.push(input);
            return input;
          },
          async findMany() {
            return [
              {
                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                code: "morning_reading",
                name: "早读",
                startTime: new Date("1970-01-01T07:05:00.000Z"),
                endTime: new Date("1970-01-01T07:35:00.000Z"),
                lateTime: new Date("1970-01-01T07:15:00.000Z"),
                isActive: true,
                displayOrder: 1
              },
              {
                id: "new-schedule-noon",
                code: "noon",
                name: "午练",
                startTime: new Date("1970-01-01T12:30:00.000Z"),
                endTime: new Date("1970-01-01T13:00:00.000Z"),
                lateTime: new Date("1970-01-01T12:40:00.000Z"),
                isActive: true,
                displayOrder: 2
              },
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                code: "evening",
                name: "晚自习",
                startTime: new Date("1970-01-01T18:30:00.000Z"),
                endTime: new Date("1970-01-01T21:00:00.000Z"),
                lateTime: new Date("1970-01-01T18:40:00.000Z"),
                isActive: false,
                displayOrder: 3
              }
            ];
          }
        },
        attendancePolicy: {
          async update(input: any) {
            policyUpdates.push(input);
            return {
              id: "policy-1",
              weekendRules: {
                monday: ["morning_reading"],
                tuesday: [],
                wednesday: [],
                thursday: [],
                friday: [],
                saturday: [],
                sunday: []
              },
              specialRules: {}
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/schedules`,
    payload: {
      items: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          code: "morning_reading",
          name: "早读",
          startTime: "07:05",
          endTime: "07:35",
          lateTime: "07:15",
          isActive: true
        },
        {
          code: "noon",
          name: "午练",
          startTime: "12:30",
          endTime: "13:00",
          lateTime: "12:40",
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(scheduleDeleteManyCalls.length, 1);
  assert.deepEqual(scheduleDeleteManyCalls[0].where.id.in, ["cccccccc-cccc-4ccc-8ccc-cccccccccccc"]);
  assert.equal(scheduleUpdates.length, 3);
  assert.match(scheduleUpdates[0].data.code, /__tmp_att_/);
  assert.deepEqual(scheduleUpdates[1].data, {
    code: "morning_reading",
    name: "早读",
    startTime: new Date("1970-01-01T07:05:00.000Z"),
    endTime: new Date("1970-01-01T07:35:00.000Z"),
    lateTime: new Date("1970-01-01T07:15:00.000Z"),
    isActive: true,
    displayOrder: 1
  });
  assert.deepEqual(scheduleUpdates[2].data, {
    isActive: false,
    displayOrder: 3
  });
  assert.equal(scheduleCreates.length, 1);
  assert.deepEqual(scheduleCreates[0].data, {
    tenantId: TENANT_ID,
    classId: CLASS_ID,
    code: "noon",
    name: "午练",
    startTime: new Date("1970-01-01T12:30:00.000Z"),
    endTime: new Date("1970-01-01T13:00:00.000Z"),
    lateTime: new Date("1970-01-01T12:40:00.000Z"),
    isActive: true,
    displayOrder: 2
  });
  assert.equal(policyUpdates.length, 1);
  assert.deepEqual(policyUpdates[0].data.weekendRules, {
    monday: ["morning_reading"],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: []
  });
  assert.deepEqual(policyUpdates[0].data.specialRules, {});
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.schedule.update");
  assert.equal(response.json().schedules[0].code, "morning_reading");
  assert.equal(response.json().schedules[2].isActive, false);
  await app.close();
});

test("PUT /attendance/schedules rejects unchanged config", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findMany() {
        return [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            code: "morning",
            name: "早读",
            startTime: new Date("1970-01-01T07:00:00.000Z"),
            endTime: new Date("1970-01-01T07:30:00.000Z"),
            lateTime: new Date("1970-01-01T07:10:00.000Z"),
            isActive: true,
            displayOrder: 1
          }
        ];
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          id: "policy-1",
          weekendRules: {},
          specialRules: {}
        };
      }
    },
    attendanceSession: {
      async count() {
        return 0;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/schedules`,
    payload: {
      items: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          code: "morning",
          name: "早读",
          startTime: "07:00",
          endTime: "07:30",
          lateTime: "07:10",
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance schedules unchanged");
  await app.close();
});

test("POST /attendance/sessions creates session and seeds daily participant students", async () => {
  const sessionCreates: any[] = [];
  const recordCreateMany: any[] = [];
  const auditCreates: any[] = [];
  let capturedStudentWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findFirst() {
        return {
          id: SESSION_ID,
          code: "morning",
          name: "早读",
          startTime: new Date("1970-01-01T07:30:00.000Z"),
          endTime: new Date("1970-01-01T08:00:00.000Z"),
          lateTime: new Date("1970-01-01T07:40:00.000Z")
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return null;
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            studentStatusOptions: [
              {
                value: "active",
                label: "在读",
                participatesInDailyFlow: false
              },
              {
                value: "observer",
                label: "值日",
                participatesInDailyFlow: true
              }
            ]
          }
        };
      }
    },
    student: {
      async findMany(input: any) {
        capturedStudentWhere = input.where;
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            legacyId: 2
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceSession: {
          async create(input: any) {
            sessionCreates.push(input);
            return {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open"
            };
          }
        },
        attendanceRecord: {
          async createMany(input: any) {
            recordCreateMany.push(input);
            return {
              count: 2
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-10",
      sessionCode: "morning",
      initialStatus: "present"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sessionCreates.length, 1);
  assert.equal(recordCreateMany.length, 1);
  assert.equal(recordCreateMany[0].data.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.session.create");
  assert.deepEqual(capturedStudentWhere.status.in, ["observer"]);
  assert.equal(response.json().seeded.studentCount, 2);
  await app.close();
});

test("POST /attendance/sessions creates empty session when daily participant seeding is disabled", async () => {
  const sessionCreates: any[] = [];
  const recordCreateMany: any[] = [];
  let studentFindManyCalled = false;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findFirst() {
        return {
          id: SESSION_ID,
          code: "morning",
          name: "早读",
          startTime: new Date("1970-01-01T07:30:00.000Z"),
          endTime: new Date("1970-01-01T08:00:00.000Z"),
          lateTime: new Date("1970-01-01T07:40:00.000Z")
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return null;
      }
    },
    student: {
      async findMany() {
        studentFindManyCalled = true;
        return [];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceSession: {
          async create(input: any) {
            sessionCreates.push(input);
            return {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open"
            };
          }
        },
        attendanceRecord: {
          async createMany(input: any) {
            recordCreateMany.push(input);
            return {
              count: 0
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-10",
      sessionCode: "morning",
      initialStatus: "absent",
      seedDailyParticipantStudents: false
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sessionCreates.length, 1);
  assert.equal(studentFindManyCalled, false);
  assert.equal(recordCreateMany.length, 0);
  assert.equal(response.json().seeded.studentCount, 0);
  await app.close();
});

test("POST /attendance/sessions accepts legacy seedAllActiveStudents alias", async () => {
  let studentFindManyCalled = false;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findFirst() {
        return {
          id: SESSION_ID,
          code: "morning",
          name: "早读",
          startTime: new Date("1970-01-01T07:30:00.000Z"),
          endTime: new Date("1970-01-01T08:00:00.000Z"),
          lateTime: new Date("1970-01-01T07:40:00.000Z")
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return null;
      }
    },
    student: {
      async findMany() {
        studentFindManyCalled = true;
        return [];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceSession: {
          async create() {
            return {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-10T00:00:00.000Z"),
              sessionCode: "morning",
              status: "open"
            };
          }
        },
        attendanceRecord: {
          async createMany() {
            return {
              count: 0
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-10",
      sessionCode: "morning",
      initialStatus: "absent",
      seedAllActiveStudents: false
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(studentFindManyCalled, false);
  assert.equal(response.json().seeded.studentCount, 0);
  await app.close();
});

test("POST /attendance/sessions uses sunday special late time when configured", async () => {
  const sessionCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findFirst() {
        return {
          id: "schedule-evening",
          code: "evening",
          name: "晚自习",
          startTime: new Date("1970-01-01T18:30:00.000Z"),
          endTime: new Date("1970-01-01T21:00:00.000Z"),
          lateTime: new Date("1970-01-01T18:40:00.000Z")
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return null;
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          specialRules: {
            sundaySpecialLateTime: {
              evening: "19:00"
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceSession: {
          async create(input: any) {
            sessionCreates.push(input);
            return {
              id: SESSION_ID,
              sessionDate: new Date("2026-03-15T00:00:00.000Z"),
              sessionCode: "evening",
              status: "open"
            };
          }
        },
        attendanceRecord: {
          async createMany() {
            return {
              count: 0
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-15",
      sessionCode: "evening",
      initialStatus: "present",
      seedDailyParticipantStudents: false
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sessionCreates.length, 1);
  assert.equal(sessionCreates[0].data.lateDeadlineAt.toISOString(), "2026-03-15T19:00:00.000Z");
  await app.close();
});

test("POST /attendance/sessions rejects duplicate session", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSchedule: {
      async findFirst() {
        return {
          id: SESSION_ID,
          code: "morning",
          name: "早读",
          startTime: new Date("1970-01-01T07:30:00.000Z"),
          endTime: new Date("1970-01-01T08:00:00.000Z"),
          lateTime: new Date("1970-01-01T07:40:00.000Z")
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-10",
      sessionCode: "morning",
      initialStatus: "present"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Attendance session already exists");
  await app.close();
});

test("POST /attendance/sessions rejects writes when class is frozen", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: true
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions`,
    payload: {
      sessionDate: "2026-03-10",
      sessionCode: "morning",
      initialStatus: "present"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records creates missing attendance record", async () => {
  const recordCreates: any[] = [];
  const auditCreates: any[] = [];
  let capturedStudentWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            studentStatusOptions: [
              {
                value: "active",
                label: "在读",
                participatesInDailyFlow: false
              },
              {
                value: "observer",
                label: "值日",
                participatesInDailyFlow: true
              }
            ]
          }
        };
      }
    },
    student: {
      async findFirst(input: any) {
        capturedStudentWhere = input.where;
        return {
          id: STUDENT_ID,
          name: "张三",
          legacyId: 1
        };
      }
    },
    attendanceRecord: {
      async findFirst() {
        return null;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async create(input: any) {
            recordCreates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: new Date("2026-03-10T07:30:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_insert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records`,
    payload: {
      studentId: STUDENT_ID,
      status: "present"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordCreates.length, 1);
  assert.equal(recordCreates[0].data.source, "manual_insert");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.create");
  assert.deepEqual(capturedStudentWhere.status.in, ["observer"]);
  assert.equal(response.json().record.status, "present");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records allows non-daily participant student with imported check-in time", async () => {
  const recordCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "张三",
          legacyId: 1,
          status: "archived"
        };
      }
    },
    attendanceRecord: {
      async findFirst() {
        return null;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async create(input: any) {
            recordCreates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "late",
              note: null,
              checkInAt: new Date("2026-03-10T07:45:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_insert"
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records`,
    payload: {
      studentId: STUDENT_ID,
      status: "late",
      checkInAt: "2026-03-10T07:45:00.000Z",
      allowNonDailyParticipant: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordCreates.length, 1);
  assert.equal(recordCreates[0].data.checkInAt.toISOString(), "2026-03-10T07:45:00.000Z");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records accepts legacy allowInactiveStudent alias", async () => {
  const recordCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "张三",
          legacyId: 1,
          status: "archived"
        };
      }
    },
    attendanceRecord: {
      async findFirst() {
        return null;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async create(input: any) {
            recordCreates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "late",
              note: null,
              checkInAt: new Date("2026-03-10T07:45:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_insert"
            };
          }
        },
        auditLog: {
          async create() {}
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records`,
    payload: {
      studentId: STUDENT_ID,
      status: "late",
      checkInAt: "2026-03-10T07:45:00.000Z",
      allowInactiveStudent: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordCreates.length, 1);
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records rejects duplicate attendance record", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "张三",
          legacyId: 1
        };
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records`,
    payload: {
      studentId: STUDENT_ID,
      status: "present"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Attendance record already exists");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-create creates missing attendance records", async () => {
  const recordCreates: any[] = [];
  const auditCreates: any[] = [];
  let capturedStudentWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            studentStatusOptions: [
              {
                value: "active",
                label: "在读",
                participatesInDailyFlow: false
              },
              {
                value: "observer",
                label: "值日",
                participatesInDailyFlow: true
              }
            ]
          }
        };
      }
    },
    student: {
      async findMany(input: any) {
        capturedStudentWhere = input.where;
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            legacyId: 2
          }
        ];
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            studentId: STUDENT_ID_2
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async create(input: any) {
            recordCreates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: new Date("2026-03-10T07:30:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_batch_insert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-create`,
    payload: {
      studentIds: [STUDENT_ID, STUDENT_ID_2],
      status: "present"
    }
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(recordCreates.length, 1);
  assert.equal(recordCreates[0].data.source, "manual_batch_insert");
  assert.ok(recordCreates[0].data.batchId);
  assert.equal(recordCreates[0].data.batchId, body.batchId);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_create");
  assert.equal(auditCreates[0].data.metadata.batchId, body.batchId);
  assert.deepEqual(capturedStudentWhere.status.in, ["observer"]);
  assert.equal(body.createdCount, 1);
  assert.equal(body.skippedCount, 1);
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-create rejects when no students are missing", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          }
        ];
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            studentId: STUDENT_ID
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-create`,
    payload: {
      studentIds: [STUDENT_ID],
      status: "present"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance batch create has no missing students");
  await app.close();
});

test("GET /attendance/sessions/:sessionId/records/batch returns batch history", async () => {
  let capturedWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active"
        };
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID
        };
      }
    },
    attendanceRecord: {
      async groupBy(input: any) {
        capturedWhere = input.where;
        return [
          {
            batchId: "batch-1",
            source: "manual_batch_insert",
            status: "present",
            actorUserId: USER_ID,
            _count: {
              _all: 2
            },
            _max: {
              recordedAt: new Date("2026-03-10T08:10:00.000Z")
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch?limit=5`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedWhere.classId, CLASS_ID);
  assert.equal(capturedWhere.attendanceSessionId, SESSION_ID);
  assert.equal(response.json().items[0].operation, "batch_create");
  assert.equal(response.json().items[0].count, 2);
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch/:batchId/revert reverts batch updates by batchId", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];
  const batchId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: null,
            source: "manual_batch_update",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-1",
            targetId: RECORD_ID,
            beforeData: { status: "absent" },
            afterData: { status: "present" }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:30:00.000Z"),
              source: "manual_batch_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch/${batchId}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(recordUpdates[0].data.source, "manual_batch_revert");
  assert.equal(recordUpdates[0].data.batchId, null);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.metadata.revertedBatchId, batchId);
  assert.equal(response.json().operation, "batch_update");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch/:batchId/revert deletes batch-created records by batchId", async () => {
  const recordDeletes: any[] = [];
  const auditCreates: any[] = [];
  const batchId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: null,
            source: "manual_batch_insert",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      },
      async delete(input: any) {
        recordDeletes.push(input);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async delete(input: any) {
            recordDeletes.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch/${batchId}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordDeletes.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.metadata.revertedBatchId, batchId);
  assert.equal(response.json().operation, "batch_create");
  await app.close();
});

test("GET /attendance/audits returns filtered attendance audit items", async () => {
  let capturedWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return {
          id: MEMBERSHIP_ID,
          status: "active"
        };
      }
    },
    auditLog: {
      async findMany(input: any) {
        capturedWhere = input.where;
        return [
          {
            id: RECORD_ID,
            action: "attendance.record.update",
            targetType: "attendance_record",
            targetId: RECORD_ID,
            beforeData: { status: "absent" },
            afterData: { status: "present" },
            metadata: { attendanceSessionId: SESSION_ID },
            createdAt: new Date("2026-03-10T08:00:00.000Z"),
            actorUser: {
              id: USER_ID,
              username: "14ban",
              displayName: "14班"
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/attendance/audits?sessionId=${SESSION_ID}&limit=10`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedWhere.classId, CLASS_ID);
  assert.equal(capturedWhere.OR[0].targetType, "attendance_session");
  assert.equal(capturedWhere.OR[0].targetId, SESSION_ID);
  assert.equal(capturedWhere.OR[1].metadata.path[0], "attendanceSessionId");
  assert.equal(capturedWhere.OR[1].metadata.equals, SESSION_ID);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].action, "attendance.record.update");
  await app.close();
});

test("PUT /attendance/records rejects member without attendance write permission", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_member_readonly"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "late"
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Attendance record permission denied");
  await app.close();
});

test("PUT /attendance/records rejects unchanged status", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "late",
          note: null,
          checkInAt: new Date("2026-03-10T00:05:00.000Z"),
          source: "legacy_import",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "late"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance record status unchanged");
  await app.close();
});

test("POST /attendance/records/:recordId/revert-latest reverts latest single update", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "present",
          note: null,
          checkInAt: null,
          source: "manual_update",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    auditLog: {
      async findFirst() {
        return {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          beforeData: { status: "absent" },
          afterData: { status: "present" }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}/revert-latest`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(recordUpdates[0].data.status, "absent");
  assert.equal(recordUpdates[0].data.source, "manual_revert");
  assert.equal(recordUpdates[0].data.batchId, null);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.revert");
  await app.close();
});

test("POST /attendance/records/:recordId/revert-latest recreates settlement when previous state was settled", async () => {
  const transactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "present",
          note: null,
          checkInAt: null,
          source: "manual_update",
          pointTransactionId: null,
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1,
            account: {
              id: "account-1"
            }
          },
          session: {
            id: SESSION_ID,
            plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    auditLog: {
      async findFirst() {
        return {
          id: "audit-1",
          beforeData: {
            status: "absent",
            pointTransactionId: "transaction-old-1",
            pointTransactionSourceModule: "attendance_issue_settlement"
          },
          afterData: {
            status: "present",
            pointTransactionId: null
          }
        };
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          latePenaltyValue: -1,
          absentPenaltyValue: -5
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: "transaction-new-1"
            };
          }
        },
        pointAccount: {
          async findUnique() {
            return {
              id: "account-1",
              totalPoints: 100,
              balancePoints: 95,
              penaltyPoints: 5
            };
          },
          async update(input: any) {
            pointAccountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:25:00.000Z"),
              source: "manual_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}/revert-latest`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_issue_settlement");
  assert.equal(transactionCreates[0].data.transactionType, "penalty");
  assert.equal(transactionCreates[0].data.value, -5);
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(recordUpdates[0].data.pointTransactionId, "transaction-new-1");
  assert.equal(auditCreates[0].data.afterData.pointTransactionId, "transaction-new-1");
  await app.close();
});

test("POST /attendance/records/:recordId/revert-latest rejects when no revertible update exists", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "present",
          note: null,
          checkInAt: null,
          source: "manual_update",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    auditLog: {
      async findFirst() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}/revert-latest`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance record has no revertible update");
  await app.close();
});

test("POST /attendance/audits/:auditId/revert reverts selected single-update audit", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];
  const AUDIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "present",
          note: null,
          checkInAt: null,
          source: "manual_update",
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1
          },
          session: {
            id: SESSION_ID,
            plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    auditLog: {
      async findFirst(input?: any) {
        if (input?.where?.id === AUDIT_ID) {
          return {
            id: AUDIT_ID,
            action: "attendance.record.update",
            targetId: RECORD_ID,
            metadata: {
              attendanceSessionId: SESSION_ID
            }
          };
        }

        return {
          id: AUDIT_ID,
          beforeData: { status: "absent" },
          afterData: { status: "present" }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.revert");
  await app.close();
});

test("PUT /attendance/sessions/:sessionId/records/batch-status updates selected records and writes audits", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "absent",
            note: null,
            checkInAt: null,
            source: "legacy_import",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          },
          {
            id: RECORD_ID_2,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID_2,
            status: "late",
            note: null,
            checkInAt: new Date("2026-03-10T00:03:00.000Z"),
            source: "legacy_import",
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              legacyId: 2
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: input.where.id,
              attendanceSessionId: SESSION_ID,
              status: "present",
              note: null,
              checkInAt: input.where.id === RECORD_ID ? null : new Date("2026-03-10T00:03:00.000Z"),
              recordedAt: new Date("2026-03-10T08:00:00.000Z"),
              source: "manual_batch_update"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-status`,
    payload: {
      recordIds: [RECORD_ID, RECORD_ID_2],
      status: "present"
    }
  });

  const body = response.json();
  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 2);
  assert.ok(recordUpdates[0].data.batchId);
  assert.equal(recordUpdates[0].data.batchId, body.batchId);
  assert.equal(auditCreates.length, 2);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_update");
  assert.equal(auditCreates[0].data.metadata.batchId, body.batchId);
  assert.equal(body.updatedCount, 2);
  assert.equal(body.skippedCount, 0);
  await app.close();
});

test("PUT /attendance/sessions/:sessionId/records/batch-status rejects unchanged batch", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: null,
            source: "legacy_import",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-status`,
    payload: {
      recordIds: [RECORD_ID],
      status: "present"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance batch status unchanged");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-revert-latest reverts latest batch update", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_update",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-1",
            targetId: RECORD_ID,
            beforeData: { status: "absent" },
            afterData: { status: "present" }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:30:00.000Z"),
              source: "manual_batch_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-revert-latest`,
    payload: {
      recordIds: [RECORD_ID]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(recordUpdates[0].data.source, "manual_batch_revert");
  assert.equal(recordUpdates[0].data.batchId, null);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_revert");
  assert.equal(response.json().revertedCount, 1);
  assert.equal(response.json().skippedCount, 0);
  await app.close();
});

test("POST /attendance/audits/:auditId/revert reverts selected batch-update audit", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];
  const AUDIT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_update",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findFirst(input?: any) {
        if (input?.where?.id === AUDIT_ID) {
          return {
            id: AUDIT_ID,
            action: "attendance.record.batch_update",
            targetId: RECORD_ID,
            metadata: {
              attendanceSessionId: SESSION_ID
            }
          };
        }
        return null;
      },
      async findMany() {
        return [
          {
            id: AUDIT_ID,
            targetId: RECORD_ID,
            beforeData: { status: "absent" },
            afterData: { status: "present" }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "absent",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:30:00.000Z"),
              source: "manual_batch_revert"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_revert");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-revert-latest rejects when no revertible records exist", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          plannedStartAt: new Date("2026-03-10T07:30:00.000Z"),
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_update",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-1",
            targetId: RECORD_ID,
            beforeData: { status: "absent" },
            afterData: { status: "late" }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-revert-latest`,
    payload: {
      recordIds: [RECORD_ID]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance batch revert has no revertible records");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-revert-create-latest deletes latest batch-created records", async () => {
  const deletedRecordIds: string[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_insert",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-create-1",
            action: "attendance.record.batch_create",
            targetId: RECORD_ID
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async delete(input: any) {
            deletedRecordIds.push(input.where.id);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-revert-create-latest`,
    payload: {
      recordIds: [RECORD_ID]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(deletedRecordIds, [RECORD_ID]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_create_revert");
  assert.equal(response.json().revertedCount, 1);
  assert.equal(response.json().skippedCount, 0);
  await app.close();
});

test("POST /attendance/audits/:auditId/revert reverts selected batch-create audit", async () => {
  const deletedRecordIds: string[] = [];
  const auditCreates: any[] = [];
  const AUDIT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_insert",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findFirst(input?: any) {
        if (input?.where?.id === AUDIT_ID) {
          return {
            id: AUDIT_ID,
            action: "attendance.record.batch_create",
            targetId: RECORD_ID,
            metadata: {
              attendanceSessionId: SESSION_ID
            }
          };
        }
        return null;
      },
      async findMany() {
        return [
          {
            id: AUDIT_ID,
            action: "attendance.record.batch_create",
            targetId: RECORD_ID
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async delete(input: any) {
            deletedRecordIds.push(input.where.id);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(deletedRecordIds, [RECORD_ID]);
  assert.equal(auditCreates[0].data.action, "attendance.record.batch_create_revert");
  await app.close();
});

test("POST /attendance/audits/:auditId/revert rejects non-revertible audit action", async () => {
  const AUDIT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    auditLog: {
      async findFirst() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Attendance audit not found");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/records/batch-revert-create-latest rejects when no revertible create records exist", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            attendanceSessionId: SESSION_ID,
            studentId: STUDENT_ID,
            status: "present",
            note: null,
            checkInAt: new Date("2026-03-10T07:30:00.000Z"),
            source: "manual_batch_insert",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1
            }
          }
        ];
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-update-1",
            action: "attendance.record.batch_update",
            targetId: RECORD_ID
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/records/batch-revert-create-latest`,
    payload: {
      recordIds: [RECORD_ID]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Attendance batch create revert has no revertible records");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/settle closes session and creates point transactions", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
  const recordUpdates: any[] = [];
  const sessionUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          status: "open",
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendancePolicy: {
      async findUnique() {
        return {
          latePenaltyValue: -1,
          absentPenaltyValue: -5
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            studentId: STUDENT_ID,
            status: "late",
            pointTransactionId: null,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 100,
                balancePoints: 80,
                penaltyPoints: 20,
                version: 1
              }
            }
          },
          {
            id: RECORD_ID_2,
            studentId: STUDENT_ID_2,
            status: "present",
            pointTransactionId: null,
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              account: {
                id: "account-2",
                totalPoints: 90,
                balancePoints: 70,
                penaltyPoints: 20,
                version: 1
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: "point-tx-1",
              value: input.data.value
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
          }
        },
        attendanceSession: {
          async update(input: any) {
            sessionUpdates.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/settle`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().settledCount, 1);
  assert.equal(response.json().skippedCount, 1);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_settlement");
  assert.equal(accountUpdates.length, 1);
  assert.equal(recordUpdates.length, 1);
  assert.equal(sessionUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.session.settle");
  await app.close();
});

test("POST /attendance/sessions/:sessionId/revert-latest-settlement reopens session and reverts point transactions", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const accountUpdates: any[] = [];
  const recordUpdates: any[] = [];
  const sessionUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findFirst() {
        return {
          id: SESSION_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          status: "closed",
          schedule: {
            name: "早读"
          }
        };
      }
    },
    auditLog: {
      async findFirst() {
        return {
          id: "audit-settle-1",
          action: "attendance.session.settle"
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            studentId: STUDENT_ID,
            pointTransactionId: "point-tx-1",
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 99,
                balancePoints: 79,
                penaltyPoints: 21,
                version: 2
              }
            }
          }
        ];
      }
    },
    pointTransaction: {
      async findMany() {
        return [
          {
            id: "point-tx-1",
            studentId: STUDENT_ID,
            pointAccountId: "account-1",
            transactionType: "penalty",
            value: -1,
            reason: "考勤迟到: 2026-03-10 早读",
            scene: "班级",
            category: "出勤",
            sourceModule: "attendance_settlement",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 99,
                balancePoints: 79,
                penaltyPoints: 21,
                version: 2
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: "point-tx-revert-1"
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
          }
        },
        attendanceRecord: {
          async updateMany(input: any) {
            recordUpdates.push(input);
          }
        },
        attendanceSession: {
          async update(input: any) {
            sessionUpdates.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/attendance/sessions/${SESSION_ID}/revert-latest-settlement`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().revertedCount, 1);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "attendance_settlement_revert");
  assert.equal(transactionUpdates.length, 1);
  assert.equal(accountUpdates.length, 1);
  assert.equal(recordUpdates.length, 1);
  assert.equal(sessionUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "attendance.session.settle_revert");
  await app.close();
});

test("GET /attendance/sessions/:sessionId keeps excused separate from absent in summary", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "legacy-demo"
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceSession: {
      async findUnique() {
        return {
          id: SESSION_ID,
          classId: CLASS_ID,
          sessionDate: new Date("2026-03-10T00:00:00.000Z"),
          sessionCode: "morning",
          status: "closed",
          schedule: {
            name: "早读"
          }
        };
      }
    },
    attendanceRecord: {
      async findMany() {
        return [
          {
            id: RECORD_ID,
            status: "excused",
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:00:00.000Z"),
            note: "病假",
            source: "legacy_import",
            legacyStudentName: "张三",
            student: {
              id: STUDENT_ID,
              name: "张三",
              legacyId: 1,
              sortOrder: 1
            }
          },
          {
            id: RECORD_ID_2,
            status: "absent",
            checkInAt: null,
            recordedAt: new Date("2026-03-10T08:02:00.000Z"),
            note: null,
            source: "legacy_import",
            legacyStudentName: "李四",
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              legacyId: 2,
              sortOrder: 2
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/attendance/sessions/${SESSION_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().summary, {
    total: 2,
    present: 0,
    late: 0,
    absent: 1,
    excused: 1
  });
  assert.equal(response.json().items[0].status, "excused");
  await app.close();
});

test("PUT /attendance/records accepts excused status and clears check-in time", async () => {
  const recordUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    attendanceRecord: {
      async findFirst() {
        return {
          id: RECORD_ID,
          attendanceSessionId: SESSION_ID,
          studentId: STUDENT_ID,
          status: "late",
          note: null,
          checkInAt: new Date("2026-03-10T08:03:00.000Z"),
          source: "legacy_import",
          pointTransactionId: null,
          student: {
            id: STUDENT_ID,
            name: "张三",
            legacyId: 1,
            account: {
              id: "account-1"
            }
          },
          session: {
            id: SESSION_ID,
            sessionDate: new Date("2026-03-10T00:00:00.000Z"),
            schedule: {
              name: "早读"
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        attendanceRecord: {
          async update(input: any) {
            recordUpdates.push(input);
            return {
              id: RECORD_ID,
              attendanceSessionId: SESSION_ID,
              status: "excused",
              note: null,
              checkInAt: null,
              recordedAt: new Date("2026-03-10T08:05:00.000Z"),
              source: "manual_update"
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/attendance/records/${RECORD_ID}`,
    payload: {
      status: "excused"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(recordUpdates.length, 1);
  assert.equal(recordUpdates[0].data.status, "excused");
  assert.equal(recordUpdates[0].data.checkInAt, null);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.afterData.status, "excused");
  assert.equal(response.json().record.status, "excused");
  await app.close();
});
