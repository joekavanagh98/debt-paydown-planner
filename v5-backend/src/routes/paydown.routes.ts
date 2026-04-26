import { Router } from "express";
import { postPaydown } from "../controllers/paydown.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { paydownRequestSchema } from "../validators/paydown.schema.js";

export const paydownRouter = Router();

// Paydown is stateless from the database's point of view but still
// requires auth — keeps the calculator from being driven anonymously
// and makes the gate uniform across the API surface.
paydownRouter.use(requireAuth);

paydownRouter.post("/", validate("body", paydownRequestSchema), postPaydown);
