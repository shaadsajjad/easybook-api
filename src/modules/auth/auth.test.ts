import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { createUser, resetDatabase } from "../../tests/helpers";

const validBody = { name: "Ayesha Rahman", email: "ayesha@example.com", password: "Secret123" };

function fieldsIn(body: { errors?: { field: string }[] }): string[] {
  return (body.errors ?? []).map((e) => e.field);
}

beforeEach(resetDatabase);

describe("POST /api/v1/auth/register", () => {
  it("creates an account and returns the user and a token", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: "Account created",
      data: {
        token: expect.any(String),
        user: {
          id: expect.any(String),
          name: "Ayesha Rahman",
          email: "ayesha@example.com",
          phone: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });
  });

  it("returns a token that works on protected routes", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(validBody);
    const me = await request(app).get("/api/v1/users/me").set("Authorization", `Bearer ${res.body.data.token}`);

    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("ayesha@example.com");
  });

  it("stores the email trimmed and in lowercase", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, email: "  Ayesha@Example.COM " });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe("ayesha@example.com");
  });

  it("stores a bcrypt hash, never the plain password", async () => {
    await request(app).post("/api/v1/auth/register").send(validBody);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: validBody.email } });

    expect(user.passwordHash).not.toBe(validBody.password);
    expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("never includes the password or its hash in the response", async () => {
    const res = await request(app).post("/api/v1/auth/register").send(validBody);

    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("returns 409 when the email is already registered, ignoring letter case", async () => {
    await createUser({ email: "ayesha@example.com" });
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, email: "AYESHA@example.com" });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ success: false, message: "An account with this email already exists" });
  });

  it("returns 422 with an error for each missing field", async () => {
    const res = await request(app).post("/api/v1/auth/register").send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "name", message: "Name is required" },
        { field: "email", message: "Email is required" },
        { field: "password", message: "Password is required" },
      ]),
    );
  });

  it("returns 422 when the email is invalid", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, email: "not-an-email" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "email", message: "Enter a valid email address" }]);
  });

  it("returns 422 when the password is shorter than 8 characters", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, password: "abc12" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toContainEqual({ field: "password", message: "Password must be at least 8 characters" });
  });

  it("returns 422 when the password has no number", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, password: "onlyletters" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "password", message: "Password must contain at least one number" }]);
  });

  it("returns 422 when the password has no letter", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, password: "12345678" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "password", message: "Password must contain at least one letter" }]);
  });

  it("returns 422 when the name is too short", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...validBody, name: " A " });

    expect(res.status).toBe(422);
    expect(fieldsIn(res.body)).toEqual(["name"]);
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns the user and a token for the correct email and password", async () => {
    const user = await createUser({ email: "sam@example.com", name: "Sam" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "sam@example.com", password: user.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Logged in",
      data: {
        token: expect.any(String),
        user: {
          id: user.id,
          name: "Sam",
          email: "sam@example.com",
          phone: null,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      },
    });
  });

  it("accepts the email in any letter case", async () => {
    const user = await createUser({ email: "sam@example.com" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "  SAM@Example.com", password: user.password });

    expect(res.status).toBe(200);
  });

  it("never includes the password or its hash in the response", async () => {
    const user = await createUser({ email: "sam@example.com" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "sam@example.com", password: user.password });

    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  it("returns 401 with a generic message when the password is wrong", async () => {
    await createUser({ email: "sam@example.com" });
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "sam@example.com", password: "WrongPass1" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Invalid email or password" });
  });

  it("returns the same 401 message when the email does not exist", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@example.com", password: "WhatEver1" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Invalid email or password" });
  });

  it("returns 422 with an error for each missing field", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({});

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "email", message: "Email is required" },
        { field: "password", message: "Password is required" },
      ]),
    );
  });

  it("returns 422 when the email is invalid", async () => {
    const res = await request(app).post("/api/v1/auth/login").send({ email: "nope", password: "Secret123" });

    expect(res.status).toBe(422);
    expect(fieldsIn(res.body)).toEqual(["email"]);
  });
});
