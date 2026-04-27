import type { Request, Response } from "express";
import { getStaffSummary } from "../services/aggregate.service.js";

export async function getSummary(
  _req: Request,
  res: Response,
): Promise<void> {
  const summary = await getStaffSummary();
  res.json(summary);
}
