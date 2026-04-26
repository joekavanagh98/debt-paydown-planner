import { Router } from "express";
import {
  postLogin,
  postRegister,
} from "../controllers/auth.controller.js";
import { authRateLimit } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import {
  loginSchema,
  registerSchema,
} from "../validators/auth.schema.js";

export const authRouter = Router();

// Rate limiting runs in front of validation so a flood of bad-shape
// requests still counts toward the same per-IP budget as well-formed
// ones. An attacker can't burn validation cycles for free.
authRouter.post(
  "/register",
  authRateLimit,
  validate("body", registerSchema),
  postRegister,
);
authRouter.post(
  "/login",
  authRateLimit,
  validate("body", loginSchema),
  postLogin,
);
