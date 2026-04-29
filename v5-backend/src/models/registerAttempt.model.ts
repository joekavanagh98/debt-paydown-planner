import { Schema, model } from "mongoose";

/**
 * Per-email register attempt counter. Caps how many times the same
 * email can be submitted to /auth/register in a 24-hour window,
 * regardless of source IP. authRateLimit covers single-source
 * attempts; this counter covers the case where an enumerator spreads
 * attempts across IPs.
 *
 * The lowercased email is the document _id, so the document IS the
 * per-email counter. Lookups are by-id and uniqueness is enforced by
 * the _id collision rather than a separate unique index.
 *
 * The TTL index on expiresAt (Mongoose's `expires: 0` means "delete
 * when the date is in the past") auto-resets the counter 24h after
 * first creation. $setOnInsert anchors expiresAt to the first
 * attempt only, so later $inc updates don't slide the window
 * forward.
 *
 * The `_id: false` schema option disables Mongoose's default
 * ObjectId auto-generation. The field-level `_id: String` declared
 * above is the actual key.
 */
const schema = new Schema(
  {
    _id: { type: String, required: true },
    count: { type: Number, default: 0, required: true },
    expiresAt: { type: Date, required: true, expires: 0 },
  },
  { versionKey: false, _id: false },
);

export const RegisterAttemptModel = model("RegisterAttempt", schema);
