import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { adminRoutes } from "./routes.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_MEMBERSHIP_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_MEMBERSHIP_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const TARGET_USER_ID = "55555555-5555-4555-8555-555555555555";

function createAdminMembership(roleCodes: string[]) {
  return {
    id: ADMIN_MEMBERSHIP_ID,
    tenantId: TENANT_ID,
    userId: USER_ID,
    status: "active",
    roles: roleCodes.map((code) => ({
      role: {
        code
      }
    })),
    tenant: {
      id: "tenant-1",
      name: "测试租户",
      slug: "tenant-test",
      type: "class",
      status: "active"
    }
  };
}

async function createTestApp(prisma: any) {
  const app = Fastify();
  await app.register(sensible);
  app.decorate("prisma", prisma);
  app.decorate(
    "authenticate",
    async (request: any) => {
      request.auth = {
        sub: USER_ID
      };
    }
  );
  await app.register(adminRoutes, { prefix: "/api" });
  return app;
}

test("GET /admin/summary returns tenant admin summary for tenant owner", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async groupBy() {
        return [
          {
            status: "active",
            _count: {
              _all: 3
            }
          },
          {
            status: "invited",
            _count: {
              _all: 1
            }
          }
        ];
      }
    },
    role: {
      async count() {
        return 6;
      }
    },
    auditLog: {
      async count() {
        return 4;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/summary`
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.deepEqual(body.totals, {
    members: 4,
    activeMembers: 3,
    disabledMembers: 0,
    invitedMembers: 1,
    roles: 6,
    roleAuditLogs: 4
  });
  await app.close();
});

test("GET /admin/members returns members for tenant owner", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findMany() {
        return [
          {
            id: ADMIN_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            displayName: "14ban",
            status: "active",
            joinedAt: "2026-03-09T10:04:17.850Z",
            roles: [
              {
                role: {
                  id: "role-1",
                  code: "tenant_owner",
                  name: "Tenant Owner",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: USER_ID,
              username: "14ban",
              email: null,
              displayName: "14ban",
              status: "active",
              lastLoginAt: null
            }
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/members`
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].roleCodes[0], "tenant_owner");
  await app.close();
});

test("GET /admin/members forwards search and status filters", async () => {
  let capturedFindManyInput: any = null;

  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findMany(input: any) {
        capturedFindManyInput = input;
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/members?status=disabled&search=teacher-a`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFindManyInput.where.tenantId, TENANT_ID);
  assert.equal(capturedFindManyInput.where.status, "disabled");
  assert.equal(capturedFindManyInput.where.OR.length, 3);
  assert.equal(capturedFindManyInput.where.OR[0].displayName.contains, "teacher-a");
  assert.equal(capturedFindManyInput.where.OR[1].user.username.contains, "teacher-a");
  assert.equal(capturedFindManyInput.where.OR[2].user.displayName.contains, "teacher-a");
  await app.close();
});

test("GET /admin/members forwards role filter", async () => {
  let capturedFindManyInput: any = null;

  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findMany(input: any) {
        capturedFindManyInput = input;
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/members?roleCode=tenant_admin`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFindManyInput.where.roles.some.role.code, "tenant_admin");
  await app.close();
});

test("GET /admin/members forwards sortBy", async () => {
  let capturedFindManyInput: any = null;

  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findMany(input: any) {
        capturedFindManyInput = input;
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/members?sortBy=lastLoginAt`
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(capturedFindManyInput.orderBy, [{ user: { lastLoginAt: "desc" } }, { joinedAt: "desc" }]);
  await app.close();
});

test("GET /admin/members/:membershipId includes recent audit actions", async () => {
  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "active",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-member",
                  tenantId: TENANT_ID,
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null,
              createdAt: "2026-03-10T00:00:00.000Z",
              updatedAt: "2026-03-10T00:00:00.000Z"
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    auditLog: {
      async findMany() {
        return [
          {
            id: "audit-1",
            action: "membership.status.enable",
            targetType: "membership",
            targetId: TARGET_MEMBERSHIP_ID,
            actorUserId: USER_ID,
            actorMembershipId: ADMIN_MEMBERSHIP_ID,
            beforeData: { status: "invited" },
            afterData: { status: "active" },
            createdAt: "2026-03-10T10:00:00.000Z",
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
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().recentAudits[0].action, "membership.status.enable");
  assert.equal(response.json().recentAudits[0].actorUser.displayName, "14班");
  await app.close();
});

test("GET /admin/audits forwards action filter", async () => {
  let capturedFindManyInput: any = null;

  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      }
    },
    auditLog: {
      async findMany(input: any) {
        capturedFindManyInput = input;
        return [];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/audits?action=membership.password.set&membershipId=${TARGET_MEMBERSHIP_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(capturedFindManyInput.where.action, "membership.password.set");
  assert.equal(capturedFindManyInput.where.targetId, TARGET_MEMBERSHIP_ID);
  await app.close();
});

test("GET /admin/summary rejects membership without admin read role", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["points_manager"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/summary`
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Tenant admin access denied");
  await app.close();
});

test("GET /admin/members rejects membership without admin read role", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["points_manager"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "GET",
    url: `/api/tenants/${TENANT_ID}/admin/members`
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Tenant admin access denied");
  await app.close();
});

test("POST /admin/members/invitations creates invited membership and audit log", async () => {
  const userCreates: any[] = [];
  const membershipCreates: any[] = [];
  const membershipRoleCreates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findFirst() {
        return null;
      }
    },
    user: {
      async findFirst() {
        return null;
      }
    },
    role: {
      async findMany() {
        return [
          {
            id: "role-member",
            tenantId: TENANT_ID,
            code: "tenant_member",
            name: "Tenant Member",
            scope: "tenant"
          }
        ];
      }
    },
    $transaction: async (fn: any) =>
      fn({
        user: {
          async create(input: any) {
            userCreates.push(input);
            return {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "invited",
              lastLoginAt: null
            };
          }
        },
        membership: {
          async create(input: any) {
            membershipCreates.push(input);
            return {
              id: TARGET_MEMBERSHIP_ID
            };
          },
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "Teacher A",
              status: "invited",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-member",
                    tenantId: TENANT_ID,
                    code: "tenant_member",
                    name: "Tenant Member",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: "teacher-a@example.com",
                displayName: "Teacher A",
                status: "invited",
                lastLoginAt: null
              }
            };
          }
        },
        membershipRole: {
          async createMany(input: any) {
            membershipRoleCreates.push(input);
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
    url: `/api/tenants/${TENANT_ID}/admin/members/invitations`,
    payload: {
      username: "teacher-a",
      displayName: "Teacher A",
      email: "Teacher-A@example.com",
      roleCodes: ["tenant_member"]
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.item.status, "invited");
  assert.equal(body.item.user.username, "teacher-a");
  assert.equal(userCreates.length, 1);
  assert.equal(userCreates[0].data.status, "invited");
  assert.equal(userCreates[0].data.email, "teacher-a@example.com");
  assert.equal(typeof userCreates[0].data.passwordHash, "string");
  assert.notEqual(userCreates[0].data.passwordHash.length, 0);
  assert.equal(membershipCreates.length, 1);
  assert.equal(membershipCreates[0].data.status, "invited");
  assert.equal(membershipRoleCreates.length, 1);
  assert.deepEqual(membershipRoleCreates[0].data, [
    {
      membershipId: TARGET_MEMBERSHIP_ID,
      roleId: "role-member"
    }
  ]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.invite.create");
  assert.deepEqual(auditCreates[0].data.afterData, {
    status: "invited",
    roleCodes: ["tenant_member"],
    username: "teacher-a"
  });
  await app.close();
});

test("POST /admin/members/invitations rejects duplicate tenant membership", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findFirst() {
        return {
          id: TARGET_MEMBERSHIP_ID
        };
      }
    },
    role: {
      async findMany() {
        return [
          {
            id: "role-member",
            tenantId: TENANT_ID,
            code: "tenant_member",
            name: "Tenant Member",
            scope: "tenant"
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/tenants/${TENANT_ID}/admin/members/invitations`,
    payload: {
      username: "teacher-a",
      displayName: "Teacher A",
      email: "teacher-a@example.com",
      roleCodes: ["tenant_member"]
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().message, "Membership already exists for this tenant");
  await app.close();
});

test("POST /admin/members/invitations rejects disabled existing user", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      },
      async findFirst() {
        return null;
      }
    },
    user: {
      async findFirst() {
        return {
          id: TARGET_USER_ID,
          username: "teacher-a",
          email: "teacher-a@example.com",
          displayName: "Teacher A",
          status: "disabled",
          lastLoginAt: null
        };
      }
    },
    role: {
      async findMany() {
        return [
          {
            id: "role-member",
            tenantId: TENANT_ID,
            code: "tenant_member",
            name: "Tenant Member",
            scope: "tenant"
          }
        ];
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: `/api/tenants/${TENANT_ID}/admin/members/invitations`,
    payload: {
      username: "teacher-a",
      displayName: "Teacher A",
      email: "teacher-a@example.com",
      roleCodes: ["tenant_member"]
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Disabled user cannot be invited in this phase");
  await app.close();
});

test("PUT /admin/members/:membershipId/roles rejects self role change", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${ADMIN_MEMBERSHIP_ID}/roles`,
    payload: {
      roleCodes: ["tenant_admin"]
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Self role change is disabled in this phase");
  await app.close();
});

test("PUT /admin/members/:membershipId/status rejects self status change", async () => {
  const prisma = {
    membership: {
      async findUnique() {
        return createAdminMembership(["tenant_owner"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${ADMIN_MEMBERSHIP_ID}/status`,
    payload: {
      status: "disabled"
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Self status change is disabled in this phase");
  await app.close();
});

test("PUT /admin/members/:membershipId/status rejects disabling the last tenant owner", async () => {
  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "active",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-owner",
                  code: "tenant_owner",
                  name: "Tenant Owner",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: null,
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_admin"]);
      }
    },
    membershipRole: {
      async count() {
        return 1;
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/status`,
    payload: {
      status: "disabled"
    }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Cannot disable the last tenant owner");
  await app.close();
});

test("PUT /admin/members/:membershipId/status updates membership status and writes audit log", async () => {
  const auditCreates: any[] = [];
  const membershipUpdates: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "active",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-member",
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: null,
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        membership: {
          async update(input: any) {
            membershipUpdates.push(input);
          },
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "teacher-a",
              status: "disabled",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-member",
                    code: "tenant_member",
                    name: "Tenant Member",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: null,
                displayName: "Teacher A",
                status: "active",
                lastLoginAt: null
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
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/status`,
    payload: {
      status: "disabled"
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.item.status, "disabled");
  assert.equal(membershipUpdates.length, 1);
  assert.deepEqual(membershipUpdates[0], {
    where: { id: TARGET_MEMBERSHIP_ID },
    data: {
      status: "disabled"
    }
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.status.disable");
  assert.deepEqual(auditCreates[0].data.beforeData, {
    status: "active"
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    status: "disabled"
  });
  await app.close();
});

test("PUT /admin/members/:membershipId/status enables disabled membership and writes audit log", async () => {
  const auditCreates: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "disabled",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-member",
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: null,
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        membership: {
          async update() {},
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "teacher-a",
              status: "active",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-member",
                    code: "tenant_member",
                    name: "Tenant Member",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: null,
                displayName: "Teacher A",
                status: "active",
                lastLoginAt: null
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
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/status`,
    payload: {
      status: "active"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().item.status, "active");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.status.enable");
  await app.close();
});

test("PUT /admin/members/:membershipId/status activates invited membership and user", async () => {
  const userUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "invited",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-member",
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "invited",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        membership: {
          async update() {},
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "teacher-a",
              status: "active",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-member",
                    code: "tenant_member",
                    name: "Tenant Member",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: "teacher-a@example.com",
                displayName: "Teacher A",
                status: "active",
                lastLoginAt: null
              }
            };
          }
        },
        user: {
          async update(input: any) {
            userUpdates.push(input);
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
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/status`,
    payload: {
      status: "active"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().item.status, "active");
  assert.equal(userUpdates.length, 1);
  assert.deepEqual(userUpdates[0], {
    where: {
      id: TARGET_USER_ID
    },
    data: {
      status: "active"
    }
  });
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.status.enable");
  await app.close();
});

test("PUT /admin/members/:membershipId/password updates password hash and writes audit log", async () => {
  const userUpdates: any[] = [];
  const auditCreates: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "invited",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-member",
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "invited",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        user: {
          async update(input: any) {
            userUpdates.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        },
        membership: {
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "teacher-a",
              status: "invited",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-member",
                    code: "tenant_member",
                    name: "Tenant Member",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: "teacher-a@example.com",
                displayName: "Teacher A",
                status: "invited",
                lastLoginAt: null
              }
            };
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/password`,
    payload: {
      password: "ChangeMe123!"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().item.id, TARGET_MEMBERSHIP_ID);
  assert.equal(userUpdates.length, 1);
  assert.equal(userUpdates[0].where.id, TARGET_USER_ID);
  assert.equal(typeof userUpdates[0].data.passwordHash, "string");
  assert.notEqual(userUpdates[0].data.passwordHash, "ChangeMe123!");
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.password.set");
  await app.close();
});

test("PUT /admin/members/:membershipId/password rejects self password change", async () => {
  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === ADMIN_MEMBERSHIP_ID) {
          return {
            id: ADMIN_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: USER_ID,
            displayName: "14ban",
            status: "active",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-owner",
                  code: "tenant_owner",
                  name: "Tenant Owner",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: USER_ID,
              username: "14ban",
              email: null,
              displayName: "14ban",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${ADMIN_MEMBERSHIP_ID}/password`,
    payload: {
      password: "ChangeMe123!"
    }
  });

  assert.equal(response.statusCode, 403);
  assert.equal(response.json().message, "Self password change is disabled in this phase");
  await app.close();
});

test("DELETE /admin/members/:membershipId deletes invited membership and writes audit log", async () => {
  const auditCreates: any[] = [];
  const roleDeletes: any[] = [];
  const membershipDeletes: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "invited",
            roles: [
              {
                role: {
                  id: "role-member",
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "invited",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    $transaction: async (fn: any) =>
      fn({
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        },
        membershipRole: {
          async deleteMany(input: any) {
            roleDeletes.push(input);
          }
        },
        membership: {
          async delete(input: any) {
            membershipDeletes.push(input);
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "DELETE",
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}`
  });

  assert.equal(response.statusCode, 200);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.delete");
  assert.equal(roleDeletes.length, 1);
  assert.equal(membershipDeletes.length, 1);
  assert.equal(response.json().deleted, true);
  await app.close();
});

test("DELETE /admin/members/:membershipId rejects active membership deletion", async () => {
  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "active",
            roles: [],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: "teacher-a@example.com",
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "DELETE",
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}`
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.json().message, "Active membership deletion is not supported in this phase");
  await app.close();
});

test("PUT /admin/members/:membershipId/roles updates roles and writes audit log", async () => {
  const auditCreates: any[] = [];
  const deletedRoleLinks: any[] = [];
  const createdRoleLinks: any[] = [];

  const prisma = {
    membership: {
      async findUnique(input: any) {
        if (input.where.id === TARGET_MEMBERSHIP_ID) {
          return {
            id: TARGET_MEMBERSHIP_ID,
            tenantId: TENANT_ID,
            userId: TARGET_USER_ID,
            displayName: "teacher-a",
            status: "active",
            joinedAt: "2026-03-10T00:00:00.000Z",
            roles: [
              {
                role: {
                  id: "role-old",
                  tenantId: TENANT_ID,
                  code: "tenant_member",
                  name: "Tenant Member",
                  scope: "tenant"
                }
              }
            ],
            user: {
              id: TARGET_USER_ID,
              username: "teacher-a",
              email: null,
              displayName: "Teacher A",
              status: "active",
              lastLoginAt: null
            }
          };
        }

        return createAdminMembership(["tenant_owner"]);
      }
    },
    role: {
      async findMany() {
        return [
          {
            id: "role-new",
            tenantId: TENANT_ID,
            code: "tenant_admin",
            name: "Tenant Admin",
            scope: "tenant"
          }
        ];
      }
    },
    membershipRole: {
      async count() {
        return 2;
      }
    },
    $transaction: async (fn: any) =>
      fn({
        membershipRole: {
          async deleteMany(input: any) {
            deletedRoleLinks.push(input);
          },
          async createMany(input: any) {
            createdRoleLinks.push(input);
          }
        },
        auditLog: {
          async create(input: any) {
            auditCreates.push(input);
          }
        },
        membership: {
          async findUnique() {
            return {
              id: TARGET_MEMBERSHIP_ID,
              tenantId: TENANT_ID,
              userId: TARGET_USER_ID,
              displayName: "teacher-a",
              status: "active",
              joinedAt: "2026-03-10T00:00:00.000Z",
              roles: [
                {
                  role: {
                    id: "role-new",
                    code: "tenant_admin",
                    name: "Tenant Admin",
                    scope: "tenant"
                  }
                }
              ],
              user: {
                id: TARGET_USER_ID,
                username: "teacher-a",
                email: null,
                displayName: "Teacher A",
                status: "active",
                lastLoginAt: null
              }
            };
          }
        }
      })
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "PUT",
    url: `/api/tenants/${TENANT_ID}/admin/members/${TARGET_MEMBERSHIP_ID}/roles`,
    payload: {
      roleCodes: ["tenant_admin"]
    }
  });

  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.item.id, TARGET_MEMBERSHIP_ID);
  assert.deepEqual(body.item.roleCodes, ["tenant_admin"]);
  assert.equal(deletedRoleLinks.length, 1);
  assert.equal(createdRoleLinks.length, 1);
  assert.deepEqual(createdRoleLinks[0].data, [
    {
      membershipId: TARGET_MEMBERSHIP_ID,
      roleId: "role-new"
    }
  ]);
  assert.equal(auditCreates.length, 1);
  assert.equal(auditCreates[0].data.action, "membership.roles.update");
  assert.deepEqual(auditCreates[0].data.beforeData, {
    roleCodes: ["tenant_member"]
  });
  assert.deepEqual(auditCreates[0].data.afterData, {
    roleCodes: ["tenant_admin"]
  });
  await app.close();
});
