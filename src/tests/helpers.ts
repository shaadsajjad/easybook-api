import { AppointmentStatus, type Appointment, type Service, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { addDays, addMinutes, toZonedDateString, zonedTimeToUtc } from "../utils/time";

// Shared test helpers. Every test builds the data it needs with these, from an empty database.

/** Deletes all rows (children first because of foreign keys). Call in beforeEach. */
export async function resetDatabase(): Promise<void> {
  await prisma.appointment.deleteMany();
  await prisma.service.deleteMany();
  await prisma.user.deleteMany();
}

export const DEFAULT_PASSWORD = "Password123";

let counter = 0;
const unique = (): string => `${Date.now()}-${++counter}`;

export async function createUser(
  overrides: Partial<{ name: string; email: string; password: string; phone: string | null }> = {},
): Promise<User & { password: string }> {
  const password = overrides.password ?? DEFAULT_PASSWORD;
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? "Test User",
      email: (overrides.email ?? `user-${unique()}@example.com`).toLowerCase(),
      phone: overrides.phone ?? null,
      passwordHash: await bcrypt.hash(password, env.BCRYPT_ROUNDS),
    },
  });
  return { ...user, password };
}

/** A valid JWT for the user, signed exactly like the login endpoint signs it. */
export function tokenFor(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, { subject: userId, expiresIn: "1h", algorithm: "HS256" });
}

/** An already-expired JWT for the user. */
export function expiredTokenFor(userId: string): string {
  const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
  return jwt.sign({ exp: oneMinuteAgo }, env.JWT_SECRET, { subject: userId, algorithm: "HS256" });
}

/** Authorization header value for supertest: .set("Authorization", bearer(user.id)). */
export function bearer(userId: string): string {
  return `Bearer ${tokenFor(userId)}`;
}

export async function createService(
  overrides: Partial<Omit<Service, "id" | "createdAt" | "updatedAt" | "price">> & { price?: string } = {},
): Promise<Service> {
  return prisma.service.create({
    data: {
      name: "Test Haircut",
      description: "A test service",
      price: "500.00",
      durationMinutes: 30,
      imageUrl: "https://example.com/image.jpg",
      category: "Hair & Beauty",
      ...overrides,
    },
  });
}

export async function createAppointment(options: {
  userId: string;
  service: Service;
  startTime: Date;
  status?: AppointmentStatus;
  notes?: string;
}): Promise<Appointment> {
  return prisma.appointment.create({
    data: {
      userId: options.userId,
      serviceId: options.service.id,
      startTime: options.startTime,
      endTime: addMinutes(options.startTime, options.service.durationMinutes),
      status: options.status ?? AppointmentStatus.PENDING,
      notes: options.notes,
    },
  });
}

/** A business date ("YYYY-MM-DD") `daysAhead` days from today in the business time zone. */
export function businessDate(daysAhead: number): string {
  return addDays(toZonedDateString(new Date()), daysAhead);
}

/**
 * A slot that is always bookable, whatever the current time: opening time, two days from now
 * (business time zone), plus `slotsAfterOpening` slot intervals. Never depends on the clock.
 */
export function nextBookableSlot(slotsAfterOpening: number = 0): Date {
  const opening = zonedTimeToUtc(businessDate(2), env.BUSINESS_OPEN_HOUR);
  return addMinutes(opening, slotsAfterOpening * env.SLOT_INTERVAL_MINUTES);
}
