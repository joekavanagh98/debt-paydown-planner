import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { connectMongo, disconnectMongo } from "./db/mongo.js";
import { logger } from "./utils/logger.js";

const app = buildApp();

await connectMongo();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "v5-backend listening");
});

/**
 * Graceful shutdown. SIGTERM is what process managers (Vercel, k8s,
 * systemd) send first. SIGINT is Ctrl+C in the dev terminal. Both
 * route through the same handler: stop accepting new connections,
 * let in-flight requests drain, then close Mongo cleanly.
 *
 * Without this, a deploy or a Ctrl+C kills the process mid-query,
 * which can leave Mongo connections in a half-closed state and
 * truncate any in-progress request mid-response.
 */
async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "Shutting down");
  server.close(async () => {
    await disconnectMongo();
    process.exit(0);
  });
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
