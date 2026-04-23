import { useEffect, useState } from "react";
import type { Debt, NewDebt } from "./types";
import BudgetInput from "./features/debts/BudgetInput";
import DebtForm from "./features/debts/DebtForm";
import DebtList from "./features/debts/DebtList";
import Schedule from "./features/debts/Schedule";
import Summary from "./features/debts/Summary";
import { loadJSON, saveJSON } from "./utils/storage";

const DEBTS_KEY = "dpp.debts";
const BUDGET_KEY = "dpp.budget";

function App() {
  const [debts, setDebts] = useState<Debt[]>(() =>
    loadJSON<Debt[]>(DEBTS_KEY, []),
  );
  const [budget, setBudget] = useState<string>(() =>
    loadJSON<string>(BUDGET_KEY, ""),
  );

  useEffect(() => {
    saveJSON(DEBTS_KEY, debts);
  }, [debts]);

  useEffect(() => {
    saveJSON(BUDGET_KEY, budget);
  }, [budget]);

  const addDebt = (debt: NewDebt) => {
    const debtWithId: Debt = { ...debt, id: crypto.randomUUID() };
    setDebts((prev) => [...prev, debtWithId]);
  };

  const deleteDebt = (id: string) => {
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
