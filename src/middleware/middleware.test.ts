import express, { type Express } from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { env } from "../config/env";
import { authenticate } from "./authenticate";
import { errorHandler } from "./errorHandler";
import { createRateLimiter } from "./rateLimiters";
import { validate } from "./validate";

// Small throwaway apps that exercise one shared middleware at a time,
// always ending with the real error handler so the error shape is the real one.
function buildApp(setup: (app: Express) => void): Express {
  const app = express();
  app.use(express.json());
  setup(app);
  app.use(errorHandler);
  return app;
}

describe("validate middleware", () => {
  const app = buildApp((a) => {
    a.post(
      "/items",
      validate({ body: z.object({ name: z.string().trim().min(2), qty: z.number().int().positive() }) }),
      (req, res) => {
        res.json({ success: true, data: req.body });
      },
    );
  });

  it("passes the parsed (trimmed) body to the route when it is valid", async () => {
    const res = await request(app).post("/items").send({ name: "  Haircut ", qty: 2 });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: "Haircut", qty: 2 });
  });

  it("returns 422 with a field-level errors array when fields are missing or invalid", async () => {
    const res = await request(app).post("/items").send({ qty: -1 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    const fields = res.body.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "qty"]));
    for (const error of res.body.errors) {
      expect(error).toEqual({ field: expect.any(String), message: expect.any(String) });
    }
  });
});

describe("authenticate middleware", () => {
  const app = buildApp((a) => {
    a.get("/private", authenticate, (req, res) => {
      res.json({ success: true, data: req.user });
    });
  });

  it("attaches the user id from a valid token", async () => {
    const token = jwt.sign({}, env.JWT_SECRET, { subject: "user-123", expiresIn: "1h" });
    const res = await request(app).get("/private").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ id: "user-123" });
  });

  it("returns 401 when no token is sent", async () => {
    const res = await request(app).get("/private");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Authentication required. Please log in." });
  });

  it("returns 401 when the token is malformed", async () => {
    const res = await request(app).get("/private").set("Authorization", "Bearer not-a-jwt");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Invalid token. Please log in again." });
  });

  it("returns 401 when the token is signed with a different secret", async () => {
    const token = jwt.sign({}, "some-other-secret-that-is-32-characters!!", { subject: "user-123" });
    const res = await request(app).get("/private").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Invalid token. Please log in again.");
  });

  it("returns 401 with a session expired message when the token is expired", async () => {
    const token = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 60 }, env.JWT_SECRET, {
      subject: "user-123",
    });
    const res = await request(app).get("/private").set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      success: false,
      message: "Your session has expired. Please log in again.",
    });
  });
});

describe("rate limiter", () => {
  it("returns 429 in the standard error shape once the limit is reached", async () => {
    const app = buildApp((a) => {
      a.use(createRateLimiter({ windowMs: 60_000, limit: 2, message: "Slow down", skipInTest: false }));
      a.get("/ping", (_req, res) => {
        res.json({ success: true });
      });
    });

    expect((await request(app).get("/ping")).status).toBe(200);
    expect((await request(app).get("/ping")).status).toBe(200);
    const res = await request(app).get("/ping");

    expect(res.status).toBe(429);
    expect(res.body).toEqual({ success: false, message: "Slow down" });
  });
});
