import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { NewDebt } from "../../types";

interface DebtFormProps {
  onAdd: (debt: NewDebt) => void;
}

interface DebtFormDraft {
  name: string;
  balance: string;
  rate: string;
  minPayment: string;
}

const EMPTY_FORM: DebtFormDraft = {
  name: "",
  balance: "",
  rate: "",
  minPayment: "",
};

function DebtForm({ onAdd }: DebtFormProps) {
  const [form, setForm] = useState<DebtFormDraft>(EMPTY_FORM);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as keyof DebtFormDraft;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = form.name.trim();
    const balance = parseFloat(form.balance);
    const rate = parseFloat(form.rate);
    const minPayment = parseFloat(form.minPayment);

    if (!name) return;
    if (!Number.isFinite(balance) || balance <= 0) return;
    if (!Number.isFinite(rate) || rate < 0) return;
    if (!Number.isFinite(minPayment) || minPayment < 0) return;

    onAdd({ name, balance, rate, minPayment });
    setForm(EMPTY_FORM);
  };

  return (
    <form onSubmit={handleSubmit} autoComplete="off" noValidate>
      <div className="field">
        <label htmlFor="form-name">Name</label>
        <input
          type="text"
          id="form-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          maxLength={40}
          placeholder="Visa, Car Loan, Student Loan..."
          required
        />
      </div>
      <div className="field">
        <label htmlFor="form-balance">Balance ($)</label>
        <input
          type="number"
          id="form-balance"
          name="balance"
          value={form.balance}
          onChange={handleChange}
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="5000.00"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="form-rate">Interest Rate (APR %)</label>
        <input
          type="number"
          id="form-rate"
          name="rate"
          value={form.rate}
          onChange={handleChange}
          inputMode="decimal"
          min="0"
          step="0.01"
          placeholder="19.99"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="form-min-payment">Minimum Payment ($)</label>
        <input
          type="number"
          id="form-min-payment"
          name="minPayment"
          value={form.minPayment}
          onChange={handleChange}
          inputMode="decimal"
          min="0.01"
          step="0.01"
          placeholder="25.00"
          required
        />
      </div>
      <div className="buttons">
        <button type="submit">Add Debt</button>
        <button type="button" onClick={() => setForm(EMPTY_FORM)}>
          Clear
        </button>
      </div>
    </form>
  );
}

export default DebtForm;
