import { useState } from "react";
import BudgetInput from "./features/debts/BudgetInput";
import DebtForm from "./features/debts/DebtForm";
import DebtList from "./features/debts/DebtList";
import Schedule from "./features/debts/Schedule";
import Summary from "./features/debts/Summary";

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
      <Summary debts={debts} />
      <BudgetInput value={budget} onChange={setBudget} />
      <DebtForm onAdd={addDebt} />
      <DebtList debts={debts} onDelete={deleteDebt} />
      <Schedule debts={debts} budget={budget} />
    </main>
  );
}

export default App;
