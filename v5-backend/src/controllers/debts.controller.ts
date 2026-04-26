import type { Request, Response } from "express";
import type { NewDebt } from "../types/index.js";
import { NotFoundError } from "../errors/AppError.js";
import { getUserId } from "../middleware/requireAuth.js";
import {
  createDebt,
  deleteDebtById,
  listDebts,
} from "../services/debts.service.js";

export async function getDebts(req: Request, res: Response): Promise<void> {
  const userId = getUserId(req);
  res.json(await listDebts(userId));
}

export async function postDebt(
  req: Request<Record<string, string>, unknown, NewDebt>,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const debt = await createDebt(userId, req.body);
  res.status(201).json(debt);
}

export async function deleteDebt(
  req: Request<Record<string, string>>,
  res: Response,
): Promise<void> {
  const userId = getUserId(req);
  const id = req.params.id ?? "";
  const deleted = await deleteDebtById(userId, id);
  if (!deleted) {
    throw new NotFoundError(`Debt ${id} not found`);
  }
  res.status(204).end();
}
