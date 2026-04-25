import { Router } from "express";
import type { Request, Response } from "express";

export const router = Router();

// Liveness check. Used by curl, deploy probes, and the upcoming
// integration tests that need to confirm the server is up before
// hitting real endpoints.
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Sub-routers (debts, paydown) get mounted here in subsequent commits.
