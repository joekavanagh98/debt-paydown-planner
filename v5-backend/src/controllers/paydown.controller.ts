import type { Request, Response } from "express";
import type { Debt, Strategy } from "../types/index.js";
import { computePaydown } from "../services/paydown.service.js";

interface PaydownRequestBody {
  debts: Debt[];
  budget: number;
  strategy: Strategy;
}

/**
 * Thin glue: extract the request body, call the service, send the
 * result. No validation here — Zod middleware lands in a later commit
 * and runs before this handler. For now the controller trusts that
 * the body matches PaydownRequestBody.
 */
export function postPaydown(
  req: Request<unknown, unknown, PaydownRequestBody>,
  res: Response,
): void {
  const { debts, budget, strategy } = req.body;
  const result = computePaydown(debts, budget, strategy);
  res.json(result);
}
