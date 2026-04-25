import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const app = buildApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "v5-backend listening");
});
