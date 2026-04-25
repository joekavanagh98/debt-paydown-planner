import { Router } from "express";
import {
  deleteDebt,
  getDebts,
  postDebt,
} from "../controllers/debts.controller.js";
import { validate } from "../middleware/validate.js";
import {
  debtIdParamSchema,
  newDebtSchema,
} from "../validators/debts.schema.js";

export const debtsRouter = Router();

debtsRouter.get("/", getDebts);
debtsRouter.post("/", validate("body", newDebtSchema), postDebt);
debtsRouter.delete("/:id", validate("params", debtIdParamSchema), deleteDebt);
