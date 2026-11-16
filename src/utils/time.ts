import { env } from "../config/env";

// Time-zone helpers built only on the built-in Intl API (no date library).
// Rule of thumb: the database and the API always use UTC. Business hours (e.g. 09:00-18:00)
// are wall-clock times in BUSINESS_TIMEZONE, so we convert between the two here.

export const MINUTE_MS = 60 * 1000;

/** A calendar date as "YYYY-MM-DD". */
export type DateString = string;

export interface ZonedParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number; // 0-23
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** What a wall clock in `timeZone` shows at the given instant. */
export function getZonedParts(date: Date, timeZone: string = env.BUSINESS_TIMEZONE): ZonedParts {
  const parts = getFormatter(timeZone).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** How far `timeZone` is ahead of UTC at the given instant, in ms (Dhaka: +6h). */
function getOffsetMs(date: Date, timeZone: string): number {
  const p = getZonedParts(date, timeZone);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000;
  return wallClockAsUtc - wholeSeconds;
}

/** Splits "YYYY-MM-DD" into numbers. */
function parseDateString(date: DateString): { year: number; month: number; day: number } {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

/**
 * The UTC instant when the wall clock in `timeZone` shows `date` at `hour:minute`.
 * Example: zonedTimeToUtc("2026-11-20", 9, 0) with Asia/Dhaka -> 2026-11-20T03:00:00.000Z
 */
export function zonedTimeToUtc(
  date: DateString,
  hour: number,
  minute: number = 0,
  timeZone: string = env.BUSINESS_TIMEZONE,
): Date {
  const { year, month, day } = parseDateString(date);
  // Treat the wall-clock time as if it were UTC, then subtract the zone's offset.
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute);
  let result = new Date(asIfUtc - getOffsetMs(new Date(asIfUtc), timeZone));
  // If the offset is different at the result (daylight-saving change), correct once.
  const offsetAtResult = getOffsetMs(result, timeZone);
  result = new Date(asIfUtc - offsetAtResult);
  return result;
}

/** The calendar date ("YYYY-MM-DD") in `timeZone` at the given instant. */
export function toZonedDateString(date: Date, timeZone: string = env.BUSINESS_TIMEZONE): DateString {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Adds whole days to a "YYYY-MM-DD" date (calendar maths, no time zone involved). */
export function addDays(date: DateString, days: number): DateString {
  const { year, month, day } = parseDateString(date);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** True if the string is a real calendar date in "YYYY-MM-DD" form (rejects 2026-02-30). */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const { year, month, day } = parseDateString(value);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MINUTE_MS);
}
