import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { legacyRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "77777777-7777-4777-8777-777777777777";
const STUDENT_ID_2 = "88888888-8888-4888-8888-888888888888";
const STUDENT_ID_3 = "99999999-9999-4999-8999-999999999999";
const STUDENT_ID_4 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createClassRecord() {
  return {
    id: CLASS_ID,
    tenantId: TENANT_ID,
    timezone: "Asia/Shanghai"
  };
}

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

function createLegacyCompatShop(overrides?: Record<string, unknown>) {
  return {
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
    battle: null,
    ...(overrides || {})
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
  await app.register(legacyRoutes, { prefix: "/api" });
  return app;
}

test("POST /legacy/tasks/:taskId/claim awards points and marks task claimed", async () => {
  const pointTransactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];
  let capturedStudentWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
            ],
            legacyCompat: createLegacyCompatShop({
              tasks: [
                {
                  id: "task-1",
                  title: "复盘的复盘",
                  desc: "说明",
                  points: 25,
                  startTime: "2026-03-01T08:00:00.000Z",
                  endTime: "2026-03-30T08:00:00.000Z",
                  claimedByStudentIds: []
                }
              ]
            })
          }
        };
      }
    },
    student: {
      async findFirst(input: any) {
        capturedStudentWhere = input.where;
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 10,
            balancePoints: 6,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            pointTransactionCreates.push(input);
            return {
              id: "tx-1",
              transactionType: "reward",
              value: 25,
              reason: "任务领取：复盘的复盘",
              occurredAt: new Date("2026-03-17T08:00:00.000Z")
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
            return {
              id: "account-1",
              totalPoints: 35,
              balancePoints: 31,
              penaltyPoints: 0,
              version: 3
            };
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/tasks/task-1/claim`,
    payload: {
      studentId: STUDENT_ID,
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pointTransactionCreates.length, 1);
  assert.equal(pointTransactionCreates[0].data.sourceModule, "legacy_tasks");
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(pointAccountUpdates[0].data.totalPoints, 35);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(
    classConfigUpdates[0].data.extra.legacyCompat.tasks[0].claimedByStudentIds,
    [STUDENT_ID]
  );
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "legacy.task.claim");
  assert.deepEqual(capturedStudentWhere.status.in, ["observer"]);
  assert.equal(response.json().task.claimedByStudentIds[0], STUDENT_ID);
  await app.close();
});

test("POST /legacy/tasks/:taskId/claim rejects already claimed task", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              tasks: [
                {
                  id: "task-1",
                  title: "复盘的复盘",
                  desc: "说明",
                  points: 25,
                  startTime: "2026-03-01T08:00:00.000Z",
                  endTime: "2026-03-30T08:00:00.000Z",
                  claimedByStudentIds: [STUDENT_ID]
                }
              ]
            })
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/tasks/task-1/claim`,
    payload: {
      studentId: STUDENT_ID
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy task already claimed");
  await app.close();
});

test("POST /legacy/shop/redeem deducts balance, updates storage and appends log", async () => {
  const pointTransactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 3,
                    desc: "一次作业减免",
                    ladderPrices: [20, 30],
                    dailyLimit: 1
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 100,
            balancePoints: 40,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            pointTransactionCreates.push(input);
            return {
              id: "tx-shop-redeem",
              transactionType: "adjustment",
              value: -20,
              reason: "兑换: 免作业卡",
              occurredAt: new Date("2026-03-17T08:00:00.000Z")
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
            return {
              id: "account-1",
              totalPoints: 100,
              balancePoints: 20,
              penaltyPoints: 0,
              version: 3
            };
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/shop/redeem`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1",
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pointTransactionCreates.length, 1);
  assert.equal(pointTransactionCreates[0].data.sourceModule, "legacy_shop");
  assert.equal(pointTransactionCreates[0].data.value, -20);
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(pointAccountUpdates[0].data.balancePoints, 20);
  assert.equal(pointAccountUpdates[0].data.totalPoints, undefined);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.treasures[0].stock, 2);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.storage[STUDENT_ID]["item-1"], 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.redemptionHistory[STUDENT_ID]["item-1"], 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.dailyRedemptionCounts["2026-03-17"]["item-1"], 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.logs[0].action, "兑换");
  assert.equal(auditCreates[0].data.action, "legacy.shop.redeem");
  assert.equal(response.json().item.storageCount, 1);
  assert.equal(response.json().price, 20);
  await app.close();
});

test("POST /legacy/shop/gacha deducts balance, consumes stock and appends gacha log", async () => {
  const pointTransactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "星愿卡",
                    rarity: "N",
                    price: 30,
                    stock: 10,
                    desc: "祈愿掉落",
                    ladderPrices: [],
                    dailyLimit: 0
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 200,
            balancePoints: 150,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            pointTransactionCreates.push(input);
            return {
              id: "tx-shop-gacha",
              transactionType: "adjustment",
              value: -120,
              reason: "祈愿 x10",
              occurredAt: new Date("2026-03-17T08:00:00.000Z")
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
            return {
              id: "account-1",
              totalPoints: 200,
              balancePoints: 30,
              penaltyPoints: 0,
              version: 3
            };
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/shop/gacha`,
    payload: {
      studentId: STUDENT_ID,
      times: 10,
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pointTransactionCreates.length, 1);
  assert.equal(pointTransactionCreates[0].data.sourceType, "legacy_shop_gacha");
  assert.equal(pointTransactionCreates[0].data.value, -120);
  assert.equal(pointAccountUpdates.length, 1);
  assert.equal(pointAccountUpdates[0].data.balancePoints, 30);
  assert.equal(pointAccountUpdates[0].data.totalPoints, undefined);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.treasures[0].stock, 0);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.storage[STUDENT_ID]["item-1"], 10);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.logs[0].action, "祈愿");
  assert.equal(auditCreates[0].data.action, "legacy.shop.gacha");
  assert.equal(response.json().times, 10);
  assert.equal(response.json().cost, 120);
  assert.equal(response.json().results.length, 10);
  await app.close();
});

test("POST /legacy/shop/gacha rejects insufficient total stock", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "星愿卡",
                    rarity: "N",
                    price: 30,
                    stock: 9,
                    desc: "祈愿掉落",
                    ladderPrices: [],
                    dailyLimit: 0
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 200,
            balancePoints: 150,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/shop/gacha`,
    payload: {
      studentId: STUDENT_ID,
      times: 10,
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy shop gacha stock insufficient");
  await app.close();
});

test("POST /legacy/shop/use consumes storage and increments daily usage count", async () => {
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 2,
                    desc: "一次作业减免",
                    ladderPrices: [20, 30],
                    dailyLimit: 2
                  }
                ],
                storage: {
                  [STUDENT_ID]: {
                    "item-1": 2
                  }
                },
                logs: [],
                redemptionHistory: {
                  [STUDENT_ID]: {
                    "item-1": 2
                  }
                },
                dailyRedemptionCounts: {},
                dailyUsageCounts: {
                  "2026-03-17": {
                    "item-1": 1
                  }
                }
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳"
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/shop/use`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1",
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.storage[STUDENT_ID]["item-1"], 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.dailyUsageCounts["2026-03-17"]["item-1"], 2);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.logs[0].action, "使用");
  assert.equal(auditCreates[0].data.action, "legacy.shop.use");
  assert.equal(response.json().item.storageCount, 1);
  assert.equal(response.json().item.dailyUsageCount, 2);
  await app.close();
});

test("POST /legacy/shop/return restores stock, refunds latest ladder price and decrements history", async () => {
  const pointTransactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 2,
                    desc: "一次作业减免",
                    ladderPrices: [20, 30],
                    dailyLimit: 2
                  }
                ],
                storage: {
                  [STUDENT_ID]: {
                    "item-1": 1
                  }
                },
                logs: [],
                redemptionHistory: {
                  [STUDENT_ID]: {
                    "item-1": 2
                  }
                },
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 100,
            balancePoints: 5,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointTransaction: {
          async create(input: any) {
            pointTransactionCreates.push(input);
            return {
              id: "tx-shop-return",
              transactionType: "adjustment",
              value: 30,
              reason: "退宝物: 免作业卡",
              occurredAt: new Date("2026-03-17T08:00:00.000Z")
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
            return {
              id: "account-1",
              totalPoints: 100,
              balancePoints: 35,
              penaltyPoints: 0,
              version: 3
            };
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/shop/return`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1",
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pointTransactionCreates.length, 1);
  assert.equal(pointTransactionCreates[0].data.value, 30);
  assert.equal(pointAccountUpdates[0].data.balancePoints, 35);
  assert.equal(pointAccountUpdates[0].data.totalPoints, undefined);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.treasures[0].stock, 3);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.storage[STUDENT_ID], undefined);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.redemptionHistory[STUDENT_ID]["item-1"], 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.logs[0].action, "退宝物");
  assert.equal(auditCreates[0].data.action, "legacy.shop.return");
  assert.equal(response.json().refundPrice, 30);
  await app.close();
});

test("POST /legacy/battle/settle applies team results for daily participant students", async () => {
  const pointTransactionCreates: any[] = [];
  const pointAccountUpdates: any[] = [];
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];
  let capturedStudentWhere: any = null;

  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
            ],
            legacyCompat: createLegacyCompatShop({
              battle: {
                version: 1,
                teams: [
                  {
                    id: "team-a",
                    name: "双子星甲",
                    memberStudentIds: [STUDENT_ID, STUDENT_ID_2],
                    points: 50
                  },
                  {
                    id: "team-b",
                    name: "双子星乙",
                    memberStudentIds: [STUDENT_ID_3, STUDENT_ID_4],
                    points: 50
                  }
                ],
                squads: [],
                battles: [
                  {
                    id: "battle-1",
                    teamAId: "team-a",
                    teamBId: "team-b",
                    stake: 5,
                    isUnderdog: false
                  }
                ],
                logs: [],
                history: [],
                settlements: [],
                season: 1,
                rules: {},
                exams: [
                  {
                    id: "exam-base",
                    name: "基准考",
                    ts: 1,
                    ranks: {
                      [STUDENT_ID]: { c: 4, g: 40 },
                      [STUDENT_ID_2]: { c: 6, g: 60 },
                      [STUDENT_ID_3]: { c: 20, g: 200 },
                      [STUDENT_ID_4]: { c: 22, g: 220 }
                    }
                  },
                  {
                    id: "exam-settle",
                    name: "结算考",
                    ts: 2,
                    ranks: {
                      [STUDENT_ID]: { c: 1, g: 30 },
                      [STUDENT_ID_2]: { c: 2, g: 50 },
                      [STUDENT_ID_3]: { c: 18, g: 210 },
                      [STUDENT_ID_4]: { c: 20, g: 230 }
                    }
                  }
                ],
                teamBaseExamId: "exam-base",
                settleExamId: "exam-settle"
              }
            })
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
            name: "徐青阳",
            account: {
              id: "account-1",
              totalPoints: 100,
              balancePoints: 100,
              penaltyPoints: 0,
              version: 1
            }
          },
          {
            id: STUDENT_ID_2,
            name: "赵雨泽",
            account: {
              id: "account-2",
              totalPoints: 100,
              balancePoints: 100,
              penaltyPoints: 0,
              version: 1
            }
          },
          {
            id: STUDENT_ID_3,
            name: "钱星河",
            account: {
              id: "account-3",
              totalPoints: 100,
              balancePoints: 100,
              penaltyPoints: 0,
              version: 1
            }
          },
          {
            id: STUDENT_ID_4,
            name: "孙远帆",
            account: {
              id: "account-4",
              totalPoints: 100,
              balancePoints: 100,
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
            pointTransactionCreates.push(input);
            return {
              id: `tx-${pointTransactionCreates.length}`,
              transactionType: input.data.transactionType,
              value: input.data.value,
              reason: input.data.reason,
              occurredAt: new Date("2026-03-17T08:00:00.000Z")
            };
          }
        },
        pointAccount: {
          async update(input: any) {
            pointAccountUpdates.push(input);
            return {
              id: input.where.id,
              totalPoints: input.data.totalPoints,
              balancePoints: input.data.balancePoints,
              penaltyPoints: input.data.penaltyPoints,
              version: 2
            };
          }
        },
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/legacy/battle/settle`,
    payload: {
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(pointTransactionCreates.length, 4);
  assert.deepEqual(
    pointTransactionCreates.map((item) => [item.data.transactionType, item.data.value, item.data.reason]),
    [
      ["bonus", 27.5, "双子星结算-双子星甲"],
      ["bonus", 27.5, "双子星结算-双子星甲"],
      ["penalty", -37.5, "双子星结算-双子星乙"],
      ["penalty", -37.5, "双子星结算-双子星乙"]
    ]
  );
  assert.equal(pointAccountUpdates.length, 4);
  assert.deepEqual(
    pointAccountUpdates.map((item) => [item.where.id, item.data.totalPoints, item.data.balancePoints, item.data.penaltyPoints]),
    [
      ["account-1", 127.5, 127.5, 0],
      ["account-2", 127.5, 127.5, 0],
      ["account-3", 62.5, 62.5, 37.5],
      ["account-4", 62.5, 62.5, 37.5]
    ]
  );
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.battle.teams[0].points, 105);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.battle.teams[1].points, -25);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.battle.battles.length, 0);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.battle.settlements.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "legacy.battle.settle");
  assert.deepEqual(capturedStudentWhere.status.in, ["observer"]);
  assert.equal(response.json().teams[0].newPoints, 105);
  assert.equal(response.json().teams[1].newPoints, -25);
  assert.equal(response.json().adjustments.length, 4);
  await app.close();
});

test("POST /legacy/tasks/:taskId/claim rejects frozen class before mutating data", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          isFrozen: true,
          extra: {
            legacyCompat: createLegacyCompatShop()
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/tasks/task-1/claim`,
    payload: {
      studentId: STUDENT_ID
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /legacy/tasks/:taskId/claim rejects membership without legacy write permission", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["observer"]);
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {
            legacyCompat: createLegacyCompatShop()
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/tasks/task-1/claim`,
    payload: {
      studentId: STUDENT_ID
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Legacy feature permission denied");
  await app.close();
});

test("POST /legacy/tasks/:taskId/claim rejects tasks outside the active time window", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              tasks: [
                {
                  id: "task-1",
                  title: "还没开始的任务",
                  desc: "说明",
                  points: 10,
                  startTime: "2026-03-20T08:00:00.000Z",
                  endTime: "2026-03-30T08:00:00.000Z",
                  claimedByStudentIds: []
                }
              ]
            })
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/tasks/task-1/claim`,
    payload: {
      studentId: STUDENT_ID,
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy task not started");
  await app.close();
});

test("POST /legacy/shop/redeem rejects insufficient balance", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 3,
                    desc: "一次作业减免",
                    ladderPrices: [],
                    dailyLimit: 0
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 10,
            balancePoints: 5,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/shop/redeem`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy shop balance insufficient");
  await app.close();
});

test("POST /legacy/shop/redeem rejects out-of-stock items", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 0,
                    desc: "一次作业减免",
                    ladderPrices: [],
                    dailyLimit: 0
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/shop/redeem`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy shop item out of stock");
  await app.close();
});

test("POST /legacy/shop/redeem rejects negative-price items for non-negative balances", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-negative",
                    name: "负分修复券",
                    rarity: "SSR",
                    price: -10,
                    stock: 1,
                    desc: "仅负余额可兑",
                    ladderPrices: [],
                    dailyLimit: 0
                  }
                ],
                storage: {},
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {}
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳",
          account: {
            id: "account-1",
            totalPoints: 10,
            balancePoints: 0,
            penaltyPoints: 0,
            version: 2
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/shop/redeem`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-negative"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Negative price item requires negative balance");
  await app.close();
});

test("POST /legacy/shop/use rejects when the daily usage limit is reached", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              shop: {
                treasures: [
                  {
                    id: "item-1",
                    name: "免作业卡",
                    rarity: "SR",
                    price: 20,
                    stock: 2,
                    desc: "一次作业减免",
                    ladderPrices: [],
                    dailyLimit: 1
                  }
                ],
                storage: {
                  [STUDENT_ID]: {
                    "item-1": 1
                  }
                },
                logs: [],
                redemptionHistory: {},
                dailyRedemptionCounts: {},
                dailyUsageCounts: {
                  "2026-03-17": {
                    "item-1": 1
                  }
                }
              }
            })
          }
        };
      }
    },
    student: {
      async findFirst() {
        return {
          id: STUDENT_ID,
          name: "徐青阳"
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/legacy/shop/use`,
    payload: {
      studentId: STUDENT_ID,
      itemId: "item-1",
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy shop daily usage limit reached");
  await app.close();
});

test("POST /legacy/battle/settle rejects battles without configured exams", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              battle: {
                version: 1,
                teams: [
                  {
                    id: "team-a",
                    name: "双子星甲",
                    memberStudentIds: [STUDENT_ID],
                    points: 50
                  },
                  {
                    id: "team-b",
                    name: "双子星乙",
                    memberStudentIds: [STUDENT_ID_2],
                    points: 50
                  }
                ],
                squads: [],
                battles: [
                  {
                    id: "battle-1",
                    teamAId: "team-a",
                    teamBId: "team-b",
                    stake: 5,
                    isUnderdog: false
                  }
                ],
                logs: [],
                history: [],
                settlements: [],
                season: 1,
                rules: {},
                exams: [],
                teamBaseExamId: null,
                settleExamId: null
              }
            })
          }
        };
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
    url: `/api/classes/${CLASS_ID}/legacy/battle/settle`,
    payload: {
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy battle exams not configured");
  await app.close();
});

test("POST /legacy/battle/settle rejects when there are no pending matches", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return createClassRecord();
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
          extra: {
            legacyCompat: createLegacyCompatShop({
              battle: {
                version: 1,
                teams: [
                  {
                    id: "team-a",
                    name: "双子星甲",
                    memberStudentIds: [STUDENT_ID],
                    points: 50
                  }
                ],
                squads: [],
                battles: [],
                logs: [],
                history: [],
                settlements: [],
                season: 1,
                rules: {},
                exams: [
                  {
                    id: "exam-a",
                    name: "摸底考",
                    ts: 1,
                    ranks: {
                      [STUDENT_ID]: { c: 1, g: 10 }
                    }
                  }
                ],
                teamBaseExamId: "exam-a",
                settleExamId: "exam-a"
              }
            })
          }
        };
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
    url: `/api/classes/${CLASS_ID}/legacy/battle/settle`,
    payload: {
      occurredAt: "2026-03-17T08:00:00.000Z"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy battle has no pending matches");
  await app.close();
});
