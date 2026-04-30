import { useState } from "react";
import type { Debt } from "../../types";
import { calculateMinimumPayment } from "../../utils/paydownCalculator";
import { formatMoney } from "../../utils/formatMoney";

interface DebtRowProps {
  debt: Debt;
  onDelete: (id: string) => void;
}

function DebtRow({ debt, onDelete }: DebtRowProps) {
  // Two-stage delete: first click arms the row, second click commits.
  // Avoids one-misclick data loss on a list of manually-typed debts.
  const [confirming, setConfirming] = useState<boolean>(false);

  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="font-medium text-slate-900">{debt.name}</div>
        <div className="mt-0.5 text-sm text-slate-500">
          {formatMoney(debt.balance)} · {debt.rate}% APR · min{" "}
          {formatMoney(calculateMinimumPayment(debt))}
        </div>
      </div>
      {confirming ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDelete(debt.id)}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200"
          >
            Confirm delete
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Delete
        </button>
      )}
    </li>
  );
}

export default DebtRow;
