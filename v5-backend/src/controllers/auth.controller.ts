import type { Request, Response } from "express";
import type {
  LoginInput,
  RegisterInput,
} from "../validators/auth.schema.js";
import { loginUser, registerUser } from "../services/auth.service.js";

export async function postRegister(
  req: Request<unknown, unknown, RegisterInput>,
  res: Response,
): Promise<void> {
  const user = await registerUser(req.body);
  res.status(201).json(user);
}

export async function postLogin(
  req: Request<unknown, unknown, LoginInput>,
  res: Response,
): Promise<void> {
  const result = await loginUser(req.body);
  res.json(result);
}
