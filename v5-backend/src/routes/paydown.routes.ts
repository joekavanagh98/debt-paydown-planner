import { Router } from "express";
import { postPaydown } from "../controllers/paydown.controller.js";
import { validate } from "../middleware/validate.js";
import { paydownRequestSchema } from "../validators/paydown.schema.js";

export const paydownRouter = Router();

paydownRouter.post("/", validate("body", paydownRequestSchema), postPaydown);
