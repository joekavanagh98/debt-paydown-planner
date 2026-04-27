import { apiRequest, apiRequestVoid } from "./api";
import type { Debt, ExtractionResult, NewDebt } from "../types";

/**
 * Typed wrappers around the v5-backend /debts surface. These exist so
 * call sites read like a domain, not like fetch-with-paths-and-methods,
 * and so the path strings live in exactly one place.
 *
 * Auth is enforced server-side; api.ts attaches the Bearer token to
 * every request automatically once setAuthToken has been called from
 * the AuthProvider.
 *
 * Errors flow through the same ApiRequestError path as every other
 * call: 401 triggers the global session-expired handler, validation
 * 400s carry Zod issues, 429 from the rate limiter and 502 from a
 * model-extraction failure both surface as ApiRequestError with the
 * matching `code` so the UI can map to a specific message.
 */

export const listDebts = (): Promise<Debt[]> => apiRequest<Debt[]>("/debts");

export const createDebt = (debt: NewDebt): Promise<Debt> =>
  apiRequest<Debt>("/debts", { method: "POST", body: debt });

export const deleteDebt = (id: string): Promise<void> =>
  apiRequestVoid(`/debts/${id}`, { method: "DELETE" });

export const extractDebts = (text: string): Promise<ExtractionResult> =>
  apiRequest<ExtractionResult>("/debts/extract", {
    method: "POST",
    body: { text },
  });
