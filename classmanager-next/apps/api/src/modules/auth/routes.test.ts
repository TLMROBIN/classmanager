import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import sensible from "@fastify/sensible";

import { authRoutes } from "./routes.js";
import { hashPassword } from "../../lib/password.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test?schema=public";
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "test-access-secret";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "test-refresh-secret";

async function createTestApp(prisma: any) {
  const app = Fastify();
  await app.register(sensible);
  app.decorate("prisma", prisma);
  app.decorate("authenticate", async () => {});
  await app.register(authRoutes, { prefix: "/api" });
  return app;
}

test("POST /auth/login accepts active user with valid password", async () => {
  const prisma = {
    user: {
      async findUnique() {
        return {
          id: "user-1",
          username: "teacher-a",
          email: "teacher-a@example.com",
          displayName: "Teacher A",
          status: "active",
          passwordHash: hashPassword("ChangeMe123!"),
          memberships: []
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: "teacher-a",
      password: "ChangeMe123!"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().user.status, "active");
  await app.close();
});

test("POST /auth/login rejects invited user even with valid password", async () => {
  const prisma = {
    user: {
      async findUnique() {
        return {
          id: "user-1",
          username: "teacher-a",
          email: "teacher-a@example.com",
          displayName: "Teacher A",
          status: "invited",
          passwordHash: hashPassword("ChangeMe123!"),
          memberships: []
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: "teacher-a",
      password: "ChangeMe123!"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, "User unavailable");
  await app.close();
});

test("POST /auth/login rejects disabled user even with valid password", async () => {
  const prisma = {
    user: {
      async findUnique() {
        return {
          id: "user-1",
          username: "teacher-a",
          email: "teacher-a@example.com",
          displayName: "Teacher A",
          status: "disabled",
          passwordHash: hashPassword("ChangeMe123!"),
          memberships: []
        };
      }
    }
  };

  const app = await createTestApp(prisma);
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: {
      username: "teacher-a",
      password: "ChangeMe123!"
    }
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.json().message, "User unavailable");
  await app.close();
});
