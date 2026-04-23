import { useMemo } from "react";
import type { Debt } from "../../types";
import { calculateMinimumPayment } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

interface SummaryProps {
  debts: Debt[];
}

function Summary({ debts }: SummaryProps) {
  const { totalBalance, totalMinimum } = useMemo(() => {
    return debts.reduce(
      (acc, d) => ({
        totalBalance: acc.totalBalance + d.balance,
        totalMinimum: acc.totalMinimum + calculateMinimumPayment(d),
      }),
      { totalBalance: 0, totalMinimum: 0 },
    );
  }, [debts]);

  return (
    <section className="summary">
      <div className="summary-card">
        <span className="summary-label">Total Balance</span>
        <span className="summary-value">{formatMoney(totalBalance)}</span>
      </div>
      <div className="summary-card">
        <span className="summary-label">Total Minimum</span>
        <span className="summary-value">{formatMoney(totalMinimum)}</span>
      </div>
      <div className="summary-card">
        <span className="summary-label">Debts</span>
        <span className="summary-value">{debts.length}</span>
      </div>
    </section>
  );
}

export default Summary;
