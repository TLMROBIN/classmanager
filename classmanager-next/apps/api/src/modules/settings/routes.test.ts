import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { settingsRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const GROUP_ID = "55555555-5555-4555-8555-555555555555";
const GROUP_ID_2 = "66666666-6666-4666-8666-666666666666";
const DORMITORY_ID = "99999999-9999-4999-8999-999999999999";
const DORMITORY_ID_2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POSITION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const POSITION_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const STUDENT_ID = "77777777-7777-4777-8777-777777777777";
const STUDENT_ID_2 = "88888888-8888-4888-8888-888888888888";

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
  await app.register(settingsRoutes, { prefix: "/api" });
  return app;
}

test("POST /settings/reason-templates creates editable template and audit log", async () => {
  const templateCreates: any[] = [];
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
    pointReasonTemplate: {
      async findFirst() {
        return null;
      },
      async aggregate() {
        return {
          _max: {
            displayOrder: 3
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async create(input: any) {
            templateCreates.push(input);
            return {
              id: "template-1",
              name: "课堂表现",
              value: 2,
              transactionType: "bonus",
              scene: "班级",
              category: "表现",
              isEditable: true,
              isActive: true
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates`,
    payload: {
      name: "课堂表现",
      value: 2,
      transactionType: "bonus",
      scene: "班级",
      category: "表现"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(templateCreates.length, 1);
  assert.equal(templateCreates[0].data.displayOrder, 4);
  assert.equal(templateCreates[0].data.isEditable, true);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.create");
  assert.equal(response.json().item.name, "课堂表现");
  await app.close();
});

test("POST /settings/reason-templates rejects duplicate template name", async () => {
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
    pointReasonTemplate: {
      async findFirst() {
        return {
          id: "existing"
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates`,
    payload: {
      name: "课堂表现",
      value: 2,
      transactionType: "bonus",
      scene: "班级",
      category: "表现"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Reason template already exists");
  await app.close();
});

test("POST /settings/reason-templates rejects writes when class is frozen", async () => {
  const prisma = {
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates`,
    payload: {
      name: "课堂表现",
      value: 2,
      transactionType: "bonus",
      scene: "班级",
      category: "表现"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /settings/reason-templates/batch creates templates and writes audit log", async () => {
  const createManyCalls: any[] = [];
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
    pointReasonTemplate: {
      async findMany() {
        return [];
      },
      async aggregate() {
        return {
          _max: {
            displayOrder: 2
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async createMany(input: any) {
            createManyCalls.push(input);
            return { count: input.data.length };
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch`,
    payload: {
      items: [
        {
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现"
        },
        {
          name: "课堂纪律",
          value: -1,
          transactionType: "penalty",
          scene: "班级",
          category: "纪律"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(createManyCalls.length, 1);
  assert.equal(createManyCalls[0].data.length, 2);
  assert.equal(createManyCalls[0].data[0].displayOrder, 3);
  assert.equal(createManyCalls[0].data[1].displayOrder, 4);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.batch_create");
  assert.equal(response.json().createdCount, 2);
  await app.close();
});

test("POST /settings/reason-templates/batch rejects duplicate names in payload", async () => {
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch`,
    payload: {
      items: [
        {
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现"
        },
        {
          name: "课堂表现",
          value: 1,
          transactionType: "bonus",
          scene: "班级",
          category: "表现"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template batch contains duplicate names");
  await app.close();
});

test("POST /settings/reason-templates/batch rejects existing template names", async () => {
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
    pointReasonTemplate: {
      async findMany() {
        return [{ id: "existing", name: "课堂表现" }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch`,
    payload: {
      items: [
        {
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Reason template already exists");
  await app.close();
});

test("POST /settings/reason-templates/batch rejects writes when class is frozen", async () => {
  const prisma = {
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch`,
    payload: {
      items: [
        {
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("POST /settings/reason-templates/batch/precheck returns existing names", async () => {
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
    pointReasonTemplate: {
      async findMany() {
        return [
          { id: "existing-1", name: "课堂表现" },
          { id: "existing-2", name: "课堂纪律" }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch/precheck`,
    payload: {
      names: ["课堂表现", "课堂纪律", "其他"]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().existingNames.sort(), ["课堂纪律", "课堂表现"]);
  await app.close();
});

test("POST /settings/reason-templates/batch/precheck rejects duplicate names", async () => {
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch/precheck`,
    payload: {
      names: ["课堂表现", "课堂表现"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template precheck contains duplicate names");
  await app.close();
});

test("POST /settings/reason-templates/batch/precheck rejects missing class", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/batch/precheck`,
    payload: {
      names: ["课堂表现"]
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Class not found");
  await app.close();
});

test("PUT /settings/reason-templates/reorder updates display order and writes audit log", async () => {
  const templateUpdates: any[] = [];
  const auditCreates: any[] = [];
  const templateIdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const templateIdB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    pointReasonTemplate: {
      async findMany() {
        return [
          { id: templateIdA, displayOrder: 1 },
          { id: templateIdB, displayOrder: 2 }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async update(input: any) {
            templateUpdates.push(input);
            return input;
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/reorder`,
    payload: {
      templateIds: [templateIdB, templateIdA]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(templateUpdates.length, 2);
  assert.deepEqual(templateUpdates[0].data, { displayOrder: 1 });
  assert.deepEqual(templateUpdates[1].data, { displayOrder: 2 });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.reorder");
  assert.deepEqual(response.json().items, [
    { id: templateIdB, displayOrder: 1 },
    { id: templateIdA, displayOrder: 2 }
  ]);
  await app.close();
});

test("PUT /settings/reason-templates/reorder rejects unchanged order", async () => {
  const templateIdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const templateIdB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
    pointReasonTemplate: {
      async findMany() {
        return [
          { id: templateIdA, displayOrder: 1 },
          { id: templateIdB, displayOrder: 2 }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/reorder`,
    payload: {
      templateIds: [templateIdA, templateIdB]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template order unchanged");
  await app.close();
});

test("PUT /settings/reason-templates/reorder rejects invalid templates", async () => {
  const templateIdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const templateIdB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
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
    pointReasonTemplate: {
      async findMany() {
        return [{ id: templateIdA, displayOrder: 1 }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/reorder`,
    payload: {
      templateIds: [templateIdA, templateIdB]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template reorder list contains invalid templates");
  await app.close();
});

test("PUT /settings/reason-templates/reorder rejects writes when class is frozen", async () => {
  const templateIdA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const prisma = {
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/reorder`,
    payload: {
      templateIds: [templateIdA]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("PUT /settings/reason-templates/categories updates category and writes audit log", async () => {
  const auditCreates: any[] = [];
  const updateCalls: any[] = [];

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
    pointReasonTemplate: {
      async count() {
        return 2;
      },
      async updateMany(input: any) {
        updateCalls.push(input);
        return { count: 2 };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async updateMany(input: any) {
            updateCalls.push(input);
            return { count: 2 };
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/categories`,
    payload: {
      scene: "班级",
      category: "表现",
      nextScene: "课堂",
      nextCategory: "纪律"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(updateCalls.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.category.update");
  assert.equal(response.json().updatedCount, 2);
  await app.close();
});

test("PUT /settings/reason-templates/categories rejects unchanged category", async () => {
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/categories`,
    payload: {
      scene: "班级",
      category: "表现",
      nextScene: "班级",
      nextCategory: "表现"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template category unchanged");
  await app.close();
});

test("PUT /settings/reason-templates/categories rejects missing category", async () => {
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
    pointReasonTemplate: {
      async count() {
        return 0;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/categories`,
    payload: {
      scene: "班级",
      category: "表现",
      nextScene: "课堂",
      nextCategory: "纪律"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template category not found");
  await app.close();
});

test("PUT /settings/reason-templates/categories rejects writes when class is frozen", async () => {
  const prisma = {
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/categories`,
    payload: {
      scene: "班级",
      category: "表现",
      nextScene: "课堂",
      nextCategory: "纪律"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("PUT /settings/reason-templates/:templateId updates active state and writes audit log", async () => {
  const templateUpdates: any[] = [];
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
    pointReasonTemplate: {
      async findFirst() {
        return {
          id: "template-1",
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现",
          isEditable: true,
          isActive: true
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async update(input: any) {
            templateUpdates.push(input);
            return {
              id: "template-1",
              name: "课堂表现",
              value: 2,
              transactionType: "bonus",
              scene: "班级",
              category: "表现",
              isEditable: true,
              isActive: false
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/55555555-5555-4555-8555-555555555555`,
    payload: {
      isActive: false
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(templateUpdates.length, 1);
  assert.equal(templateUpdates[0].data.isActive, false);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.update");
  assert.deepEqual(auditCreates[0].data.beforeData, {
    name: "课堂表现",
    value: 2,
    transactionType: "bonus",
    scene: "班级",
    category: "表现",
    isActive: true
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    name: "课堂表现",
    value: 2,
    transactionType: "bonus",
    scene: "班级",
    category: "表现",
    isActive: false
  });
  assert.equal(response.json().item.isActive, false);
  await app.close();
});

test("PUT /settings/reason-templates/:templateId updates core fields", async () => {
  const templateUpdates: any[] = [];

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
    pointReasonTemplate: {
      async findFirst(input?: any) {
        if (input?.where?.NOT) {
          return null;
        }
        return {
          id: "template-1",
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现",
          isEditable: true,
          isActive: true
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async update(input: any) {
            templateUpdates.push(input);
            return {
              id: "template-1",
              name: "课堂纪律",
              value: -1,
              transactionType: "penalty",
              scene: "课堂",
              category: "纪律",
              isEditable: true,
              isActive: true
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
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/55555555-5555-4555-8555-555555555555`,
    payload: {
      name: "课堂纪律",
      value: -1,
      transactionType: "penalty",
      scene: "课堂",
      category: "纪律"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(templateUpdates.length, 1);
  assert.deepEqual(templateUpdates[0].data, {
    name: "课堂纪律",
    value: -1,
    transactionType: "penalty",
    scene: "课堂",
    category: "纪律",
    isActive: true
  });
  assert.equal(response.json().item.name, "课堂纪律");
  await app.close();
});

test("DELETE /settings/reason-templates/:templateId deletes editable template and writes audit log", async () => {
  const deletes: any[] = [];
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
    pointReasonTemplate: {
      async findFirst() {
        return {
          id: "template-1",
          name: "课堂表现",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现",
          isEditable: true,
          isActive: true
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        pointReasonTemplate: {
          async delete(input: any) {
            deletes.push(input);
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
    method: "DELETE",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/55555555-5555-4555-8555-555555555555`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(deletes.length, 1);
  assert.equal(deletes[0].where.id, "template-1");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.reason_template.delete");
  assert.equal(response.json().deleted, true);
  await app.close();
});

test("DELETE /settings/reason-templates/:templateId rejects non-editable template", async () => {
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
    pointReasonTemplate: {
      async findFirst() {
        return {
          id: "template-1",
          name: "系统模板",
          value: 2,
          transactionType: "bonus",
          scene: "班级",
          category: "表现",
          isEditable: false,
          isActive: true
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "DELETE",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/55555555-5555-4555-8555-555555555555`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Reason template is not editable");
  await app.close();
});

test("PUT /settings/class-config updates className and timezone", async () => {
  const configUpdates: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "高一(1)班",
              timezone: "Asia/Chongqing",
              isFrozen: false
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
    url: `/api/classes/${CLASS_ID}/settings/class-config`,
    payload: {
      className: "高一(1)班",
      timezone: "Asia/Chongqing"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.deepEqual(configUpdates[0].data, {
    className: "高一(1)班",
    timezone: "Asia/Chongqing"
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.config.update");
  assert.equal(response.json().classConfig.className, "高一(1)班");
  await app.close();
});

test("PUT /settings/class-config rejects unchanged config", async () => {
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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/class-config`,
    payload: {
      className: "测试班级",
      timezone: "Asia/Shanghai"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class config unchanged");
  await app.close();
});

test("PUT /settings/class-config rejects invalid timezone", async () => {
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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/class-config`,
    payload: {
      className: "测试班级",
      timezone: "Mars/Olympus"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class config timezone is invalid");
  await app.close();
});

test("PUT /settings/duty updates duty schedule and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [STUDENT_ID],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: []
          }
        };
      }
    },
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
        return [{ id: STUDENT_ID }, { id: STUDENT_ID_2 }];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/duty`,
    payload: {
      duty: {
        mon: [STUDENT_ID, STUDENT_ID_2],
        tue: [],
        wed: [STUDENT_ID],
        thu: [],
        fri: []
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(classConfigUpdates[0].data.extra.duty, {
    mon: [STUDENT_ID, STUDENT_ID_2],
    tue: [],
    wed: [STUDENT_ID],
    thu: [],
    fri: []
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.duty.update");
  assert.deepEqual(response.json().classConfig.duty.mon, [STUDENT_ID, STUDENT_ID_2]);
  await app.close();
});

test("PUT /settings/duty rejects unchanged schedule", async () => {
  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [STUDENT_ID],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: []
          }
        };
      }
    },
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
        return [{ id: STUDENT_ID }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/duty`,
    payload: {
      duty: {
        mon: [STUDENT_ID],
        tue: [],
        wed: [],
        thu: [],
        fri: []
      }
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Duty config unchanged");
  await app.close();
});

test("PUT /settings/quotes updates quotes and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [STUDENT_ID],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: ["旧语录"],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: []
          }
        };
      }
    },
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
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/quotes`,
    payload: {
      quotes: ["行百里者半九十。", "志不求易者成。"]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(classConfigUpdates[0].data.extra.quotes, ["行百里者半九十。", "志不求易者成。"]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.quotes.update");
  assert.deepEqual(response.json().classConfig.quotes, ["行百里者半九十。", "志不求易者成。"]);
  await app.close();
});

test("PUT /settings/quotes rejects unchanged quotes", async () => {
  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: ["行百里者半九十。"],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: []
          }
        };
      }
    },
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/quotes`,
    payload: {
      quotes: ["行百里者半九十。"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Quotes unchanged");
  await app.close();
});

test("PUT /settings/legacy-compat updates compat payload and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: [],
            legacyCompat: {
              strategyDates: {
                lastPeriodicTaskDate: "2026-03-01",
                lastPenaltyReductionDate: null
              },
              messages: [
                {
                  id: "old-message",
                  content: "旧留言",
                  time: "08:00",
                  date: "2026-03-01"
                }
              ],
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
            }
          }
        };
      }
    },
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
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/legacy-compat`,
    payload: {
      legacyCompat: {
        strategyDates: {
          lastPeriodicTaskDate: "2026-03-18",
          lastPenaltyReductionDate: "2026-03-17"
        },
        messages: [
          {
            id: "m1",
            content: "新留言",
            time: "09:30",
            date: "2026-03-02"
          }
        ],
        teacherMessages: [],
        tasks: [
          {
            id: "task-1",
            title: "班级任务",
            desc: "说明",
            points: 5,
            startTime: "2026-03-02T08:00",
            endTime: "2026-03-03T08:00",
            claimedByStudentIds: [STUDENT_ID]
          }
        ],
        shop: {
          treasures: [
            {
              id: "1",
              name: "什么都没有卡",
              rarity: "N",
              price: 1,
              stock: 99,
              desc: "字面意义",
              ladderPrices: [],
              dailyLimit: 0
            }
          ],
          storage: {
            [STUDENT_ID]: {
              "1": 2
            }
          },
          logs: [],
          redemptionHistory: {},
          dailyRedemptionCounts: {},
          dailyUsageCounts: {}
        },
        battle: {
          version: 1,
          teams: [
            {
              id: "t1",
              name: "安慕希",
              memberStudentIds: [STUDENT_ID, STUDENT_ID_2],
              points: 20
            }
          ],
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
        }
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.strategyDates.lastPeriodicTaskDate, "2026-03-18");
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.strategyDates.lastPenaltyReductionDate, "2026-03-17");
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.messages[0].content, "新留言");
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.tasks[0].claimedByStudentIds[0], STUDENT_ID);
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.shop.treasures[0].name, "什么都没有卡");
  assert.equal(classConfigUpdates[0].data.extra.legacyCompat.battle.teams[0].memberStudentIds.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.legacy_compat.update");
  assert.equal(response.json().classConfig.legacyCompat.strategyDates.lastPeriodicTaskDate, "2026-03-18");
  assert.equal(response.json().classConfig.legacyCompat.messages[0].content, "新留言");
  await app.close();
});

test("PUT /settings/legacy-compat rejects unchanged payload", async () => {
  const legacyCompatPayload = {
    strategyDates: {
      lastPeriodicTaskDate: "2026-03-18",
      lastPenaltyReductionDate: "2026-03-17"
    },
    messages: [
      {
        id: "m1",
        content: "新留言",
        time: "09:30",
        date: "2026-03-02"
      }
    ],
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

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            quotes: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            subjects: [],
            studentCouncilRoles: [],
            legacyCompat: legacyCompatPayload
          }
        };
      }
    },
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/legacy-compat`,
    payload: {
      legacyCompat: legacyCompatPayload
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Legacy compat unchanged");
  await app.close();
});

test("PUT /settings/groups updates groups and writes audit log", async () => {
  const groupUpdates: any[] = [];
  const groupCreates: any[] = [];
  const groupUpdateManyCalls: any[] = [];
  const auditCreates: any[] = [];
  let groupFindManyCall = 0;

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
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
    group: {
      async findMany() {
        groupFindManyCall += 1;
        if (groupFindManyCall === 1) {
          return [
            {
              id: GROUP_ID,
              legacyKey: "group_1",
              name: "第一组",
              colorToken: "bg-red-100",
              isActive: true,
              displayOrder: 1
            },
            {
              id: GROUP_ID_2,
              legacyKey: "group_2",
              name: "第二组",
              colorToken: "bg-blue-100",
              isActive: true,
              displayOrder: 2
            }
          ];
        }

        return [
          {
            id: GROUP_ID,
            legacyKey: "group_alpha",
            name: "先锋组",
            colorToken: "bg-emerald-100",
            isActive: true,
            _count: {
              members: 4
            }
          },
          {
            id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            legacyKey: "group_new",
            name: "新小组",
            colorToken: null,
            isActive: true,
            _count: {
              members: 0
            }
          },
          {
            id: GROUP_ID_2,
            legacyKey: "group_2",
            name: "第二组",
            colorToken: "bg-blue-100",
            isActive: false,
            _count: {
              members: 3
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        group: {
          async update(input: any) {
            groupUpdates.push(input);
            return input;
          },
          async create(input: any) {
            groupCreates.push(input);
            return input;
          },
          async updateMany(input: any) {
            groupUpdateManyCalls.push(input);
            return { count: 1 };
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
    url: `/api/classes/${CLASS_ID}/settings/groups`,
    payload: {
      groups: [
        {
          id: GROUP_ID,
          legacyKey: "group_alpha",
          name: "先锋组",
          colorToken: "bg-emerald-100",
          isActive: true
        },
        {
          legacyKey: "group_new",
          name: "新小组",
          colorToken: null,
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(groupUpdates.length, 2);
  assert.match(groupUpdates[0].data.name, /__tmp_group__/);
  assert.deepEqual(groupUpdates[1].data, {
    legacyKey: "group_alpha",
    name: "先锋组",
    colorToken: "bg-emerald-100",
    isActive: true,
    displayOrder: 1
  });
  assert.equal(groupCreates.length, 1);
  assert.deepEqual(groupCreates[0].data, {
    tenantId: TENANT_ID,
    classId: CLASS_ID,
    legacyKey: "group_new",
    name: "新小组",
    colorToken: null,
    isActive: true,
    displayOrder: 2
  });
  assert.equal(groupUpdateManyCalls.length, 1);
  assert.deepEqual(groupUpdateManyCalls[0].data, { isActive: false });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.groups.update");
  assert.equal(response.json().items.length, 3);
  assert.equal(response.json().items[0].name, "先锋组");
  await app.close();
});

test("PUT /settings/groups rejects unchanged settings", async () => {
  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
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
    group: {
      async findMany() {
        return [
          {
            id: GROUP_ID,
            legacyKey: "group_1",
            name: "第一组",
            colorToken: "bg-red-100",
            isActive: true,
            displayOrder: 1
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/groups`,
    payload: {
      groups: [
        {
          id: GROUP_ID,
          legacyKey: "group_1",
          name: "第一组",
          colorToken: "bg-red-100",
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Group config unchanged");
  await app.close();
});

test("PUT /settings/dormitories updates dormitories and writes audit log", async () => {
  const dormitoryUpdates: any[] = [];
  const dormitoryCreates: any[] = [];
  const auditCreates: any[] = [];
  let dormitoryFindManyCall = 0;

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
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
    dormitory: {
      async findMany() {
        dormitoryFindManyCall += 1;
        if (dormitoryFindManyCall === 1) {
          return [
            {
              id: DORMITORY_ID,
              legacyKey: "dorm_101",
              name: "101",
              building: "1号楼",
              genderScope: "female",
              isActive: true,
              displayOrder: 1
            }
          ];
        }

        return [
          {
            id: DORMITORY_ID,
            legacyKey: "dorm_a101",
            name: "A101",
            building: "A栋",
            genderScope: "female",
            isActive: true,
            _count: {
              members: 6
            }
          },
          {
            id: DORMITORY_ID_2,
            legacyKey: "dorm_b202",
            name: "B202",
            building: "B栋",
            genderScope: "male",
            isActive: true,
            _count: {
              members: 0
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        dormitory: {
          async update(input: any) {
            dormitoryUpdates.push(input);
            return input;
          },
          async create(input: any) {
            dormitoryCreates.push(input);
            return input;
          },
          async updateMany() {
            return { count: 0 };
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
    url: `/api/classes/${CLASS_ID}/settings/dormitories`,
    payload: {
      dormitories: [
        {
          id: DORMITORY_ID,
          legacyKey: "dorm_a101",
          name: "A101",
          building: "A栋",
          genderScope: "female",
          isActive: true
        },
        {
          legacyKey: "dorm_b202",
          name: "B202",
          building: "B栋",
          genderScope: "male",
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(dormitoryUpdates.length, 2);
  assert.match(dormitoryUpdates[0].data.name, /__tmp_dormitory__/);
  assert.deepEqual(dormitoryUpdates[1].data, {
    legacyKey: "dorm_a101",
    name: "A101",
    building: "A栋",
    genderScope: "female",
    isActive: true,
    displayOrder: 1
  });
  assert.equal(dormitoryCreates.length, 1);
  assert.equal(dormitoryCreates[0].data.name, "B202");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.dormitories.update");
  assert.equal(response.json().items[1].name, "B202");
  await app.close();
});

test("PUT /settings/positions updates positions and writes audit log", async () => {
  const positionUpdates: any[] = [];
  const positionCreates: any[] = [];
  const auditCreates: any[] = [];
  let positionFindManyCall = 0;

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
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
    position: {
      async findMany() {
        positionFindManyCall += 1;
        if (positionFindManyCall === 1) {
          return [
            {
              id: POSITION_ID,
              code: "discipline",
              name: "纪律委员",
              category: "commissioner",
              isActive: true,
              displayOrder: 1
            }
          ];
        }

        return [
          {
            id: POSITION_ID,
            code: "discipline",
            name: "纪律督导",
            category: "commissioner",
            isActive: true,
            _count: {
              holders: 1
            }
          },
          {
            id: POSITION_ID_2,
            code: "health",
            name: "卫生委员",
            category: "commissioner",
            isActive: true,
            _count: {
              holders: 0
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        position: {
          async update(input: any) {
            positionUpdates.push(input);
            return input;
          },
          async create(input: any) {
            positionCreates.push(input);
            return input;
          },
          async updateMany() {
            return { count: 0 };
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
    url: `/api/classes/${CLASS_ID}/settings/positions`,
    payload: {
      positions: [
        {
          id: POSITION_ID,
          code: "discipline",
          name: "纪律督导",
          category: "commissioner",
          isActive: true
        },
        {
          code: "health",
          name: "卫生委员",
          category: "commissioner",
          isActive: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(positionUpdates.length, 2);
  assert.match(positionUpdates[0].data.code, /__tmp_position__/);
  assert.deepEqual(positionUpdates[1].data, {
    code: "discipline",
    name: "纪律督导",
    category: "commissioner",
    isActive: true,
    displayOrder: 1
  });
  assert.equal(positionCreates.length, 1);
  assert.deepEqual(positionCreates[0].data, {
    tenantId: TENANT_ID,
    classId: CLASS_ID,
    code: "health",
    name: "卫生委员",
    category: "commissioner",
    isActive: true,
    displayOrder: 2
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.positions.update");
  assert.equal(response.json().items[0].name, "纪律督导");
  await app.close();
});

test("PUT /settings/class-freeze updates frozen state and writes audit log", async () => {
  const configUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          name: "测试班级"
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
          id: "config-1",
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: true
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
    url: `/api/classes/${CLASS_ID}/settings/class-freeze`,
    payload: {
      isFrozen: true
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.equal(configUpdates[0].data.isFrozen, true);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.freeze.update");
  assert.deepEqual(auditCreates[0].data.beforeData, { isFrozen: false });
  assert.deepEqual(auditCreates[0].data.afterData, { isFrozen: true });
  assert.equal(response.json().classConfig.isFrozen, true);
  await app.close();
});

test("PUT /settings/class-freeze rejects unchanged state", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          name: "测试班级"
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
          id: "config-1",
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: true
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/class-freeze`,
    payload: {
      isFrozen: true
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class frozen state unchanged");
  await app.close();
});

test("PUT /settings/schedule-notes updates notes and writes audit log", async () => {
  const configUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          scheduleNotes: {
            morning: "语文早读"
          }
        };
      }
    },
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
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              scheduleNotes: {
                morning: "英语早读",
                night: "晚自习留堂讲评"
              }
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
    url: `/api/classes/${CLASS_ID}/settings/schedule-notes`,
    payload: {
      scheduleNotes: {
        morning: "英语早读",
        night: "晚自习留堂讲评"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.deepEqual(configUpdates[0].data.scheduleNotes, {
    morning: "英语早读",
    night: "晚自习留堂讲评"
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.schedule_notes.update");
  assert.deepEqual(auditCreates[0].data.beforeData, {
    scheduleNotes: {
      morning: "语文早读"
    }
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    scheduleNotes: {
      morning: "英语早读",
      night: "晚自习留堂讲评"
    }
  });
  assert.equal(response.json().classConfig.scheduleNotes.morning, "英语早读");
  await app.close();
});

test("PUT /settings/schedule-notes rejects unchanged notes", async () => {
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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          scheduleNotes: {
            morning: "语文早读"
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/schedule-notes`,
    payload: {
      scheduleNotes: {
        morning: "语文早读"
      }
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Schedule notes unchanged");
  await app.close();
});

test("PUT /settings/schedule-notes preserves submitted note order", async () => {
  const configUpdates: any[] = [];

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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          scheduleNotes: {
            morning: "语文早读",
            night: "晚自习"
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              scheduleNotes: input.data.scheduleNotes
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
    url: `/api/classes/${CLASS_ID}/settings/schedule-notes`,
    payload: {
      scheduleNotes: {
        night: "晚自习留堂讲评",
        morning: "英语早读",
        reading: "午间阅读"
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.deepEqual(Object.keys(configUpdates[0].data.scheduleNotes), ["night", "morning", "reading"]);
  assert.deepEqual(Object.keys(response.json().classConfig.scheduleNotes), ["night", "morning", "reading"]);
  await app.close();
});

test("PUT /settings/countdown-events updates events and writes audit log", async () => {
  const configUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          countdownEvents: [
            {
              id: "event-1",
              title: "期中考试",
              date: "2026-04-20",
              note: "复习周"
            }
          ]
        };
      }
    },
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
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              countdownEvents: [
                {
                  id: "event-1",
                  title: "期中考试",
                  date: "2026-04-22",
                  note: "复习冲刺"
                },
                {
                  title: "运动会",
                  date: "2026-05-10",
                  note: null
                }
              ]
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
    url: `/api/classes/${CLASS_ID}/settings/countdown-events`,
    payload: {
      countdownEvents: [
        {
          id: "event-1",
          title: "期中考试",
          date: "2026-04-22",
          note: "复习冲刺"
        },
        {
          title: "运动会",
          date: "2026-05-10"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.equal(configUpdates[0].data.countdownEvents.length, 2);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.countdown_events.update");
  assert.equal(response.json().classConfig.countdownEvents[0].date, "2026-04-22");
  await app.close();
});

test("PUT /settings/countdown-events rejects unchanged events", async () => {
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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          countdownEvents: [
            {
              id: "event-1",
              title: "期中考试",
              date: "2026-04-20",
              note: "复习周"
            }
          ]
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/countdown-events`,
    payload: {
      countdownEvents: [
        {
          id: "event-1",
          title: "期中考试",
          date: "2026-04-20",
          note: "复习周"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Countdown events unchanged");
  await app.close();
});

test("PUT /settings/countdown-events preserves submitted event order", async () => {
  const configUpdates: any[] = [];

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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          countdownEvents: [
            {
              id: "event-1",
              title: "期中考试",
              date: "2026-04-20",
              note: "复习周"
            },
            {
              id: "event-2",
              title: "运动会",
              date: "2026-05-10",
              note: null
            }
          ]
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return {
              className: "测试班级",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              countdownEvents: input.data.countdownEvents
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
    url: `/api/classes/${CLASS_ID}/settings/countdown-events`,
    payload: {
      countdownEvents: [
        {
          id: "event-2",
          title: "运动会",
          date: "2026-05-10"
        },
        {
          id: "event-1",
          title: "期中考试",
          date: "2026-04-18",
          note: "提前调整"
        },
        {
          title: "毕业典礼",
          date: "2026-06-30"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.deepEqual(
    configUpdates[0].data.countdownEvents.map((item: { title: string }) => item.title),
    ["运动会", "期中考试", "毕业典礼"]
  );
  assert.deepEqual(
    response.json().classConfig.countdownEvents.map((item: { title: string }) => item.title),
    ["运动会", "期中考试", "毕业典礼"]
  );
  await app.close();
});

test("PUT /settings/countdown-events rejects invalid date", async () => {
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
          className: "测试班级",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          countdownEvents: []
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/countdown-events`,
    payload: {
      countdownEvents: [
        {
          title: "期中考试",
          date: "2026-02-30"
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Countdown event date is invalid");
  await app.close();
});

test("PUT /settings/reason-templates/:templateId rejects missing template", async () => {
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
    pointReasonTemplate: {
      async findFirst() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/reason-templates/55555555-5555-4555-8555-555555555555`,
    payload: {
      isActive: false
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Reason template not found");
  await app.close();
});

test("PUT /settings/feature-flags/:featureFlagId updates enabled state and writes audit log", async () => {
  const auditCreates: any[] = [];
  const featureFlagUpdates: any[] = [];

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
    featureFlag: {
      async findFirst() {
        return {
          id: "flag-1",
          code: "attendance",
          enabled: true,
          config: {
            mode: "default"
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        featureFlag: {
          async update(input: any) {
            featureFlagUpdates.push(input);
            return {
              id: "flag-1",
              code: "attendance",
              enabled: false,
              config: {
                mode: "default"
              }
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
    url: `/api/classes/${CLASS_ID}/settings/feature-flags/55555555-5555-4555-8555-555555555555`,
    payload: {
      enabled: false
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(featureFlagUpdates.length, 1);
  assert.equal(featureFlagUpdates[0].data.enabled, false);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.feature_flag.update");
  assert.deepEqual(auditCreates[0].data.beforeData, {
    enabled: true,
    config: {
      mode: "default"
    }
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    enabled: false,
    config: {
      mode: "default"
    }
  });
  assert.equal(response.json().item.enabled, false);
  await app.close();
});

test("PUT /settings/feature-flags/:featureFlagId updates config and writes audit log", async () => {
  const auditCreates: any[] = [];
  const featureFlagUpdates: any[] = [];

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
    featureFlag: {
      async findFirst() {
        return {
          id: "flag-1",
          code: "attendance",
          enabled: true,
          config: {
            mode: "default",
            settlement: {
              allowWeekend: false
            }
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        featureFlag: {
          async update(input: any) {
            featureFlagUpdates.push(input);
            return {
              id: "flag-1",
              code: "attendance",
              enabled: true,
              config: {
                mode: "strict",
                settlement: {
                  allowWeekend: true
                }
              }
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
    url: `/api/classes/${CLASS_ID}/settings/feature-flags/55555555-5555-4555-8555-555555555555`,
    payload: {
      config: {
        mode: "strict",
        settlement: {
          allowWeekend: true
        }
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(featureFlagUpdates.length, 1);
  assert.deepEqual(featureFlagUpdates[0].data, {
    enabled: true,
    config: {
      mode: "strict",
      settlement: {
        allowWeekend: true
      }
    }
  });
  assert.equal(auditCreates.length, 1);
  assert.deepEqual(auditCreates[0].data.beforeData, {
    enabled: true,
    config: {
      mode: "default",
      settlement: {
        allowWeekend: false
      }
    }
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    enabled: true,
    config: {
      mode: "strict",
      settlement: {
        allowWeekend: true
      }
    }
  });
  assert.deepEqual(response.json().item.config, {
    mode: "strict",
    settlement: {
      allowWeekend: true
    }
  });
  await app.close();
});

test("PUT /settings/feature-flags/:featureFlagId rejects missing feature flag", async () => {
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
    featureFlag: {
      async findFirst() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/feature-flags/55555555-5555-4555-8555-555555555555`,
    payload: {
      enabled: false
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Feature flag not found");
  await app.close();
});

test("PUT /settings/feature-flags/:featureFlagId rejects writes when class is frozen", async () => {
  const prisma = {
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
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/feature-flags/55555555-5555-4555-8555-555555555555`,
    payload: {
      enabled: false
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("PUT /settings/feature-flags/:featureFlagId rejects unchanged settings", async () => {
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
    featureFlag: {
      async findFirst() {
        return {
          id: "flag-1",
          code: "attendance",
          enabled: true,
          config: {
            mode: "default"
          }
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/feature-flags/55555555-5555-4555-8555-555555555555`,
    payload: {
      enabled: true,
      config: {
        mode: "default"
      }
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Feature flag settings unchanged");
  await app.close();
});

test("PUT /settings/wage-config updates wage settings and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            dailyWageAmount: 5,
            dailyWageGroupIds: [GROUP_ID],
            psychologyCommitteeStudentIds: [],
            quotes: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    group: {
      async findMany() {
        return [{ id: GROUP_ID }, { id: GROUP_ID_2 }];
      }
    },
    student: {
      async findMany() {
        return [{ id: STUDENT_ID }, { id: STUDENT_ID_2 }];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "高一14班",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/wage-config`,
    payload: {
      dailyWageAmount: 6,
      dailyWageGroupIds: [GROUP_ID, GROUP_ID_2],
      psychologyCommitteeStudentIds: [STUDENT_ID],
      studentCouncilRoles: [
        {
          id: "student_council_secretary",
          name: "秘书处",
          studentId: STUDENT_ID_2
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(classConfigUpdates[0].data.extra, {
    duty: {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: []
    },
    dailyWageAmount: 6,
    dailyWageGroupIds: [GROUP_ID, GROUP_ID_2],
    psychologyCommitteeStudentIds: [STUDENT_ID],
    quotes: [],
    studentStatusOptions: [
      {
        value: "active",
        label: "在读（active）",
        participatesInDailyFlow: true
      },
      {
        value: "archived",
        label: "已归档（archived）",
        participatesInDailyFlow: false
      },
      {
        value: "graduated",
        label: "已毕业（graduated）",
        participatesInDailyFlow: false
      },
      {
        value: "transferred",
        label: "已转出（transferred）",
        participatesInDailyFlow: false
      }
    ],
    subjects: [],
    studentCouncilRoles: [
      {
        id: "student_council_secretary",
        name: "秘书处",
        studentId: STUDENT_ID_2
      }
    ]
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.wage_config.update");
  assert.equal(response.json().classConfig.dailyWageAmount, 6);
  assert.deepEqual(response.json().classConfig.dailyWageGroupIds, [GROUP_ID, GROUP_ID_2]);
  await app.close();
});

test("PUT /settings/wage-config accepts migrated last wage date", async () => {
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
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {
              mon: [],
              tue: [],
              wed: [],
              thu: [],
              fri: []
            },
            dailyWageAmount: 5,
            dailyWageGroupIds: [GROUP_ID],
            psychologyCommitteeStudentIds: [],
            quotes: [],
            subjects: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    group: {
      async findMany() {
        return [{ id: GROUP_ID }];
      }
    },
    student: {
      async findMany() {
        return [];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "高一14班",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/wage-config`,
    payload: {
      dailyWageAmount: 5,
      dailyWageGroupIds: [GROUP_ID],
      psychologyCommitteeStudentIds: [],
      lastWageDate: "2026-03-18",
      studentCouncilRoles: []
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.equal(classConfigUpdates[0].data.extra.lastWageDate, "2026-03-18");
  assert.equal(response.json().classConfig.lastWageDate, "2026-03-18");
  await app.close();
});

test("PUT /settings/wage-config rejects unchanged settings", async () => {
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
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            dailyWageAmount: 5,
            dailyWageGroupIds: [GROUP_ID],
            psychologyCommitteeStudentIds: [STUDENT_ID],
            quotes: [],
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
    group: {
      async findMany() {
        return [{ id: GROUP_ID }];
      }
    },
    student: {
      async findMany() {
        return [{ id: STUDENT_ID }, { id: STUDENT_ID_2 }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/wage-config`,
    payload: {
      dailyWageAmount: 5,
      dailyWageGroupIds: [GROUP_ID],
      psychologyCommitteeStudentIds: [STUDENT_ID],
      studentCouncilRoles: [
        {
          id: "student_council_secretary",
          name: "秘书处",
          studentId: STUDENT_ID_2
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Wage config unchanged");
  await app.close();
});

test("GET /settings/overview falls back to legacy default wage groups when config is missing", async () => {
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
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          scheduleNotes: {},
          countdownEvents: [],
          extra: {
            dailyWageAmount: 5,
            psychologyCommitteeStudentIds: [],
            quotes: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    group: {
      async findMany() {
        return [
          {
            id: GROUP_ID,
            legacyKey: "discipline",
            name: "纪律组",
            colorToken: null,
            isActive: true,
            _count: {
              members: 2
            }
          },
          {
            id: GROUP_ID_2,
            legacyKey: "hygiene",
            name: "卫生组",
            colorToken: null,
            isActive: true,
            _count: {
              members: 1
            }
          }
        ];
      }
    },
    dormitory: {
      async findMany() {
        return [];
      }
    },
    position: {
      async findMany() {
        return [];
      }
    },
    pointReasonTemplate: {
      async findMany() {
        return [];
      }
    },
    featureFlag: {
      async findMany() {
        return [];
      }
    },
    student: {
      async findMany() {
        return [
          {
            id: STUDENT_ID,
            name: "张三",
            status: "active",
            sortOrder: 1,
            groups: [
              {
                group: {
                  id: GROUP_ID,
                  legacyKey: "discipline",
                  name: "纪律组"
                }
              }
            ]
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/classes/${CLASS_ID}/settings/overview`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().classConfig.dailyWageGroupIds, [GROUP_ID, GROUP_ID_2]);
  assert.deepEqual(response.json().classConfig.studentStatusOptions, [
    {
      value: "active",
      label: "在读（active）",
      participatesInDailyFlow: true
    },
    {
      value: "archived",
      label: "已归档（archived）",
      participatesInDailyFlow: false
    },
    {
      value: "graduated",
      label: "已毕业（graduated）",
      participatesInDailyFlow: false
    },
    {
      value: "transferred",
      label: "已转出（transferred）",
      participatesInDailyFlow: false
    }
  ]);
  await app.close();
});

test("PUT /settings/student-statuses updates status dictionary and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          className: "高一14班",
          timezone: "Asia/Shanghai",
          extra: {
            duty: {},
            quotes: [],
            subjects: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            studentCouncilRoles: [],
            studentStatusOptions: [
              {
                value: "active",
                label: "在读（active）",
                participatesInDailyFlow: true
              }
            ]
          }
        };
      }
    },
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
        return [{ status: "active" }, { status: "leave" }];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "高一14班",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/student-statuses`,
    payload: {
      studentStatusOptions: [
        {
          value: "active",
          label: "正常在读",
          participatesInDailyFlow: true
        },
        {
          value: "leave",
          label: "阶段请假",
          participatesInDailyFlow: false
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(classConfigUpdates[0].data.extra.studentStatusOptions, [
    {
      value: "active",
      label: "正常在读",
      participatesInDailyFlow: true
    },
    {
      value: "leave",
      label: "阶段请假",
      participatesInDailyFlow: false
    },
    {
      value: "archived",
      label: "已归档（archived）",
      participatesInDailyFlow: false
    },
    {
      value: "graduated",
      label: "已毕业（graduated）",
      participatesInDailyFlow: false
    },
    {
      value: "transferred",
      label: "已转出（transferred）",
      participatesInDailyFlow: false
    }
  ]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.student_statuses.update");
  assert.equal(response.json().classConfig.studentStatusOptions[1].value, "leave");
  await app.close();
});

test("PUT /settings/student-statuses rejects unchanged config", async () => {
  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          className: "高一14班",
          timezone: "Asia/Shanghai",
          extra: {
            duty: {},
            quotes: [],
            subjects: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            studentCouncilRoles: [],
            studentStatusOptions: [
              {
                value: "active",
                label: "在读（active）",
                participatesInDailyFlow: true
              },
              {
                value: "archived",
                label: "已归档（archived）",
                participatesInDailyFlow: false
              },
              {
                value: "graduated",
                label: "已毕业（graduated）",
                participatesInDailyFlow: false
              },
              {
                value: "transferred",
                label: "已转出（transferred）",
                participatesInDailyFlow: false
              }
            ]
          }
        };
      }
    },
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
        return [{ status: "active" }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/student-statuses`,
    payload: {
      studentStatusOptions: [
        {
          value: "active",
          label: "在读（active）",
          participatesInDailyFlow: true
        },
        {
          value: "archived",
          label: "已归档（archived）",
          participatesInDailyFlow: false
        },
        {
          value: "graduated",
          label: "已毕业（graduated）",
          participatesInDailyFlow: false
        },
        {
          value: "transferred",
          label: "已转出（transferred）",
          participatesInDailyFlow: false
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student status config unchanged");
  await app.close();
});

test("PUT /settings/student-statuses rejects removing statuses still used by students", async () => {
  const prisma = {
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          className: "高一14班",
          timezone: "Asia/Shanghai",
          extra: {
            duty: {},
            quotes: [],
            subjects: [],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            studentCouncilRoles: [],
            studentStatusOptions: [
              {
                value: "active",
                label: "在读（active）",
                participatesInDailyFlow: true
              },
              {
                value: "leave",
                label: "阶段请假",
                participatesInDailyFlow: false
              }
            ]
          }
        };
      }
    },
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
        return [{ status: "active" }, { status: "leave" }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/student-statuses`,
    payload: {
      studentStatusOptions: [
        {
          value: "active",
          label: "在读（active）",
          participatesInDailyFlow: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student status config missing used statuses");
  await app.close();
});

test("PUT /settings/student-statuses rejects duplicate values", async () => {
  const app = await createTestApp({});
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/student-statuses`,
    payload: {
      studentStatusOptions: [
        {
          value: "active",
          label: "在读",
          participatesInDailyFlow: true
        },
        {
          value: "active",
          label: "仍然在读",
          participatesInDailyFlow: true
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student status config contains duplicate values");
  await app.close();
});

test("PUT /settings/subjects updates subjects and writes audit log", async () => {
  const classConfigUpdates: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {},
            subjects: [
              {
                id: "chinese",
                name: "语文",
                representativeStudentIds: []
              }
            ],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            quotes: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    student: {
      async findMany() {
        return [{ id: STUDENT_ID }, { id: STUDENT_ID_2 }];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            classConfigUpdates.push(input);
            return {
              className: "高一14班",
              timezone: "Asia/Shanghai",
              isFrozen: false,
              extra: input.data.extra
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
    url: `/api/classes/${CLASS_ID}/settings/subjects`,
    payload: {
      subjects: [
        {
          id: "chinese",
          name: "语文",
          representativeStudentIds: [STUDENT_ID]
        },
        {
          id: "math",
          name: "数学",
          representativeStudentIds: [STUDENT_ID_2]
        }
      ]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(classConfigUpdates.length, 1);
  assert.deepEqual(classConfigUpdates[0].data.extra.subjects, [
    {
      id: "chinese",
      name: "语文",
      representativeStudentIds: [STUDENT_ID]
    },
    {
      id: "math",
      name: "数学",
      representativeStudentIds: [STUDENT_ID_2]
    }
  ]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "settings.class.subjects.update");
  assert.equal(response.json().classConfig.subjects.length, 2);
  await app.close();
});

test("PUT /settings/subjects rejects unchanged settings", async () => {
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
          className: "高一14班",
          timezone: "Asia/Shanghai",
          isFrozen: false,
          extra: {
            duty: {},
            subjects: [
              {
                id: "chinese",
                name: "语文",
                representativeStudentIds: [STUDENT_ID]
              }
            ],
            dailyWageAmount: 5,
            dailyWageGroupIds: [],
            psychologyCommitteeStudentIds: [],
            quotes: [],
            studentCouncilRoles: []
          }
        };
      }
    },
    student: {
      async findMany() {
        return [{ id: STUDENT_ID }];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/classes/${CLASS_ID}/settings/subjects`,
    payload: {
      subjects: [
        {
          id: "chinese",
          name: "语文",
          representativeStudentIds: [STUDENT_ID]
        }
      ]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Subject config unchanged");
  await app.close();
});
