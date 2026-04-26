import { useEffect, useState } from "react";
import type { Debt, NewDebt } from "./types";
import AuthGate from "./features/auth/AuthGate";
import { useAuth } from "./features/auth/authContext";
import BudgetInput from "./features/debts/BudgetInput";
import DebtForm from "./features/debts/DebtForm";
import DebtList from "./features/debts/DebtList";
import StrategyComparison from "./features/debts/StrategyComparison";
import Summary from "./features/debts/Summary";
import { loadJSON, saveJSON } from "./utils/storage";

const DEBTS_KEY = "dpp.debts";
const BUDGET_KEY = "dpp.budget";

function App() {
  const { user, logout } = useAuth();

  // Hooks always run; early return below is the standard React
  // pattern (rules of hooks: same hook order every render).
  // localStorage persistence stays in this commit; c5 swaps it for
  // the per-user backend.
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

  if (user === null) {
    return <AuthGate />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Debt Paydown Planner
            </h1>
            <p className="mt-1 text-sm text-slate-600 sm:text-base">
              List your debts and a monthly budget to see an avalanche payoff
              plan.
            </p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <div className="hidden sm:block">{user.email}</div>
            <button
              type="button"
              onClick={logout}
              className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Sign out
            </button>
          </div>
        </header>
        <Summary debts={debts} />
        <BudgetInput value={budget} onChange={setBudget} />
        <DebtForm onAdd={addDebt} />
        <DebtList debts={debts} onDelete={deleteDebt} />
        <StrategyComparison debts={debts} budget={budget} />
      </main>
    </div>
  );
}

export default App;
