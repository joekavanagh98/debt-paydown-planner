import { createContext, useContext } from "react";
import type { User } from "../../types";

interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthContextValue {
  // null when no one is signed in. The app gates the main view on
  // `user !== null` rather than tracking a separate isAuthenticated
  // boolean — one source of truth.
  user: User | null;
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (credentials: AuthCredentials) => Promise<void>;
  logout: () => void;
}

// Component-free file by design. Vite's react-refresh ESLint rule
// requires a file to export only components OR only non-components,
// not both. Keeping the Context and the hook here lets the
// AuthProvider component live in its own .tsx with components-only
// exports, so HMR stays clean.
export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
