// Re-exports of types whose runtime contract lives in a Zod schema.
// Schema is the source of truth; the type comes from z.infer. Anything
// imported via `../types/index.js` continues to work and stays in sync
// automatically when the schema changes.
export type { Debt, NewDebt } from "../validators/debts.schema.js";
export type { Strategy } from "../validators/paydown.schema.js";

// Calculator output types. No runtime validation (the calculator is
// pure code we trust); no Zod schema needed. They live here because
// they're internal contract types between the calculator and its
// consumers, not API request shapes.
export interface ScheduleEntry {
  name: string;
  balance: number;
  interestThisMonth: number;
  principalPaid: number;
  targeted: boolean;
}

export type ScheduleMonth = ScheduleEntry[];

// Discriminated union on `feasible` — consumers narrow by checking the
// tag before reading the branch-specific fields.
export type PaydownResult =
  | { feasible: true; schedule: ScheduleMonth[] }
  | {
      feasible: false;
      reason: "budgetBelowMinimums";
      requiredMinimum: number;
      shortfall: number;
    }
  | { feasible: false; reason: "exceeds50Years" };
