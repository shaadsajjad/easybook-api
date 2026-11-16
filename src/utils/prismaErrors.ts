import { Prisma } from "@prisma/client";

// Name of the hand-written exclusion constraint (prisma/migrations/*_appointment_no_overlap).
export const OVERLAP_CONSTRAINT = "appointment_no_overlap";

export const SLOT_TAKEN_MESSAGE = "This time slot is already booked. Please choose another time.";

/**
 * True when Postgres rejected an insert because it overlaps another booking (error 23P01).
 * Prisma has no error code for exclusion constraints, so it arrives as an "unknown" request
 * error whose message contains the constraint name.
 */
export function isSlotOverlapError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientUnknownRequestError && error.message.includes(OVERLAP_CONSTRAINT);
}
