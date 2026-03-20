import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { classRoutes } from "./routes.js";

const CLASS_ID = "11111111-1111-4111-8111-111111111111";
const TENANT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const STUDENT_ID = "55555555-5555-4555-8555-555555555555";
const STUDENT_ID_2 = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const GROUP_ID_OLD = "66666666-6666-4666-8666-666666666666";
const GROUP_ID_NEW = "77777777-7777-4777-8777-777777777777";
const DORM_ID_OLD = "88888888-8888-4888-8888-888888888888";
const DORM_ID_NEW = "99999999-9999-4999-8999-999999999999";
const POSITION_ID_OLD = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const POSITION_ID_NEW = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
  await app.register(classRoutes, { prefix: "/api" });
  return app;
}

test("GET /students/:studentId returns recent transactions with audit ids", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          legacyId: 1,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "active",
          sortOrder: 1,
          account: {
            totalPoints: 10,
            balancePoints: 8,
            penaltyPoints: 2,
            version: 1
          },
          profile: {
            titleLeft: "纪律标兵",
            titleRight: "进步之星",
            notes: "旧系统迁移档案"
          },
          groups: [],
          dorms: [],
          positions: []
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
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
            transactionType: "bonus",
            value: 2,
            reason: "手工加分",
            scene: "班级",
            category: "表现",
            sourceModule: "manual_adjustment",
            occurredAt: new Date("2026-03-10T00:00:00.000Z"),
            legacyNumericId: 1,
            isReverted: false
          }
        ];
      },
      async count() {
        return 1;
      }
    },
    attendanceRecord: {
      async count() {
        return 0;
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-1",
            afterData: {
              transactionId: "tx-1"
            }
          }
        ];
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {}
        };
      }
    },
    migrationMapping: {
      async findMany(input: any) {
        if (input.where.entityType === "student") {
          return [
            {
              metadata: {
                hasLegacyAvatarData: true
              }
            }
          ];
        }
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().recentTransactions[0].auditId, "audit-1");
  assert.equal(response.json().student.profile.titleLeft, "纪律标兵");
  assert.equal(response.json().student.profile.legacyAvatarPending, true);
  assert.equal(response.json().deleteGuard.canDelete, false);
  await app.close();
});

test("GET /students/:studentId returns migrated avatar payloads", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          legacyId: 1,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "active",
          sortOrder: 1,
          account: {
            totalPoints: 10,
            balancePoints: 8,
            penaltyPoints: 2,
            version: 1
          },
          profile: null,
          groups: [],
          dorms: [],
          positions: []
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
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
        return [];
      },
      async count() {
        return 0;
      }
    },
    attendanceRecord: {
      async count() {
        return 0;
      }
    },
    auditLog: {
      async findMany() {
        return [];
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {}
        };
      }
    },
    migrationMapping: {
      async findMany(input: any) {
        if (input.where.entityType === "student") {
          return [
            {
              metadata: {
                hasLegacyAvatarData: true
              }
            }
          ];
        }
        return [
          {
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,happy",
                sad: "data:image/jpeg;base64,sad"
              }
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().student.profile.avatarHappyData, "data:image/jpeg;base64,happy");
  assert.equal(response.json().student.profile.avatarSadData, "data:image/jpeg;base64,sad");
  assert.equal(response.json().student.profile.legacyAvatarPending, false);
  assert.equal(response.json().deleteGuard.canDelete, false);
  await app.close();
});

test("PUT /students/:studentId/profile updates student profile and writes audit log", async () => {
  const profileUpserts: any[] = [];
  const mappingUpserts: any[] = [];
  const mappingDeletes: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          profile: {
            titleLeft: "原称号",
            titleRight: null,
            notes: null
          }
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    migrationMapping: {
      async findMany(input: any) {
        if (input.where.entityType === "student") {
          return [
            {
              legacyScope: "tenant-slug",
              legacyKey: "student:1",
              metadata: {
                hasLegacyAvatarData: true
              }
            }
          ];
        }
        return [];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        studentProfile: {
          async upsert(input: any) {
            profileUpserts.push(input);
            return {
              studentId: STUDENT_ID,
              titleLeft: "纪律标兵",
              titleRight: "进步之星",
              notes: "表现稳定"
            };
          }
        },
        migrationMapping: {
          async upsert(input: any) {
            mappingUpserts.push(input);
          },
          async deleteMany(input: any) {
            mappingDeletes.push(input);
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
    url: `/api/students/${STUDENT_ID}/profile`,
    payload: {
      titleLeft: "纪律标兵",
      titleRight: "进步之星",
      notes: "表现稳定",
      avatarHappyData: "data:image/jpeg;base64,happy"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(profileUpserts.length, 1);
  assert.equal(profileUpserts[0].update.titleLeft, "纪律标兵");
  assert.equal(mappingUpserts.length, 1);
  assert.equal(mappingDeletes.length, 1);
  assert.equal(mappingUpserts[0].create.entityType, "student_avatar");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "student.profile.update");
  assert.equal(response.json().profile.titleRight, "进步之星");
  assert.equal(response.json().profile.avatarHappyData, "data:image/jpeg;base64,happy");
  await app.close();
});

test("PUT /students/:studentId/profile rejects unchanged payload", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          profile: {
            titleLeft: "纪律标兵",
            titleRight: "进步之星",
            notes: "表现稳定"
          }
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    migrationMapping: {
      async findMany() {
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/students/${STUDENT_ID}/profile`,
    payload: {
      titleLeft: "纪律标兵",
      titleRight: "进步之星",
      notes: "表现稳定"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student profile unchanged");
  await app.close();
});

test("GET /students/:studentId prefers structured-full avatar mapping and merges lower-priority fields", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          legacyId: 1,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "active",
          sortOrder: 1,
          account: null,
          profile: null,
          groups: [],
          dorms: [],
          positions: []
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
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
        return [];
      },
      async count() {
        return 0;
      }
    },
    attendanceRecord: {
      async count() {
        return 0;
      }
    },
    auditLog: {
      async findMany() {
        return [];
      }
    },
    classConfig: {
      async findUnique() {
        return {
          extra: {}
        };
      }
    },
    migrationMapping: {
      async findMany(input: any) {
        if (input.where.entityType === "student") {
          return [
            {
              legacyScope: "tenant-slug",
              legacyKey: "student:1",
              metadata: {
                hasLegacyAvatarData: true
              }
            }
          ];
        }
        return [
          {
            legacyScope: "tenant-slug",
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
            legacyScope: `structured-full:${CLASS_ID}`,
            createdAt: new Date("2026-03-18T08:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,full-happy",
                normal: null,
                sad: "data:image/jpeg;base64,full-sad"
              }
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().student.profile.avatarHappyData, "data:image/jpeg;base64,full-happy");
  assert.equal(response.json().student.profile.avatarNormalData, "data:image/jpeg;base64,tenant-normal");
  assert.equal(response.json().student.profile.avatarSadData, "data:image/jpeg;base64,full-sad");
  assert.equal(response.json().deleteGuard.canDelete, true);
  await app.close();
});

test("PUT /students/:studentId/profile deletes stale avatar mappings after choosing preferred scope", async () => {
  const mappingUpserts: any[] = [];
  const mappingDeletes: any[] = [];

  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          profile: {
            titleLeft: null,
            titleRight: null,
            notes: null
          }
        };
      }
    },
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID,
          tenant: {
            slug: "tenant-slug"
          }
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    migrationMapping: {
      async findMany(input: any) {
        if (input.where.entityType === "student") {
          return [
            {
              legacyScope: "tenant-slug",
              legacyKey: "student:1",
              metadata: {
                hasLegacyAvatarData: true
              }
            }
          ];
        }
        return [
          {
            legacyScope: "tenant-slug",
            legacyKey: "student:1",
            createdAt: new Date("2026-03-17T08:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,tenant-old"
              }
            }
          },
          {
            legacyScope: `structured-full:${CLASS_ID}`,
            legacyKey: "student:1",
            createdAt: new Date("2026-03-18T08:00:00.000Z"),
            metadata: {
              avatarData: {
                happy: "data:image/jpeg;base64,full-old"
              }
            }
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        studentProfile: {
          async upsert() {
            return {
              studentId: STUDENT_ID,
              titleLeft: null,
              titleRight: null,
              notes: null
            };
          }
        },
        migrationMapping: {
          async upsert(input: any) {
            mappingUpserts.push(input);
          },
          async deleteMany(input: any) {
            mappingDeletes.push(input);
          }
        },
        auditLog: {
          async create() {
            return null;
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/students/${STUDENT_ID}/profile`,
    payload: {
      avatarHappyData: "data:image/jpeg;base64,new-avatar"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(mappingUpserts.length, 1);
  assert.equal(mappingUpserts[0].create.legacyScope, `structured-full:${CLASS_ID}`);
  assert.equal(mappingDeletes.length, 1);
  assert.deepEqual(mappingDeletes[0].where.NOT, {
    legacyScope: `structured-full:${CLASS_ID}`,
    legacyKey: "student:1"
  });
  await app.close();
});

test("PUT /students/:studentId updates basic student fields and writes audit log", async () => {
  const studentUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          name: "张三",
          studentNo: "01",
          gender: "男",
          status: "active",
          sortOrder: 1
        };
      },
      async findFirst() {
        return null;
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
        student: {
          async update(input: any) {
            studentUpdates.push(input);
            return {
              id: STUDENT_ID,
              classId: CLASS_ID,
              name: "李四",
              studentNo: "02",
              gender: "女",
              status: "archived",
              sortOrder: 9
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
    url: `/api/students/${STUDENT_ID}`,
    payload: {
      name: "李四",
      studentNo: "02",
      gender: "女",
      status: "archived",
      sortOrder: 9
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(studentUpdates.length, 1);
  assert.equal(studentUpdates[0].data.name, "李四");
  assert.equal(studentUpdates[0].data.studentNo, "02");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "student.update");
  assert.equal(response.json().student.name, "李四");
  await app.close();
});

test("PUT /students/:studentId rejects unchanged payload", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          name: "张三",
          studentNo: "01",
          gender: "男",
          status: "active",
          sortOrder: 1
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
    url: `/api/students/${STUDENT_ID}`,
    payload: {
      name: "张三",
      studentNo: "01",
      gender: "男",
      status: "active",
      sortOrder: 1
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student unchanged");
  await app.close();
});

test("PUT /students/:studentId rejects duplicate student number", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          name: "张三",
          studentNo: "01",
          gender: "男",
          status: "active",
          sortOrder: 1
        };
      },
      async findFirst() {
        return {
          id: "existing"
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
    url: `/api/students/${STUDENT_ID}`,
    payload: {
      studentNo: "02"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Student number already exists");
  await app.close();
});

test("PUT /students/:studentId rejects writes when class is frozen", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          name: "张三",
          studentNo: "01",
          gender: "男",
          status: "active",
          sortOrder: 1
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: true
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
    url: `/api/students/${STUDENT_ID}`,
    payload: {
      name: "李四"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("DELETE /students/:studentId deletes empty student, mappings and writes audit log", async () => {
  const configUpdates: any[] = [];
  const mappingDeletes: any[] = [];
  const studentDeletes: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "active",
          sortOrder: 1,
          account: {
            totalPoints: 0,
            balancePoints: 0,
            penaltyPoints: 0
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          extra: {
            duty: {
              mon: [STUDENT_ID, "other-student"]
            },
            subjects: [
              {
                id: "subject-1",
                name: "语文",
                representativeStudentIds: [STUDENT_ID]
              }
            ],
            psychologyCommitteeStudentIds: [STUDENT_ID],
            studentCouncilRoles: [
              {
                id: "role-1",
                name: "学习部",
                studentId: STUDENT_ID
              }
            ],
            legacyCompat: {
              tasks: [
                {
                  id: "task-1",
                  title: "值日",
                  claimedByStudentIds: [STUDENT_ID]
                }
              ],
              shop: {
                storage: {
                  [STUDENT_ID]: {
                    treasure_1: 2
                  }
                },
                redemptionHistory: {
                  [STUDENT_ID]: {
                    treasure_1: 1
                  }
                }
              },
              battle: {
                teams: [
                  {
                    id: "team-1",
                    name: "一队",
                    memberStudentIds: [STUDENT_ID, STUDENT_ID_2],
                    points: 10
                  }
                ]
              }
            }
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    pointTransaction: {
      async count() {
        return 0;
      }
    },
    attendanceRecord: {
      async count() {
        return 0;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        classConfig: {
          async update(input: any) {
            configUpdates.push(input);
            return null;
          }
        },
        migrationMapping: {
          async deleteMany(input: any) {
            mappingDeletes.push(input);
            return { count: 2 };
          }
        },
        student: {
          async delete(input: any) {
            studentDeletes.push(input);
            return { id: STUDENT_ID };
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
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(configUpdates.length, 1);
  assert.deepEqual(configUpdates[0].data.extra.duty.mon, ["other-student"]);
  assert.deepEqual(configUpdates[0].data.extra.subjects[0].representativeStudentIds, []);
  assert.equal(configUpdates[0].data.extra.psychologyCommitteeStudentIds.length, 0);
  assert.equal(configUpdates[0].data.extra.studentCouncilRoles[0].studentId, null);
  assert.deepEqual(configUpdates[0].data.extra.legacyCompat.tasks[0].claimedByStudentIds, []);
  assert.equal(configUpdates[0].data.extra.legacyCompat.shop.storage[STUDENT_ID], undefined);
  assert.equal(configUpdates[0].data.extra.legacyCompat.shop.redemptionHistory[STUDENT_ID], undefined);
  assert.deepEqual(configUpdates[0].data.extra.legacyCompat.battle.teams[0].memberStudentIds, [STUDENT_ID_2]);
  assert.equal(mappingDeletes.length, 1);
  assert.deepEqual(mappingDeletes[0].where.entityType.in, ["student", "student_avatar"]);
  assert.equal(studentDeletes.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "student.delete");
  assert.deepEqual(auditCreates[0].data.metadata.cleanupMessages, [
    "值日安排 1 处",
    "科目代表 1 处",
    "心理委员名单 1 处",
    "学生会岗位 1 处",
    "兼容任务领取 1 处",
    "藏宝阁仓库 1 项",
    "藏宝阁兑换历史 1 项",
    "双子星战队成员 1 处"
  ]);
  assert.equal(response.json().deleted, true);
  await app.close();
});

test("DELETE /students/:studentId rejects delete when history exists", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "active",
          sortOrder: 1,
          account: {
            totalPoints: 0,
            balancePoints: 0,
            penaltyPoints: 0
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          extra: {}
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    pointTransaction: {
      async count() {
        return 2;
      }
    },
    attendanceRecord: {
      async count() {
        return 1;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "DELETE",
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student delete blocked");
  assert.equal(response.json().deleteGuard.canDelete, false);
  assert.equal(response.json().deleteGuard.blockers.length, 2);
  await app.close();
});

test("DELETE /students/:studentId rejects delete when compat history still references student", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          tenantId: TENANT_ID,
          classId: CLASS_ID,
          studentNo: "01",
          name: "张三",
          gender: "男",
          status: "archived",
          sortOrder: 1,
          account: {
            totalPoints: 0,
            balancePoints: 0,
            penaltyPoints: 0
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false,
          extra: {
            legacyCompat: {
              battle: {
                exams: [
                  {
                    id: "exam-1",
                    name: "联考",
                    ranks: {
                      [STUDENT_ID]: {
                        c: 3,
                        g: 12
                      }
                    }
                  }
                ]
              },
              tasks: [
                {
                  id: "task-1",
                  title: "值日",
                  claimedByStudentIds: [STUDENT_ID]
                }
              ]
            }
          }
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    pointTransaction: {
      async count() {
        return 0;
      }
    },
    attendanceRecord: {
      async count() {
        return 0;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "DELETE",
    url: `/api/students/${STUDENT_ID}`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Student delete blocked");
  assert.equal(response.json().deleteGuard.canDelete, false);
  assert.match(response.json().deleteGuard.blockers[0], /班级配置或兼容区数据/);
  assert.deepEqual(response.json().deleteGuard.cleanupMessages, ["兼容任务领取 1 处"]);
  await app.close();
});

test("POST /classes/:classId/students creates student, account and audit log", async () => {
  const studentCreates: any[] = [];
  const accountCreates: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
        return null;
      },
      async aggregate() {
        return {
          _max: {
            sortOrder: 8
          }
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        student: {
          async create(input: any) {
            studentCreates.push(input);
            return {
              id: STUDENT_ID,
              classId: CLASS_ID,
              studentNo: "03",
              name: "王五",
              gender: "男",
              status: "active",
              sortOrder: 9
            };
          }
        },
        pointAccount: {
          async create(input: any) {
            accountCreates.push(input);
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
    url: `/api/classes/${CLASS_ID}/students`,
    payload: {
      studentNo: "03",
      name: "王五",
      gender: "男"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(studentCreates.length, 1);
  assert.equal(studentCreates[0].data.sortOrder, 9);
  assert.equal(accountCreates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "student.create");
  assert.equal(response.json().student.name, "王五");
  await app.close();
});

test("POST /classes/:classId/students rejects duplicate student number", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
          id: "existing"
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/classes/${CLASS_ID}/students`,
    payload: {
      studentNo: "03",
      name: "王五"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Student number already exists");
  await app.close();
});

test("POST /classes/:classId/students rejects writes when class is frozen", async () => {
  const prisma = {
    class: {
      async findUnique() {
        return {
          id: CLASS_ID,
          tenantId: TENANT_ID
        };
      }
    },
    classConfig: {
      async findUnique() {
        return {
          isFrozen: true
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
    url: `/api/classes/${CLASS_ID}/students`,
    payload: {
      name: "王五"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Class is frozen");
  await app.close();
});

test("PUT /students/:studentId/organization updates primary group and dormitory", async () => {
  const groupUpdateManyCalls: any[] = [];
  const groupCreateCalls: any[] = [];
  const dormUpdateManyCalls: any[] = [];
  const dormCreateCalls: any[] = [];
  const positionUpdateManyCalls: any[] = [];
  const positionCreateManyCalls: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          groups: [
            {
              id: "assignment-1",
              groupId: GROUP_ID_OLD,
              isPrimary: true,
              group: {
                id: GROUP_ID_OLD,
                name: "旧组"
              }
            }
          ],
          dorms: [
            {
              id: "assignment-2",
              dormitoryId: DORM_ID_OLD,
              isPrimary: true,
              dormitory: {
                id: DORM_ID_OLD,
                name: "旧宿舍"
              }
            }
          ],
          positions: [
            {
              id: "assignment-3",
              positionId: POSITION_ID_OLD,
              position: {
                id: POSITION_ID_OLD,
                code: "leader",
                name: "班长",
                category: "班委"
              }
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    group: {
      async findFirst() {
        return {
          id: GROUP_ID_NEW,
          name: "新组"
        };
      }
    },
    dormitory: {
      async findFirst() {
        return {
          id: DORM_ID_NEW,
          name: "新宿舍"
        };
      }
    },
    position: {
      async findMany() {
        return [
          {
            id: POSITION_ID_NEW,
            code: "monitor",
            name: "值日生",
            category: "事务"
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        studentGroupAssignment: {
          async updateMany(input: any) {
            groupUpdateManyCalls.push(input);
          },
          async create(input: any) {
            groupCreateCalls.push(input);
          }
        },
        studentDormAssignment: {
          async updateMany(input: any) {
            dormUpdateManyCalls.push(input);
          },
          async create(input: any) {
            dormCreateCalls.push(input);
          }
        },
        studentPositionAssignment: {
          async updateMany(input: any) {
            positionUpdateManyCalls.push(input);
          },
          async createMany(input: any) {
            positionCreateManyCalls.push(input);
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
    url: `/api/students/${STUDENT_ID}/organization`,
    payload: {
      groupId: GROUP_ID_NEW,
      dormitoryId: DORM_ID_NEW,
      positionIds: [POSITION_ID_NEW]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(groupUpdateManyCalls.length, 1);
  assert.equal(groupCreateCalls.length, 1);
  assert.equal(dormUpdateManyCalls.length, 1);
  assert.equal(dormCreateCalls.length, 1);
  assert.equal(positionUpdateManyCalls.length, 1);
  assert.equal(positionCreateManyCalls.length, 1);
  assert.equal(auditCreates[0].data.action, "student.organization.update");
  assert.equal(response.json().organization.primaryGroup.name, "新组");
  assert.equal(response.json().organization.primaryDormitory.name, "新宿舍");
  assert.equal(response.json().organization.positions[0].id, POSITION_ID_NEW);
  await app.close();
});

test("PUT /students/:studentId/organization rejects invalid group", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          groups: [],
          dorms: [],
          positions: []
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
        };
      }
    },
    membership: {
      async findUnique() {
        return createMembership(["tenant_owner"]);
      }
    },
    group: {
      async findFirst() {
        return null;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/students/${STUDENT_ID}/organization`,
    payload: {
      groupId: "77777777-7777-4777-8777-777777777777"
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Group not found");
  await app.close();
});

test("PUT /students/:studentId/organization rejects invalid position", async () => {
  const prisma = {
    student: {
      async findUnique() {
        return {
          id: STUDENT_ID,
          classId: CLASS_ID,
          tenantId: TENANT_ID,
          groups: [],
          dorms: [],
          positions: []
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/students/${STUDENT_ID}/organization`,
    payload: {
      positionIds: ["77777777-7777-4777-8777-777777777777"]
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().message, "Position not found");
  await app.close();
});

test("PUT /classes/:classId/students/positions/batch updates student positions", async () => {
  const positionUpdateManyCalls: any[] = [];
  const positionCreateManyCalls: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
          { id: STUDENT_ID, name: "张三" },
          { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "李四" }
        ];
      }
    },
    position: {
      async findMany() {
        return [
          {
            id: POSITION_ID_NEW,
            code: "monitor",
            name: "值日生",
            category: "事务"
          }
        ];
      }
    },
    studentPositionAssignment: {
      async findMany() {
        return [
          {
            id: "assignment-1",
            studentId: STUDENT_ID,
            positionId: POSITION_ID_OLD
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        studentPositionAssignment: {
          async updateMany(input: any) {
            positionUpdateManyCalls.push(input);
          },
          async createMany(input: any) {
            positionCreateManyCalls.push(input);
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
    url: `/api/classes/${CLASS_ID}/students/positions/batch`,
    payload: {
      studentIds: [STUDENT_ID, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      positionIds: [POSITION_ID_NEW]
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(positionUpdateManyCalls.length, 1);
  assert.equal(positionCreateManyCalls.length, 2);
  assert.equal(auditCreates.length, 2);
  assert.equal(response.json().updatedCount, 2);
  await app.close();
});

test("PUT /classes/:classId/students/organization/batch updates student groups and dorms", async () => {
  const groupUpdateManyCalls: any[] = [];
  const groupCreateCalls: any[] = [];
  const dormUpdateManyCalls: any[] = [];
  const dormCreateCalls: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
            groups: [
              {
                groupId: GROUP_ID_OLD,
                isPrimary: true,
                group: {
                  id: GROUP_ID_OLD,
                  name: "旧组"
                }
              }
            ],
            dorms: [
              {
                dormitoryId: DORM_ID_OLD,
                isPrimary: true,
                dormitory: {
                  id: DORM_ID_OLD,
                  name: "旧宿舍"
                }
              }
            ]
          }
        ];
      }
    },
    group: {
      async findFirst() {
        return {
          id: GROUP_ID_NEW,
          name: "新组"
        };
      }
    },
    dormitory: {
      async findFirst() {
        return {
          id: DORM_ID_NEW,
          name: "新宿舍"
        };
      }
    },
    $transaction: async (fn: any) =>
      fn({
        studentGroupAssignment: {
          async updateMany(input: any) {
            groupUpdateManyCalls.push(input);
          },
          async create(input: any) {
            groupCreateCalls.push(input);
          }
        },
        studentDormAssignment: {
          async updateMany(input: any) {
            dormUpdateManyCalls.push(input);
          },
          async create(input: any) {
            dormCreateCalls.push(input);
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
    url: `/api/classes/${CLASS_ID}/students/organization/batch`,
    payload: {
      studentIds: [STUDENT_ID],
      groupId: GROUP_ID_NEW,
      dormitoryId: DORM_ID_NEW
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(groupUpdateManyCalls.length, 1);
  assert.equal(groupCreateCalls.length, 1);
  assert.equal(dormUpdateManyCalls.length, 1);
  assert.equal(dormCreateCalls.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(response.json().updatedCount, 1);
  await app.close();
});

test("PUT /classes/:classId/students/status/batch updates student status", async () => {
  const studentUpdates: any[] = [];
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
    classConfig: {
      async findUnique() {
        return {
          isFrozen: false
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
          { id: STUDENT_ID, name: "张三", status: "active" },
          { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "李四", status: "inactive" }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        student: {
          async update(input: any) {
            studentUpdates.push(input);
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
    url: `/api/classes/${CLASS_ID}/students/status/batch`,
    payload: {
      studentIds: [STUDENT_ID, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
      status: "active"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(studentUpdates.length, 1);
  assert.equal(auditCreates.length, 1);
  assert.equal(response.json().updatedCount, 1);
  assert.equal(response.json().skippedCount, 1);
  await app.close();
});
