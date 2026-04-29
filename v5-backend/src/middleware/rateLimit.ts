import rateLimit from "express-rate-limit";
import type { Request, RequestHandler } from "express";
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

/**
 * Rate limiter for the AI debt-extraction endpoint. 10 requests per
 * user per hour, keyed by userId rather than IP.
 *
 * Why userId, not IP: the endpoint is behind requireAuth, so
 * req.userId is always set by the time this runs. IP-keying would
 * let one user share quota across coworkers (false friction) and
 * let one user bypass quota by switching networks (false ceiling).
 * userId is the unit of cost, so it's the unit of quota.
 *
 * The fallback to IP only fires if the route is wired without
 * requireAuth in front — defensive, should never happen in
 * practice. Returning empty string would defeat the limiter.
 *
 * Skipped in test mode for the same reason authRateLimit is.
 */
export const extractionRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req: Request): string =>
    req.userId ?? `ip:${req.ip ?? "unknown"}`,
  message: {
    error: {
      code: "rate_limited",
      message: "Extraction limit reached. Try again in an hour.",
    },
  },
});

/**
 * Rate limiter for /paydown. 60 requests per user per minute, keyed by
 * userId with the same IP fallback as extractionRateLimit.
 *
 * Why this exists: /paydown is the most computationally expensive
 * endpoint in the app. Even with the input bounds (50 debts, 600-month
 * cap), it's a CPU-bound loop that holds the event loop while it runs.
 * 60/min is generous enough that a real user re-running "what if I add
 * $50 to my budget?" never feels it, but tight enough that an
 * automated abuser saturating the CPU has to spread the load across
 * many accounts to make any progress.
 *
 * Same userId-keying rationale as extractionRateLimit: the unit of
 * cost is the user, so the unit of quota is the user.
 */
export const paydownRateLimit: RequestHandler = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  keyGenerator: (req: Request): string =>
    req.userId ?? `ip:${req.ip ?? "unknown"}`,
  message: {
    error: {
      code: "rate_limited",
      message: "Too many paydown requests. Try again in a minute.",
    },
  },
});
