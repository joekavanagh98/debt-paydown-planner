import morgan from "morgan";
import type { RequestHandler } from "express";
import { logger } from "../utils/logger.js";

const isProduction = process.env.NODE_ENV === "production";

// Morgan format: 'combined' (Apache-style) for production logs that
// downstream tools know how to parse, 'dev' for colorful one-liners
// in local development.
const format = isProduction ? "combined" : "dev";

// Morgan writes lines to a stream. Routing them through pino keeps
// the request log in the same place as the structured app log
// (one stdout, one ingestion path).
const stream = {
  write: (line: string): void => {
    logger.info(line.trim());
  },
};

export const requestLogger: RequestHandler = morgan(format, { stream });
