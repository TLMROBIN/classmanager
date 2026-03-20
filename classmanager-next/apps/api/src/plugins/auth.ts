import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { getEnv } from "../config/env.js";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: AccessTokenPayload;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw reply.unauthorized("Missing bearer token");
    }

    const token = authHeader.slice("Bearer ".length);
    try {
      request.auth = verifyAccessToken(token, getEnv());
    } catch {
      throw reply.unauthorized("Invalid or expired access token");
    }
  });
});
