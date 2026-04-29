/**
 * Base class for any error the API intentionally surfaces to the client.
 * The error handler middleware checks `instanceof AppError` to decide
 * whether to use the carried (statusCode, code, message) or fall back
 * to a generic 500. Anything not extending AppError is treated as
 * unexpected and the actual message is hidden from the response.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Resource not found") {
    super(404, "not_found", message);
  }
}

export class ValidationError extends AppError {
  readonly issues: unknown;

  constructor(issues: unknown, message: string = "Request validation failed") {
    super(400, "validation_error", message);
    this.issues = issues;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = "Unauthorized") {
    super(401, "unauthorized", message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = "Resource already exists") {
    super(409, "already_exists", message);
  }
}

/**
 * 403, distinct from 401. Used when the request is authenticated
 * but the authenticated principal lacks the role needed for the
 * route (v8 phase 4: requireStaff). 401 says "log in"; 403 says
 * "you can log in all you want, you still can't have this."
 */
export class ForbiddenError extends AppError {
  constructor(message: string = "Forbidden") {
    super(403, "forbidden", message);
  }
}

/**
 * 429. For cases the service layer enforces itself.
 * express-rate-limit middleware returns 429 directly and does not
 * route through this handler, so this class is only used when a
 * service throws a rate-limit decision of its own.
 */
export class RateLimitError extends AppError {
  constructor(message: string = "Too many requests") {
    super(429, "rate_limited", message);
  }
}

export class ExtractionError extends AppError {
  /**
   * Used when the upstream LLM returns something we can't parse into
   * the expected shape (no tool_use block, malformed input, Zod
   * rejects). 502 because it's an upstream-service problem from the
   * client's perspective, not their request being wrong.
   */
  constructor(
    message: string = "Could not extract debts from the provided text.",
  ) {
    super(502, "extraction_failed", message);
  }
}
