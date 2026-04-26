import type { Debt, NewDebt } from "../types/index.js";
import { DebtModel, toDebt } from "../models/debt.model.js";

/**
 * Every debts query is scoped to a userId. listDebts only returns the
 * caller's debts; createDebt stamps the new doc with the caller's
 * userId; deleteDebtById refuses to delete a doc owned by another user.
 *
 * The deleteOne query uses both _id and userId. If user A guesses
 * user B's debt id, the query matches zero documents (deletedCount=0),
 * and the controller returns 404 — same response as a non-existent id,
 * so the caller can't probe for which ids belong to other users.
 */

export async function listDebts(userId: string): Promise<Debt[]> {
  const docs = await DebtModel.find({ userId }).lean();
  return docs.map(toDebt);
}

export async function createDebt(
  userId: string,
  input: NewDebt,
): Promise<Debt> {
  const doc = await DebtModel.create({ userId, ...input });
  return toDebt(doc.toObject());
}

export async function deleteDebtById(
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await DebtModel.deleteOne({ _id: id, userId });
  return result.deletedCount === 1;
}
