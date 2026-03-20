import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = bcrypt.hashSync("ChangeMe123!", 10);

  const user = await prisma.user.upsert({
    where: { username: "admin" },
    update: {
      passwordHash,
      displayName: "System Admin",
      status: "active"
    },
    create: {
      username: "admin",
      email: "admin@classmanager.local",
      passwordHash,
      displayName: "System Admin",
      status: "active"
    }
  });

  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-tenant" },
    update: {
      name: "Demo Tenant",
      type: "class",
      status: "active",
      ownerUserId: user.id
    },
    create: {
      name: "Demo Tenant",
      slug: "demo-tenant",
      type: "class",
      status: "active",
      ownerUserId: user.id
    }
  });

  const membership = await prisma.membership.upsert({
    where: {
      tenantId_userId: {
        tenantId: tenant.id,
        userId: user.id
      }
    },
    update: {
      status: "active",
      displayName: "Demo Owner"
    },
    create: {
      tenantId: tenant.id,
      userId: user.id,
      status: "active",
      displayName: "Demo Owner"
    }
  });

  const role = await prisma.role.upsert({
    where: {
      tenantId_code: {
        tenantId: tenant.id,
        code: "tenant_owner"
      }
    },
    update: {
      name: "Tenant Owner",
      scope: "tenant"
    },
    create: {
      tenantId: tenant.id,
      code: "tenant_owner",
      name: "Tenant Owner",
      scope: "tenant"
    }
  });

  await prisma.membershipRole.upsert({
    where: {
      membershipId_roleId: {
        membershipId: membership.id,
        roleId: role.id
      }
    },
    update: {},
    create: {
      membershipId: membership.id,
      roleId: role.id
    }
  });

  const classRecord = await prisma.class.upsert({
    where: {
      tenantId_name: {
        tenantId: tenant.id,
        name: "Demo Class"
      }
    },
    update: {
      code: "demo-class",
      timezone: "Asia/Shanghai"
    },
    create: {
      tenantId: tenant.id,
      name: "Demo Class",
      code: "demo-class",
      timezone: "Asia/Shanghai"
    }
  });

  await prisma.classConfig.upsert({
    where: { classId: classRecord.id },
    update: {
      className: "Demo Class",
      timezone: "Asia/Shanghai"
    },
    create: {
      classId: classRecord.id,
      tenantId: tenant.id,
      className: "Demo Class",
      timezone: "Asia/Shanghai"
    }
  });

  await prisma.attendancePolicy.upsert({
    where: { classId: classRecord.id },
    update: {},
    create: {
      tenantId: tenant.id,
      classId: classRecord.id
    }
  });

  await prisma.featureFlag.upsert({
    where: {
      tenantId_classId_code: {
        tenantId: tenant.id,
        classId: classRecord.id,
        code: "attendance"
      }
    },
    update: {
      enabled: true
    },
    create: {
      tenantId: tenant.id,
      classId: classRecord.id,
      code: "attendance",
      enabled: true
    }
  });

  console.log("Seed completed");
  console.log(`admin username: ${user.username}`);
  console.log("admin password: ChangeMe123!");
  console.log(`tenant slug: ${tenant.slug}`);
  console.log(`class name: ${classRecord.name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
