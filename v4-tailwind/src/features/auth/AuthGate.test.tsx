import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AuthContext, type AuthContextValue } from "./authContext";
import AuthGate from "./AuthGate";

// Wrap AuthGate in a custom AuthContext.Provider so the tests inject
// known login/register/logout fns instead of going through the real
// AuthProvider, which has side effects against api.ts module state.
function renderGate(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  const value: AuthContextValue = {
    user: null,
    sessionExpired: false,
    login: vi.fn().mockResolvedValue(undefined),
    register: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
    ...overrides,
  };
  render(
    <AuthContext.Provider value={value}>
      <AuthGate />
    </AuthContext.Provider>,
  );
  return value;
}

describe("AuthGate", () => {
  it("renders the sign-in form by default", () => {
    renderGate();
    expect(
      screen.getByRole("heading", { name: /sign in/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^sign in$/i }),
    ).toBeInTheDocument();
  });

  it("toggles to register mode when the switch button is clicked", () => {
    renderGate();
    fireEvent.click(screen.getByRole("button", { name: /^register$/i }));
    expect(
      screen.getByRole("heading", { name: /create your account/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^create account$/i }),
    ).toBeInTheDocument();
  });

  it("calls login with the entered credentials on sign-in submit", async () => {
    const value = renderGate();

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));

    await waitFor(() => {
      expect(value.login).toHaveBeenCalledTimes(1);
    });
    expect(value.login).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    expect(value.register).not.toHaveBeenCalled();
  });

  it("calls register with the entered credentials in register mode", async () => {
    const value = renderGate();
    fireEvent.click(screen.getByRole("button", { name: /^register$/i }));

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "password123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^create account$/i }));

    await waitFor(() => {
      expect(value.register).toHaveBeenCalledTimes(1);
    });
    expect(value.register).toHaveBeenCalledWith({
      email: "new@example.com",
      password: "password123",
    });
    expect(value.login).not.toHaveBeenCalled();
  });
});
