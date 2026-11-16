import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../app";

describe("GET /api/v1/health", () => {
  it("returns 200 with status ok and the uptime in seconds", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { status: "ok", uptime: expect.any(Number) },
    });
  });

  it("sets security headers from helmet and hides x-powered-by", async () => {
    const res = await request(app).get("/api/v1/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("Unknown routes", () => {
  it("returns 404 in the standard error shape", async () => {
    const res = await request(app).get("/api/v1/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Route not found: GET /api/v1/does-not-exist",
    });
  });
});

describe("Request body errors", () => {
  it("returns 400 in the standard error shape when the JSON is malformed", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .set("Content-Type", "application/json")
      .send('{"broken": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, message: "Malformed JSON in request body" });
  });

  it("returns 413 in the standard error shape when the body is larger than 10kb", async () => {
    const res = await request(app)
      .post("/api/v1/health")
      .send({ text: "x".repeat(11 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, message: "Request body is too large" });
  });
});
