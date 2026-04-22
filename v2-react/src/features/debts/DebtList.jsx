import DebtRow from "./DebtRow";

function DebtList({ debts, onDelete }) {
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
