import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ApiRequestError } from "../../lib/api";
import { extractDebts } from "../../lib/debtsApi";
import type { NewDebt } from "../../types";

interface DebtExtractorProps {
  // Throws on failure so each review row can fail independently
  // and stay editable. Same contract as the manual DebtForm uses.
  onAddDebt: (debt: NewDebt) => Promise<void>;
}

interface ReviewableDebtDraft {
  name: string;
  balance: string;
  rate: string;
  minPayment: string;
}

interface ReviewableDebt {
  id: number;
  draft: ReviewableDebtDraft;
  status: "ready" | "saving" | "saved" | "failed";
  rowError?: string | undefined;
}

const MAX_TEXT_LENGTH = 5000;

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500";
const labelClass = "block text-xs font-medium text-slate-700";

function DebtExtractor({ onAddDebt }: DebtExtractorProps) {
  const [text, setText] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [debts, setDebts] = useState<ReviewableDebt[] | null>(null);

  const handleParse = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    try {
      const result = await extractDebts(trimmed);
      setDebts(
        result.debts.map((d, i) => ({
          id: i,
          draft: {
            name: d.name,
            balance: d.balance.toString(),
            rate: d.rate.toString(),
            minPayment:
              d.minPayment !== undefined ? d.minPayment.toString() : "",
          },
          status: "ready" as const,
        })),
      );
    } catch (e: unknown) {
      setError(messageFor(e));
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (
    id: number,
    field: keyof ReviewableDebtDraft,
    value: string,
  ): void => {
    setDebts((prev) =>
      prev === null
        ? null
        : prev.map((row) =>
            row.id === id
              ? {
                  ...row,
                  draft: { ...row.draft, [field]: value },
                  // Clear inline error when the user edits — let them try again.
                  rowError: undefined,
                }
              : row,
          ),
    );
  };

  const setRow = (
    id: number,
    patch: Partial<Pick<ReviewableDebt, "status" | "rowError">>,
  ): void => {
    setDebts((prev) =>
      prev === null
        ? null
        : prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const saveOne = async (id: number): Promise<void> => {
    const row = debts?.find((r) => r.id === id);
    if (!row || row.status !== "ready") return;

    const name = row.draft.name.trim();
    const balance = parseFloat(row.draft.balance);
    const rate = parseFloat(row.draft.rate);
    // Backend's NewDebt requires minPayment as a number; an empty
    // field becomes 0, which the calculator interprets as "use the
    // fallback rule (interest + 1% of principal, floored at $25)".
    const minPayment =
      row.draft.minPayment.trim() === ""
        ? 0
        : parseFloat(row.draft.minPayment);

    if (!name) {
      setRow(id, { rowError: "Name can't be empty." });
      return;
    }
    if (!Number.isFinite(balance) || balance <= 0) {
      setRow(id, { rowError: "Balance must be a positive number." });
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setRow(id, { rowError: "Rate must be 0 or higher." });
      return;
    }
    if (!Number.isFinite(minPayment) || minPayment < 0) {
      setRow(id, {
        rowError: "Minimum payment must be 0 or higher (or blank).",
      });
      return;
    }

    setRow(id, { status: "saving", rowError: undefined });
    try {
      await onAddDebt({ name, balance, rate, minPayment });
      setRow(id, { status: "saved" });
    } catch {
      setRow(id, {
        status: "failed",
        rowError: "Couldn't save this one. Try again.",
      });
    }
  };

  const saveAll = async (): Promise<void> => {
    if (debts === null) return;
    // Sequential, not parallel: gentler on the server, predictable
    // ordering for the user (the list grows in extraction order),
    // and a row failure doesn't take the rest down with it.
    for (const row of debts) {
      if (row.status === "ready") {
        await saveOne(row.id);
      }
    }
  };

  const resetAll = (): void => {
    setText("");
    setDebts(null);
    setError(null);
  };

  const readyCount = debts?.filter((r) => r.status === "ready").length ?? 0;
  const savedCount = debts?.filter((r) => r.status === "saved").length ?? 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">
        Add debts from a statement
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        Paste statement text and let Claude extract the debt accounts. You'll
        review each one before it saves.
      </p>

      {debts === null ? (
        <form onSubmit={handleParse} className="mt-4 space-y-3">
          <div>
            <label htmlFor="extract-text" className={labelClass}>
              Statement text
            </label>
            <textarea
              id="extract-text"
              value={text}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setText(e.target.value)
              }
              rows={6}
              maxLength={MAX_TEXT_LENGTH}
              disabled={submitting}
              placeholder="Paste a credit card or loan statement here..."
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
            />
            <p
              className={
                "mt-1 text-xs " +
                (text.length === MAX_TEXT_LENGTH
                  ? "text-red-600"
                  : "text-slate-500")
              }
            >
              {text.length} / {MAX_TEXT_LENGTH}
            </p>
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting || text.trim().length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-400 disabled:hover:bg-slate-400"
          >
            {submitting ? "Parsing..." : "Parse with AI"}
          </button>
        </form>
      ) : (
        <div className="mt-4 space-y-4">
          {debts.length === 0 ? (
            <>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Claude didn't find any debts in that text. Try pasting a
                different statement, or add debts manually below.
              </p>
              <button
                type="button"
                onClick={resetAll}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                Try different text
              </button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
                <span>
                  {debts.length} debt{debts.length === 1 ? "" : "s"} found.
                  {savedCount > 0 && (
                    <>
                      {" "}
                      {savedCount} added
                      {readyCount > 0 ? `, ${readyCount} pending` : ""}.
                    </>
                  )}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={saveAll}
                    disabled={readyCount === 0}
                    className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-400 disabled:hover:bg-slate-400"
                  >
                    Add all ready ({readyCount})
                  </button>
                  <button
                    type="button"
                    onClick={resetAll}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Start over
                  </button>
                </div>
              </div>
              <ul className="space-y-3">
                {debts.map((row) => (
                  <ReviewRow
                    key={row.id}
                    row={row}
                    onUpdate={updateField}
                    onSave={saveOne}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}

interface ReviewRowProps {
  row: ReviewableDebt;
  onUpdate: (
    id: number,
    field: keyof ReviewableDebtDraft,
    value: string,
  ) => void;
  onSave: (id: number) => Promise<void>;
}

function ReviewRow({ row, onUpdate, onSave }: ReviewRowProps) {
  const isSaved = row.status === "saved";
  const isSaving = row.status === "saving";
  const disabled = isSaved || isSaving;

  const cardClass = isSaved
    ? "rounded-md border border-emerald-200 bg-emerald-50 p-3"
    : "rounded-md border border-slate-200 bg-slate-50 p-3";

  return (
    <li className={cardClass}>
      <div className="space-y-2">
        <Field
          id={`row-${row.id}-name`}
          label="Name"
          value={row.draft.name}
          onChange={(v) => onUpdate(row.id, "name", v)}
          disabled={disabled}
          maxLength={40}
        />
        <Field
          id={`row-${row.id}-balance`}
          label="Balance ($)"
          value={row.draft.balance}
          onChange={(v) => onUpdate(row.id, "balance", v)}
          disabled={disabled}
          type="number"
        />
        <Field
          id={`row-${row.id}-rate`}
          label="Rate (% APR)"
          value={row.draft.rate}
          onChange={(v) => onUpdate(row.id, "rate", v)}
          disabled={disabled}
          type="number"
        />
        <Field
          id={`row-${row.id}-min`}
          label="Min Payment ($)"
          value={row.draft.minPayment}
          onChange={(v) => onUpdate(row.id, "minPayment", v)}
          disabled={disabled}
          type="number"
          placeholder="Leave blank if not stated"
        />
      </div>
      {row.rowError && (
        <p className="mt-2 text-xs text-red-700">{row.rowError}</p>
      )}
      <div className="mt-3 flex items-center justify-between">
        {isSaved ? (
          <span className="text-sm font-medium text-emerald-700">
            Added to your debts
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              void onSave(row.id);
            }}
            disabled={isSaving}
            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-400 disabled:hover:bg-slate-400"
          >
            {isSaving ? "Adding..." : "Add this debt"}
          </button>
        )}
      </div>
    </li>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  type?: "text" | "number";
  maxLength?: number;
  placeholder?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  disabled,
  type = "text",
  maxLength,
  placeholder,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        inputMode={type === "number" ? "decimal" : undefined}
        step={type === "number" ? "0.01" : undefined}
        className={inputClass}
      />
    </div>
  );
}

function messageFor(err: unknown): string {
  if (err instanceof ApiRequestError) {
    if (err.code === "rate_limited") {
      return "Too many extractions. Try again in an hour.";
    }
    if (err.code === "extraction_failed") {
      return "Couldn't extract debts from that text. Try a clearer paste, or add them manually below.";
    }
    if (err.code === "validation_error") {
      return "Text was empty or over the 5000-character limit.";
    }
  }
  return "Something went wrong. Check your connection and try again.";
}

export default DebtExtractor;
