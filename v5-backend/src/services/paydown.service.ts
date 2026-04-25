import type { Debt, PaydownResult, Strategy } from "../types/index.js";
import {
  avalanchePaydown,
  snowballPaydown,
} from "../utils/paydownCalculator.js";

/**
 * Dispatches to the strategy-specific calculator. Lives in the service
 * layer so the controller doesn't have to know which calculator to
 * call, and so future strategies (custom orderings, percentage-based
 * splits) only require touching this dispatch and the calculator
 * module — not the HTTP layer.
 */
export function computePaydown(
  debts: Debt[],
  budget: number,
  strategy: Strategy,
): PaydownResult {
  switch (strategy) {
    case "avalanche":
      return avalanchePaydown(debts, budget);
    case "snowball":
      return snowballPaydown(debts, budget);
  }
}
