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
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <SummaryCard label="Total Balance" value={formatMoney(totalBalance)} />
      <SummaryCard label="Total Minimum" value={formatMoney(totalMinimum)} />
      <SummaryCard label="Debts" value={String(debts.length)} />
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default Summary;
