import { Router } from "express";
import { postPaydown } from "../controllers/paydown.controller.js";

export const paydownRouter = Router();

paydownRouter.post("/", postPaydown);
