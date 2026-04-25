import type { Request, RequestHandler, Response, NextFunction } from "express";
import type { ZodType } from "zod";

type Source = "body" | "params" | "query";

/**
 * Returns Express middleware that validates one part of the request
 * against a Zod schema. On success, the parsed (and possibly coerced)
 * value replaces req[source] so the downstream controller sees the
 * canonicalized shape. On failure, responds 400 with the standard
 * error envelope plus the Zod issues array, and never calls next().
 *
 * Lives in front of every controller that reads request data, so by
 * the time a controller runs, its declared body / params types are
 * a runtime guarantee, not a hopeful annotation.
 */
export function validate(source: Source, schema: ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          issues: result.error.issues,
        },
      });
      return;
    }
    // Express's typed Request slots (body, params, query) carry the
    // type asserted at the route handler. Mutating them to the parsed
    // shape is a runtime-correct upgrade that TS can't see, so the
    // assignment goes through `as` once at the boundary.
    (req as unknown as Record<Source, unknown>)[source] = result.data;
    next();
  };
}
