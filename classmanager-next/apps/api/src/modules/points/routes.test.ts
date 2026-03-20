import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { pointRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "55555555-5555-4555-8555-555555555555";
const STUDENT_ID_2 = "66666666-6666-4666-8666-666666666666";
const GROUP_ID = "77777777-7777-4777-8777-777777777777";
const GROUP_ID_2 = "88888888-8888-4888-8888-888888888888";

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
  await app.register(pointRoutes, { prefix: "/api" });
  return app;
}

test("POST /points/accounts/rebuild-from-history recalculates accounts from non-reverted transactions", async () => {
  const accountCreates: any[] = [];
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
              id: "account-1",
              totalPoints: 100,
              balancePoints: 100,
              penaltyPoints: 40,
              version: 1
            }
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            account: null
          }
        ];
      }
    },
    pointTransaction: {
      async findMany() {
        return [
          {
            studentId: STUDENT_ID,
            transactionType: "bonus",
            value: 5
          },
          {
            studentId: STUDENT_ID,
            transactionType: "penalty",
            value: -2
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointAccount: {
          async create(input: any) {
            accountCreates.push(input);
            return {
              id: "account-created",
              ...input.data
            };
          },
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
    url: `/api/classes/${CLASS_ID}/points/accounts/rebuild-from-history`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(accountUpdates.length, 1);
  assert.equal(accountUpdates[0].data.totalPoints, 3);
  assert.equal(accountUpdates[0].data.balancePoints, 3);
  assert.equal(accountUpdates[0].data.penaltyPoints, 2);
  assert.equal(accountCreates.length, 1);
  assert.equal(accountCreates[0].data.studentId, STUDENT_ID_2);
  assert.equal(accountCreates[0].data.totalPoints, 0);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.account.rebuild");
  assert.deepEqual(response.json(), {
    studentCount: 2,
    transactionCount: 2,
    updatedCount: 1,
    createdCount: 1,
    unchangedCount: 0
  });
  await app.close();
});

test("POST /points/accounts/maintenance-import overwrites point accounts and writes audit", async () => {
  const accountCreates: any[] = [];
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
              id: "account-1",
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2
            }
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            account: null
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointAccount: {
          async create(input: any) {
            accountCreates.push(input);
            return {
              id: "account-created",
              ...input.data
            };
          },
          async update(input: any) {
            accountUpdates.push(input);
            return {
              id: input.where.id,
              ...input.data
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
    url: `/api/classes/${CLASS_ID}/points/accounts/maintenance-import`,
    payload: {
      items: [
        {
          studentId: STUDENT_ID,
          totalPoints: 12,
          balancePoints: 11,
          penaltyPoints: 3
        },
        {
          studentId: STUDENT_ID_2,
          totalPoints: 0,
          balancePoints: -2,
          penaltyPoints: 5
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(accountUpdates.length, 1);
  assert.equal(accountUpdates[0].data.totalPoints, 12);
  assert.equal(accountUpdates[0].data.balancePoints, 11);
  assert.equal(accountUpdates[0].data.penaltyPoints, 3);
  assert.equal(accountCreates.length, 1);
  assert.equal(accountCreates[0].data.studentId, STUDENT_ID_2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.account.maintenance_import");
  assert.deepEqual(response.json(), {
    requestedCount: 2,
    importedCount: 2,
    updatedCount: 1,
    createdCount: 1,
    unchangedCount: 0
  });
  await app.close();
});

test("POST /points/accounts/maintenance-import rejects unknown student", async () => {
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
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/accounts/maintenance-import`,
    payload: {
      items: [
        {
          studentId: STUDENT_ID,
          totalPoints: 12,
          balancePoints: 11,
          penaltyPoints: 3
        }
      ]
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Student not found");
  await app.close();
});

test("POST /points/accounts/rebuild-from-history rejects member without points permission", async () => {
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
        return createMembership(["viewer"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/accounts/rebuild-from-history`
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Point adjustment permission denied");
  await app.close();
});

test("POST /points/batch-adjustments creates transactions for multiple students", async () => {
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
              id: "account-1",
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
              id: "account-2",
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
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
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments`,
    payload: {
      studentIds: [STUDENT_ID, STUDENT_ID_2],
      transactionType: "bonus",
      value: 2,
      reason: "批量表扬",
      scene: "班级",
      category: "表现"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment");
  assert.ok(transactionCreates[0].data.batchId);
  assert.equal(transactionCreates[0].data.batchId, transactionCreates[1].data.batchId);
  assert.equal(accountUpdates.length, 2);
  assert.equal(auditCreates.length, 2);
  assert.equal(auditCreates[0].data.action, "point.adjust.batch");
  assert.equal(response.json().adjustedCount, 2);
  await app.close();
});

test("GET /points/batch-adjustments returns recent batches", async () => {
  let groupByArgs: any = null;
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
      async groupBy(input: any) {
        groupByArgs = input;
        return [
          {
            batchId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            transactionType: "bonus",
            value: 2,
            reason: "批量表扬",
            scene: "班级",
            category: "表现",
            occurredAt: new Date("2026-03-10T00:00:00.000Z"),
            actorUserId: USER_ID,
            _count: { _all: 3 },
            _max: { createdAt: new Date("2026-03-10T00:00:00.000Z") }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments?limit=5`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].batchId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(response.json().items[0].count, 3);
  assert.equal(groupByArgs.where.isReverted, false);
  await app.close();
});

test("POST /points/batch-adjustments/:batchId/correct reverts original batch then creates replacement batch", async () => {
  const BATCH_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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
              id: "account-1",
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
              id: "account-2",
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
        return [
          {
            id: "tx-original-1",
            studentId: STUDENT_ID,
            pointAccountId: "account-1",
            transactionType: "bonus",
            value: 2,
            reason: "批量表扬",
            scene: "班级",
            category: "表现",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 10,
                balancePoints: 8,
                penaltyPoints: 2,
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
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments/${BATCH_ID}/correct`,
    payload: {
      studentIds: [STUDENT_ID, STUDENT_ID_2],
      transactionType: "penalty",
      value: 1,
      reason: "批量纠正",
      scene: "班级",
      category: "纪律"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 3);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment_revert");
  assert.equal(transactionCreates[0].data.metadata.revertedBatchId, BATCH_ID);
  assert.equal(transactionCreates[0].data.metadata.correctionBatchId, response.json().batchId);
  assert.equal(transactionCreates[1].data.sourceModule, "manual_batch_adjustment");
  assert.equal(transactionCreates[1].data.metadata.correctedFromBatchId, BATCH_ID);
  assert.equal(transactionCreates[2].data.metadata.correctedFromBatchId, BATCH_ID);
  assert.equal(transactionUpdates.length, 1);
  assert.equal(accountUpdates.length, 3);
  assert.equal(accountUpdates[0].where.id, "account-1");
  assert.equal(accountUpdates[0].data.totalPoints, 8);
  assert.equal(accountUpdates[0].data.balancePoints, 6);
  assert.equal(accountUpdates[1].where.id, "account-1");
  assert.equal(accountUpdates[1].data.totalPoints, 7);
  assert.equal(accountUpdates[1].data.balancePoints, 5);
  assert.equal(accountUpdates[1].data.penaltyPoints, 3);
  assert.equal(accountUpdates[2].where.id, "account-2");
  assert.equal(accountUpdates[2].data.totalPoints, 11);
  assert.equal(accountUpdates[2].data.balancePoints, 11);
  assert.equal(accountUpdates[2].data.penaltyPoints, 1);
  assert.equal(auditCreates.length, 3);
  assert.equal(auditCreates[0].data.action, "point.revert.batch");
  assert.equal(auditCreates[1].data.action, "point.adjust.batch");
  assert.equal(auditCreates[1].data.metadata.correctedFromBatchId, BATCH_ID);
  assert.equal(response.json().revertedCount, 1);
  assert.equal(response.json().adjustedCount, 2);
  await app.close();
});

test("GET /points/audits returns recent point audit items", async () => {
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
      async findMany() {
        return [
          {
            id: "audit-1",
            action: "point.adjust",
            afterData: {
              transactionId: "tx-1",
              studentName: "张三",
              reason: "手工加分",
              value: 2
            },
            metadata: {
              sourceModule: "manual_adjustment"
            },
            createdAt: new Date("2026-03-10T00:00:00.000Z"),
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
    url: `/api/classes/${CLASS_ID}/points/audits?limit=5`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().items.length, 1);
  assert.equal(response.json().items[0].canRevert, true);
  assert.equal(response.json().items[0].transactionId, "tx-1");
  await app.close();
});

test("POST /points/batch-adjustments rejects invalid student batch", async () => {
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
            account: null
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments`,
    payload: {
      studentIds: [STUDENT_ID, STUDENT_ID_2],
      transactionType: "penalty",
      value: 1,
      reason: "批量扣分",
      scene: "班级",
      category: "纪律"
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Student account batch contains invalid items");
  await app.close();
});

test("POST /points/adjustments rejects writes when class is frozen", async () => {
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
    url: `/api/classes/${CLASS_ID}/points/adjustments`,
    payload: {
      studentId: STUDENT_ID,
      transactionType: "bonus",
      value: 1,
      reason: "冻结测试",
      scene: "班级",
      category: "表现"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /points/batch-adjustments/revert reverts batch manual adjustments", async () => {
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
            id: "77777777-7777-4777-8777-777777777777",
            studentId: STUDENT_ID,
            pointAccountId: "account-1",
            transactionType: "bonus",
            value: 2,
            reason: "批量表扬",
            scene: "班级",
            category: "表现",
            sourceModule: "manual_batch_adjustment",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 10,
                balancePoints: 8,
                penaltyPoints: 2,
                version: 1
              }
            }
          },
          {
            id: "88888888-8888-4888-8888-888888888888",
            studentId: STUDENT_ID_2,
            pointAccountId: "account-2",
            transactionType: "penalty",
            value: -1,
            reason: "批量扣分",
            scene: "班级",
            category: "纪律",
            sourceModule: "manual_batch_adjustment",
            isReverted: false,
            student: {
              id: STUDENT_ID_2,
              name: "李四",
              account: {
                id: "account-2",
                totalPoints: 12,
                balancePoints: 12,
                penaltyPoints: 1,
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
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments/revert`,
    payload: {
      transactionIds: ["77777777-7777-4777-8777-777777777777", "88888888-8888-4888-8888-888888888888"]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 2);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment_revert");
  assert.equal(transactionUpdates.length, 2);
  assert.equal(accountUpdates.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.revert.batch");
  assert.equal(response.json().revertedCount, 2);
  await app.close();
});

test("POST /points/batch-adjustments/:batchId/revert reverts batch by id", async () => {
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
            id: "tx-1",
            studentId: STUDENT_ID,
            pointAccountId: "account-1",
            transactionType: "bonus",
            value: 2,
            reason: "批量表扬",
            scene: "班级",
            category: "表现",
            sourceModule: "manual_batch_adjustment",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 10,
                balancePoints: 8,
                penaltyPoints: 2,
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
    url: `/api/classes/${CLASS_ID}/points/batch-adjustments/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment_revert");
  assert.equal(accountUpdates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.revert.batch");
  assert.equal(response.json().revertedCount, 1);
  await app.close();
});

test("POST /points/audits/:auditId/revert reverts manual adjustment by audit id", async () => {
  const AUDIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab";
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
    auditLog: {
      async findFirst(input?: any) {
        if (input?.where?.id === AUDIT_ID) {
          return {
            id: AUDIT_ID,
            action: "point.adjust",
            afterData: {
              transactionId: "tx-1"
            }
          };
        }
        return null;
      }
    },
    pointTransaction: {
      async findFirst() {
        return {
          id: "tx-1",
          studentId: STUDENT_ID,
          pointAccountId: "account-1",
          transactionType: "bonus",
          value: 2,
          reason: "手工加分",
          scene: "班级",
          category: "表现",
          sourceModule: "manual_adjustment",
          isReverted: false,
          student: {
            id: STUDENT_ID,
            name: "张三",
            account: {
              id: "account-1",
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
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
              id: "revert-1",
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
    url: `/api/classes/${CLASS_ID}/points/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_adjustment_revert");
  assert.equal(accountUpdates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.revert");
  await app.close();
});

test("POST /points/audits/:auditId/revert reverts batch adjustment by audit id", async () => {
  const AUDIT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaac";
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
    auditLog: {
      async findFirst() {
        return {
          id: AUDIT_ID,
          action: "point.adjust.batch",
          afterData: {
            transactionId: "tx-1"
          },
          metadata: {
            batchId: "batch-1"
          }
        };
      }
    },
    pointTransaction: {
      async findMany() {
        return [
          {
            id: "tx-1",
            studentId: STUDENT_ID,
            pointAccountId: "account-1",
            transactionType: "bonus",
            value: 2,
            reason: "批量表扬",
            scene: "班级",
            category: "表现",
            sourceModule: "manual_batch_adjustment",
            isReverted: false,
            student: {
              id: STUDENT_ID,
              name: "张三",
              account: {
                id: "account-1",
                totalPoints: 10,
                balancePoints: 8,
                penaltyPoints: 2,
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
              id: "revert-batch-1",
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
    url: `/api/classes/${CLASS_ID}/points/audits/${AUDIT_ID}/revert`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 1);
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment_revert");
  assert.equal(accountUpdates.length, 1);
  assert.equal(auditCreates[0].data.action, "point.revert.batch");
  assert.equal(response.json().revertedCount, 1);
  await app.close();
});

test("POST /points/wages/issue creates wage transactions for group, psychology and student council targets", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
  const auditCreates: any[] = [];
  const classConfigUpdates: any[] = [];

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
          isFrozen: false,
          timezone: "Asia/Shanghai",
          extra: {
            dailyWageAmount: 5,
            dailyWageGroupIds: [GROUP_ID],
            psychologyCommitteeStudentIds: [STUDENT_ID_2],
            studentCouncilRoles: [
              {
                id: "student_council_secretary",
                name: "秘书处",
                studentId: STUDENT_ID_2
              }
            ]
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
            status: "active",
            account: {
              id: "account-1",
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            },
            groups: [
              {
                groupId: GROUP_ID,
                roleCode: "leader",
                isPrimary: true
              }
            ]
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            status: "active",
            account: {
              id: "account-2",
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
            },
            groups: [
              {
                groupId: GROUP_ID,
                roleCode: "member",
                isPrimary: true
              },
              {
                groupId: GROUP_ID_2,
                roleCode: "leader",
                isPrimary: false
              }
            ]
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
              id: `wage-tx-${transactionCreates.length}`,
              ...input.data
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
              penaltyPoints: 0,
              version: 2
            };
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              classId: CLASS_ID,
              extra: input.data.extra
            };
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/wages/issue`,
    payload: {
      occurredAt: "2026-03-18T01:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(transactionCreates.length, 4);
  assert.deepEqual(
    transactionCreates.map((item) => [item.data.reason, item.data.value]),
    [
      ["每日工资", 6],
      ["每日工资", 5],
      ["心理委员津贴", 1],
      ["学生会专员津贴: 秘书处", 2]
    ]
  );
  assert.equal(transactionCreates[0].data.sourceModule, "manual_batch_adjustment");
  assert.equal(transactionCreates[0].data.metadata.sourceModule, "wage_issue");
  assert.equal(accountUpdates.length, 4);
  assert.equal(auditCreates.length, 4);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.lastWageDate, "2026-03-18");
  assert.equal(auditCreates[0].data.action, "point.adjust.batch");
  assert.deepEqual(response.json().summary, {
    dailyWageTargets: 2,
    psychologyCommitteeTargets: 1,
    studentCouncilTargets: 1
  });
  assert.equal(response.json().issuedCount, 4);
  await app.close();
});

test("POST /points/wages/issue falls back to legacy default wage groups when config is missing", async () => {
  const transactionCreates: any[] = [];
  const accountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];

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
          isFrozen: false,
          timezone: "Asia/Shanghai",
          extra: {
            dailyWageAmount: 5,
            psychologyCommitteeStudentIds: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    group: {
      async findMany() {
        return [
          { id: GROUP_ID, legacyKey: "discipline", isActive: true },
          { id: GROUP_ID_2, legacyKey: "hygiene", isActive: true }
        ];
      }
    },
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            status: "active",
            account: {
              id: "account-1",
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            },
            groups: [
              {
                groupId: GROUP_ID,
                roleCode: "leader",
                isPrimary: true
              }
            ]
          },
          {
            id: STUDENT_ID_2,
            name: "李四",
            status: "active",
            account: {
              id: "account-2",
              totalPoints: 12,
              balancePoints: 12,
              penaltyPoints: 0,
              version: 1
            },
            groups: [
              {
                groupId: GROUP_ID_2,
                roleCode: "member",
                isPrimary: true
              }
            ]
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
              id: `wage-tx-${transactionCreates.length}`,
              ...input.data
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
              penaltyPoints: 0,
              version: 2
            };
          }
        },
        auditLog: {
          async create() {}
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              classId: CLASS_ID,
              extra: input.data.extra
            };
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/wages/issue`,
    payload: {
      occurredAt: "2026-03-18T01:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(
    transactionCreates.map((item) => [item.data.reason, item.data.value]),
    [
      ["每日工资", 6],
      ["每日工资", 5]
    ]
  );
  assert.equal(accountUpdates.length, 2);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.lastWageDate, "2026-03-18");
  assert.deepEqual(response.json().summary, {
    dailyWageTargets: 2,
    psychologyCommitteeTargets: 0,
    studentCouncilTargets: 0
  });
  await app.close();
});

test("POST /points/wages/issue rejects empty wage targets", async () => {
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
          isFrozen: false,
          extra: {
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            studentCouncilRoles: []
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
            status: "active",
            account: {
              id: "account-1",
              totalPoints: 10,
              balancePoints: 8,
              penaltyPoints: 2,
              version: 1
            },
            groups: [
              {
                groupId: GROUP_ID_2,
                roleCode: "member",
                isPrimary: true
              }
            ]
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/points/wages/issue`,
    payload: {}
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "No wage targets configured");
  await app.close();
});
