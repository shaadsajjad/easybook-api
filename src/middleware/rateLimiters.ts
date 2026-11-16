import type { Request, RequestHandler } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { env } from "../config/env";

interface LimiterOptions {
  windowMs: number;
  limit: number;
  message: string;
  // Tests send many requests quickly, so limiters are off in the test environment by default.
  skipInTest?: boolean;
  // Count per logged-in user instead of per IP (for routes behind `authenticate`).
  perUser?: boolean;
}

// Mobile carriers often put many phones behind one shared IP, so a per-IP limit on a
// logged-in route could block unrelated users. Falls back to the IP if there is no user.
function userOrIpKey(req: Request): string {
  return req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? "unknown");
}

export function createRateLimiter(options: LimiterOptions): RequestHandler {
  const { windowMs, limit, message, skipInTest = true, perUser = false } = options;
  return rateLimit({
    windowMs,
    limit,
    ...(perUser && { keyGenerator: userOrIpKey }),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: () => skipInTest && env.NODE_ENV === "test",
    handler: (_req, res) => {
      res.status(429).json({ success: false, message });
    },
  });
}

const MINUTE = 60 * 1000;

// Applied to every /api/v1 route.
export const generalLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: 300,
  message: "Too many requests. Please try again in a few minutes.",
});

// Strict limit on login/register to slow down password guessing.
export const authLimiter = createRateLimiter({
  windowMs: 15 * MINUTE,
  limit: 20,
  message: "Too many login attempts. Please try again in 15 minutes.",
});

// The AI endpoint costs money per call, so keep it tight.
export const aiLimiter = createRateLimiter({
  windowMs: MINUTE,
  limit: 10,
  message: "You are sending messages too quickly. Please wait a minute and try again.",
  perUser: true,
});
