import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import DebtForm from "./DebtForm";

describe("DebtForm", () => {
  it("calls onAdd with parsed and trimmed values on a valid submit", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<DebtForm onAdd={onAdd} />);

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "  Visa  " },
    });
    fireEvent.change(screen.getByLabelText(/balance/i), {
      target: { value: "5000" },
    });
    fireEvent.change(screen.getByLabelText(/interest rate/i), {
      target: { value: "19.99" },
    });
    fireEvent.change(screen.getByLabelText(/minimum payment/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add debt/i }));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledTimes(1);
    });
    expect(onAdd).toHaveBeenCalledWith({
      name: "Visa",
      balance: 5000,
      rate: 19.99,
      minPayment: 100,
    });
  });

  it("does not call onAdd when required fields are empty", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<DebtForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add debt/i }));

    // The handler runs synchronously and early-returns on invalid
    // input. Yield the event loop once so any state work flushes,
    // then assert nothing was called.
    await Promise.resolve();
    expect(onAdd).not.toHaveBeenCalled();
  });
});
