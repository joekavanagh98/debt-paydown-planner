import type { Debt } from "../../types";
import DebtRow from "./DebtRow";

interface DebtListProps {
  debts: Debt[];
  onDelete: (id: string) => void;
}

function DebtList({ debts, onDelete }: DebtListProps) {
  if (debts.length === 0) {
    return <p id="list-empty">No debts added yet.</p>;
  }
  return (
    <ul id="debt-list">
      {debts.map((debt) => (
        <DebtRow key={debt.id} debt={debt} onDelete={onDelete} />
      ))}
    </ul>
  );
}

export default DebtList;
