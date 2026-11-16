import { AppointmentStatus } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { businessDate, createAppointment, createService, createUser, resetDatabase } from "../../tests/helpers";
import { zonedTimeToUtc } from "../../utils/time";
import { getAvailability } from "./availability.service";

beforeEach(resetDatabase);

const UNKNOWN_ID = "5e000000-0000-4000-8000-0000000000ff";

const names = (body: { data: { name: string }[] }): string[] => body.data.map((s) => s.name);

describe("GET /api/v1/services", () => {
  it("returns active services with pagination meta and price as a 2-decimal string", async () => {
    await createService({ name: "Haircut", price: "500" });
    const res = await request(app).get("/api/v1/services");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: [
        {
          id: expect.any(String),
          name: "Haircut",
          description: "A test service",
          price: "500.00",
          durationMinutes: 30,
          imageUrl: "https://example.com/image.jpg",
          category: "Hair & Beauty",
          isFeatured: false,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it("lists featured services first, then by name", async () => {
    await createService({ name: "Bravo" });
    await createService({ name: "Zulu", isFeatured: true });
    await createService({ name: "Alpha" });
    const res = await request(app).get("/api/v1/services");

    expect(names(res.body)).toEqual(["Zulu", "Alpha", "Bravo"]);
  });

  it("hides inactive services", async () => {
    await createService({ name: "Visible" });
    await createService({ name: "Hidden", isActive: false });
    const res = await request(app).get("/api/v1/services");

    expect(names(res.body)).toEqual(["Visible"]);
    expect(res.body.meta.total).toBe(1);
  });

  it("searches the name case-insensitively", async () => {
    await createService({ name: "Classic Haircut" });
    await createService({ name: "Massage" });
    const res = await request(app).get("/api/v1/services").query({ search: "HAIRcut" });

    expect(names(res.body)).toEqual(["Classic Haircut"]);
  });

  it("searches the description too", async () => {
    await createService({ name: "Spa Day", description: "Includes a hot stone massage" });
    await createService({ name: "Plumbing", description: "Fix leaks" });
    const res = await request(app).get("/api/v1/services").query({ search: "stone" });

    expect(names(res.body)).toEqual(["Spa Day"]);
  });

  it("filters by category, ignoring letter case", async () => {
    await createService({ name: "Haircut", category: "Hair & Beauty" });
    await createService({ name: "Cleaning", category: "Home Services" });
    const res = await request(app).get("/api/v1/services").query({ category: "home services" });

    expect(names(res.body)).toEqual(["Cleaning"]);
  });

  it("filters featured and non-featured services", async () => {
    await createService({ name: "Star", isFeatured: true });
    await createService({ name: "Regular" });

    const featured = await request(app).get("/api/v1/services").query({ featured: "true" });
    const notFeatured = await request(app).get("/api/v1/services").query({ featured: "false" });

    expect(names(featured.body)).toEqual(["Star"]);
    expect(names(notFeatured.body)).toEqual(["Regular"]);
  });

  it("filters by an inclusive price range", async () => {
    await createService({ name: "Cheap", price: "100.00" });
    await createService({ name: "Middle", price: "500.00" });
    await createService({ name: "Pricey", price: "900.00" });
    const res = await request(app).get("/api/v1/services").query({ minPrice: 100, maxPrice: 500 });

    expect(names(res.body)).toEqual(["Cheap", "Middle"]);
  });

  it("combines search, category and price filters", async () => {
    await createService({ name: "Haircut Deluxe", category: "Hair & Beauty", price: "900.00" });
    await createService({ name: "Haircut Basic", category: "Hair & Beauty", price: "300.00" });
    await createService({ name: "Haircut at Home", category: "Home Services", price: "300.00" });
    const res = await request(app)
      .get("/api/v1/services")
      .query({ search: "haircut", category: "Hair & Beauty", maxPrice: 500 });

    expect(names(res.body)).toEqual(["Haircut Basic"]);
  });

  it("paginates with page and limit and reports the totals in meta", async () => {
    for (const name of ["A", "B", "C", "D", "E"]) await createService({ name });
    const res = await request(app).get("/api/v1/services").query({ page: 2, limit: 2 });

    expect(names(res.body)).toEqual(["C", "D"]);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 5, totalPages: 3 });
  });

  it("returns an empty list when nothing matches", async () => {
    await createService({ name: "Haircut" });
    const res = await request(app).get("/api/v1/services").query({ search: "yoga" });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 0, totalPages: 0 });
  });

  it("returns 422 when limit is above 50 or page is below 1", async () => {
    const res = await request(app).get("/api/v1/services").query({ limit: 51, page: 0 });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { field: "limit", message: "Must be at most 50" },
        { field: "page", message: "Must be 1 or more" },
      ]),
    );
  });

  it("returns 422 when featured is not true or false", async () => {
    const res = await request(app).get("/api/v1/services").query({ featured: "yes" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "featured", message: 'Must be "true" or "false"' }]);
  });

  it("returns 422 when a price is not a number", async () => {
    const res = await request(app).get("/api/v1/services").query({ minPrice: "cheap" });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "minPrice", message: "Must be a number" }]);
  });

  it("returns 422 when maxPrice is lower than minPrice", async () => {
    const res = await request(app).get("/api/v1/services").query({ minPrice: 500, maxPrice: 100 });

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { field: "maxPrice", message: "maxPrice must be greater than or equal to minPrice" },
    ]);
  });
});

describe("GET /api/v1/services/categories", () => {
  it("returns the distinct categories of active services in alphabetical order", async () => {
    await createService({ category: "Wellness" });
    await createService({ category: "Health" });
    await createService({ category: "Wellness" });
    await createService({ category: "Hidden Category", isActive: false });
    const res = await request(app).get("/api/v1/services/categories");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: ["Health", "Wellness"] });
  });

  it("returns an empty list when there are no services", async () => {
    const res = await request(app).get("/api/v1/services/categories");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe("GET /api/v1/services/:id", () => {
  it("returns the full service details", async () => {
    const service = await createService({ name: "Massage", price: "3000.5", durationMinutes: 60 });
    const res = await request(app).get(`/api/v1/services/${service.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: expect.objectContaining({ id: service.id, name: "Massage", price: "3000.50", durationMinutes: 60 }),
    });
    expect(res.body.data).not.toHaveProperty("isActive");
  });

  it("returns 404 for an unknown id", async () => {
    const res = await request(app).get(`/api/v1/services/${UNKNOWN_ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Service not found" });
  });

  it("returns 404 for an id that is not a valid uuid", async () => {
    const res = await request(app).get("/api/v1/services/not-a-uuid");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Service not found" });
  });

  it("returns 404 for an inactive service", async () => {
    const service = await createService({ isActive: false });
    const res = await request(app).get(`/api/v1/services/${service.id}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, message: "Service not found" });
  });
});

describe("GET /api/v1/services/:id/availability", () => {
  const date = businessDate(2); // always in the future, independent of the current time
  const at = (hour: number, minute = 0): string => zonedTimeToUtc(date, hour, minute).toISOString();
  const slotAt = (body: { data: { slots: { startTime: string; available: boolean }[] } }, iso: string) =>
    body.data.slots.find((s) => s.startTime === iso);

  it("returns every 30-minute slot from 09:00 to 17:30 business time, in UTC", async () => {
    const service = await createService({ durationMinutes: 30 });
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      serviceId: service.id,
      date,
      timeZone: "Asia/Dhaka",
      durationMinutes: 30,
      slots: expect.any(Array),
    });
    const slots = res.body.data.slots;
    expect(slots).toHaveLength(18);
    expect(slots[0]).toEqual({ startTime: at(9), endTime: at(9, 30), available: true });
    expect(slots[17]).toEqual({ startTime: at(17, 30), endTime: at(18), available: true });
  });

  it("marks booked slots, and slots that would overlap a booking, as unavailable", async () => {
    const user = await createUser();
    const service = await createService({ durationMinutes: 60 });
    await createAppointment({ userId: user.id, service, startTime: new Date(at(10)) }); // 10:00-11:00
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date });

    expect(slotAt(res.body, at(9))?.available).toBe(true); // 09:00-10:00 just touches
    expect(slotAt(res.body, at(9, 30))?.available).toBe(false); // 09:30-10:30 overlaps
    expect(slotAt(res.body, at(10))?.available).toBe(false);
    expect(slotAt(res.body, at(10, 30))?.available).toBe(false);
    expect(slotAt(res.body, at(11))?.available).toBe(true); // starts as the booking ends
  });

  it("keeps slots available when the booking on them was cancelled", async () => {
    const user = await createUser();
    const service = await createService();
    await createAppointment({ userId: user.id, service, startTime: new Date(at(10)), status: AppointmentStatus.CANCELLED });
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date });

    expect(slotAt(res.body, at(10))?.available).toBe(true);
  });

  it("is not affected by bookings of other services", async () => {
    const user = await createUser();
    const service = await createService();
    const other = await createService({ name: "Other" });
    await createAppointment({ userId: user.id, service: other, startTime: new Date(at(10)) });
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date });

    expect(slotAt(res.body, at(10))?.available).toBe(true);
  });

  it("marks slots that would end after closing time as unavailable", async () => {
    const service = await createService({ durationMinutes: 120 });
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date });

    expect(slotAt(res.body, at(16))?.available).toBe(true); // 16:00-18:00 fits exactly
    expect(slotAt(res.body, at(16, 30))?.available).toBe(false);
    expect(slotAt(res.body, at(17, 30))?.available).toBe(false);
  });

  it("marks every slot of a past date as unavailable", async () => {
    const service = await createService();
    const res = await request(app)
      .get(`/api/v1/services/${service.id}/availability`)
      .query({ date: businessDate(-1) });

    expect(res.status).toBe(200);
    expect(res.body.data.slots.every((s: { available: boolean }) => !s.available)).toBe(true);
  });

  it("marks slots that have already started today as unavailable", async () => {
    const service = await createService();
    // Pretend the time is 10:15 on that day.
    const result = await getAvailability(service.id, date, zonedTimeToUtc(date, 10, 15));

    const available = result.slots.map((s) => s.available);
    expect(available.slice(0, 3)).toEqual([false, false, false]); // 09:00, 09:30, 10:00
    expect(available[3]).toBe(true); // 10:30
  });

  it("returns 422 when the date is missing", async () => {
    const service = await createService();
    const res = await request(app).get(`/api/v1/services/${service.id}/availability`);

    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([{ field: "date", message: "Date is required (YYYY-MM-DD)" }]);
  });

  it("returns 422 when the date is not a real YYYY-MM-DD date", async () => {
    const service = await createService();
    for (const bad of ["20-11-2026", "2026-02-30", "tomorrow"]) {
      const res = await request(app).get(`/api/v1/services/${service.id}/availability`).query({ date: bad });
      expect(res.status).toBe(422);
      expect(res.body.errors).toEqual([
        { field: "date", message: "Date must be a real date in the format YYYY-MM-DD" },
      ]);
    }
  });

  it("returns 404 for an unknown, malformed or inactive service", async () => {
    const inactive = await createService({ isActive: false });
    for (const id of [UNKNOWN_ID, "not-a-uuid", inactive.id]) {
      const res = await request(app).get(`/api/v1/services/${id}/availability`).query({ date });
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ success: false, message: "Service not found" });
    }
  });
});
