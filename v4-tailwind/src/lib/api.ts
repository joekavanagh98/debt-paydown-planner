/**
 * Low-level HTTP client for the v5-backend API.
 *
 * Token storage is intentionally module-scope and in-memory only
 * (no localStorage, no sessionStorage). XSS posture is the priority
 * for the demo: a script that gets injected into the page can't
 * read a JS-only variable across reloads or other tabs. Tradeoff is
 * that a page refresh logs the user out — see NOTES.md for the
 * deliberate-scope writeup. Refresh-token flow (v9+) is the proper
 * fix.
 *
 * The auth context owns the React-side token state and calls
 * setAuthToken(...) whenever the token changes (login, register,
 * logout). The API client never reads from React.
 */

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3001";

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/**
 * Optional 401 handler. Registered once by the AuthProvider so any
 * authed request that comes back 401 (typically because the JWT
 * expired mid-session) can be turned into a global "session ended"
 * transition: clear the token, clear user state, surface a message
 * to the login screen.
 *
 * Per-call wrapping was the alternative. The global handler keeps
 * the auth/HTTP boundary in one place and means future authed
 * endpoints get the same behavior for free instead of needing each
 * caller to remember to wrap.
 */
let onAuthError: (() => void) | null = null;

export function setOnAuthError(callback: (() => void) | null): void {
  onAuthError = callback;
}

/**
 * Shape of the standard error envelope every backend route returns
 * when something goes wrong. Mirrors v5-backend/src/errors/AppError.ts.
 */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = body.error.code;
    if (body.error.issues !== undefined) {
      this.issues = body.error.issues;
    }
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Shared transport. Every endpoint in v5-backend either returns a
 * JSON body or 204 No Content — never both, never neither. The two
 * exported wrappers below split on that contract so call-site types
 * are honest:
 *
 *   apiRequest<T>      throws if 204 (caller asked for data, none came)
 *   apiRequestVoid()   discards any body that comes back
 *
 * A one-function-with-cast pattern (return undefined as T on 204)
 * was tried first and rejected: a stray 204 would silently coerce
 * undefined into Debt[]. Splitting catches that at runtime.
 */
async function rawRequest(
  path: string,
  options: RequestOptions,
): Promise<{ status: number; body: unknown }> {
  const headers = new Headers(options.headers);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  // Build the RequestInit incrementally so the `body` key is absent
  // (rather than set to undefined) when there's no body. RequestInit's
  // `body` is `BodyInit | null` (no undefined) under
  // exactOptionalPropertyTypes.
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
  };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_URL}${path}`, init);

  if (response.status === 204) {
    return { status: 204, body: null };
  }

  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    if (response.status === 401 && onAuthError !== null) {
      onAuthError();
    }
    throw new ApiRequestError(response.status, body as ApiErrorBody);
  }

  return { status: response.status, body };
}

/**
 * For endpoints that return a JSON body on success. Throws if the
 * server returns 204 since the caller asked for typed data.
 */
export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { status, body } = await rawRequest(path, options);
  if (status === 204) {
    throw new Error(`Expected a body from ${path}, got 204`);
  }
  return body as T;
}

/**
 * For endpoints that return 204 No Content on success (DELETE).
 * Discards any body that comes back.
 */
export async function apiRequestVoid(
  path: string,
  options: RequestOptions = {},
): Promise<void> {
  await rawRequest(path, options);
}