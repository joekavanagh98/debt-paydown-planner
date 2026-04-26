import { Schema, model } from "mongoose";
import { randomUUID } from "node:crypto";

/**
 * Mongoose User document. Same UUID `_id` pattern as Debt so the API
 * contract surfaces `id` not `_id`. `email` is lowercased and trimmed
 * at write time and indexed unique so duplicate registration attempts
 * fail at the Mongo layer (the auth service catches the duplicate-key
 * error and reports a clean 409).
 *
 * `passwordHash` stores the bcrypt output. The plaintext password is
 * never persisted and never logged. `passwordHash` is excluded from
 * the public `toUserPublic()` projection used in API responses.
 *
 * `timestamps: { createdAt: true, updatedAt: false }` adds createdAt
 * automatically. updatedAt is off because v7 has no user-mutation
 * surface (no profile editing); turning it on now would just be noise.
 */
const userMongooseSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
  },
  {
    versionKey: false,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const UserModel = model("User", userMongooseSchema);

/**
 * Internal shape of a User document as it sits in Mongo. Includes
 * passwordHash. Never returned from any controller. Services pass
 * this around when they need the hash (login verification).
 */
export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

/**
 * The shape returned to clients. No passwordHash, no Mongo-specific
 * fields. Centralized so a controller can never accidentally leak
 * the hash by serializing a raw doc.
 */
export interface UserPublic {
  id: string;
  email: string;
  createdAt: Date;
}

export function toUserPublic(doc: UserDoc): UserPublic {
  return {
    id: doc._id,
    email: doc.email,
    createdAt: doc.createdAt,
  };
}
