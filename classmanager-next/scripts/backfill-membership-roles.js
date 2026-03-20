const { PrismaClient } = require("@prisma/client");
const { getDefaultTenantRoles } = require("./role-catalog");

async function main() {
  const prisma = new PrismaClient();

  try {
    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        ownerUserId: true,
        memberships: {
          select: {
            id: true,
            userId: true
          }
        }
      }
    });

    const summary = {
      tenants: tenants.length,
      rolesEnsured: 0,
      membershipsUpdated: 0
    };

    for (const tenant of tenants) {
      const roleMap = new Map();

      for (const roleSeed of getDefaultTenantRoles()) {
        const role = await prisma.role.upsert({
          where: {
            tenantId_code: {
              tenantId: tenant.id,
              code: roleSeed.code
            }
          },
          update: {
            name: roleSeed.name,
            scope: roleSeed.scope
          },
          create: {
            tenantId: tenant.id,
            code: roleSeed.code,
            name: roleSeed.name,
            scope: roleSeed.scope
          },
          select: {
            id: true,
            code: true
          }
        });
        roleMap.set(role.code, role.id);
        summary.rolesEnsured += 1;
      }

      for (const membership of tenant.memberships) {
        const expectedRoleCode = membership.userId === tenant.ownerUserId ? "tenant_owner" : "tenant_member";
        const roleId = roleMap.get(expectedRoleCode);
        if (!roleId) {
          throw new Error(`Missing role ${expectedRoleCode} for tenant ${tenant.id}`);
        }

        const existing = await prisma.membershipRole.findUnique({
          where: {
            membershipId_roleId: {
              membershipId: membership.id,
              roleId
            }
          }
        });

        if (!existing) {
          await prisma.membershipRole.create({
            data: {
              membershipId: membership.id,
              roleId
            }
          });
          summary.membershipsUpdated += 1;
        }

        const baselineRoleCodeToRemove = expectedRoleCode === "tenant_owner" ? "tenant_member" : "tenant_owner";
        const baselineRoleIdToRemove = roleMap.get(baselineRoleCodeToRemove);

        if (baselineRoleIdToRemove) {
          await prisma.membershipRole.deleteMany({
            where: {
              membershipId: membership.id,
              roleId: baselineRoleIdToRemove
            }
          });
        }
      }
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
