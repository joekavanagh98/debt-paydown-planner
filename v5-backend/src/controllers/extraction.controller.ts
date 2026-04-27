import type { Request, Response } from "express";
import { extractDebtsFromText } from "../services/extraction.service.js";

interface ExtractRequestBody {
  text: string;
}

/**
 * Thin glue: validated body in, parsed extraction result out.
 *
 * Deliberately does not write to the database. The response is for
 * the frontend to render as a review UI; the user confirms each
 * extracted debt and the frontend then calls POST /debts per debt
 * to persist. That review-before-save pattern is the third layer
 * of prompt-injection defense — even if the model is tricked into
 * fabricating debts, none of them land in storage without an
 * explicit user click.
 */
export async function postExtract(
  req: Request<Record<string, string>, unknown, ExtractRequestBody>,
  res: Response,
): Promise<void> {
  const result = await extractDebtsFromText(req.body.text);
  res.json(result);
}
