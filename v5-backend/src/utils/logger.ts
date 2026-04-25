import { pino } from "pino";
import { env } from "../config/env.js";

const isProduction = env.NODE_ENV === "production";

/**
 * Single application logger. JSON in production (one line per log,
 * easy for log shippers to ingest). Pretty-printed via pino-pretty
 * in development so human eyes can read it without piping through
 * a tool. Log level comes from env, defaults applied in the env
 * schema.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});
