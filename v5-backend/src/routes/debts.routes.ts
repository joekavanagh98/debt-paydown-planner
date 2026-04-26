import { Router } from "express";
import {
  deleteDebt,
  getDebts,
  postDebt,
} from "../controllers/debts.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import {
  debtIdParamSchema,
  newDebtSchema,
} from "../validators/debts.schema.js";

export const debtsRouter = Router();

// All debts routes require an authenticated user. Mounting requireAuth
// on the router itself rather than each route means a new endpoint
// added later can't accidentally skip auth.
debtsRouter.use(requireAuth);

debtsRouter.get("/", getDebts);
debtsRouter.post("/", validate("body", newDebtSchema), postDebt);
debtsRouter.delete("/:id", validate("params", debtIdParamSchema), deleteDebt);
