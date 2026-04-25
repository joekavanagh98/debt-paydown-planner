import type { Debt, NewDebt } from "../types/index.js";
import { DebtModel, toDebt } from "../models/debt.model.js";

/**
 * The signatures match v5's in-memory service except every function
 * is now async. Express 5 propagates rejections to the central error
 * handler, so callers don't need try/catch — they just await.
 *
 * .lean() returns plain objects instead of Mongoose Documents, which
 * are cheaper to allocate and serialize. We don't mutate the results,
 * so we don't need the Document machinery.
 */

export async function listDebts(): Promise<Debt[]> {
  const docs = await DebtModel.find({}).lean();
  return docs.map(toDebt);
}

export async function createDebt(input: NewDebt): Promise<Debt> {
  const doc = await DebtModel.create(input);
  return toDebt(doc.toObject());
}

export async function deleteDebtById(id: string): Promise<boolean> {
  const result = await DebtModel.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
