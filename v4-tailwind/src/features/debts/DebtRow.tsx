import type { Debt } from "../../types";
import { calculateMinimumPayment } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

interface DebtRowProps {
  debt: Debt;
  onDelete: (id: string) => void;
}

function DebtRow({ debt, onDelete }: DebtRowProps) {
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="font-medium text-slate-900">{debt.name}</div>
        <div className="mt-0.5 text-sm text-slate-500">
          {formatMoney(debt.balance)} · {debt.rate}% APR · min{" "}
          {formatMoney(calculateMinimumPayment(debt))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDelete(debt.id)}
        className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
      >
        Delete
      </button>
    </li>
  );
}

export default DebtRow;
