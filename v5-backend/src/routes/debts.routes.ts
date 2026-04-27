import { Router } from "express";
import {
  deleteDebt,
  getDebts,
  postDebt,
} from "../controllers/debts.controller.js";
import { postExtract } from "../controllers/extraction.controller.js";
import { extractionRateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import {
  debtIdParamSchema,
  newDebtSchema,
} from "../validators/debts.schema.js";
import { extractRequestSchema } from "../validators/extraction.schema.js";

export const debtsRouter = Router();

// All debts routes require an authenticated user. Mounting requireAuth
// on the router itself rather than each route means a new endpoint
// added later can't accidentally skip auth.
debtsRouter.use(requireAuth);

debtsRouter.get("/", getDebts);
debtsRouter.post("/", validate("body", newDebtSchema), postDebt);
debtsRouter.delete("/:id", validate("params", debtIdParamSchema), deleteDebt);

// /extract sits behind a per-user rate limiter (10/hour) on top of the
// router-level requireAuth. Rate limit runs before validate so a flood
// of malformed bodies still counts toward the budget; an attacker can't
// burn validation cycles for free.
debtsRouter.post(
  "/extract",
  extractionRateLimit,
  validate("body", extractRequestSchema),
  postExtract,
);
