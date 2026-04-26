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

// ---- v8: Auth surface types ----
//
// These mirror v5-backend's contracts. Duplicated rather than shared
// because pulling in a workspaces refactor or codegen pipeline doesn't
// earn its place in v8. See NOTES.md for the three proper solutions
// (workspaces, OpenAPI codegen, tRPC) and why each one is deferred.

export interface User {
  id: string;
  email: string;
  // Server returns ISO 8601 strings. Could be parsed into Date at the
  // boundary; left as string for now since nothing in v8 displays it.
  createdAt: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}
