import { Router } from "express";
import {
  postLogin,
  postRegister,
} from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.js";
import {
  loginSchema,
  registerSchema,
} from "../validators/auth.schema.js";

export const authRouter = Router();

authRouter.post("/register", validate("body", registerSchema), postRegister);
authRouter.post("/login", validate("body", loginSchema), postLogin);
