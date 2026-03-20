import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { hashPassword } from "../../lib/password.js";
import { canManageTenantMembers, canReadTenantMembers, getMembershipRoleCodes } from "../../lib/permissions.js";

const tenantParamsSchema = z.object({
  tenantId: z.string().uuid()
});

const memberListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
  status: z.enum(["active", "disabled", "invited"]).optional(),
  search: z.string().trim().min(1).max(120).optional(),
  roleCode: z.string().trim().min(1).max(50).optional(),
  sortBy: z.enum(["status", "joinedAt", "lastLoginAt"]).optional().default("status")
});

const membershipParamsSchema = z.object({
  tenantId: z.string().uuid(),
  membershipId: z.string().uuid()
});

const memberRoleUpdateBodySchema = z.object({
  roleCodes: z.array(z.string().trim().min(1).max(50)).min(1).max(20)
});

const memberInviteBodySchema = z.object({
  username: z.string().trim().min(3).max(50),
  displayName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  roleCodes: z.array(z.string().trim().min(1).max(50)).min(1).max(20)
});

const memberStatusUpdateBodySchema = z.object({
  status: z.enum(["active", "disabled"])
});

const memberPasswordUpdateBodySchema = z.object({
  password: z.string().min(8).max(100)
});

const adminAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  membershipId: z.string().uuid().optional(),
  action: z
    .enum([
      "membership.roles.update",
      "membership.status.disable",
      "membership.status.enable",
      "membership.invite.create",
      "membership.password.set",
      "membership.delete"
    ])
    .optional()
});

async function requireTenantAdminReadAccess(app: any, userId: string, tenantId: string) {
  const membership = await app.prisma.membership.findUnique({
    where: {
      tenantId_userId: {
        tenantId,
        userId
      }
    },
    include: {
      roles: {
        include: {
          role: {
            select: {
              code: true
            }
          }
        }
      },
      tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          status: true
        }
      }
    }
  });

  if (!membership || membership.status !== "active") {
    throw app.httpErrors.forbidden("Tenant access denied");
  }

  if (!canReadTenantMembers(membership)) {
    throw app.httpErrors.forbidden("Tenant admin access denied");
  }

  return membership;
}

function requireTenantAdminWriteAccess(app: any, membership: any) {
  if (!canManageTenantMembers(membership)) {
    throw app.httpErrors.forbidden("Tenant admin write access denied");
  }
}

function serializeMembership(membership: any) {
  return {
    id: membership.id,
    tenantId: membership.tenantId,
    userId: membership.userId,
    displayName: membership.displayName,
    status: membership.status,
    joinedAt: membership.joinedAt,
    roleCodes: getMembershipRoleCodes(membership),
    roles: membership.roles.map((item: any) => item.role),
    user: membership.user
  };
}

function serializeMembershipAudit(item: any) {
  return {
    id: item.id,
    action: item.action,
    targetType: item.targetType,
    targetId: item.targetId,
    actorUserId: item.actorUserId,
    actorMembershipId: item.actorMembershipId,
    beforeData: item.beforeData,
    afterData: item.afterData,
    createdAt: item.createdAt,
    actorUser: item.actorUser
      ? {
          id: item.actorUser.id,
          username: item.actorUser.username,
          displayName: item.actorUser.displayName
        }
      : null
  };
}

function buildMemberOrderBy(sortBy: "status" | "joinedAt" | "lastLoginAt") {
  if (sortBy === "joinedAt") {
    return [{ joinedAt: "desc" }];
  }

  if (sortBy === "lastLoginAt") {
    return [{ user: { lastLoginAt: "desc" } }, { joinedAt: "desc" }];
  }

  return [{ status: "asc" }, { joinedAt: "asc" }];
}

export const adminRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tenants/:tenantId/admin/summary", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = tenantParamsSchema.parse(request.params);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);

    const [membersByStatus, roleCount, auditCount] = await Promise.all([
      app.prisma.membership.groupBy({
        by: ["status"],
        where: {
          tenantId: params.tenantId
        },
        _count: {
          _all: true
        }
      }),
      app.prisma.role.count({
        where: {
          tenantId: params.tenantId
        }
      }),
      app.prisma.auditLog.count({
        where: {
          tenantId: params.tenantId,
          action: "membership.roles.update",
          targetType: "membership"
        }
      })
    ]);

    const totals = {
      members: 0,
      activeMembers: 0,
      disabledMembers: 0,
      invitedMembers: 0,
      roles: roleCount,
      roleAuditLogs: auditCount
    };

    for (const item of membersByStatus) {
      totals.members += item._count._all;
      if (item.status === "active") totals.activeMembers += item._count._all;
      if (item.status === "disabled") totals.disabledMembers += item._count._all;
      if (item.status === "invited") totals.invitedMembers += item._count._all;
    }

    return {
      tenant: adminMembership.tenant,
      adminMembership: {
        id: adminMembership.id,
        roleCodes: getMembershipRoleCodes(adminMembership)
      },
      totals
    };
  });

  app.get("/tenants/:tenantId/admin/members", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = tenantParamsSchema.parse(request.params);
    const query = memberListQuerySchema.parse(request.query);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);

    const items = await app.prisma.membership.findMany({
      where: {
        tenantId: params.tenantId,
        status: query.status,
        roles: query.roleCode
          ? {
              some: {
                role: {
                  code: query.roleCode
                }
              }
            }
          : undefined,
        OR: query.search
          ? [
              {
                displayName: {
                  contains: query.search,
                  mode: "insensitive"
                }
              },
              {
                user: {
                  username: {
                    contains: query.search,
                    mode: "insensitive"
                  }
                }
              },
              {
                user: {
                  displayName: {
                    contains: query.search,
                    mode: "insensitive"
                  }
                }
              }
            ]
          : undefined
      },
      orderBy: buildMemberOrderBy(query.sortBy),
      take: query.limit,
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    return {
      tenant: adminMembership.tenant,
      adminMembership: {
        id: adminMembership.id,
        roleCodes: getMembershipRoleCodes(adminMembership)
      },
      items: items.map(serializeMembership)
    };
  });

  app.get("/tenants/:tenantId/admin/members/:membershipId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = membershipParamsSchema.parse(request.params);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);

    const membership = await app.prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                tenantId: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    if (!membership || membership.tenantId !== params.tenantId) {
      throw app.httpErrors.notFound("Membership not found");
    }

    const recentAudits = await app.prisma.auditLog.findMany({
      where: {
        tenantId: params.tenantId,
        targetType: "membership",
        targetId: membership.id,
        action: {
          in: [
            "membership.roles.update",
            "membership.status.disable",
            "membership.status.enable",
            "membership.invite.create",
            "membership.password.set",
            "membership.delete"
          ]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        actorUserId: true,
        actorMembershipId: true,
        beforeData: true,
        afterData: true,
        createdAt: true,
        actorUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    return {
      tenant: adminMembership.tenant,
      adminMembership: {
        id: adminMembership.id,
        roleCodes: getMembershipRoleCodes(adminMembership)
      },
      item: serializeMembership(membership),
      recentAudits: recentAudits.map(serializeMembershipAudit)
    };
  });

  app.get("/tenants/:tenantId/admin/roles", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = tenantParamsSchema.parse(request.params);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);

    const roles = await app.prisma.role.findMany({
      where: {
        OR: [{ tenantId: params.tenantId }, { tenantId: null }]
      },
      orderBy: [{ scope: "asc" }, { code: "asc" }],
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        scope: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            membershipRoles: true
          }
        }
      }
    });

    return {
      tenant: adminMembership.tenant,
      items: roles.map((role: any) => ({
        id: role.id,
        tenantId: role.tenantId,
        code: role.code,
        name: role.name,
        scope: role.scope,
        assignedMembershipCount: role._count.membershipRoles,
        createdAt: role.createdAt,
        updatedAt: role.updatedAt
      }))
    };
  });

  app.get("/tenants/:tenantId/admin/audits", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = tenantParamsSchema.parse(request.params);
    const query = adminAuditQuerySchema.parse(request.query);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);

    const items = await app.prisma.auditLog.findMany({
      where: {
        tenantId: params.tenantId,
        action: query.action,
        targetType: "membership",
        targetId: query.membershipId
      },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      include: {
        actorUser: {
          select: {
            id: true,
            username: true,
            displayName: true
          }
        }
      }
    });

    return {
      tenant: adminMembership.tenant,
      adminMembership: {
        id: adminMembership.id,
        roleCodes: getMembershipRoleCodes(adminMembership)
      },
      items: items.map(serializeMembershipAudit)
    };
  });

  app.post("/tenants/:tenantId/admin/members/invitations", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = tenantParamsSchema.parse(request.params);
    const body = memberInviteBodySchema.parse(request.body);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);
    requireTenantAdminWriteAccess(app, adminMembership);

    const nextRoleCodes = [...new Set(body.roleCodes)];
    const roles = await app.prisma.role.findMany({
      where: {
        tenantId: params.tenantId,
        code: {
          in: nextRoleCodes
        }
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        scope: true
      }
    });

    if (roles.length !== nextRoleCodes.length) {
      throw app.httpErrors.badRequest("Unknown tenant role code");
    }

    const normalizedEmail = body.email ? body.email.trim().toLowerCase() : null;
    const membershipLookupOr = [
      {
        user: {
          username: body.username
        }
      }
    ] as any[];
    if (normalizedEmail) {
      membershipLookupOr.push({
        user: {
          email: normalizedEmail
        }
      });
    }

    const existingMembership = await app.prisma.membership.findFirst({
      where: {
        tenantId: params.tenantId,
        OR: membershipLookupOr
      },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                tenantId: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    if (existingMembership) {
      throw app.httpErrors.conflict("Membership already exists for this tenant");
    }

    const userLookupOr = [
      {
        username: body.username
      }
    ] as any[];
    if (normalizedEmail) {
      userLookupOr.push({
        email: normalizedEmail
      });
    }

    const existingUser = await app.prisma.user.findFirst({
      where: {
        OR: userLookupOr
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true
      }
    });

    if (existingUser?.status === "disabled") {
      throw app.httpErrors.badRequest("Disabled user cannot be invited in this phase");
    }

    const placeholderPassword = `invite:${params.tenantId}:${body.username}:${Date.now()}`;

    const invitedMembership = await app.prisma.$transaction(async (tx: any) => {
      const user =
        existingUser ||
        (await tx.user.create({
          data: {
            username: body.username,
            email: normalizedEmail,
            displayName: body.displayName,
            status: "invited",
            passwordHash: hashPassword(placeholderPassword)
          },
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }));

      const membership = await tx.membership.create({
        data: {
          tenantId: params.tenantId,
          userId: user.id,
          displayName: body.displayName,
          status: "invited"
        },
        select: {
          id: true
        }
      });

      await tx.membershipRole.createMany({
        data: roles.map((role: any) => ({
          membershipId: membership.id,
          roleId: role.id
        }))
      });

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: auth.sub,
          actorMembershipId: adminMembership.id,
          action: "membership.invite.create",
          targetType: "membership",
          targetId: membership.id,
          beforeData: null,
          afterData: {
            status: "invited",
            roleCodes: nextRoleCodes,
            username: user.username
          }
        }
      });

      return tx.membership.findUnique({
        where: { id: membership.id },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  tenantId: true,
                  code: true,
                  name: true,
                  scope: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              status: true,
              lastLoginAt: true
            }
          }
        }
      });
    });

    return {
      tenant: adminMembership.tenant,
      item: serializeMembership(invitedMembership)
    };
  });

  app.put("/tenants/:tenantId/admin/members/:membershipId/status", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = membershipParamsSchema.parse(request.params);
    const body = memberStatusUpdateBodySchema.parse(request.body);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);
    requireTenantAdminWriteAccess(app, adminMembership);

    if (adminMembership.id === params.membershipId) {
      throw app.httpErrors.forbidden("Self status change is disabled in this phase");
    }

    const targetMembership = await app.prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    if (!targetMembership || targetMembership.tenantId !== params.tenantId) {
      throw app.httpErrors.notFound("Membership not found");
    }

    if (targetMembership.status === "invited" && body.status !== "active") {
      throw app.httpErrors.badRequest("Invited membership status change is not supported in this phase");
    }

    if (targetMembership.status === body.status) {
      return {
        tenant: adminMembership.tenant,
        item: serializeMembership(targetMembership)
      };
    }

    const currentRoleCodes = getMembershipRoleCodes(targetMembership);
    const disablingTenantOwner = body.status === "disabled" && currentRoleCodes.includes("tenant_owner");

    if (disablingTenantOwner) {
      const tenantOwnerCount = await app.prisma.membershipRole.count({
        where: {
          role: {
            tenantId: params.tenantId,
            code: "tenant_owner"
          },
          membership: {
            tenantId: params.tenantId,
            status: "active"
          }
        }
      });

      if (tenantOwnerCount <= 1) {
        throw app.httpErrors.badRequest("Cannot disable the last tenant owner");
      }
    }

    const auditAction = body.status === "disabled" ? "membership.status.disable" : "membership.status.enable";

    const updatedMembership = await app.prisma.$transaction(async (tx: any) => {
      await tx.membership.update({
        where: { id: targetMembership.id },
        data: {
          status: body.status
        }
      });

      if (targetMembership.user.status === "invited" && body.status === "active") {
        await tx.user.update({
          where: {
            id: targetMembership.user.id
          },
          data: {
            status: "active"
          }
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: auth.sub,
          actorMembershipId: adminMembership.id,
          action: auditAction,
          targetType: "membership",
          targetId: targetMembership.id,
          beforeData: {
            status: targetMembership.status
          },
          afterData: {
            status: body.status
          }
        }
      });

      return tx.membership.findUnique({
        where: { id: targetMembership.id },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  scope: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              status: true,
              lastLoginAt: true
            }
          }
        }
      });
    });

    return {
      tenant: adminMembership.tenant,
      item: serializeMembership(updatedMembership)
    };
  });

  app.put("/tenants/:tenantId/admin/members/:membershipId/password", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = membershipParamsSchema.parse(request.params);
    const body = memberPasswordUpdateBodySchema.parse(request.body);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);
    requireTenantAdminWriteAccess(app, adminMembership);

    if (adminMembership.id === params.membershipId) {
      throw app.httpErrors.forbidden("Self password change is disabled in this phase");
    }

    const targetMembership = await app.prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    if (!targetMembership || targetMembership.tenantId !== params.tenantId) {
      throw app.httpErrors.notFound("Membership not found");
    }

    if (targetMembership.status === "disabled" || targetMembership.user.status === "disabled") {
      throw app.httpErrors.badRequest("Disabled membership password update is not supported in this phase");
    }

    const updatedMembership = await app.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: {
          id: targetMembership.user.id
        },
        data: {
          passwordHash: hashPassword(body.password)
        }
      });

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: auth.sub,
          actorMembershipId: adminMembership.id,
          action: "membership.password.set",
          targetType: "membership",
          targetId: targetMembership.id,
          beforeData: null,
          afterData: {
            status: targetMembership.status,
            username: targetMembership.user.username
          }
        }
      });

      return tx.membership.findUnique({
        where: { id: targetMembership.id },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  scope: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              status: true,
              lastLoginAt: true
            }
          }
        }
      });
    });

    return {
      tenant: adminMembership.tenant,
      item: serializeMembership(updatedMembership)
    };
  });

  app.delete("/tenants/:tenantId/admin/members/:membershipId", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = membershipParamsSchema.parse(request.params);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);
    requireTenantAdminWriteAccess(app, adminMembership);

    if (adminMembership.id === params.membershipId) {
      throw app.httpErrors.forbidden("Self membership deletion is disabled in this phase");
    }

    const targetMembership = await app.prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    if (!targetMembership || targetMembership.tenantId !== params.tenantId) {
      throw app.httpErrors.notFound("Membership not found");
    }

    if (targetMembership.status === "active") {
      throw app.httpErrors.badRequest("Active membership deletion is not supported in this phase");
    }

    await app.prisma.$transaction(async (tx: any) => {
      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: auth.sub,
          actorMembershipId: adminMembership.id,
          action: "membership.delete",
          targetType: "membership",
          targetId: targetMembership.id,
          beforeData: {
            status: targetMembership.status,
            username: targetMembership.user.username,
            roleCodes: getMembershipRoleCodes(targetMembership)
          }
        }
      });

      await tx.membershipRole.deleteMany({
        where: {
          membershipId: targetMembership.id
        }
      });

      await tx.membership.delete({
        where: {
          id: targetMembership.id
        }
      });
    });

    return {
      tenant: adminMembership.tenant,
      deleted: true,
      membershipId: targetMembership.id
    };
  });

  app.put("/tenants/:tenantId/admin/members/:membershipId/roles", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const params = membershipParamsSchema.parse(request.params);
    const body = memberRoleUpdateBodySchema.parse(request.body);
    const adminMembership = await requireTenantAdminReadAccess(app, auth.sub, params.tenantId);
    requireTenantAdminWriteAccess(app, adminMembership);

    if (adminMembership.id === params.membershipId) {
      throw app.httpErrors.forbidden("Self role change is disabled in this phase");
    }

    const targetMembership = await app.prisma.membership.findUnique({
      where: { id: params.membershipId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                id: true,
                tenantId: true,
                code: true,
                name: true,
                scope: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            status: true,
            lastLoginAt: true
          }
        }
      }
    });

    if (!targetMembership || targetMembership.tenantId !== params.tenantId) {
      throw app.httpErrors.notFound("Membership not found");
    }

    const roles = await app.prisma.role.findMany({
      where: {
        tenantId: params.tenantId,
        code: {
          in: body.roleCodes
        }
      },
      select: {
        id: true,
        tenantId: true,
        code: true,
        name: true,
        scope: true
      }
    });

    if (roles.length !== new Set(body.roleCodes).size) {
      throw app.httpErrors.badRequest("Unknown tenant role code");
    }

    const currentRoleCodes = getMembershipRoleCodes(targetMembership);
    const nextRoleCodes = [...new Set(body.roleCodes)];
    const removingTenantOwner = currentRoleCodes.includes("tenant_owner") && !nextRoleCodes.includes("tenant_owner");

    if (removingTenantOwner) {
      const tenantOwnerCount = await app.prisma.membershipRole.count({
        where: {
          role: {
            tenantId: params.tenantId,
            code: "tenant_owner"
          },
          membership: {
            tenantId: params.tenantId,
            status: "active"
          }
        }
      });

      if (tenantOwnerCount <= 1) {
        throw app.httpErrors.badRequest("Cannot remove the last tenant owner");
      }
    }

    const updatedMembership = await app.prisma.$transaction(async (tx: any) => {
      await tx.membershipRole.deleteMany({
        where: {
          membershipId: targetMembership.id
        }
      });

      await tx.membershipRole.createMany({
        data: roles.map((role: any) => ({
          membershipId: targetMembership.id,
          roleId: role.id
        }))
      });

      await tx.auditLog.create({
        data: {
          tenantId: params.tenantId,
          actorUserId: auth.sub,
          actorMembershipId: adminMembership.id,
          action: "membership.roles.update",
          targetType: "membership",
          targetId: targetMembership.id,
          beforeData: {
            roleCodes: currentRoleCodes
          },
          afterData: {
            roleCodes: nextRoleCodes
          }
        }
      });

      return tx.membership.findUnique({
        where: { id: targetMembership.id },
        include: {
          roles: {
            include: {
              role: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                  scope: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              username: true,
              email: true,
              displayName: true,
              status: true,
              lastLoginAt: true
            }
          }
        }
      });
    });

    return {
      tenant: adminMembership.tenant,
      item: serializeMembership(updatedMembership)
    };
  });
};
