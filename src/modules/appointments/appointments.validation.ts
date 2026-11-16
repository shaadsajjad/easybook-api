import { AppointmentStatus } from "@prisma/client";
import { z } from "zod";

export const createAppointmentSchema = z.object({
  serviceId: z.uuid({ error: "serviceId must be a valid id" }),
  // ISO 8601 with a time zone, e.g. "2026-11-18T03:00:00.000Z" (send UTC, as returned by availability).
  startTime: z
    .iso.datetime({ offset: true, error: "startTime must be an ISO 8601 date-time, e.g. 2026-11-18T03:00:00.000Z" })
    .transform((value) => new Date(value)),
  notes: z.string({ error: "Notes must be text" }).trim().max(500, "Notes must be at most 500 characters").optional(),
});

export const listAppointmentsQuerySchema = z.object({
  type: z.enum(["upcoming", "past"], { error: 'type must be "upcoming" or "past"' }).optional(),
  status: z
    .enum(AppointmentStatus, { error: "status must be one of PENDING, CONFIRMED, CANCELLED, COMPLETED" })
    .optional(),
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;
