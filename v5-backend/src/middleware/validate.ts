import type { Request, RequestHandler, Response, NextFunction } from "express";
import type { ZodType } from "zod";
import { ValidationError } from "../errors/AppError.js";

type Source = "body" | "params" | "query";

/**
 * Returns Express middleware that validates one part of the request
 * against a Zod schema. On success, the parsed (and possibly coerced)
 * value replaces req[source] so the downstream controller sees the
 * canonicalized shape. On failure, throws a ValidationError so the
 * central error handler renders the response.
 *
 * Lives in front of every controller that reads request data, so by
 * the time a controller runs, its declared body / params types are
 * a runtime guarantee, not a hopeful annotation.
 */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      throw new ValidationError(result.error.issues);
    }
    // Express's typed Request slots (body, params, query) carry the
    // type asserted at the route handler. Mutating them to the parsed
    // shape is a runtime-correct upgrade that TS can't see, so the
    // assignment goes through `as` once at the boundary.
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
