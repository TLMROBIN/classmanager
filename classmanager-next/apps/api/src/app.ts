import Fastify from "fastify";
import cors from "@fastify/cors";

import { getEnv } from "./config/env.js";
import { adminRoutes } from "./modules/admin/routes.js";
import { authRoutes } from "./modules/auth/routes.js";
import { attendanceRoutes } from "./modules/attendance/routes.js";
import { classRoutes } from "./modules/classes/routes.js";
import { exportRoutes } from "./modules/exports/routes.js";
import { healthRoutes } from "./modules/health/routes.js";
import { homeworkRoutes } from "./modules/homework/routes.js";
import { legacyRoutes } from "./modules/legacy/routes.js";
import { pointRoutes } from "./modules/points/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { tenantRoutes } from "./modules/tenant/routes.js";
import { authPlugin } from "./plugins/auth.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { sensiblePlugin } from "./plugins/sensible.js";

export async function createApp() {
  const env = getEnv();
  const app = Fastify({
    logger: env.NODE_ENV !== "test"
  });

  await app.register(cors, {
    origin: true,
    credentials: true
  });
  await app.register(sensiblePlugin);
  await app.register(prismaPlugin);
  await app.register(authPlugin);

  await app.register(adminRoutes, { prefix: "/api" });
  await app.register(healthRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api" });
  await app.register(attendanceRoutes, { prefix: "/api" });
  await app.register(exportRoutes, { prefix: "/api" });
  await app.register(homeworkRoutes, { prefix: "/api" });
  await app.register(legacyRoutes, { prefix: "/api" });
  await app.register(settingsRoutes, { prefix: "/api" });
  await app.register(tenantRoutes, { prefix: "/api" });
  await app.register(classRoutes, { prefix: "/api" });
  await app.register(pointRoutes, { prefix: "/api" });

  return app;
}
