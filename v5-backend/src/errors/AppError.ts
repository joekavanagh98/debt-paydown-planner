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
 * Used when the upstream LLM returns something we can't parse into
 * the expected shape (no tool_use block, malformed input, Zod
 * rejects). 502 because it's an upstream-service problem from the
 * client's perspective, not their request being wrong.
 */
export class ExtractionError extends AppError {
  constructor(
    message: string = "Could not extract debts from the provided text.",
  ) {
    super(502, "extraction_failed", message);
  }
}
