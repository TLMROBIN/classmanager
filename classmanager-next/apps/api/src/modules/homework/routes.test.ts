import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { homeworkRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "55555555-5555-4555-8555-555555555555";
const ACCOUNT_ID = "66666666-6666-4666-8666-666666666666";
const HOMEWORK_TRANSACTION_ID = "77777777-7777-4777-8777-777777777777";
const HOMEWORK_REVERT_TRANSACTION_ID = "88888888-8888-4888-8888-888888888888";
const STUDENT_ID_2 = "99999999-9999-4999-8999-999999999999";
const ACCOUNT_ID_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

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
  await app.register(homeworkRoutes, { prefix: "/api" });
  return app;
}

test("POST /homework/records creates missing homework record and audit log", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
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
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          name: "张三",
          account: {
            id: ACCOUNT_ID,
            totalPoints: 10,
            balancePoints: 8,
            penaltyPoints: 2,
            version: 1
          }
        };
      }
    },
    pointTransaction: {
      async findFirst() {
        return null;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: HOMEWORK_TRANSACTION_ID
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: ACCOUNT_ID,
              totalPoints: 8,
              balancePoints: 6,
              penaltyPoints: 4,
              version: 2
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
    url: `/api/classes/${CLASS_ID}/homework/records`,
    payload: {
      studentId: STUDENT_ID,
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.reason, "语文作业未交 2026-03-10");
  assert.equal(transactionCreates[0].data.transactionType, "penalty");
  assert.equal(transactionCreates[0].data.value, -2);
  assert.equal(accountUpdates.length, 1);
  assert.deepEqual(accountUpdates[0].data, {
    totalPoints: 8,
    balancePoints: 6,
    penaltyPoints: 4,
    version: {
      increment: 1
    }
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "homework.record.create");
  await app.close();
});

test("POST /homework/records rejects duplicate homework record", async () => {
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
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          name: "张三",
          account: {
            id: ACCOUNT_ID,
            totalPoints: 10,
            balancePoints: 8,
            penaltyPoints: 2,
            version: 1
          }
        };
      }
    },
    pointTransaction: {
      async findFirst() {
        return {
          id: "existing-tx"
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/homework/records`,
    payload: {
      studentId: STUDENT_ID,
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Homework record already exists");
  await app.close();
});

test("POST /homework/records rejects member without points permission", async () => {
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
    method: "POST",
    url: `/api/classes/${CLASS_ID}/homework/records`,
    payload: {
      studentId: STUDENT_ID,
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "register",
      value: 1
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Homework record permission denied");
  await app.close();
});

test("POST /homework/records rejects writes when class is frozen", async () => {
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
    url: `/api/classes/${CLASS_ID}/homework/records`,
    payload: {
      studentId: STUDENT_ID,
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /homework/records/batch creates homework records for multiple students", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
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
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            }
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            account: {
              id: ACCOUNT_ID_2,
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
            }
          }
        ];
      }
    },
    pointTransaction: {
      async findMany() {
        return [];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: `tx-${transactionCreates.length}`
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.data.penaltyPoints,
              version: 2
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch`,
    payload: {
      studentIds: [STUDENT_ID, STUDENT_ID_2],
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.equal(transactionCreates[0].data.reason, "语文作业未交 2026-03-10");
  assert.ok(transactionCreates[0].data.batchId);
  assert.equal(transactionCreates[0].data.batchId, transactionCreates[1].data.batchId);
  assert.equal(accountUpdates.length, 2);
  assert.equal(auditCreates.length, 2);
  assert.equal(auditCreates[0].data.action, "homework.record.batch_create");
  assert.equal(response.json().createdCount, 2);
  assert.equal(response.json().skippedCount, 0);
  await app.close();
});

test("POST /homework/records/batch also rewards configured representatives", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
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
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            }
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            account: {
              id: ACCOUNT_ID_2,
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
            }
          }
        ];
      }
    },
    pointTransaction: {
      async findMany(input: any) {
        if (input?.where?.reason === "语文作业未交 2026-03-10") {
          return [];
        }
        if (input?.where?.reason === "语文作业登记 2026-03-10") {
          return [];
        }
        return [];
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            subjects: [
              {
                id: "chinese",
                name: "语文",
                representativeStudentIds: [STUDENT_ID_2]
              }
            ]
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: `tx-${transactionCreates.length}`
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.where.id === ACCOUNT_ID ? 4 : 0,
              version: 2
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch`,
    payload: {
      studentIds: [STUDENT_ID],
      representativeStudentIds: [STUDENT_ID_2],
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.deepEqual(
    transactionCreates.map((item) => [item.data.reason, item.data.transactionType, item.data.value]),
    [
      ["语文作业未交 2026-03-10", "penalty", -2],
      ["语文作业登记 2026-03-10", "reward", 1]
    ]
  );
  assert.equal(accountUpdates.length, 2);
  assert.equal(auditCreates.length, 2);
  assert.equal(response.json().createdCount, 2);
  assert.equal(response.json().representativeRequestedCount, 1);
  assert.equal(response.json().representativeCreatedCount, 1);
  await app.close();
});

test("POST /homework/records/batch rejects empty targets", async () => {
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
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/homework/records/batch`,
    payload: {
      studentIds: [],
      representativeStudentIds: [],
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Homework batch targets required");
  await app.close();
});

test("POST /homework/records/batch rejects duplicate batch", async () => {
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
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            }
          }
        ];
      }
    },
    pointTransaction: {
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch`,
    payload: {
      studentIds: [STUDENT_ID],
      subjectName: "语文",
      homeworkDate: "2026-03-10",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Homework batch already exists");
  await app.close();
});

test("POST /homework/records/batch-revert reverts recent batch homework records", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const accountUpdates: any[] = [];
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
    pointTransaction: {
      async findMany() {
        return [
          {
            id: HOMEWORK_TRANSACTION_ID,
            studentId: STUDENT_ID,
            pointAccountId: ACCOUNT_ID,
            transactionType: "penalty",
            value: -2,
            reason: "语文作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
            sourceModule: "homework_record",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: ACCOUNT_ID,
                totalPoints: 8,
                balancePoints: 6,
                penaltyPoints: 4,
                version: 2
              }
            }
          },
          {
            id: "12121212-1212-4121-8121-121212121212",
            studentId: STUDENT_ID_2,
            pointAccountId: ACCOUNT_ID_2,
            transactionType: "reward",
            value: 1,
            reason: "语文作业登记 2026-03-10",
            scene: "作业",
            category: "登记",
            sourceModule: "homework_record",
            isReverted: false,
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              account: {
                id: ACCOUNT_ID_2,
                totalPoints: 13,
                balancePoints: 13,
                penaltyPoints: 0,
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
              id: `revert-${transactionCreates.length}`,
              ...input.data
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
            return input;
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.data.penaltyPoints,
              version: 3
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch-revert`,
    payload: {
      transactionIds: [HOMEWORK_TRANSACTION_ID, "12121212-1212-4121-8121-121212121212"]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.equal(transactionCreates[0].data.sourceModule, "homework_batch_revert");
  assert.equal(transactionUpdates.length, 2);
  assert.equal(accountUpdates.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "homework.record.batch_revert");
  assert.equal(response.json().revertedCount, 2);
  await app.close();
});

test("GET /homework/records/batch returns recent batches", async () => {
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
    pointTransaction: {
      async groupBy() {
        return [
          {
            batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            _max: { createdAt: new Date("2026-03-10T00:00:00.000Z") }
          }
        ];
      },
      async findMany() {
        return [
          {
            batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            transactionType: "penalty",
            value: -2,
            reason: "数学作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
            occurredAt: new Date("2026-03-10T08:00:00.000Z"),
            createdAt: new Date("2026-03-10T08:00:00.000Z"),
            actorUserId: USER_ID,
            metadata: {
              subjectName: "数学",
              homeworkDate: "2026-03-10",
              eventType: "missing",
              inputValue: 2
            }
          },
          {
            batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            transactionType: "penalty",
            value: -2,
            reason: "数学作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
            occurredAt: new Date("2026-03-10T08:00:00.000Z"),
            createdAt: new Date("2026-03-10T08:01:00.000Z"),
            actorUserId: USER_ID,
            metadata: {
              subjectName: "数学",
              homeworkDate: "2026-03-10",
              eventType: "missing",
              inputValue: 2
            }
          },
          {
            batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            transactionType: "reward",
            value: 1,
            reason: "数学作业登记 2026-03-10",
            scene: "作业",
            category: "登记",
            occurredAt: new Date("2026-03-10T08:00:00.000Z"),
            createdAt: new Date("2026-03-10T08:02:00.000Z"),
            actorUserId: USER_ID,
            metadata: {
              subjectName: "数学",
              homeworkDate: "2026-03-10",
              eventType: "register",
              inputValue: 1,
              autoAwardedRepresentative: true
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/homework/records/batch?limit=5`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].batchId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(response.json().items[0].subjectName, "数学");
  assert.equal(response.json().items[0].homeworkDate, "2026-03-10");
  assert.equal(response.json().items[0].eventType, "missing");
  assert.equal(response.json().items[0].count, 2);
  assert.equal(response.json().items[0].representativeCount, 1);
  assert.equal(response.json().items[0].totalCount, 3);
  await app.close();
});

test("POST /homework/records/batch/:batchId/revert reverts batch by id", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
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
    pointTransaction: {
      async findMany() {
        return [
          {
            id: HOMEWORK_TRANSACTION_ID,
            studentId: STUDENT_ID,
            pointAccountId: ACCOUNT_ID,
            transactionType: "penalty",
            value: -2,
            reason: "语文作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
            sourceModule: "homework_record",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: ACCOUNT_ID,
                totalPoints: 8,
                balancePoints: 6,
                penaltyPoints: 4,
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
              id: `tx-${transactionCreates.length}`,
              ...input.data
            };
          },
          async update() {
            return {};
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.data.penaltyPoints,
              version: 3
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "homework_batch_revert");
  assert.equal(accountUpdates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "homework.record.batch_revert");
  assert.equal(response.json().revertedCount, 1);
  await app.close();
});

test("POST /homework/records/batch/:batchId/correct reverts old batch and creates replacement batch", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const accountUpdates: any[] = [];
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
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            }
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            account: {
              id: ACCOUNT_ID_2,
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
            }
          }
        ];
      }
    },
    pointTransaction: {
      async findMany(input?: any) {
        if (input?.where?.batchId === "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa") {
          return [
            {
              id: HOMEWORK_TRANSACTION_ID,
              studentId: STUDENT_ID,
              pointAccountId: ACCOUNT_ID,
              transactionType: "penalty",
              value: -2,
              reason: "语文作业未交 2026-03-10",
              scene: "作业",
              category: "未交",
              sourceModule: "homework_record",
              isReverted: false,
              student: {
                id: STUDENT_ID,
                name: "张三",
                account: {
                  id: ACCOUNT_ID,
                  totalPoints: 8,
                  balancePoints: 6,
                  penaltyPoints: 4,
                  version: 2
                }
              }
            }
          ];
        }
        return [];
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            subjects: [
              {
                id: "chinese",
                name: "语文",
                representativeStudentIds: [STUDENT_ID_2]
              }
            ]
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: `tx-${transactionCreates.length}`,
              ...input.data
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
            return input;
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.data.penaltyPoints ?? 0,
              version: 3
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
    url: `/api/classes/${CLASS_ID}/homework/records/batch/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/correct`,
    payload: {
      studentIds: [STUDENT_ID],
      representativeStudentIds: [STUDENT_ID_2],
      subjectName: "语文",
      homeworkDate: "2026-03-11",
      eventType: "missing",
      value: 2
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().revertedCount, 1);
  assert.equal(response.json().createdCount, 2);
  assert.equal(transactionCreates[0].data.sourceModule, "homework_batch_revert");
  assert.equal(transactionCreates[1].data.sourceModule, "homework_record");
  assert.equal(transactionCreates[2].data.sourceModule, "homework_record");
  assert.equal(transactionUpdates.length, 1);
  assert.equal(accountUpdates.length, 3);
  assert.equal(auditCreates.length, 3);
  assert.equal(auditCreates[0].data.action, "homework.record.batch_revert");
  assert.equal(auditCreates[1].data.action, "homework.record.batch_create");
  await app.close();
});

test("POST /homework/records/:transactionId/revert reverts homework record and writes audit log", async () => {
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const accountUpdates: any[] = [];
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
    pointTransaction: {
      async findFirst() {
        return {
          id: HOMEWORK_TRANSACTION_ID,
          studentId: STUDENT_ID,
          pointAccountId: ACCOUNT_ID,
          transactionType: "penalty",
          value: -2,
          reason: "语文作业未交 2026-03-10",
          scene: "作业",
          category: "未交",
          sourceModule: "homework_record",
          isReverted: false,
          student: {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 8,
              balancePoints: 6,
              penaltyPoints: 4,
              version: 2
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: HOMEWORK_REVERT_TRANSACTION_ID
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 3
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
    url: `/api/classes/${CLASS_ID}/homework/records/${HOMEWORK_TRANSACTION_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "homework_record_revert");
  assert.equal(transactionCreates[0].data.value, 2);
  assert.equal(transactionUpdates.length, 1);
  assert.deepEqual(transactionUpdates[0].data, {
    isReverted: true,
    revertedByTransactionId: HOMEWORK_REVERT_TRANSACTION_ID
  });
  assert.equal(accountUpdates.length, 1);
  assert.equal(accountUpdates[0].data.penaltyPoints, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "homework.record.revert");
  await app.close();
});

test("POST /homework/records/:transactionId/revert rejects non-homework transaction", async () => {
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
    pointTransaction: {
      async findFirst() {
        return {
          id: HOMEWORK_TRANSACTION_ID,
          studentId: STUDENT_ID,
          pointAccountId: ACCOUNT_ID,
          transactionType: "bonus",
          value: 1,
          reason: "课堂表现",
          scene: "课堂",
          category: "表现",
          sourceModule: "manual_adjustment",
          isReverted: false,
          student: {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 8,
              balancePoints: 6,
              penaltyPoints: 4,
              version: 2
            }
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/homework/records/${HOMEWORK_TRANSACTION_ID}/revert`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Only homework records can be reverted");
  await app.close();
});

test("POST /homework/audits/:auditId/revert reverts homework record by audit id", async () => {
  const AUDIT_ID = "12121212-1212-4212-8212-121212121212";
  const transactionCreates: any[] = [];
  const transactionUpdates: any[] = [];
  const accountUpdates: any[] = [];
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
    auditLog: {
      async findFirst(input?: any) {
        if (input?.where?.id === AUDIT_ID) {
          return {
            id: AUDIT_ID,
            action: "homework.record.create",
            afterData: {
              transactionId: HOMEWORK_TRANSACTION_ID
            }
          };
        }

        return null;
      }
    },
    pointTransaction: {
      async findFirst() {
        return {
          id: HOMEWORK_TRANSACTION_ID,
          studentId: STUDENT_ID,
          pointAccountId: ACCOUNT_ID,
          transactionType: "penalty",
          value: -2,
          reason: "语文作业未交 2026-03-10",
          scene: "作业",
          category: "未交",
          sourceModule: "homework_record",
          isReverted: false,
          student: {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: ACCOUNT_ID,
              totalPoints: 8,
              balancePoints: 6,
              penaltyPoints: 4,
              version: 2
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            transactionCreates.push(input);
            return {
              id: HOMEWORK_REVERT_TRANSACTION_ID
            };
          },
          async update(input: any) {
            transactionUpdates.push(input);
          }
        },
        pointAccount: {
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: ACCOUNT_ID,
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 3
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
    url: `/api/classes/${CLASS_ID}/homework/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionUpdates.length, 1);
  assert.equal(accountUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "homework.record.revert");
  await app.close();
});

test("GET /homework/detail only queries active homework records", async () => {
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
        return createMembership(["tenant_owner"]);
      }
    },
    pointTransaction: {
      async findMany(input: any) {
        capturedWhere = input.where;
        return [
          {
            id: HOMEWORK_TRANSACTION_ID,
            occurredAt: new Date("2026-03-10T08:00:00.000Z"),
            transactionType: "penalty",
            value: -2,
            reason: "语文作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
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
    method: "GET",
    url: `/api/classes/${CLASS_ID}/homework/detail?days=30`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedWhere.classId, CLASS_ID);
  assert.equal(capturedWhere.sourceModule, "homework_record");
  assert.equal(capturedWhere.isReverted, false);
  assert.equal(response.json().totals.events, 1);
  await app.close();
});

test("GET /homework/overview returns recent homework audits", async () => {
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
    pointTransaction: {
      async findMany() {
        return [
          {
            id: HOMEWORK_TRANSACTION_ID,
            occurredAt: new Date("2026-03-10T08:00:00.000Z"),
            transactionType: "penalty",
            value: -2,
            reason: "语文作业未交 2026-03-10",
            scene: "作业",
            category: "未交",
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
            id: "23232323-2323-4232-8232-232323232323",
            action: "homework.record.create",
            afterData: {
              transactionId: HOMEWORK_TRANSACTION_ID,
              subjectName: "语文",
              homeworkDate: "2026-03-10",
              studentName: "张三",
              eventType: "missing"
            },
            metadata: {
              sourceModule: "homework_record"
            },
            createdAt: new Date("2026-03-10T08:00:00.000Z"),
            actorUser: {
              id: USER_ID,
              username: "owner",
              displayName: "班主任"
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/homework/overview?days=14`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().recentAudits.length, 1);
  assert.equal(response.json().recentAudits[0].canRevert, true);
  assert.equal(response.json().recentAudits[0].transactionId, HOMEWORK_TRANSACTION_ID);
  await app.close();
});
