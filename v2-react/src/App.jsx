import { useState } from "react";
import DebtForm from "./features/debts/DebtForm";
import DebtList from "./features/debts/DebtList";

function App() {
  const [debts, setDebts] = useState([]);
  const [budget, setBudget] = useState("");

  const addDebt = (debt) => {
    const debtWithId = { ...debt, id: crypto.randomUUID() };
    setDebts((prev) => [...prev, debtWithId]);
  };

  const deleteDebt = (id) => {
    setDebts((prev) => prev.filter((d) => d.id !== id));
  };

  return (
    <main>
      <h1>Debt Paydown Planner</h1>
      <p>
        {debts.length} debts, budget: {budget || "(empty)"}
      </p>
      <DebtForm onAdd={addDebt} />
      <DebtList debts={debts} onDelete={deleteDebt} />
    </main>
  );
}

export default App;
