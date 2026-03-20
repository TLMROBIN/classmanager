import type { FastifyPluginAsync } from "fastify";

import { getEnv } from "../../config/env.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../../lib/jwt.js";
import { verifyPassword } from "../../lib/password.js";
import { canManagePoints, getMembershipRoleCodes } from "../../lib/permissions.js";
import { loginBodySchema, refreshBodySchema } from "./schema.js";

type MembershipView = {
  id: string;
  tenantId: string;
  status: string;
  roles: Array<{
    role: {
      code: string;
    };
  }>;
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
};

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/auth/login", async (request, reply) => {
    const body = loginBodySchema.parse(request.body);
    const env = getEnv();

    const user = await app.prisma.user.findUnique({
      where: { username: body.username },
      include: {
        memberships: {
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
        }
      }
    });

    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      throw reply.unauthorized("Invalid username or password");
    }

    if (user.status !== "active") {
      throw reply.unauthorized("User unavailable");
    }

    const accessToken = signAccessToken(
      { sub: user.id, username: user.username },
      env
    );
    const refreshToken = signRefreshToken(
      { sub: user.id, type: "refresh" },
      env
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        status: user.status
      },
      memberships: user.memberships.map((membership: MembershipView) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        status: membership.status,
        roleCodes: getMembershipRoleCodes(membership),
        permissions: {
          canManagePoints: canManagePoints(membership)
        },
        tenant: membership.tenant
      }))
    };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    const env = getEnv();

    let payload;
    try {
      payload = verifyRefreshToken(body.refreshToken, env);
    } catch {
      throw reply.unauthorized("Invalid or expired refresh token");
    }

    const user = await app.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        status: true
      }
    });

    if (!user || user.status !== "active") {
      throw reply.unauthorized("User unavailable");
    }

    return {
      accessToken: signAccessToken(
        { sub: user.id, username: user.username },
        env
      )
    };
  });

  app.get("/auth/me", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const user = await app.prisma.user.findUnique({
      where: { id: auth.sub },
      include: {
        memberships: {
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
        }
      }
    });

    if (!user) {
      throw reply.notFound("User not found");
    }

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        status: user.status
      },
      memberships: user.memberships.map((membership: MembershipView) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        status: membership.status,
        roleCodes: getMembershipRoleCodes(membership),
        permissions: {
          canManagePoints: canManagePoints(membership)
        },
        tenant: membership.tenant
      }))
    };
  });
};
