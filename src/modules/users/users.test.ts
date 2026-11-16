import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import { bearer, createUser, itRejectsUnauthenticatedRequests, resetDatabase } from "../../tests/helpers";

beforeEach(resetDatabase);

const publicUserShape = {
  id: expect.any(String),
  name: expect.any(String),
  email: expect.any(String),
  phone: null,
  createdAt: expect.any(String),
  updatedAt: expect.any(String),
};

// Users-specific extra 401 case: a valid token whose account was deleted.
function itRejectsDeletedAccounts(send: (authorization?: string) => request.Test): void {
  it("returns 401 when the account behind a valid token no longer exists", async () => {
    const user = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    const res = await send(bearer(user.id));
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ success: false, message: "Account not found. Please log in again." });
  });
}

describe("GET /api/v1/users/me", () => {
  it("returns the logged-in user's profile", async () => {
    const user = await createUser({ name: "Sam", email: "sam@example.com" });
    const res = await request(app).get("/api/v1/users/me").set("Authorization", bearer(user.id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { ...publicUserShape, id: user.id, name: "Sam", email: "sam@example.com" },
    });
  });

  it("never includes the password hash", async () => {
    const user = await createUser();
    const res = await request(app).get("/api/v1/users/me").set("Authorization", bearer(user.id));

    expect(JSON.stringify(res.body)).not.toMatch(/password/i);
  });

  const getMe = (authorization?: string): request.Test => {
    const req = request(app).get("/api/v1/users/me");
    return authorization ? req.set("Authorization", authorization) : req;
  };
  itRejectsUnauthenticatedRequests(getMe);
  itRejectsDeletedAccounts(getMe);
});

describe("PATCH /api/v1/users/me", () => {
  const patch = (authorization: string | undefined, body: object): request.Test => {
    const req = request(app).patch("/api/v1/users/me");
    return (authorization ? req.set("Authorization", authorization) : req).send(body);
  };

  it("updates the name and phone and returns the updated profile", async () => {
    const user = await createUser({ name: "Old Name" });
    const res = await patch(bearer(user.id), { name: "  New Name ", phone: "+8801712345678" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Profile updated",
      data: { ...publicUserShape, id: user.id, name: "New Name", phone: "+8801712345678" },
    });
  });

  it("updates only the fields that are sent", async () => {
    const user = await createUser({ name: "Keep Me", phone: "+8801700000000" });
    const res = await patch(bearer(user.id), { phone: "01811111111" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Keep Me");
    expect(res.body.data.phone).toBe("01811111111");
  });

  it("clears the phone number when phone is null", async () => {
    const user = await createUser({ phone: "+8801700000000" });
    const res = await patch(bearer(user.id), { phone: null });

    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBeNull();
  });

  it("returns 422 and keeps the email unchanged when trying to change the email", async () => {
    const user = await createUser({ email: "sam@example.com" });
    const res = await patch(bearer(user.id), { name: "Sam", email: "new@example.com" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "email", message: "Email cannot be changed" }]);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.email).toBe("sam@example.com");
    expect(stored.name).not.toBe("Sam");
  });

  it("returns 422 for fields that are not allowed, such as passwordHash", async () => {
    const user = await createUser();
    const res = await patch(bearer(user.id), { name: "Sam", passwordHash: "hacked" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "passwordHash", message: "This field is not allowed" }]);
  });

  it("returns 422 when the body is empty", async () => {
    const user = await createUser();
    const res = await patch(bearer(user.id), {});

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "body", message: "Send at least one of: name, phone" }]);
  });

  it("returns 422 when the name is too short", async () => {
    const user = await createUser();
    const res = await patch(bearer(user.id), { name: "A" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "name", message: "Name must be at least 2 characters" }]);
  });

  it("returns 422 when the phone number is invalid", async () => {
    const user = await createUser();
    const res = await patch(bearer(user.id), { phone: "call me" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { field: "phone", message: "Enter a valid phone number, e.g. +8801712345678" },
    ]);
  });

  itRejectsUnauthenticatedRequests((authorization) => patch(authorization, { name: "Sam" }));
  itRejectsDeletedAccounts((authorization) => patch(authorization, { name: "Sam" }));
});

describe("PATCH /api/v1/users/me/password", () => {
  const changePassword = (authorization: string | undefined, body: object): request.Test => {
    const req = request(app).patch("/api/v1/users/me/password");
    return (authorization ? req.set("Authorization", authorization) : req).send(body);
  };
  const login = (email: string, password: string): request.Test =>
    request(app).post("/api/v1/auth/login").send({ email, password });

  it("changes the password so only the new one works for login", async () => {
    const user = await createUser({ email: "sam@example.com", password: "OldPass123" });
    const res = await changePassword(bearer(user.id), { currentPassword: "OldPass123", newPassword: "NewPass456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null, message: "Password changed" });
    expect((await login("sam@example.com", "NewPass456")).status).toBe(200);
    expect((await login("sam@example.com", "OldPass123")).status).toBe(401);
  });

  it("stores the new password as a bcrypt hash", async () => {
    const user = await createUser({ password: "OldPass123" });
    await changePassword(bearer(user.id), { currentPassword: "OldPass123", newPassword: "NewPass456" });
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    expect(stored.passwordHash).not.toBe(user.passwordHash);
    expect(stored.passwordHash).not.toContain("NewPass456");
    expect(stored.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it("returns 422 and keeps the old password when the current password is wrong", async () => {
    const user = await createUser({ email: "sam@example.com", password: "OldPass123" });
    const res = await changePassword(bearer(user.id), { currentPassword: "Wrong1234", newPassword: "NewPass456" });

    expect(res.status).toBe(422);
    expect(res.body).toEqual({
      success: false,
      message: "Current password is incorrect",
      errors: [{ field: "currentPassword", message: "Current password is incorrect" }],
    });
    expect((await login("sam@example.com", "OldPass123")).status).toBe(200);
  });

  it("returns 422 when the new password breaks the password rules", async () => {
    const user = await createUser({ password: "OldPass123" });
    const res = await changePassword(bearer(user.id), { currentPassword: "OldPass123", newPassword: "short" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { field: "newPassword", message: "Password must be at least 8 characters" },
      { field: "newPassword", message: "Password must contain at least one number" },
    ]);
  });

  it("returns 422 when the new password is the same as the current one", async () => {
    const user = await createUser({ password: "OldPass123" });
    const res = await changePassword(bearer(user.id), { currentPassword: "OldPass123", newPassword: "OldPass123" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { field: "newPassword", message: "New password must be different from the current password" },
    ]);
  });

  it("returns 422 with an error for each missing field", async () => {
    const user = await createUser();
    const res = await changePassword(bearer(user.id), {});

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "currentPassword", message: "Current password is required" },
        { field: "newPassword", message: "Password is required" },
      ]),
    );
  });

  it("returns 422 for fields that are not allowed", async () => {
    const user = await createUser({ password: "OldPass123" });
    const res = await changePassword(bearer(user.id), {
      currentPassword: "OldPass123",
      newPassword: "NewPass456",
      email: "x@example.com",
    });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "email", message: "This field is not allowed" }]);
  });

  it("never includes a password or hash in the response", async () => {
    const user = await createUser({ password: "OldPass123" });
    const res = await changePassword(bearer(user.id), { currentPassword: "OldPass123", newPassword: "NewPass456" });

    expect(JSON.stringify(res.body)).not.toMatch(/OldPass123|NewPass456|\$2[aby]\$/);
  });

  itRejectsUnauthenticatedRequests((authorization) =>
    changePassword(authorization, { currentPassword: "OldPass123", newPassword: "NewPass456" }),
  );
  itRejectsDeletedAccounts((authorization) =>
    changePassword(authorization, { currentPassword: "OldPass123", newPassword: "NewPass456" }),
  );
});
