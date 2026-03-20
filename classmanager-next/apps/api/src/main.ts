import { createApp } from "./app.js";
import { getEnv } from "./config/env.js";

async function main() {
  const env = getEnv();
  const app = await createApp();

  try {
    await app.listen({
      host: env.HOST,
      port: env.PORT
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();
