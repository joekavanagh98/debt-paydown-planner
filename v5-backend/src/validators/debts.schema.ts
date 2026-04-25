import { z } from "zod";

// Shared field set so debtSchema and newDebtSchema can't drift. Keeping
// these as a plain object instead of building one schema and .pick()ing
// avoids re-applying .strict() after each derivation.
const debtFields = {
  name: z.string().min(1).max(40),
  balance: z.number().positive(),
  rate: z.number().min(0),
  // 0 is allowed and means "no explicit minimum, use the calculator's
  // industry-rule fallback". Negatives are rejected.
  minPayment: z.number().min(0),
};

export const debtSchema = z
  .object({
    id: z.string().uuid(),
    ...debtFields,
  })
  .strict();

export const newDebtSchema = z.object(debtFields).strict();

export const debtIdParamSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

// Single source of truth for the Debt shape. The Zod schema describes
// the runtime contract; z.infer derives the matching TS type so the
// two cannot drift. Consumers import these from src/types/index.ts
// (which re-exports from here) so call sites don't have to know which
// file owns the canonical declaration.
export type Debt = z.infer<typeof debtSchema>;
export type NewDebt = z.infer<typeof newDebtSchema>;
