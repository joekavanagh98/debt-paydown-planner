import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import {
  ConflictError,
  RateLimitError,
  UnauthorizedError,
} from "../errors/AppError.js";
import { RegisterAttemptModel } from "../models/registerAttempt.model.js";
import {
  UserModel,
  toUserPublic,
  type UserDoc,
  type UserPublic,
} from "../models/user.model.js";
import type { LoginInput, RegisterInput } from "../validators/auth.schema.js";

// bcrypt cost. CLAUDE.md sets a 10+ minimum; 12 is the modern default
// (~250ms per hash on a 2024 laptop). Lower is faster but weaker;
// higher slows the login path noticeably.
const BCRYPT_COST = 12;

// A real-shaped bcrypt hash that doesn't validate against any password.
// Used in loginUser when the email isn't found, so the response time
// doesn't reveal whether an email is registered (a basic enumeration
// defense). Generated once at module load via bcrypt.hash; replaced
// with a constant if module load is too slow.
const dummyHash = await bcrypt.hash(
  "this-string-never-matches-a-real-password",
  BCRYPT_COST,
);

/**
 * Sign a short-lived JWT for the given user id. `sub` is the standard
 * JWT claim for "subject of the token" (the user the token represents).
 * v7 has no refresh-token flow; when this token expires the user logs
 * in again.
 *
 * The expiresIn cast strips `undefined` from jwt.SignOptions["expiresIn"]
 * because exactOptionalPropertyTypes makes the original type include it.
 * env.JWT_EXPIRES_IN is required and validated by Zod, so it can't be
 * undefined at runtime.
 */
function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<jwt.SignOptions["expiresIn"]>,
  });
}

// Per-email register attempt cap. authRateLimit catches single-IP
// abuse; this counter catches the cross-IP enumeration case. 3 over
// 24h is tighter than any plausible legit retry pattern (a real signup
// is one schema-valid attempt).
const REGISTER_ATTEMPT_LIMIT = 3;
const REGISTER_ATTEMPT_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function registerUser(input: RegisterInput): Promise<UserPublic> {
  // Atomic increment-or-insert. See registerAttempt.model.ts for why
  // this shape (atomicity, $setOnInsert, the email-as-_id trick).
  const attempt = await RegisterAttemptModel.findOneAndUpdate(
    { _id: input.email },
    {
      $inc: { count: 1 },
      $setOnInsert: {
        expiresAt: new Date(Date.now() + REGISTER_ATTEMPT_WINDOW_MS),
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (attempt.count > REGISTER_ATTEMPT_LIMIT) {
    throw new RateLimitError(
      "Too many registration attempts for this email. Try again later.",
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  try {
    const doc = await UserModel.create({
      email: input.email,
      passwordHash,
    });
    return toUserPublic(doc.toObject() as UserDoc);
  } catch (err: unknown) {
    // Mongo duplicate-key error means the email index already had this
    // value. Map to a 409. Everything else is a real failure and should
    // bubble to the central error handler.
    if (
      err !== null &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: number }).code === 11000
    ) {
      throw new ConflictError("Email already registered");
    }
    throw err;
  }
}

export async function loginUser(
  input: LoginInput,
): Promise<{ user: UserPublic; token: string }> {
  const doc = await UserModel.findOne({ email: input.email }).lean<UserDoc>();

  // bcrypt.compare runs against the dummy hash when the user doesn't
  // exist. Same wall-clock time either way, so an attacker can't
  // distinguish "wrong password" from "no such user" by timing the
  // 401 response.
  const passwordValid = await bcrypt.compare(
    input.password,
    doc?.passwordHash ?? dummyHash,
  );

  if (!doc || !passwordValid) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const token = signToken(doc._id);
  return { user: toUserPublic(doc), token };
}
