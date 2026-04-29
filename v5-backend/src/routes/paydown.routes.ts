import { Router } from "express";
import { postPaydown } from "../controllers/paydown.controller.js";
import { paydownRateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { paydownRequestSchema } from "../validators/paydown.schema.js";

export const paydownRouter = Router();

// Paydown is stateless from the database's point of view but still
// requires auth — keeps the calculator from being driven anonymously
// and makes the gate uniform across the API surface.
paydownRouter.use(requireAuth);

// Mount order is requireAuth, rate limit, validate, controller. The
// limiter has to come after requireAuth so it can key on req.userId,
// and before validate so a flood of malformed bodies still counts
// against the quota.
paydownRouter.post(
  "/",
  paydownRateLimit,
  validate("body", paydownRequestSchema),
  postPaydown,
);
