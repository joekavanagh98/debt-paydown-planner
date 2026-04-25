import { pino } from "pino";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Single application logger. JSON in production (one line per log,
 * easy for log shippers to ingest). Pretty-printed via pino-pretty
 * in development so human eyes can read it without piping through
 * a tool. Log level comes from LOG_LEVEL env var, defaults to info.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
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
