import { useEffect, useState } from "react";
import { ApiRequestError } from "../../lib/api";
import { getStaffSummary } from "../../lib/staffApi";
import type { StaffSummary } from "../../types";
import { formatMoney } from "../../utils/formatMoney";

/**
 * Staff dashboard view. Fetches /staff/summary on mount and renders
 * the aggregate metrics as cards.
 *
 * The "Aggregate data only" banner sits at the top of the view as a
 * visible, non-collapsible reminder of the privacy invariant. Even
 * if a future bug accidentally surfaces individual data in the
 * response, the banner's claim would no longer match the page —
 * which is itself a soft check, but the load-bearing one is the
 * server-side leak-canary test.
 */
function StaffDashboard() {
  const [summary, setSummary] = useState<StaffSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStaffSummary()
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(messageFor(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div
        role="note"
        className="rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700"
      >
        Aggregate data only — no individual customer information is
        displayed.
      </div>

      {loading && (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
          Loading staff summary...
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}

      {summary && <SummaryCards summary={summary} />}
    </div>
  );
}

function SummaryCards({ summary }: { summary: StaffSummary }) {
  const noUsers = summary.users.total === 0;
  const noDebts = summary.debts.totalCount === 0;

  return (
    <>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card label="Total users" value={String(summary.users.total)} />
        <Card
          label="Total debt"
          value={noDebts ? "No data yet" : formatMoney(summary.debts.totalBalance)}
        />
        <Card
          label="Average APR"
          value={
            summary.debts.averageRate === null
              ? "No data yet"
              : `${summary.debts.averageRate.toFixed(2)}%`
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card
          label="Total debts (count)"
          value={String(summary.debts.totalCount)}
        />
        <Card
          label="Signup range"
          value={
            noUsers
              ? "No data yet"
              : formatSignupRange(
                  summary.users.earliestSignup,
                  summary.users.latestSignup,
                )
          }
        />
      </section>

      <DistributionCard
        distribution={summary.debtCountDistribution}
        totalUsers={summary.users.total}
      />
    </>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

interface DistributionCardProps {
  distribution: StaffSummary["debtCountDistribution"];
  totalUsers: number;
}

function DistributionCard({ distribution, totalUsers }: DistributionCardProps) {
  // Bars scale to the largest bucket so the visual ranking shows
  // correctly even when one bucket dwarfs the others. Falls back to
  // 1 to avoid a divide-by-zero when there are no users.
  const max = Math.max(
    distribution.zero,
    distribution.oneToTwo,
    distribution.threeToFive,
    distribution.sixPlus,
    1,
  );

  const buckets: { label: string; count: number }[] = [
    { label: "0 debts", count: distribution.zero },
    { label: "1–2 debts", count: distribution.oneToTwo },
    { label: "3–5 debts", count: distribution.threeToFive },
    { label: "6+ debts", count: distribution.sixPlus },
  ];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Debt count distribution
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        How many debts each user has tracked.
      </p>
      {totalUsers === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No data yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {buckets.map((b) => (
            <li key={b.label} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-slate-600">
                {b.label}
              </span>
              <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                <div
                  className="h-full rounded bg-blue-600"
                  style={{ width: `${(b.count / max) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-slate-700">
                {b.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatSignupRange(
  earliest: string | null,
  latest: string | null,
): string {
  if (earliest === null || latest === null) return "No data yet";
  const fmt = (iso: string): string => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };
  if (earliest === latest) return fmt(earliest);
  return `${fmt(earliest)} – ${fmt(latest)}`;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.code === "forbidden") {
      return "You no longer have staff access. Switch to the planner view.";
    }
    if (err.code === "unauthorized") {
      // The 401 case is handled globally by the AuthProvider, which
      // signs the user out and routes them to the auth screen.
      // This message is the brief flash before that re-renders.
      return "Your session expired.";
    }
  }
  return "Couldn't load the staff summary. Try again.";
}

export default StaffDashboard;
