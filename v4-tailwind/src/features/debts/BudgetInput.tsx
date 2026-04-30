interface BudgetInputProps {
  value: string;
  onChange: (value: string) => void;
}

function BudgetInput({ value, onChange }: BudgetInputProps) {
  // Empty is fine: the placeholder is doing the prompting. Non-empty
  // but unparseable or non-positive means StrategyComparison would
  // silently render null, which leaves the user staring at a missing
  // section with no idea why. The hint covers that case.
  const trimmed = value.trim();
  const parsed = parseFloat(trimmed);
  const invalid = trimmed.length > 0 && (!Number.isFinite(parsed) || parsed <= 0);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <label
        htmlFor="budget-input"
        className="block text-sm font-medium text-slate-700"
      >
        Monthly Budget ($)
      </label>
      <input
        type="number"
        id="budget-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="500.00"
        aria-invalid={invalid}
        aria-describedby={invalid ? "budget-input-hint" : undefined}
        className={
          "mt-2 w-full rounded-md border px-3 py-2 text-base shadow-sm focus:outline-none focus:ring-2 " +
          (invalid
            ? "border-red-300 focus:border-red-500 focus:ring-red-200"
            : "border-slate-300 focus:border-blue-500 focus:ring-blue-200")
        }
      />
      {invalid && (
        <p id="budget-input-hint" className="mt-1 text-xs text-red-700">
          Enter a budget greater than 0 to see your payoff plan.
        </p>
      )}
    </section>
  );
}

export default BudgetInput;
