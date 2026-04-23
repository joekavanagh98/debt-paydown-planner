interface BudgetInputProps {
  value: string;
  onChange: (value: string) => void;
}

function BudgetInput({ value, onChange }: BudgetInputProps) {
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
        className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
      />
    </section>
  );
}

export default BudgetInput;
