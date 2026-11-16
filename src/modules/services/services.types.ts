import type { Prisma } from "@prisma/client";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// Fields returned to the app. isActive is left out: the API only ever returns active services.
export const serviceSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  durationMinutes: true,
  imageUrl: true,
  category: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ServiceSelect;

type ServiceRow = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

// Same as the row, but price is a string with exactly two decimals ("500.00").
// Prisma's Decimal would otherwise serialize as "500" and lose the trailing zeros.
export type ServiceDto = Omit<ServiceRow, "price"> & { price: string };

export function toServiceDto(service: ServiceRow): ServiceDto {
  return { ...service, price: service.price.toFixed(2) };
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface TimeSlot {
  startTime: string; // ISO 8601, UTC
  endTime: string; // ISO 8601, UTC
  available: boolean;
}

export interface Availability {
  serviceId: string;
  date: string; // YYYY-MM-DD in the business time zone
  timeZone: string;
  durationMinutes: number;
  slots: TimeSlot[];
}
