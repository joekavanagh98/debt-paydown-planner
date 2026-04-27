import { Router } from "express";
import type { Request, Response } from "express";
import { authRouter } from "./auth.routes.js";
import { debtsRouter } from "./debts.routes.js";
import { paydownRouter } from "./paydown.routes.js";
import { staffRouter } from "./staff.routes.js";

export const router = Router();

// Liveness check. Used by curl, deploy probes, and the upcoming
// integration tests that need to confirm the server is up before
// hitting real endpoints.
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

router.use("/auth", authRouter);
router.use("/debts", debtsRouter);
router.use("/paydown", paydownRouter);
router.use("/staff", staffRouter);
