import type { Debt, PaydownResult, ScheduleEntry } from "../types/index.js";

const MAX_MONTHS = 600;
const MIN_PAYMENT_FLOOR = 25;

const toCents = (dollars: number): number => Math.round(dollars * 100);
const toDollars = (cents: number): number => cents / 100;

type MinPaymentInput = Pick<Debt, "balance" | "rate" | "minPayment">;

/**
 * Returns the monthly minimum payment for a debt. If the debt already
 * has an explicit minPayment, that wins. Otherwise, fall back to the
 * credit-card industry rule: interest + 1% of principal, floored at $25.
 */
export function calculateMinimumPayment(debt: MinPaymentInput): number {
  if (debt.minPayment && debt.minPayment > 0) {
    return debt.minPayment;
  }
  const monthlyRate = debt.rate / 100 / 12;
  const interest = debt.balance * monthlyRate;
  const onePercentPrincipal = debt.balance * 0.01;
  const computed = interest + onePercentPrincipal;
  return Math.max(MIN_PAYMENT_FLOOR, Math.round(computed * 100) / 100);
}

interface WorkingDebt {
  name: string;
  rate: number;
  balance: number;
  minPayment: number;
}

interface WorkingEntry {
  debt: WorkingDebt;
  interest: number;
  principalPaid: number;
  targeted: boolean;
}

type Comparator = (a: WorkingDebt, b: WorkingDebt) => number;

/**
 * Internal: month-by-month payoff loop. The only thing that varies
 * between strategies is the sort order of the working list. Both
 * strategies pay minimums everywhere then cascade extra down the
 * sorted list; the comparator decides what "down" means.
 *
 * All dollar values in the returned schedule are in dollars. Cents
 * are an internal detail kept inside this function so 600 months of
 * compounding can't accumulate floating-point drift.
 */
function runPaydown(
  debts: Debt[],
  monthlyBudget: number,
  compare: Comparator,
): PaydownResult {
  const working: WorkingDebt[] = debts
    .map((d) => ({
      name: d.name,
      rate: d.rate,
      balance: toCents(d.balance),
      minPayment: toCents(calculateMinimumPayment(d)),
    }))
    .sort(compare);

  const budgetCents = toCents(monthlyBudget);
  const totalMinimums = working.reduce((sum, d) => sum + d.minPayment, 0);

  if (budgetCents < totalMinimums) {
    return {
      feasible: false,
      reason: "budgetBelowMinimums",
      requiredMinimum: toDollars(totalMinimums),
      shortfall: toDollars(totalMinimums - budgetCents),
    };
  }

  const schedule: ScheduleEntry[][] = [];

  while (working.some((d) => d.balance > 0)) {
    if (schedule.length >= MAX_MONTHS) {
      return { feasible: false, reason: "exceeds50Years" };
    }

    let extra = budgetCents - totalMinimums;
    const entries: WorkingEntry[] = working.map((d) => ({
      debt: d,
      interest: 0,
      principalPaid: 0,
      targeted: false,
    }));

    for (const e of entries) {
      const d = e.debt;
      if (d.balance <= 0) {
        extra += d.minPayment;
        continue;
      }
      const monthlyRate = d.rate / 100 / 12;
      e.interest = Math.round(d.balance * monthlyRate);
      const payoffAmount = d.balance + e.interest;
      const minPay = Math.min(d.minPayment, payoffAmount);
      d.balance = d.balance + e.interest - minPay;
      e.principalPaid = minPay - e.interest;
      extra += d.minPayment - minPay;
    }

    for (const e of entries) {
      const d = e.debt;
      if (d.balance <= 0) continue;
      if (extra <= 0) break;
      const applied = Math.min(extra, d.balance);
      d.balance -= applied;
      e.principalPaid += applied;
      e.targeted = true;
      extra -= applied;
    }

    schedule.push(
      entries.map((e) => ({
        name: e.debt.name,
        balance: toDollars(e.debt.balance),
        interestThisMonth: toDollars(e.interest),
        principalPaid: toDollars(e.principalPaid),
        targeted: e.targeted,
      })),
    );
  }

  return { feasible: true, schedule };
}

export function avalanchePaydown(
  debts: Debt[],
  monthlyBudget: number,
): PaydownResult {
  return runPaydown(debts, monthlyBudget, (a, b) => b.rate - a.rate);
}

export function snowballPaydown(
  debts: Debt[],
  monthlyBudget: number,
): PaydownResult {
  return runPaydown(debts, monthlyBudget, (a, b) => a.balance - b.balance);
}
