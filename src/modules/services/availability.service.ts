import { AppointmentStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import {
  addMinutes,
  getBusinessHours,
  getSlotStarts,
  getZonedParts,
  MINUTE_MS,
  rangesOverlap,
  toZonedDateString,
} from "../../utils/time";
import { getActiveServiceOrThrow } from "./services.service";
import type { Availability } from "./services.types";

const pad = (n: number): string => String(n).padStart(2, "0");
const OPEN_LABEL = `${pad(env.BUSINESS_OPEN_HOUR)}:00`;
const CLOSE_LABEL = `${pad(env.BUSINESS_CLOSE_HOUR)}:00`;

/**
 * The booking rules that do not need the database. Returns a user-facing reason why
 * `start` cannot be booked for a service of `durationMinutes`, or null if it is fine.
 * Used both to mark availability slots and to validate new appointments, so the two always agree.
 */
export function getSlotProblem(start: Date, durationMinutes: number, now: Date = new Date()): string | null {
  const { open, close } = getBusinessHours(toZonedDateString(start));

  if (start < open || start >= close) {
    return `Bookings are only available between ${OPEN_LABEL} and ${CLOSE_LABEL} (${env.BUSINESS_TIMEZONE} time)`;
  }
  const minutesFromOpen = (start.getTime() - open.getTime()) / MINUTE_MS;
  if (getZonedParts(start).second !== 0 || start.getMilliseconds() !== 0 || minutesFromOpen % env.SLOT_INTERVAL_MINUTES !== 0) {
    return `Start time must be on a ${env.SLOT_INTERVAL_MINUTES}-minute slot (for example ${OPEN_LABEL})`;
  }
  if (addMinutes(start, durationMinutes) > close) {
    return `This service would end after closing time (${CLOSE_LABEL}). Please choose an earlier slot.`;
  }
  if (start < now) {
    return "This time is in the past. Please choose a future slot.";
  }
  return null;
}

/**
 * All slots of one business date for one service. A slot is available when it passes
 * getSlotProblem (not started, finishes by closing) and does not overlap any
 * non-cancelled appointment of this service.
 */
export async function getAvailability(serviceId: string, date: string, now: Date = new Date()): Promise<Availability> {
  const service = await getActiveServiceOrThrow(serviceId);
  const { open, close } = getBusinessHours(date);

  // One query for the whole day: every active booking that touches business hours.
  const booked = await prisma.appointment.findMany({
    where: {
      serviceId: service.id,
      status: { not: AppointmentStatus.CANCELLED },
      startTime: { lt: close },
      endTime: { gt: open },
    },
    select: { startTime: true, endTime: true },
  });

  const slots = getSlotStarts(date).map((start) => {
    const end = addMinutes(start, service.durationMinutes);
    const available =
      getSlotProblem(start, service.durationMinutes, now) === null &&
      !booked.some((b) => rangesOverlap(start, end, b.startTime, b.endTime));
    return { startTime: start.toISOString(), endTime: end.toISOString(), available };
  });

  return {
    serviceId: service.id,
    date,
    timeZone: env.BUSINESS_TIMEZONE,
    durationMinutes: service.durationMinutes,
    slots,
  };
}
