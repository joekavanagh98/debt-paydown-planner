import { apiRequest } from "./api";
import type { StaffSummary } from "../types";

/**
 * Typed wrapper for the v5-backend /staff surface. Mirrors the
 * pattern used by debtsApi.ts. Auth (Bearer token) is attached
 * automatically by api.ts; the backend's requireAuth + requireStaff
 * gate the endpoint, so a non-staff caller gets a 403 ApiRequestError
 * with code "forbidden".
 */
export const getStaffSummary = (): Promise<StaffSummary> =>
  apiRequest<StaffSummary>("/staff/summary");
