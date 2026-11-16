-- Database-level double-booking protection (hand-written: Prisma cannot express exclusion constraints).
--
-- Rule: one service cannot have two non-cancelled appointments whose time ranges overlap.
-- The app checks this first inside a transaction, but two simultaneous requests could both
-- pass that check. This constraint makes Postgres reject the second insert (error 23P01),
-- which the API turns into a 409.

-- btree_gist lets a GiST index compare plain values (the uuid "serviceId") with "=".
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tstzrange(start, end, '[)') includes the start and excludes the end, so back-to-back
-- slots (10:00-10:30 and 10:30-11:00) do NOT overlap. The columns are already timestamptz,
-- so no cast is needed. Cancelled appointments are ignored, which frees their slot.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_no_overlap"
  EXCLUDE USING gist (
    "serviceId" WITH =,
    tstzrange("startTime", "endTime", '[)') WITH &&
  )
  WHERE (status <> 'CANCELLED');

-- A booking must end after it starts.
ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_end_after_start" CHECK ("endTime" > "startTime");
