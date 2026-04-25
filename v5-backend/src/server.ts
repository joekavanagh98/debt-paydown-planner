import { buildApp } from "./app.js";
import { logger } from "./utils/logger.js";

const PORT = Number(process.env.PORT ?? 3001);

const app = buildApp();

app.listen(PORT, () => {
  logger.info({ port: PORT }, "v5-backend listening");
});
