import { useState } from "react";
import type { FormEvent } from "react";

interface AuthFormProps {
  mode: "login" | "register";
  onSubmit: (input: { email: string; password: string }) => Promise<void>;
  onSwitchMode: () => void;
  // Surface API errors (wrong credentials, duplicate email) above the
  // submit button. Optional because the parent owns the error state.
  error?: string | undefined;
  submitting?: boolean | undefined;
}

/**
 * One component for both login and register because the wire shape is
 * identical (email + password). Mode controls labels, button text,
 * autoComplete hints, and the minLength constraint on password (only
 * applied at register; login accepts whatever the server stored).
 *
 * State is fully owned here — email and password are local. The parent
 * gets a clean { email, password } via onSubmit and decides what to do
 * with it (call /auth/login, /auth/register, or anything else).
 */
function AuthForm({
  mode,
  onSubmit,
  onSwitchMode,
  error,
  submitting = false,
}: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const isLogin = mode === "login";
  const title = isLogin ? "Sign in" : "Create your account";
  const submitLabel = isLogin ? "Sign in" : "Create account";
  const switchPrompt = isLogin
    ? "Don't have an account?"
    : "Already have an account?";
  const switchLabel = isLogin ? "Register" : "Sign in";
  const passwordAutoComplete = isLogin ? "current-password" : "new-password";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await onSubmit({ email: email.trim(), password });
  };

  return (
    <div className="mx-auto w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold tracking-tight text-slate-900">
        {title}
      </h1>
      <form
        onSubmit={handleSubmit}
        autoComplete="on"
        noValidate
        className="mt-5 space-y-4"
      >
        <div>
          <label
            htmlFor="auth-email"
            className="block text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="auth-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>
        <div>
          <label
            htmlFor="auth-password"
            className="block text-sm font-medium text-slate-700"
          >
            Password
          </label>
          <input
            id="auth-password"
            name="password"
            type="password"
            autoComplete={passwordAutoComplete}
            required
            minLength={isLogin ? undefined : 8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
          />
          {!isLogin && (
            <p className="mt-1 text-xs text-slate-500">
              Minimum 8 characters.
            </p>
          )}
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
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:bg-slate-400 disabled:hover:bg-slate-400"
        >
          {submitting ? "..." : submitLabel}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-600">
        {switchPrompt}{" "}
        <button
          type="button"
          onClick={onSwitchMode}
          disabled={submitting}
          className="font-semibold text-blue-700 hover:text-blue-800 focus:outline-none focus:underline disabled:text-slate-400"
        >
          {switchLabel}
        </button>
      </p>
    </div>
  );
}

export default AuthForm;
