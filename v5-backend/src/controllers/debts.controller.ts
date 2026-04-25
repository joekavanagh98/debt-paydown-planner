import type { Request, Response } from "express";
import type { NewDebt } from "../types/index.js";
import {
  createDebt,
  deleteDebtById,
  listDebts,
} from "../services/debts.service.js";

export function getDebts(_req: Request, res: Response): void {
  res.json(listDebts());
}

export function postDebt(
  req: Request<unknown, unknown, NewDebt>,
  res: Response,
): void {
  const debt = createDebt(req.body);
  res.status(201).json(debt);
}

export function deleteDebt(
  req: Request<{ id: string }>,
  res: Response,
): void {
  const { id } = req.params;
  const deleted = deleteDebtById(id);
  if (!deleted) {
    res.status(404).json({
      error: { code: "not_found", message: `Debt ${id} not found` },
    });
    return;
  }
  res.status(204).end();
}
