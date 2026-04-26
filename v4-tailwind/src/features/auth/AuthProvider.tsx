import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { apiRequest, setAuthToken, setOnAuthError } from "../../lib/api";
import type { LoginResponse, User } from "../../types";
import { AuthContext, type AuthContextValue } from "./authContext";

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Owns the React-side auth state. Token storage lives in api.ts
 * (module-scope, in-memory); this provider mirrors the user object
 * for the UI and keeps api.ts in sync via setAuthToken on every
 * state transition.
 *
 * Initial state is always `user: null`. Tokens don't survive a page
 * reload by design (see api.ts and NOTES), so there's no boot-time
 * "am I signed in?" probe to do — refreshes always start signed out.
 *
 * Loading and error state are deliberately not tracked here.
 * Consumers (the AuthGate that renders AuthForm) keep their own
 * useState for "submitting" and "error" so a logout button or a
 * page reload doesn't have to share UI state with the login form.
 *
 * 401 mid-session: a single global handler is registered against
 * api.ts on mount. When any authed request comes back 401 (typically
 * an expired JWT), the handler clears the token + user and flips
 * sessionExpired to true so AuthGate can surface the "your session
 * expired" message. setSessionExpired(false) on every login /
 * register success and on manual logout resets the message before
 * it lingers into a fresh session.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  useEffect(() => {
    setOnAuthError(() => {
      setAuthToken(null);
      setUser(null);
      setSessionExpired(true);
    });
    return () => {
      setOnAuthError(null);
    };
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuthToken(result.token);
      setUser(result.user);
      setSessionExpired(false);
    },
    [],
  );

  const register = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      // /auth/register returns the new user but no token. Chaining a
      // login call gives the same { user, token } the login flow
      // produces, so the caller doesn't have to know register and
      // login take different paths internally.
      await apiRequest<User>("/auth/register", {
        method: "POST",
        body: { email, password },
      });
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: { email, password },
      });
      setAuthToken(result.token);
      setUser(result.user);
      setSessionExpired(false);
    },
    [],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    setSessionExpired(false);
  }, []);

  const value: AuthContextValue = {
    user,
    sessionExpired,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
