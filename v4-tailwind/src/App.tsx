import { useEffect, useState } from "react";
import type { Debt, NewDebt, User } from "./types";
import AuthGate from "./features/auth/AuthGate";
import { useAuth } from "./features/auth/authContext";
import BudgetInput from "./features/debts/BudgetInput";
import DebtForm from "./features/debts/DebtForm";
import DebtList from "./features/debts/DebtList";
import StrategyComparison from "./features/debts/StrategyComparison";
import Summary from "./features/debts/Summary";
import {
  createDebt as apiCreateDebt,
  deleteDebt as apiDeleteDebt,
  listDebts as apiListDebts,
} from "./lib/debtsApi";
import { loadJSON, saveJSON } from "./utils/storage";

// Budget is a per-user UI preference. Server-side preferences would
// be the proper home (one /users/me/preferences endpoint), but that's
// not in the v8 scope. Namespacing by user id keeps two users on the
// same browser from inheriting each other's budget entry.
const budgetKey = (userId: string): string => `dpp.budget.${userId}`;

/**
 * Top-level gate. AuthGate when signed out, SignedInApp when signed in.
 * The key={user.id} on SignedInApp makes React unmount + remount when
 * the user changes (sign-out then sign-in as a different user) so all
 * debts/budget state resets without manual cleanup in an effect.
 */
function App() {
  const { user } = useAuth();
  if (user === null) {
    return <AuthGate />;
  }
  return <SignedInApp user={user} key={user.id} />;
}

interface SignedInAppProps {
  user: User;
}

function SignedInApp({ user }: SignedInAppProps) {
  const { logout } = useAuth();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtsLoading, setDebtsLoading] = useState<boolean>(true);
  const [debtsError, setDebtsError] = useState<string | null>(null);

  const [budget, setBudget] = useState<string>(() =>
    loadJSON<string>(budgetKey(user.id), ""),
  );

  // Fetch debts once at mount. The key={user.id} on this component
  // means a new user gets a fresh component instance, so this effect
  // runs once per signed-in session and never has to handle the
  // signed-out case.
  useEffect(() => {
    let cancelled = false;
    apiListDebts()
      .then((result) => {
        if (!cancelled) setDebts(result);
      })
      .catch(() => {
        if (!cancelled) {
          setDebtsError("Couldn't load your debts. Try refreshing.");
        }
      })
      .finally(() => {
        if (!cancelled) setDebtsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Persist budget per-user to localStorage on change. Server-side
  // store would be cleaner; deferred.
  useEffect(() => {
    saveJSON(budgetKey(user.id), budget);
  }, [user.id, budget]);

  const addDebt = async (input: NewDebt): Promise<void> => {
    try {
      const created = await apiCreateDebt(input);
      setDebts((prev) => [...prev, created]);
      setDebtsError(null);
    } catch {
      setDebtsError("Couldn't save the debt. Try again.");
      // Re-throw so DebtForm knows not to clear its inputs.
      throw new Error("createDebt failed");
    }
  };

  const deleteDebt = async (id: string): Promise<void> => {
    try {
      await apiDeleteDebt(id);
      setDebts((prev) => prev.filter((d) => d.id !== id));
      setDebtsError(null);
    } catch {
      setDebtsError("Couldn't delete the debt. Try again.");
    }
  };

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
        {debtsError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
          >
            <span>{debtsError}</span>
            <button
              type="button"
              onClick={() => setDebtsError(null)}
              className="text-xs font-semibold text-red-900 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <Summary debts={debts} />
        <BudgetInput value={budget} onChange={setBudget} />
        <DebtForm onAdd={addDebt} />
        {debtsLoading ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
            Loading your debts...
          </p>
        ) : (
          <DebtList debts={debts} onDelete={deleteDebt} />
        )}
        <StrategyComparison debts={debts} budget={budget} />
      </main>
    </div>
  );
}

export default App;
