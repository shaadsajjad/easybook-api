import { AppointmentStatus } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../config/prisma";
import { addMinutes } from "../utils/time";
import { createAppointment, createService, createUser, nextBookableSlot, resetDatabase } from "./helpers";

// Proves the migrations (including the hand-written exclusion constraint) are applied
// to the test database. These go straight to Prisma, bypassing the API's own checks.

describe("Database: appointment_no_overlap constraint", () => {
  beforeEach(resetDatabase);

  it("rejects a second active appointment that overlaps on the same service", async () => {
    const user = await createUser();
    const service = await createService({ durationMinutes: 60 });
    const start = nextBookableSlot();
    await createAppointment({ userId: user.id, service, startTime: start });

    await expect(
      createAppointment({ userId: user.id, service, startTime: addMinutes(start, 30) }),
    ).rejects.toThrow(/appointment_no_overlap|23P01/);
  });

  it("allows back-to-back appointments that touch but do not overlap", async () => {
    const user = await createUser();
    const service = await createService({ durationMinutes: 30 });
    const start = nextBookableSlot();
    await createAppointment({ userId: user.id, service, startTime: start });

    await expect(
      createAppointment({ userId: user.id, service, startTime: addMinutes(start, 30) }),
    ).resolves.toBeDefined();
  });

  it("ignores cancelled appointments, so a cancelled slot can be booked again", async () => {
    const user = await createUser();
    const service = await createService();
    const start = nextBookableSlot();
    await createAppointment({ userId: user.id, service, startTime: start, status: AppointmentStatus.CANCELLED });

    await expect(createAppointment({ userId: user.id, service, startTime: start })).resolves.toBeDefined();
  });

  it("allows the same time on two different services", async () => {
    const user = await createUser();
    const first = await createService();
    const second = await createService({ name: "Other service" });
    const start = nextBookableSlot();
    await createAppointment({ userId: user.id, service: first, startTime: start });

    await expect(createAppointment({ userId: user.id, service: second, startTime: start })).resolves.toBeDefined();
  });

  it("rejects an appointment that ends before it starts", async () => {
    const user = await createUser();
    const service = await createService();
    const start = nextBookableSlot();

    await expect(
      prisma.appointment.create({
        data: { userId: user.id, serviceId: service.id, startTime: start, endTime: addMinutes(start, -30) },
      }),
    ).rejects.toThrow(/appointment_end_after_start/);
  });
});
