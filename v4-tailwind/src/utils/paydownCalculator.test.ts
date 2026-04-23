import { describe, it, expect } from "vitest";
import type { Debt } from "../types";
import {
  avalanchePaydown,
  calculateMinimumPayment,
  snowballPaydown,
} from "./paydownCalculator";

// Small helper so test tables read cleanly; id isn't exercised by the math
// but is required by the Debt type.
const debt = (
  name: string,
  balance: number,
  rate: number,
  minPayment: number,
): Debt => ({ id: name, name, balance, rate, minPayment });

describe("avalanchePaydown", () => {
  it("returns an empty schedule for an empty debt array", () => {
    const result = avalanchePaydown([], 500);
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    expect(result.schedule).toHaveLength(0);
  });

  it("handles a zero-interest debt without dividing by zero", () => {
    const result = avalanchePaydown([debt("A", 1000, 0, 100)], 100);
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    expect(result.schedule).toHaveLength(10);
    const final = result.schedule.at(-1)?.[0];
    expect(final?.balance).toBeCloseTo(0, 2);
  });

  it("pays off faster when extra budget is supplied than minimum-only", () => {
    const debts = [debt("A", 1000, 12, 50)];
    const minOnly = avalanchePaydown(debts, 50);
    const extra = avalanchePaydown(debts, 200);
    expect(minOnly.feasible).toBe(true);
    expect(extra.feasible).toBe(true);
    if (!minOnly.feasible || !extra.feasible) return;
    expect(extra.schedule.length).toBeLessThan(minOnly.schedule.length);
  });

  it("does not target any debt in month 1 when budget equals minimums", () => {
    const debts = [debt("A", 1000, 20, 50), debt("B", 2000, 10, 100)];
    const result = avalanchePaydown(debts, 150);
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    for (const entry of result.schedule[0] ?? []) {
      expect(entry.targeted).toBe(false);
    }
  });

  it("flags infeasible when budget is below the sum of minimums", () => {
    const debts = [debt("A", 1000, 20, 50), debt("B", 2000, 10, 100)];
    const result = avalanchePaydown(debts, 100);
    expect(result.feasible).toBe(false);
    if (result.feasible) return;
    expect(result.reason).toBe("budgetBelowMinimums");
    if (result.reason !== "budgetBelowMinimums") return;
    expect(result.requiredMinimum).toBeCloseTo(150, 2);
    expect(result.shortfall).toBeCloseTo(50, 2);
  });

  it("orders tied rates deterministically across runs", () => {
    const debts = [debt("A", 1000, 15, 50), debt("B", 2000, 15, 50)];
    const run1 = avalanchePaydown(debts, 300);
    const run2 = avalanchePaydown(debts, 300);
    expect(run1.feasible).toBe(true);
    expect(run2.feasible).toBe(true);
    if (!run1.feasible || !run2.feasible) return;
    const target1 = run1.schedule[0]?.find((e) => e.targeted)?.name;
    const target2 = run2.schedule[0]?.find((e) => e.targeted)?.name;
    expect(target1).toBeDefined();
    expect(target1).toBe(target2);
  });

  it("stays precise with large numbers through full paydown", () => {
    const result = avalanchePaydown(
      [debt("A", 10_000_000, 5, 100_000)],
      200_000,
    );
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    const final = result.schedule.at(-1)?.[0];
    expect(final?.balance).toBeCloseTo(0, 2);
  });
});

describe("snowballPaydown", () => {
  it("returns an empty schedule for an empty debt array", () => {
    const result = snowballPaydown([], 500);
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    expect(result.schedule).toHaveLength(0);
  });

  it("targets the smallest balance first, even when its rate is lower", () => {
    // Bigger debt has the higher rate, so avalanche would target it.
    // Snowball should target the smaller-balance one instead — this
    // is the entire behavioral point of the strategy.
    const debts = [
      debt("Big", 5000, 20, 100),
      debt("Small", 500, 8, 25),
    ];
    const result = snowballPaydown(debts, 200);
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    const firstMonthTarget = result.schedule[0]?.find((e) => e.targeted)?.name;
    expect(firstMonthTarget).toBe("Small");
  });

  it("produces a different first target than avalanche for the same inputs", () => {
    const debts = [
      debt("Big", 5000, 20, 100),
      debt("Small", 500, 8, 25),
    ];
    const av = avalanchePaydown(debts, 200);
    const sn = snowballPaydown(debts, 200);
    expect(av.feasible).toBe(true);
    expect(sn.feasible).toBe(true);
    if (!av.feasible || !sn.feasible) return;
    const avTarget = av.schedule[0]?.find((e) => e.targeted)?.name;
    const snTarget = sn.schedule[0]?.find((e) => e.targeted)?.name;
    expect(avTarget).toBe("Big");
    expect(snTarget).toBe("Small");
  });

  it("flags infeasible when budget is below the sum of minimums", () => {
    const debts = [debt("A", 1000, 20, 50), debt("B", 2000, 10, 100)];
    const result = snowballPaydown(debts, 100);
    expect(result.feasible).toBe(false);
    if (result.feasible) return;
    expect(result.reason).toBe("budgetBelowMinimums");
  });

  it("stays precise with large numbers through full paydown", () => {
    const result = snowballPaydown(
      [debt("A", 10_000_000, 5, 100_000)],
      200_000,
    );
    expect(result.feasible).toBe(true);
    if (!result.feasible) return;
    const final = result.schedule.at(-1)?.[0];
    expect(final?.balance).toBeCloseTo(0, 2);
  });

  it("pays at least as much total interest as avalanche on the same inputs", () => {
    // Avalanche is provably interest-optimal, so snowball should
    // never beat it. Equal is fine (e.g. trivial single-debt case).
    const debts = [
      debt("Big", 5000, 20, 100),
      debt("Small", 500, 8, 25),
    ];
    const av = avalanchePaydown(debts, 300);
    const sn = snowballPaydown(debts, 300);
    expect(av.feasible).toBe(true);
    expect(sn.feasible).toBe(true);
    if (!av.feasible || !sn.feasible) return;
    const totalInterest = (months: typeof av.schedule) =>
      months.reduce(
        (sum, m) => sum + m.reduce((s, e) => s + e.interestThisMonth, 0),
        0,
      );
    expect(totalInterest(sn.schedule)).toBeGreaterThanOrEqual(
      totalInterest(av.schedule),
    );
  });
});

describe("calculateMinimumPayment", () => {
  it("uses explicit minPayment when provided", () => {
    expect(
      calculateMinimumPayment({ balance: 1000, rate: 20, minPayment: 30 }),
    ).toBeCloseTo(30, 2);
  });

  it("falls back to interest + 1% of principal when minPayment is 0", () => {
    // $1000 at 24% APR: interest $20/mo + 1% ($10) = $30, above the floor.
    expect(
      calculateMinimumPayment({ balance: 1000, rate: 24, minPayment: 0 }),
    ).toBeCloseTo(30, 2);
  });

  it("floors the fallback at $25", () => {
    // $100 at 24% APR: interest $2 + 1% ($1) = $3, floored to $25.
    expect(
      calculateMinimumPayment({ balance: 100, rate: 24, minPayment: 0 }),
    ).toBeCloseTo(25, 2);
  });
});
