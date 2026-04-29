import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import { NotFoundError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { router } from "./routes/index.js";

export function buildApp(): express.Express {
  const app = express();

  // helmet first. Defaults cover X-Content-Type-Options, X-Frame-Options,
  // Strict-Transport-Security (in production), a baseline
  // Content-Security-Policy, and a dozen other response headers. One
  // app.use, twelve quiet defenses.
  app.use(helmet());

  // CORS next so preflight (OPTIONS) requests get handled before any
  // other middleware burns work on them. Origin is an array (single
  // entry today): the array form makes cors echo the matching origin
  // back only when it matches the request's Origin header, instead of
  // unconditionally echoing the configured value the way the string
  // form does. Strictly visible intent, easy to extend with a second
  // deploy URL.
  app.use(cors({ origin: [env.CORS_ORIGIN] }));

  // Request logging runs before body parsing so even malformed bodies
  // get a log line.
  app.use(requestLogger);

  // 32kb covers the ~5kb extraction text and every other endpoint with
  // headroom. Anything larger is either a bug or an attempt to chew up
  // memory on the parse step. The errorHandler renders the resulting
  // PayloadTooLarge error as a 413 with the standard envelope.
  app.use(express.json({ limit: "32kb" }));

  app.use(router);

  // Final 404. Anything that didn't match a mounted route gets
  // converted into a NotFoundError and funneled through the error
  // handler so every error response uses the same envelope.
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError("Route not found"));
  });

  app.use(errorHandler);

  return app;
}
