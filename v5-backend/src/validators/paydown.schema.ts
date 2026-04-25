import { z } from "zod";
import { debtSchema } from "./debts.schema.js";

export const strategySchema = z.enum(["avalanche", "snowball"]);

export const paydownRequestSchema = z
  .object({
    debts: z.array(debtSchema),
    budget: z.number().positive(),
    strategy: strategySchema,
  })
  .strict();

export type Strategy = z.infer<typeof strategySchema>;
