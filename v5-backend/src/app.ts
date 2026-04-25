import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { NotFoundError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { router } from "./routes/index.js";

export function buildApp(): express.Express {
  const app = express();

  // CORS first so preflight (OPTIONS) requests get handled before any
  // other middleware burns work on them. Origin is pinned to a single
  // value (no "*") because the v8 plan exposes user data behind auth
  // and "*" would be wrong then; setting it correctly now means one
  // less thing to remember.
  app.use(cors({ origin: env.CORS_ORIGIN }));

  // Request logging runs before body parsing so even malformed bodies
  // get a log line.
  app.use(requestLogger);

  app.use(express.json());

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
