import { z } from "zod";

/**
 * Register and login schemas. Both .strict() so unrecognized keys
 * reject — typical client-side typos surface as 400 instead of being
 * silently dropped.
 *
 * Password rules:
 *
 * - Min 8 chars. NIST 800-63B floor. Anything shorter is brute-forceable
 *   on a modern GPU in seconds.
 * - Max 72 chars. bcrypt silently truncates beyond 72 bytes; the schema
 *   surfaces that as a 400 instead of letting the truncation happen
 *   invisibly. Users with longer passwords learn about the limit
 *   immediately.
 * - No required-character rules (no "must contain a digit, symbol,
 *   uppercase"). NIST 800-63B explicitly recommends against these
 *   because they push users toward predictable patterns (Password1!,
 *   Welcome2024!) that don't actually add entropy.
 *
 * Email is lowercased + trimmed at validation so duplicate-detection
 * in Mongo uses the same canonical form regardless of how the user
 * typed it.
 */
const emailField = z
  .string()
  .email()
  .toLowerCase()
  .trim();

export const registerSchema = z
  .object({
    email: emailField,
    password: z.string().min(8).max(72),
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailField,
    // No length validation on login: a user whose stored password
    // doesn't meet current rules should still be able to sign in,
    // and rejecting at the schema layer would leak the rules to
    // attackers via the timing of the response.
    password: z.string(),
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
