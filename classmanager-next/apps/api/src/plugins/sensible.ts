import fp from "fastify-plugin";
import sensible from "@fastify/sensible";

export const sensiblePlugin = fp(async (app) => {
  await app.register(sensible);
});
