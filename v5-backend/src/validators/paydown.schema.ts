import { z } from "zod";
import { debtSchema } from "./debts.schema.js";

export const paydownRequestSchema = z
  .object({
    debts: z.array(debtSchema),
    budget: z.number().positive(),
    strategy: z.enum(["avalanche", "snowball"]),
  })
  .strict();
