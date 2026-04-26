import { Schema, model } from "mongoose";
import { randomUUID } from "node:crypto";

/**
 * Mongoose representation of a Debt document.
 *
 * `_id` is overridden to a string UUID instead of Mongoose's default
 * ObjectId. v5 already issued UUIDs (crypto.randomUUID) so the API
 * contract surfaces `id: string (uuid)` and downstream consumers
 * expect that shape. Switching the persistence layer to ObjectIds
 * would break the existing Zod validator (z.string().uuid()) and
 * leak Mongo-specific concerns through the API.
 *
 * versionKey is disabled because optimistic concurrency control via
 * __v isn't part of v6's scope (no concurrent edits). Removing it
 * keeps the persisted document shape minimal.
 *
 * Field-level validation is deliberately light: Zod already validated
 * the shape at the API boundary. Mongoose's required/maxlength here
 * is a defense-in-depth backstop, not the primary contract.
 */
const debtMongooseSchema = new Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    // Owning user. Indexed so the per-user list query stays fast even
    // as the collection grows. Required and never exposed via toDebt;
    // it's an internal scoping field, not part of the API contract.
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 40 },
    balance: { type: Number, required: true },
    rate: { type: Number, required: true },
    minPayment: { type: Number, required: true },
  },
  { versionKey: false },
);

export const DebtModel = model("Debt", debtMongooseSchema);

/**
 * Maps a persisted Mongoose document (with `_id`) to the API-shape
 * Debt (with `id`). Centralized here so callers never reach into
 * `_id` directly. .lean() callers can pass the result of .lean() and
 * get back a plain Debt object.
 */
export function toDebt(doc: {
  _id: string;
  name: string;
  balance: number;
  rate: number;
  minPayment: number;
}): { id: string; name: string; balance: number; rate: number; minPayment: number } {
  return {
    id: doc._id,
    name: doc.name,
    balance: doc.balance,
    rate: doc.rate,
    minPayment: doc.minPayment,
  };
}
