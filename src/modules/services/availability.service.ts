import { AppointmentStatus } from "@prisma/client";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { addMinutes, getBusinessHours, getSlotStarts, rangesOverlap } from "../../utils/time";
import { getActiveServiceOrThrow } from "./services.service";
import type { Availability } from "./services.types";

/**
 * All slots of one business date for one service. A slot is available when:
 *  - it has not started yet,
 *  - the service (startTime + duration) finishes by closing time,
 *  - it does not overlap any non-cancelled appointment of this service.
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
      start >= now &&
      end <= close &&
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
