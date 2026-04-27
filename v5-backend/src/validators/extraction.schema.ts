import { z } from "zod";

/**
 * Shape of a single debt as Claude returns it. Almost identical to
 * NewDebt (no id, no userId, plus minPayment is optional because
 * not every statement explicitly states it). Validated at runtime
 * after the model responds, even though the tool-use schema in the
 * Anthropic call already constrains the model — defense in depth
 * against a model hallucination that the SDK happens not to catch.
 *
 * Type comes from z.infer so the extraction service and the
 * frontend's review UI share the same shape derivation pattern as
 * the rest of the project.
 */
export const extractedDebtSchema = z
  .object({
    name: z.string().min(1).max(40),
    balance: z.number().positive(),
    rate: z.number().min(0),
    minPayment: z.number().min(0).optional(),
  })
  .strict();

export const extractionResultSchema = z
  .object({
    debts: z.array(extractedDebtSchema),
  })
  .strict();

export type ExtractedDebt = z.infer<typeof extractedDebtSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;

/**
 * Schema for the POST /debts/extract request body. Lives here too
 * since it's part of the same feature surface; the route mounts it
 * via the validate() middleware.
 *
 * Length cap is generous (5000 chars covers a multi-page statement
 * pasted as text) but bounded so the model isn't asked to chew
 * through arbitrary input. The Anthropic API itself has a much
 * higher token limit; this cap is a frontline rejection of obviously
 * abusive input.
 */
export const extractRequestSchema = z
  .object({
    text: z.string().min(1).max(5000),
  })
  .strict();
