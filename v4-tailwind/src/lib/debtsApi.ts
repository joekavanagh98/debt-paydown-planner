import { apiRequest, apiRequestVoid } from "./api";
import type { Debt, NewDebt } from "../types";

/**
 * Typed wrappers around the v5-backend /debts surface. These exist so
 * call sites read like a domain, not like fetch-with-paths-and-methods,
 * and so the path strings live in exactly one place.
 *
 * Auth is enforced server-side; api.ts attaches the Bearer token to
 * every request automatically once setAuthToken has been called from
 * the AuthProvider.
 */

export const listDebts = (): Promise<Debt[]> => apiRequest<Debt[]>("/debts");

export const createDebt = (debt: NewDebt): Promise<Debt> =>
  apiRequest<Debt>("/debts", { method: "POST", body: debt });

export const deleteDebt = (id: string): Promise<void> =>
  apiRequestVoid(`/debts/${id}`, { method: "DELETE" });
