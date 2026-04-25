import type { ErrorRequestHandler } from "express";
import { AppError, ValidationError } from "../errors/AppError.js";
import { logger } from "../utils/logger.js";

interface ErrorBody {
  error: {
    code: string;
    message: string;
    issues?: unknown;
  };
}

/**
 * Single exit point for every error response. Middleware and
 * controllers throw (or call next with) an Error; this handler
 * decides what the client sees.
 *
 * AppError subclasses pass through their statusCode/code/message.
 * ValidationError also carries an `issues` array (zod's output) so
 * the client can show field-level feedback.
 *
 * Anything else is unexpected — log the detail server-side, return a
 * generic 500 envelope to the client. Never leak internal error
 * messages or stack traces.
 *
 * Express identifies error middleware by its 4-argument signature.
 * The unused `_req` and `_next` parameters are required for that.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ErrorBody = {
      error: { code: err.code, message: err.message },
    };
    if (err instanceof ValidationError) {
      body.error.issues = err.issues;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err }, "Unhandled error");
  res.status(500).json({
    error: { code: "internal_error", message: "Internal server error" },
  });
};
