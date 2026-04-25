import { Router } from "express";
import type { Request, Response } from "express";
import { paydownRouter } from "./paydown.routes.js";

export const router = Router();

// Liveness check. Used by curl, deploy probes, and the upcoming
// integration tests that need to confirm the server is up before
// hitting real endpoints.
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.use("/paydown", paydownRouter);

// Debts router lands in the next commit.
