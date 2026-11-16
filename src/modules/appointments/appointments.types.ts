import { AppointmentStatus, type Prisma } from "@prisma/client";

// Statuses that still hold a future slot ("upcoming" when in the future).
export const ACTIVE_STATUSES: AppointmentStatus[] = [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED];

// userId is left out: the API only ever returns the caller's own appointments.
export const appointmentSelect = {
  id: true,
  serviceId: true,
  startTime: true,
  endTime: true,
  status: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  service: {
    select: { id: true, name: true, price: true, durationMinutes: true, imageUrl: true, category: true },
  },
} satisfies Prisma.AppointmentSelect;

type AppointmentRow = Prisma.AppointmentGetPayload<{ select: typeof appointmentSelect }>;

export type AppointmentDto = Omit<AppointmentRow, "service"> & {
  service: Omit<AppointmentRow["service"], "price"> & { price: string };
};

export function toAppointmentDto(row: AppointmentRow): AppointmentDto {
  return { ...row, service: { ...row.service, price: row.service.price.toFixed(2) } };
}
