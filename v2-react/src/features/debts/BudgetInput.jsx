function BudgetInput({ value, onChange }) {
  return (
    <div className="field">
      <label htmlFor="budget-input">Monthly Budget ($)</label>
      <input
        type="number"
        id="budget-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="500.00"
      />
    </div>
  );
}

export default BudgetInput;
