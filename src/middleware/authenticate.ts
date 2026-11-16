import type { Request, RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { AuthUser } from "../types/express";
import { ApiError } from "../utils/ApiError";

// Requires "Authorization: Bearer <token>". On success sets req.user = { id }.
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    next(new ApiError(401, "Authentication required. Please log in."));
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.sub !== "string") {
      throw new jwt.JsonWebTokenError("Invalid token payload");
    }
    req.user = { id: payload.sub };
    next();
  } catch (error) {
    const message =
      error instanceof jwt.TokenExpiredError
        ? "Your session has expired. Please log in again."
        : "Invalid token. Please log in again.";
    next(new ApiError(401, message));
  }
};

// For controllers behind `authenticate`: returns the logged-in user, or 401 if the route
// was mounted without the middleware by mistake. Avoids non-null assertions (req.user!).
export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw new ApiError(401, "Authentication required. Please log in.");
  }
  return req.user;
}
