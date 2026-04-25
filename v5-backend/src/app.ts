import express from "express";
import type { NextFunction, Request, Response } from "express";
import { NotFoundError } from "./errors/AppError.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { router } from "./routes/index.js";

export function buildApp(): express.Express {
  const app = express();

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
