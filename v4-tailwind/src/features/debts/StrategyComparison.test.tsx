import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Debt } from "../../types";
import StrategyComparison from "./StrategyComparison";
import {
  avalanchePaydown,
  snowballPaydown,
} from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

// BalanceChart wraps Recharts, which uses ResizeObserver and SVG
// measurement that jsdom doesn't implement. The chart isn't what
// the test asserts on, so stub it out.
vi.mock("./BalanceChart", () => ({
  default: () => null,
}));

const debts: Debt[] = [
  { id: "1", name: "Visa", balance: 5000, rate: 24, minPayment: 100 },
  { id: "2", name: "Auto", balance: 8000, rate: 6, minPayment: 200 },
];

function totalInterestOf(schedule: { interestThisMonth: number }[][]): number {
  return schedule.reduce(
    (sum, month) => sum + month.reduce((s, e) => s + e.interestThisMonth, 0),
    0,
  );
}

describe("StrategyComparison", () => {
  it("renders months and total interest matching the calculator", () => {
    const budget = 500;
    const av = avalanchePaydown(debts, budget);
    const sn = snowballPaydown(debts, budget);
    if (!av.feasible || !sn.feasible) {
      throw new Error("test setup: budget should be feasible");
    }

    render(<StrategyComparison debts={debts} budget={String(budget)} />);

    expect(screen.getByText("Avalanche")).toBeInTheDocument();
    expect(screen.getByText("Snowball")).toBeInTheDocument();

    // The component reads the same calculator the test uses, so
    // displayed values must match. Use getAllByText because the same
    // number can appear in both strategy cards when the runs match.
    expect(
      screen.getAllByText(String(av.schedule.length)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(formatMoney(totalInterestOf(av.schedule))).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(String(sn.schedule.length)).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(formatMoney(totalInterestOf(sn.schedule))).length,
    ).toBeGreaterThan(0);
  });

  it("shows the budget-too-low warning when budget is below the sum of minimums", () => {
    // sum of minPayments is 100 + 200 = 300; 50 is well below.
    render(<StrategyComparison debts={debts} budget="50" />);
    expect(screen.getByText(/budget too low/i)).toBeInTheDocument();
  });
});
