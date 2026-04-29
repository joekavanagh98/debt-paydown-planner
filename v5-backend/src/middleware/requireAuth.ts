import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors/AppError.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verify the Bearer token from the Authorization header and attach
 * the user id to req. Mounted in front of every route that needs an
 * authenticated user.
 *
 * Throws UnauthorizedError on every failure shape (missing header,
 * wrong scheme, expired token, signature mismatch, malformed payload)
 * so the client always sees the same 401 envelope. The central error
 * handler renders the response.
 *
 * The single-message-for-everything choice is deliberate. Different
 * messages for "expired" vs "invalid signature" would let an attacker
 * distinguish "your token format is right but old" from "your token
 * was never valid," which leaks signal during enumeration.
 */
export const requireAuth: RequestHandler = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("Missing or malformed Authorization header");
  }

  let decoded: jwt.JwtPayload | string;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET);
  } catch {
    throw new UnauthorizedError("Invalid or expired token");
  }

  if (typeof decoded === "string" || typeof decoded.sub !== "string") {
    throw new UnauthorizedError("Invalid or expired token");
  }

  // sub gets used downstream as a Mongo _id (UUID). The issuance side
  // signs UUIDs today, but a future change there shouldn't silently
  // produce tokens that pass this middleware and fail (or worse,
  // succeed unexpectedly) at the database layer.
  if (!UUID_REGEX.test(decoded.sub)) {
    throw new UnauthorizedError("Invalid or expired token");
  }

  req.userId = decoded.sub;
  next();
};

/**
 * Narrow req.userId to the non-undefined string. Used at the top of
 * every controller behind requireAuth so the rest of the function can
 * use a string-typed userId without a non-null assertion.
 *
 * If requireAuth ran, userId is set; the throw is structurally
 * unreachable. It's still here as a defense in depth in case a route
 * is wired without requireAuth by accident.
 */
export function getUserId(req: Request): string {
  const id = req.userId;
  if (typeof id !== "string") {
    throw new UnauthorizedError("Authentication required");
  }
  return id;
}
