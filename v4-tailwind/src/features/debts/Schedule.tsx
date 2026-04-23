import { useMemo } from "react";
import type { Debt } from "../../types";
import { avalanchePaydown } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

interface ScheduleProps {
  debts: Debt[];
  budget: string;
}

function Schedule({ debts, budget }: ScheduleProps) {
  const budgetNum = parseFloat(budget);
  const ready = debts.length > 0 && Number.isFinite(budgetNum) && budgetNum > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    return avalanchePaydown(debts, budgetNum);
  }, [debts, budgetNum, ready]);

  if (!ready || result === null) return null;

  if (!result.feasible) {
    const message =
      result.reason === "budgetBelowMinimums"
        ? `Budget too low. You need at least ${formatMoney(result.requiredMinimum)} per month to cover all minimum payments.`
        : "Payoff would take more than 50 years at this budget. Try a higher budget.";

    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <h2 className="text-base font-semibold text-amber-900">Payoff Plan</h2>
        <p className="mt-2 text-sm text-amber-800">{message}</p>
      </section>
    );
  }

  const { schedule } = result;
  const months = schedule.length;
  const totalInterest = schedule.reduce(
    (sum, month) => sum + month.reduce((s, e) => s + e.interestThisMonth, 0),
    0,
  );

  // First month where each debt's balance hits 0 is its payoff month.
  const payoffMonth: Record<string, number> = {};
  schedule.forEach((month, i) => {
    month.forEach((e) => {
      if (e.balance === 0 && payoffMonth[e.name] === undefined) {
        payoffMonth[e.name] = i + 1;
      }
    });
  });

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Payoff Plan</h2>
      <p className="mt-2 text-sm text-slate-600">
        Debt-free in{" "}
        <strong className="font-semibold text-slate-900">{months}</strong>{" "}
        months. Total interest paid:{" "}
        <strong className="font-semibold text-slate-900">
          {formatMoney(totalInterest)}
        </strong>
        .
      </p>
      <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
        {debts.map((d) => (
          <li
            key={d.id}
            className="flex items-center justify-between py-2 text-sm"
          >
            <span className="text-slate-700">{d.name}</span>
            <span className="text-slate-500">
              {payoffMonth[d.name] !== undefined
                ? `Paid off in month ${payoffMonth[d.name]}`
                : "—"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Schedule;
