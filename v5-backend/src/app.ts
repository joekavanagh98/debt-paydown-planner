import express from "express";
import type { Request, Response } from "express";
import { router } from "./routes/index.js";

export function buildApp(): express.Express {
  const app = express();

  app.use(express.json());

  app.use(router);

  // Final 404. Anything that didn't match a mounted route lands here.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: { code: "not_found", message: "Route not found" } });
  });

  return app;
}
