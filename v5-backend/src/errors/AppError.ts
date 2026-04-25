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
