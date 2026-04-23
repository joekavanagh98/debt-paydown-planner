import { useMemo } from "react";
import type { Debt, PaydownResult, ScheduleMonth } from "../../types";
import {
  avalanchePaydown,
  snowballPaydown,
} from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

interface StrategyComparisonProps {
  debts: Debt[];
  budget: string;
}

function totalInterest(schedule: ScheduleMonth[]): number {
  return schedule.reduce(
    (sum, month) => sum + month.reduce((s, e) => s + e.interestThisMonth, 0),
    0,
  );
}

function StrategyComparison({ debts, budget }: StrategyComparisonProps) {
  const budgetNum = parseFloat(budget);
  const ready = debts.length > 0 && Number.isFinite(budgetNum) && budgetNum > 0;

  const avalanche = useMemo<PaydownResult | null>(() => {
    if (!ready) return null;
    return avalanchePaydown(debts, budgetNum);
  }, [debts, budgetNum, ready]);

  const snowball = useMemo<PaydownResult | null>(() => {
    if (!ready) return null;
    return snowballPaydown(debts, budgetNum);
  }, [debts, budgetNum, ready]);

  if (!ready || avalanche === null || snowball === null) return null;

  // Feasibility is determined by budget vs. sum of minimums and a 50-year
  // cap, neither of which depends on strategy ordering — so if avalanche
  // is infeasible, snowball is too, and we show the warning once.
  if (!avalanche.feasible) {
    const message =
      avalanche.reason === "budgetBelowMinimums"
        ? `Budget too low. You need at least ${formatMoney(avalanche.requiredMinimum)} per month to cover all minimum payments.`
        : "Payoff would take more than 50 years at this budget. Try a higher budget.";

    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="text-base font-semibold text-amber-900">Payoff Plans</h2>
        <p className="mt-2 text-sm text-amber-800">{message}</p>
      </section>
    );
  }

  if (!snowball.feasible) return null;

  const avMonths = avalanche.schedule.length;
  const snMonths = snowball.schedule.length;
  const avInterest = totalInterest(avalanche.schedule);
  const snInterest = totalInterest(snowball.schedule);
  const interestDiff = snInterest - avInterest;
  const monthsDiff = snMonths - avMonths;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Payoff Plans</h2>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StrategyCard
          name="Avalanche"
          tagline="Highest interest rate first"
          months={avMonths}
          interest={avInterest}
          highlighted
        />
        <StrategyCard
          name="Snowball"
          tagline="Smallest balance first"
          months={snMonths}
          interest={snInterest}
        />
      </div>
      <Takeaway interestDiff={interestDiff} monthsDiff={monthsDiff} />
    </section>
  );
}

interface StrategyCardProps {
  name: string;
  tagline: string;
  months: number;
  interest: number;
  highlighted?: boolean;
}

function StrategyCard({
  name,
  tagline,
  months,
  interest,
  highlighted = false,
}: StrategyCardProps) {
  return (
    <div
      className={
        "rounded-md border p-3 " +
        (highlighted
          ? "border-blue-200 bg-blue-50"
          : "border-slate-200 bg-slate-50")
      }
    >
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-900">{name}</span>
        <span className="text-xs text-slate-500">{tagline}</span>
      </div>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-600">Months to payoff</dt>
          <dd className="font-semibold text-slate-900">{months}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-600">Total interest</dt>
          <dd className="font-semibold text-slate-900">
            {formatMoney(interest)}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function Takeaway({
  interestDiff,
  monthsDiff,
}: {
  interestDiff: number;
  monthsDiff: number;
}) {
  // Avalanche is provably interest-optimal, so interestDiff (snowball - avalanche)
  // is always >= 0. monthsDiff is usually >= 0 as well.
  if (interestDiff < 0.01 && monthsDiff <= 0) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        Both strategies produce the same plan for these debts.
      </p>
    );
  }

  const parts: string[] = [];
  if (interestDiff >= 0.01) {
    parts.push(`saves you ${formatMoney(interestDiff)} in interest`);
  }
  if (monthsDiff > 0) {
    parts.push(`finishes ${monthsDiff} ${monthsDiff === 1 ? "month" : "months"} sooner`);
  }

  return (
    <p className="mt-4 text-sm text-slate-700">
      <span className="font-semibold">Avalanche</span> {parts.join(" and ")}.
    </p>
  );
}

export default StrategyComparison;
