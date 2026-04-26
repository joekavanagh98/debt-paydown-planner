import rateLimit from "express-rate-limit";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";

const isTest = env.NODE_ENV === "test";

/**
 * Rate limiter for the auth surface. /auth/login and /auth/register
 * both get 5 attempts per 15 min from the same IP.
 *
 * Why 5/15min on register too: even though registration looks like a
 * "create" operation, the auth surface as a whole is what attackers
 * abuse. Distributed credential-stuffing rotates emails through
 * register to enumerate; aggressive registration can also flood the
 * Mongo collection. Registration is asymmetric in cost (bcrypt cost
 * 12 ~ 250ms, plus a Mongo write) and shouldn't be treated as
 * cheaper than login.
 *
 * Skipped entirely in test mode so the 38-test supertest suite (which
 * registers/logs in many users back-to-back from the same loopback
 * IP) doesn't trip the limit. A future commit can add a dedicated
 * rate-limit test against a separately-configured app instance.
 *
 * Returns 429 with the standard error envelope so clients see the
 * same shape they get from every other failure.
 */
export const authRateLimit: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: {
    error: {
      code: "rate_limited",
      message: "Too many attempts. Try again in a few minutes.",
    },
  },
});
