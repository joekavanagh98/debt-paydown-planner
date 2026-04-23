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

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200";
const labelClass = "block text-sm font-medium text-slate-700";

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
    <form
      onSubmit={handleSubmit}
      autoComplete="off"
      noValidate
      className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
    >
      <h2 className="text-base font-semibold text-slate-900">Add a debt</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="form-name" className={labelClass}>
            Name
          </label>
          <input
            type="text"
            id="form-name"
            name="name"
            value={form.name}
            onChange={handleChange}
            maxLength={40}
            placeholder="Visa, Car Loan, Student Loan..."
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="form-balance" className={labelClass}>
            Balance ($)
          </label>
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
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="form-rate" className={labelClass}>
            Interest Rate (APR %)
          </label>
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
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="form-min-payment" className={labelClass}>
            Minimum Payment ($)
          </label>
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
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        >
          Add Debt
        </button>
        <button
          type="button"
          onClick={() => setForm(EMPTY_FORM)}
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          Clear
        </button>
      </div>
    </form>
  );
}

export default DebtForm;
