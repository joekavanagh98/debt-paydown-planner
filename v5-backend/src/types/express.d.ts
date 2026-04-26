// Module augmentation for Express's Request type. requireAuth
// middleware attaches the authenticated user id here so downstream
// controllers can read it without parsing the JWT themselves. Optional
// because routes that don't run requireAuth (e.g. /health, /auth/*)
// won't have it set.

import type {} from "express";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
