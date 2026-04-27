import { Router } from "express";
import { getSummary } from "../controllers/staff.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireStaff } from "../middleware/requireStaff.js";

export const staffRouter = Router();

// requireAuth must run first because requireStaff reads req.userId.
// Mounting both at the router level means any future /staff/* route
// inherits the gate without remembering to wire it per route.
staffRouter.use(requireAuth, requireStaff);

staffRouter.get("/summary", getSummary);
