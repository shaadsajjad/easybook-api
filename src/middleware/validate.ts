import type { RequestHandler } from "express";
import { z } from "zod";

interface RequestSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

// Validates (and coerces/trims) the request parts with Zod, then replaces them with the parsed values.
// On failure it passes a ZodError to the error handler, which answers 422 with field-level errors.
export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const issues: z.core.$ZodIssue[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) req.params = result.data as typeof req.params;
      else issues.push(...result.error.issues);
    }
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) req.query = result.data as typeof req.query;
      else issues.push(...result.error.issues);
    }
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (result.success) req.body = result.data;
      else issues.push(...result.error.issues);
    }

    if (issues.length > 0) {
      next(new z.ZodError(issues));
      return;
    }
    next();
  };
}
