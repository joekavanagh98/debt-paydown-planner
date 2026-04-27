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
    // v8 phase 4. New users default to "user". Promotion to "staff"
    // happens manually (mongo shell or Atlas UI) — there is no
    // self-service or invite flow in v8. Documents created before
    // this field existed have no `role` key; the requireStaff
    // middleware treats undefined as non-staff, so unmigrated users
    // are correctly denied without a back-fill migration.
    role: {
      type: String,
      enum: ["user", "staff"],
      default: "user",
      required: true,
    },
  },
  {
    versionKey: false,
    timestamps: { createdAt: true, updatedAt: false },
  },
);

export const UserModel = model("User", userMongooseSchema);

export type UserRole = "user" | "staff";

/**
 * Internal shape of a User document as it sits in Mongo. Includes
 * passwordHash. Never returned from any controller. Services pass
 * this around when they need the hash (login verification).
 *
 * `role` is optional in the type because documents from before v8
 * phase 4 don't have the field at all. The schema default only
 * applies to new writes; reads of legacy docs return undefined.
 * Consumers that care (requireStaff) treat undefined as "user".
 */
export interface UserDoc {
  _id: string;
  email: string;
  passwordHash: string;
  role?: UserRole;
  createdAt: Date;
}

/**
 * The shape returned to clients. No passwordHash, no Mongo-specific
 * fields. Centralized so a controller can never accidentally leak
 * the hash by serializing a raw doc.
 *
 * Role is exposed so the frontend can show/hide staff UI without a
 * second request. Defaulted to "user" for legacy docs missing the
 * field — the public projection should always have a concrete role.
 */
export interface UserPublic {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export function toUserPublic(doc: UserDoc): UserPublic {
  return {
    id: doc._id,
    email: doc.email,
    role: doc.role ?? "user",
    createdAt: doc.createdAt,
  };
}
