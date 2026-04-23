import type { Debt } from "../../types";
import DebtRow from "./DebtRow";

interface DebtListProps {
  debts: Debt[];
  onDelete: (id: string) => void;
}

function DebtList({ debts, onDelete }: DebtListProps) {
  if (debts.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        No debts added yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {debts.map((debt) => (
        <DebtRow key={debt.id} debt={debt} onDelete={onDelete} />
      ))}
    </ul>
  );
}

export default DebtList;
