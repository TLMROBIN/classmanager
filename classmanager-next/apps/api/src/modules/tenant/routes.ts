import type { FastifyPluginAsync } from "fastify";

type MembershipListItem = {
  id: string;
  tenantId: string;
  status: string;
  joinedAt: Date;
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    status: string;
  };
};

export const tenantRoutes: FastifyPluginAsync = async (app) => {
  app.get("/tenants", { preHandler: app.authenticate }, async (request, reply) => {
    const auth = request.auth;
    if (!auth) {
      throw reply.unauthorized("Missing auth context");
    }

    const memberships = await app.prisma.membership.findMany({
      where: {
        userId: auth.sub,
        status: "active"
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            status: true
          }
        }
      },
      orderBy: {
        joinedAt: "asc"
      }
    });

    return {
      items: memberships.map((membership: MembershipListItem) => ({
        id: membership.id,
        tenantId: membership.tenantId,
        status: membership.status,
        joinedAt: membership.joinedAt,
        tenant: membership.tenant
      }))
    };
  });
};
