import { AppointmentStatus, type Service } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { prisma } from "../../config/prisma";
import {
  bearer,
  businessDate,
  createAppointment,
  createService,
  createUser,
  itRejectsUnauthenticatedRequests,
  nextBookableSlot,
  resetDatabase,
} from "../../tests/helpers";
import { addMinutes, zonedTimeToUtc } from "../../utils/time";

beforeEach(resetDatabase);

const UNKNOWN_ID = "a0000000-0000-4000-8000-0000000000ff";
const SLOT_TAKEN = { success: false, message: "This time slot is already booked. Please choose another time." };

const withAuth = (req: request.Test, authorization?: string): request.Test =>
  authorization ? req.set("Authorization", authorization) : req;

const book = (authorization: string | undefined, body: object): request.Test =>
  withAuth(request(app).post("/api/v1/appointments"), authorization).send(body);

/** Business-time instant on a date `daysAhead` from today, e.g. at(2, 10, 30) = 10:30 Dhaka in two days. */
const at = (daysAhead: number, hour: number, minute = 0): Date => zonedTimeToUtc(businessDate(daysAhead), hour, minute);

function expectStartTimeError(res: request.Response, message: string): void {
  expect(res.status).toBe(422);
  expect(res.body).toEqual({
    success: false,
    message: "This time cannot be booked",
    errors: [{ field: "startTime", message }],
  });
}

describe("POST /api/v1/appointments", () => {
  let service: Service;
  beforeEach(async () => {
    service = await createService({ name: "Massage", price: "3000.00", durationMinutes: 60 });
  });

  it("books a free slot and returns it as PENDING with the service summary", async () => {
    const user = await createUser();
    const start = nextBookableSlot();
    const res = await book(bearer(user.id), { serviceId: service.id, startTime: start.toISOString(), notes: "  Window seat " });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      success: true,
      message: "Appointment booked",
      data: {
        id: expect.any(String),
        serviceId: service.id,
        startTime: start.toISOString(),
        endTime: addMinutes(start, 60).toISOString(),
        status: "PENDING",
        notes: "Window seat",
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        service: {
          id: service.id,
          name: "Massage",
          price: "3000.00",
          durationMinutes: 60,
          imageUrl: service.imageUrl,
          category: service.category,
        },
      },
    });
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(stored.userId).toBe(user.id);
  });

  it("accepts a start time sent with a time-zone offset instead of Z", async () => {
    const user = await createUser();
    const res = await book(bearer(user.id), { serviceId: service.id, startTime: `${businessDate(2)}T10:00:00+06:00` });

    expect(res.status).toBe(201);
    expect(res.body.data.startTime).toBe(at(2, 10).toISOString());
  });

  it("returns 409 when the slot is already booked", async () => {
    const [first, second] = [await createUser(), await createUser()];
    const startTime = nextBookableSlot().toISOString();
    await book(bearer(first.id), { serviceId: service.id, startTime });
    const res = await book(bearer(second.id), { serviceId: service.id, startTime });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(SLOT_TAKEN);
  });

  it("returns 409 when the new booking would overlap part of an existing one", async () => {
    const user = await createUser();
    await createAppointment({ userId: user.id, service, startTime: at(2, 10) }); // 10:00-11:00
    const res = await book(bearer(user.id), { serviceId: service.id, startTime: at(2, 10, 30).toISOString() });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(SLOT_TAKEN);
  });

  it("lets exactly one of several simultaneous requests for the same slot succeed", async () => {
    const users = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));
    const startTime = nextBookableSlot().toISOString();

    const responses = await Promise.all(users.map((u) => book(bearer(u.id), { serviceId: service.id, startTime })));

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    for (const res of responses.filter((r) => r.status === 409)) expect(res.body).toEqual(SLOT_TAKEN);
    expect(await prisma.appointment.count({ where: { serviceId: service.id } })).toBe(1);
  });

  it("allows booking a slot again after its booking was cancelled", async () => {
    const [first, second] = [await createUser(), await createUser()];
    await createAppointment({ userId: first.id, service, startTime: nextBookableSlot(), status: AppointmentStatus.CANCELLED });
    const res = await book(bearer(second.id), { serviceId: service.id, startTime: nextBookableSlot().toISOString() });

    expect(res.status).toBe(201);
  });

  it("allows back-to-back bookings and the same time on a different service", async () => {
    const user = await createUser();
    const other = await createService({ name: "Facial" });
    await createAppointment({ userId: user.id, service, startTime: at(2, 10) }); // 10:00-11:00

    const next = await book(bearer(user.id), { serviceId: service.id, startTime: at(2, 11).toISOString() });
    const otherService = await book(bearer(user.id), { serviceId: other.id, startTime: at(2, 10).toISOString() });

    expect(next.status).toBe(201);
    expect(otherService.status).toBe(201);
  });

  it("returns 422 when the time is in the past", async () => {
    const user = await createUser();
    const res = await book(bearer(user.id), { serviceId: service.id, startTime: at(-1, 10).toISOString() });

    expectStartTimeError(res, "This time is in the past. Please choose a future slot.");
  });

  it("returns 422 when the time is not on the 30-minute slot grid", async () => {
    const user = await createUser();
    for (const startTime of [at(2, 10, 15), addMinutes(at(2, 10), 0.5)]) {
      const res = await book(bearer(user.id), { serviceId: service.id, startTime: startTime.toISOString() });
      expectStartTimeError(res, "Start time must be on a 30-minute slot (for example 09:00)");
    }
  });

  it("returns 422 when the time is outside business hours", async () => {
    const user = await createUser();
    for (const startTime of [at(2, 8, 30), at(2, 18), at(2, 22)]) {
      const res = await book(bearer(user.id), { serviceId: service.id, startTime: startTime.toISOString() });
      expectStartTimeError(res, "Bookings are only available between 09:00 and 18:00 (Asia/Dhaka time)");
    }
  });

  it("returns 422 when the service would end after closing time", async () => {
    const user = await createUser();
    const res = await book(bearer(user.id), { serviceId: service.id, startTime: at(2, 17, 30).toISOString() });

    expectStartTimeError(res, "This service would end after closing time (18:00). Please choose an earlier slot.");
  });

  it("returns 404 when the service does not exist or is inactive", async () => {
    const user = await createUser();
    const inactive = await createService({ isActive: false });
    for (const serviceId of [UNKNOWN_ID, inactive.id]) {
      const res = await book(bearer(user.id), { serviceId, startTime: nextBookableSlot().toISOString() });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: "Service not found" });
    }
  });

  it("returns 422 with an error for each missing field", async () => {
    const user = await createUser();
    const res = await book(bearer(user.id), {});

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "serviceId", message: "serviceId must be a valid id" },
        { field: "startTime", message: "startTime must be an ISO 8601 date-time, e.g. 2026-11-18T03:00:00.000Z" },
      ]),
    );
  });

  it("returns 422 when serviceId is not a uuid, startTime is not a date-time or notes are too long", async () => {
    const user = await createUser();
    const res = await book(bearer(user.id), { serviceId: "abc", startTime: "tomorrow at 10", notes: "x".repeat(501) });

    expect(res.status).toBe(422);
    expect(res.body.errors.map((e: { field: string }) => e.field).sort()).toEqual(["notes", "serviceId", "startTime"]);
  });

  itRejectsUnauthenticatedRequests((authorization) =>
    book(authorization, { serviceId: UNKNOWN_ID, startTime: nextBookableSlot().toISOString() }),
  );
});

describe("GET /api/v1/appointments", () => {
  const list = (authorization: string | undefined, query: Record<string, string> = {}): request.Test =>
    withAuth(request(app).get("/api/v1/appointments").query(query), authorization);

  // One of each kind, owned by `user`.
  async function createMixedAppointments(userId: string, service: Service): Promise<Record<string, string>> {
    const make = async (startTime: Date, status: AppointmentStatus): Promise<string> =>
      (await createAppointment({ userId, service, startTime, status })).id;
    return {
      laterPending: await make(at(5, 10), AppointmentStatus.PENDING),
      soonConfirmed: await make(at(2, 10), AppointmentStatus.CONFIRMED),
      futureCancelled: await make(at(3, 10), AppointmentStatus.CANCELLED),
      pastCompleted: await make(at(-5, 10), AppointmentStatus.COMPLETED),
      pastPending: await make(at(-2, 10), AppointmentStatus.PENDING),
    };
  }

  const ids = (res: request.Response): string[] => res.body.data.map((a: { id: string }) => a.id);

  it("returns only the logged-in user's appointments, most recent first, with the service summary", async () => {
    const [me, other] = [await createUser(), await createUser()];
    const service = await createService();
    const mine = await createAppointment({ userId: me.id, service, startTime: at(2, 10) });
    const older = await createAppointment({ userId: me.id, service, startTime: at(-1, 10) });
    await createAppointment({ userId: other.id, service, startTime: at(2, 11) });

    const res = await list(bearer(me.id));

    expect(res.status).toBe(200);
    expect(ids(res)).toEqual([mine.id, older.id]);
    expect(res.body.data[0]).toEqual({
      id: mine.id,
      serviceId: service.id,
      startTime: at(2, 10).toISOString(),
      endTime: addMinutes(at(2, 10), service.durationMinutes).toISOString(),
      status: "PENDING",
      notes: null,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
      service: expect.objectContaining({ id: service.id, name: service.name, price: "500.00" }),
    });
  });

  it("returns upcoming appointments (future PENDING or CONFIRMED), soonest first", async () => {
    const user = await createUser();
    const a = await createMixedAppointments(user.id, await createService());
    const res = await list(bearer(user.id), { type: "upcoming" });

    expect(ids(res)).toEqual([a.soonConfirmed, a.laterPending]);
  });

  it("returns past appointments (earlier, cancelled or completed), most recent first", async () => {
    const user = await createUser();
    const a = await createMixedAppointments(user.id, await createService());
    const res = await list(bearer(user.id), { type: "past" });

    expect(ids(res)).toEqual([a.futureCancelled, a.pastPending, a.pastCompleted]);
  });

  it("filters by status, alone or together with type", async () => {
    const user = await createUser();
    const a = await createMixedAppointments(user.id, await createService());

    const pending = await list(bearer(user.id), { status: "PENDING" });
    const upcomingPending = await list(bearer(user.id), { type: "upcoming", status: "PENDING" });

    expect(ids(pending)).toEqual([a.laterPending, a.pastPending]);
    expect(ids(upcomingPending)).toEqual([a.laterPending]);
  });

  it("returns an empty list when the user has no appointments", async () => {
    const user = await createUser();
    const res = await list(bearer(user.id));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [] });
  });

  it("returns 422 for an unknown type or status", async () => {
    const user = await createUser();
    const res = await list(bearer(user.id), { type: "soon", status: "DONE" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "type", message: 'type must be "upcoming" or "past"' },
        { field: "status", message: "status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED" },
      ]),
    );
  });

  itRejectsUnauthenticatedRequests((authorization) => list(authorization));
});

describe("GET /api/v1/appointments/:id", () => {
  const get = (authorization: string | undefined, id: string): request.Test =>
    withAuth(request(app).get(`/api/v1/appointments/${id}`), authorization);

  it("returns the appointment with its service summary", async () => {
    const user = await createUser();
    const service = await createService({ name: "Haircut" });
    const appointment = await createAppointment({ userId: user.id, service, startTime: nextBookableSlot(), notes: "Hi" });
    const res = await get(bearer(user.id), appointment.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({
        id: appointment.id,
        status: "PENDING",
        notes: "Hi",
        service: {
          id: service.id,
          name: "Haircut",
          price: "500.00",
          durationMinutes: 30,
          imageUrl: service.imageUrl,
          category: service.category,
        },
      }),
    });
    expect(res.body.data).not.toHaveProperty("userId");
  });

  it("returns 404 for another user's appointment", async () => {
    const [owner, stranger] = [await createUser(), await createUser()];
    const appointment = await createAppointment({ userId: owner.id, service: await createService(), startTime: nextBookableSlot() });
    const res = await get(bearer(stranger.id), appointment.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Appointment not found" });
  });

  it("returns 404 for an unknown id or an id that is not a valid uuid", async () => {
    const user = await createUser();
    for (const id of [UNKNOWN_ID, "not-a-uuid"]) {
      const res = await get(bearer(user.id), id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: "Appointment not found" });
    }
  });

  itRejectsUnauthenticatedRequests((authorization) => get(authorization, UNKNOWN_ID));
});

describe("PATCH /api/v1/appointments/:id/cancel", () => {
  const cancel = (authorization: string | undefined, id: string): request.Test =>
    withAuth(request(app).patch(`/api/v1/appointments/${id}/cancel`), authorization);

  it("cancels a pending appointment and returns it with status CANCELLED", async () => {
    const user = await createUser();
    const appointment = await createAppointment({ userId: user.id, service: await createService(), startTime: nextBookableSlot() });
    const res = await cancel(bearer(user.id), appointment.id);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Appointment cancelled",
      data: expect.objectContaining({ id: appointment.id, status: "CANCELLED" }),
    });
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.CANCELLED);
  });

  it("frees the slot so it can be booked again", async () => {
    const [first, second] = [await createUser(), await createUser()];
    const service = await createService();
    const startTime = nextBookableSlot().toISOString();
    const booked = await book(bearer(first.id), { serviceId: service.id, startTime });
    await cancel(bearer(first.id), booked.body.data.id);

    const res = await book(bearer(second.id), { serviceId: service.id, startTime });
    expect(res.status).toBe(201);
  });

  it("returns 409 for confirmed, completed or already cancelled appointments", async () => {
    const user = await createUser();
    const service = await createService();
    const cases = [
      { status: AppointmentStatus.CONFIRMED, word: "confirmed" },
      { status: AppointmentStatus.COMPLETED, word: "completed" },
      { status: AppointmentStatus.CANCELLED, word: "cancelled" },
    ];
    for (const [i, { status, word }] of cases.entries()) {
      const appointment = await createAppointment({ userId: user.id, service, startTime: nextBookableSlot(i), status });
      const res = await cancel(bearer(user.id), appointment.id);

      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        success: false,
        message: `Only pending appointments can be cancelled. This appointment is ${word}.`,
      });
      const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
      expect(stored.status).toBe(status);
    }
  });

  it("returns 404 for another user's appointment and leaves it unchanged", async () => {
    const [owner, stranger] = [await createUser(), await createUser()];
    const appointment = await createAppointment({ userId: owner.id, service: await createService(), startTime: nextBookableSlot() });
    const res = await cancel(bearer(stranger.id), appointment.id);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Appointment not found" });
    const stored = await prisma.appointment.findUniqueOrThrow({ where: { id: appointment.id } });
    expect(stored.status).toBe(AppointmentStatus.PENDING);
  });

  it("returns 404 for an unknown id or an id that is not a valid uuid", async () => {
    const user = await createUser();
    for (const id of [UNKNOWN_ID, "not-a-uuid"]) {
      const res = await cancel(bearer(user.id), id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: "Appointment not found" });
    }
  });

  itRejectsUnauthenticatedRequests((authorization) => cancel(authorization, UNKNOWN_ID));
});
