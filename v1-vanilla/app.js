"use strict";

const MAX_MONTHS = 600;
const MIN_PAYMENT_FLOOR = 25;

const toCents = (dollars) => Math.round(dollars * 100);
const toDollars = (cents) => cents / 100;

/**
 * Returns the monthly minimum payment for a debt. If the debt already
 * has an explicit minPayment, that wins. Otherwise, fall back to the
 * credit-card industry rule: interest + 1% of principal, floored at $25.
 */
function calculateMinimumPayment(debt) {
  if (debt.minPayment && debt.minPayment > 0) {
    return debt.minPayment;
  }
  const monthlyRate = debt.rate / 100 / 12;
  const interest = debt.balance * monthlyRate;
  const onePercentPrincipal = debt.balance * 0.01;
  const computed = interest + onePercentPrincipal;
  return Math.max(MIN_PAYMENT_FLOOR, Math.round(computed * 100) / 100);
}

/**
 * Avalanche paydown: pay minimums everywhere, then throw every spare
 * dollar at the highest-rate debt until it's gone, then roll to the
 * next-highest, and so on.
 *
 * Returns either:
 *   { feasible: true, schedule: Month[] }
 *   { feasible: false, reason, ... }
 * where Month = Entry[] and Entry = { name, balance, interestThisMonth, principalPaid, targeted }.
 * All dollar values in the output are in dollars (not cents).
 */
function avalanchePaydown(debts, monthlyBudget) {
  // Work in integer cents internally so 600 months of compounding can't
  // accumulate floating-point drift.
  const working = debts
    .map((d) => ({
      name: d.name,
      rate: d.rate,
      balance: toCents(d.balance),
      minPayment: toCents(calculateMinimumPayment(d)),
    }))
    .sort((a, b) => b.rate - a.rate);

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

  const schedule = [];

  while (working.some((d) => d.balance > 0)) {
    if (schedule.length >= MAX_MONTHS) {
      return { feasible: false, reason: "exceeds50Years" };
    }

    let extra = budgetCents - totalMinimums;
    const entries = working.map((d) => ({
      debt: d,
      interest: 0,
      principalPaid: 0,
      targeted: false,
    }));

    // Pass 1: accrue interest and apply the minimum payment on each
    // still-active debt. Any unspent minimum (debt already paid off,
    // or balance smaller than the minimum) rolls into the extra pool
    // so it cascades to the next avalanche target in the same month.
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

    // Pass 2: cascade extra payment down the rate-sorted list.
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
