import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Debt, ScheduleMonth } from "../../types";
import { formatMoney } from "../../utils/formatMoney";

interface BalanceChartProps {
  debts: Debt[];
  schedule: ScheduleMonth[];
}

// Cycled per-debt; finance-friendly without being so saturated that two
// adjacent lines blur. Anything beyond 6 debts wraps around.
const COLORS = [
  "#2563eb", // blue-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#7c3aed", // violet-600
  "#e11d48", // rose-600
  "#475569", // slate-600
];

const yAxisFormatter = (value: number): string =>
  value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value.toFixed(0)}`;

// Recharts' Tooltip types value/label as ValueType / ReactNode, neither of
// which narrows usefully. Coerce at the boundary instead of casting through.
const tooltipFormatter = (value: unknown): string => formatMoney(Number(value));
const tooltipLabelFormatter = (label: unknown): string => `Month ${String(label)}`;

// noUncheckedIndexedAccess returns T | undefined from any array index. The
// modulo guarantees we're in bounds at runtime; the fallback never fires
// but satisfies the compiler without an unsafe non-null assertion.
const colorFor = (i: number): string =>
  COLORS[i % COLORS.length] ?? "#475569";

function BalanceChart({ debts, schedule }: BalanceChartProps) {
  // Prepend month 0 = original balances so the lines start at the top
  // and visibly decline to zero, rather than starting one month in.
  const data = useMemo(() => {
    const start: Record<string, number> = { month: 0 };
    debts.forEach((d) => {
      start[d.name] = d.balance;
    });

    const rows = schedule.map((monthEntries, i) => {
      const row: Record<string, number> = { month: i + 1 };
      monthEntries.forEach((e) => {
        row[e.name] = e.balance;
      });
      return row;
    });

    return [start, ...rows];
  }, [debts, schedule]);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 8, left: 0 }}
        >
          <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis
            dataKey="month"
            stroke="#64748b"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            stroke="#64748b"
            tick={{ fontSize: 11 }}
            tickFormatter={yAxisFormatter}
            width={56}
          />
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={tooltipLabelFormatter}
            contentStyle={{ fontSize: 12 }}
          />
          {debts.map((d, i) => (
            <Line
              key={d.id}
              type="monotone"
              dataKey={d.name}
              stroke={colorFor(i)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default BalanceChart;
