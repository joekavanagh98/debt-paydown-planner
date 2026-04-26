import { useState } from "react";
import { ApiRequestError } from "../../lib/api";
import AuthForm from "./AuthForm";
import { useAuth } from "./authContext";

/**
 * The signed-out state. Holds local UI state (mode, submitting, error)
 * and delegates the actual auth call to the AuthProvider's login or
 * register actions.
 *
 * Error mapping converts the backend's standard envelope (validation
 * issues / unauthorized / already_exists) into short, human-readable
 * messages. Generic ApiRequestError messages and unrelated errors
 * fall through to a single "try again" line so the form never
 * leaks server internals.
 */
function AuthGate() {
  const { login, register, sessionExpired } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>(undefined);

  // localError (from a failed submit) takes priority. The session-
  // expired message acts as a default until the user types and the
  // first submit overwrites it. Reading it from context as a derived
  // value (rather than seeding state in an effect) avoids the
  // react-hooks/set-state-in-effect rule and keeps a single source
  // of truth.
  const error: string | undefined =
    localError ??
    (sessionExpired ? "Your session expired. Please sign in again." : undefined);

  const handleSubmit = async ({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<void> => {
    setSubmitting(true);
    setLocalError(undefined);
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password });
      }
    } catch (e: unknown) {
      setLocalError(messageFor(e, mode));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchMode = (): void => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setLocalError(undefined);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <AuthForm
        mode={mode}
        onSubmit={handleSubmit}
        onSwitchMode={handleSwitchMode}
        error={error}
        submitting={submitting}
      />
    </div>
  );
}

function messageFor(e: unknown, mode: "login" | "register"): string {
  if (e instanceof ApiRequestError) {
    if (e.code === "unauthorized") {
      return "Email or password is incorrect.";
    }
    if (e.code === "already_exists") {
      return "An account with that email already exists.";
    }
    if (e.code === "validation_error") {
      return mode === "register"
        ? "Check the email format and use a password of at least 8 characters."
        : "Check the email and password format.";
    }
    if (e.code === "rate_limited") {
      return "Too many attempts. Wait a few minutes and try again.";
    }
  }
  return "Something went wrong. Check your connection and try again.";
}

export default AuthGate;
