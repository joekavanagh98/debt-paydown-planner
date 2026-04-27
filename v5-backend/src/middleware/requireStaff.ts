import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ForbiddenError, UnauthorizedError } from "../errors/AppError.js";
import { UserModel, type UserDoc } from "../models/user.model.js";

/**
 * Mount AFTER requireAuth. Reads req.userId, fetches the user from
 * Mongo, and either calls next() if role is "staff" or throws
 * ForbiddenError otherwise.
 *
 * Why a fresh DB read every request: the alternative is encoding
 * role in the JWT payload at login time, which is faster (no
 * round-trip per staff request) but means a role change doesn't
 * take effect until the user logs in again. A demoted staff user
 * could keep using staff endpoints for up to JWT_EXPIRES_IN. For a
 * v8 with one staff user (the developer) the responsiveness wins;
 * if staff scales up, embed role in the JWT and accept the
 * staleness window. Documented in NOTES.
 *
 * If req.userId is unset (the route was wired without requireAuth
 * in front, which would be a wiring bug) the middleware throws
 * UnauthorizedError rather than ForbiddenError. The caller hasn't
 * been authenticated, so 401 is the honest signal. Defensive: this
 * branch should never fire if the routes are wired correctly.
 *
 * If the user record was deleted between the JWT issuance and now,
 * same UnauthorizedError. The token is technically valid but
 * points at a non-existent user — treating that as a session
 * problem is right.
 */
export const requireStaff: RequestHandler = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
  if (typeof req.userId !== "string") {
    throw new UnauthorizedError("Authentication required");
  }

  const user = await UserModel.findById(req.userId).lean<UserDoc>();
  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  // Legacy docs from before v8 phase 4 lack the role field; treat
  // missing role as "user". Equivalent to the default Mongoose now
  // applies on writes, just handled at read time for back-compat.
  if ((user.role ?? "user") !== "staff") {
    throw new ForbiddenError("Staff access required");
  }

  next();
};
