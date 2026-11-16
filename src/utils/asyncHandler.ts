import type { NextFunction, Request, RequestHandler, Response } from "express";

// Express 4 does not catch rejected promises. This forwards them to the error handler.
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
