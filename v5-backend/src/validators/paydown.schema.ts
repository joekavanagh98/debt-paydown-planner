import { z } from "zod";
import { debtSchema } from "./debts.schema.js";

export const strategySchema = z.enum(["avalanche", "snowball"]);

// 50 debts is well past anything a real planner needs. Beyond that, a
// user has bigger problems than a paydown spreadsheet can solve, and
// the calculator's O(n * months) cost starts to bite. Budget capped at
// $1M for the same reason: legitimate uses are well under, and the cap
// stops the schedule from collapsing to one month with absurd inputs.
export const paydownRequestSchema = z
  .object({
    debts: z.array(debtSchema).max(50),
    budget: z.number().positive().max(1_000_000),
    strategy: strategySchema,
  })
  .strict();

export type Strategy = z.infer<typeof strategySchema>;
