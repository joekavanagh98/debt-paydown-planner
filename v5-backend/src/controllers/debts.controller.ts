import type { Request, Response } from "express";
import type { NewDebt } from "../types/index.js";
import { NotFoundError } from "../errors/AppError.js";
import {
  createDebt,
  deleteDebtById,
  listDebts,
} from "../services/debts.service.js";

export async function getDebts(_req: Request, res: Response): Promise<void> {
  res.json(await listDebts());
}

export async function postDebt(
  req: Request<unknown, unknown, NewDebt>,
  res: Response,
): Promise<void> {
  const debt = await createDebt(req.body);
  res.status(201).json(debt);
}

export async function deleteDebt(
  req: Request<{ id: string }>,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  const deleted = await deleteDebtById(id);
  if (!deleted) {
    throw new NotFoundError(`Debt ${id} not found`);
  }
  res.status(204).end();
}
