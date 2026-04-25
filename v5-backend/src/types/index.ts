export interface Debt {
  id: string;
  name: string;
  balance: number;
  rate: number;
  // 0 means "no explicit minimum", calculator falls back to interest + 1% of principal.
  minPayment: number;
}

export type NewDebt = Omit<Debt, "id">;

export interface ScheduleEntry {
  name: string;
  balance: number;
  interestThisMonth: number;
  principalPaid: number;
  targeted: boolean;
}

export type ScheduleMonth = ScheduleEntry[];

export type Strategy = "avalanche" | "snowball";

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
