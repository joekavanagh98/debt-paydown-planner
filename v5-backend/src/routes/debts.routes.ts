import { Router } from "express";
import {
  deleteDebt,
  getDebts,
  postDebt,
} from "../controllers/debts.controller.js";

export const debtsRouter = Router();

debtsRouter.get("/", getDebts);
debtsRouter.post("/", postDebt);
debtsRouter.delete("/:id", deleteDebt);
