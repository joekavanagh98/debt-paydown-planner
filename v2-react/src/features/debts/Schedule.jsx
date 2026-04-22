import { useMemo } from "react";
import { avalanchePaydown } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

function Schedule({ debts, budget }) {
  const budgetNum = parseFloat(budget);
  const ready = debts.length > 0 && Number.isFinite(budgetNum) && budgetNum > 0;

  const result = useMemo(() => {
    if (!ready) return null;
    return avalanchePaydown(debts, budgetNum);
  }, [debts, budgetNum, ready]);

  if (!ready) return null;

  if (!result.feasible) {
    if (result.reason === "budgetBelowMinimums") {
      return (
        <section className="schedule">
          <h2>Payoff Plan</h2>
          <p className="schedule-warning">
            Budget too low. You need at least{" "}
            {formatMoney(result.requiredMinimum)} per month to cover all minimum
            payments.
          </p>
        </section>
      );
    }
    return (
      <section className="schedule">
        <h2>Payoff Plan</h2>
        <p className="schedule-warning">
          Payoff would take more than 50 years at this budget. Try a higher
          budget.
        </p>
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
  const payoffMonth = {};
  schedule.forEach((month, i) => {
    month.forEach((e) => {
      if (e.balance === 0 && payoffMonth[e.name] === undefined) {
        payoffMonth[e.name] = i + 1;
      }
    });
  });

  return (
    <section className="schedule">
      <h2>Payoff Plan</h2>
      <p>
        Debt-free in <strong>{months}</strong> months. Total interest paid:{" "}
        <strong>{formatMoney(totalInterest)}</strong>.
      </p>
      <ul>
        {debts.map((d) => (
          <li key={d.id}>
            {d.name} — paid off in month {payoffMonth[d.name] ?? "—"}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default Schedule;
