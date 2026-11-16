import { AppointmentStatus, type Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { isSlotOverlapError, SLOT_TAKEN_MESSAGE } from "../../utils/prismaErrors";
import { addMinutes } from "../../utils/time";
import { isUuid } from "../../utils/uuid";
import { getSlotProblem } from "../services/availability.service";
import { getActiveServiceOrThrow } from "../services/services.service";
import { ACTIVE_STATUSES, appointmentSelect, toAppointmentDto, type AppointmentDto } from "./appointments.types";
import type { CreateAppointmentInput, ListAppointmentsQuery } from "./appointments.validation";

const notFound = (): ApiError => new ApiError(404, "Appointment not found");

export async function createAppointment(userId: string, input: CreateAppointmentInput): Promise<AppointmentDto> {
  const service = await getActiveServiceOrThrow(input.serviceId);

  // Business-hour, slot-grid, closing-time and past-time rules (same rules as availability).
  const problem = getSlotProblem(input.startTime, service.durationMinutes);
  if (problem) {
    throw new ApiError(422, "This time cannot be booked", [{ field: "startTime", message: problem }]);
  }

  const startTime = input.startTime;
  const endTime = addMinutes(startTime, service.durationMinutes);

  try {
    const created = await prisma.$transaction(async (tx) => {
      // Layer 1 (application): look for any active booking of this service that overlaps.
      const clash = await tx.appointment.findFirst({
        where: {
          serviceId: service.id,
          status: { not: AppointmentStatus.CANCELLED },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
        select: { id: true },
      });
      if (clash) {
        throw new ApiError(409, SLOT_TAKEN_MESSAGE);
      }
      return tx.appointment.create({
        data: { userId, serviceId: service.id, startTime, endTime, notes: input.notes },
        select: appointmentSelect,
      });
    });
    return toAppointmentDto(created);
  } catch (error) {
    // Layer 2 (database): if two requests passed the check above at the same moment,
    // the exclusion constraint rejects the second insert. Same answer for the user.
    if (isSlotOverlapError(error)) {
      throw new ApiError(409, SLOT_TAKEN_MESSAGE);
    }
    throw error;
  }
}

export async function listAppointments(
  userId: string,
  query: ListAppointmentsQuery,
  now: Date = new Date(),
): Promise<AppointmentDto[]> {
  // upcoming = still ahead and still active. past = everything else.
  const upcoming: Prisma.AppointmentWhereInput = { startTime: { gte: now }, status: { in: ACTIVE_STATUSES } };
  const past: Prisma.AppointmentWhereInput = { NOT: upcoming };

  // AND keeps each condition separate (both upcoming and the status filter set "status").
  const conditions: Prisma.AppointmentWhereInput[] = [{ userId }];
  if (query.status) conditions.push({ status: query.status });
  if (query.type === "upcoming") conditions.push(upcoming);
  if (query.type === "past") conditions.push(past);

  const rows = await prisma.appointment.findMany({
    where: { AND: conditions },
    select: appointmentSelect,
    // Upcoming: soonest first. Past and "all": most recent first.
    orderBy: { startTime: query.type === "upcoming" ? "asc" : "desc" },
  });
  return rows.map(toAppointmentDto);
}

// Someone else's appointment returns 404 too, so ids of other users' bookings are never confirmed.
export async function getAppointment(userId: string, id: string): Promise<AppointmentDto> {
  const row = isUuid(id)
    ? await prisma.appointment.findFirst({ where: { id, userId }, select: appointmentSelect })
    : null;
  if (!row) throw notFound();
  return toAppointmentDto(row);
}

export async function cancelAppointment(userId: string, id: string): Promise<AppointmentDto> {
  const appointment = await getAppointment(userId, id);

  // The status condition is part of the update itself, so two cancels at the same moment
  // (or a status change in between) cannot both succeed.
  const { count } = await prisma.appointment.updateMany({
    where: { id: appointment.id, userId, status: AppointmentStatus.PENDING },
    data: { status: AppointmentStatus.CANCELLED },
  });
  if (count === 0) {
    const current = await getAppointment(userId, id);
    throw new ApiError(
      409,
      `Only pending appointments can be cancelled. This appointment is ${current.status.toLowerCase()}.`,
    );
  }
  return getAppointment(userId, id);
}
