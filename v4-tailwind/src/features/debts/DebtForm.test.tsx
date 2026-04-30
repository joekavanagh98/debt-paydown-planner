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

  it("surfaces inline errors on each empty field instead of failing silently", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<DebtForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add debt/i }));

    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();
    expect(
      screen.getByText(/balance must be a positive number/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/rate must be 0 or higher/i)).toBeInTheDocument();
    expect(
      screen.getByText(/minimum payment must be 0 or higher/i),
    ).toBeInTheDocument();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("clears a field's error as soon as the user edits it", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<DebtForm onAdd={onAdd} />);

    fireEvent.click(screen.getByRole("button", { name: /add debt/i }));
    expect(await screen.findByText(/name is required/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Visa" },
    });
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument();
  });
});
