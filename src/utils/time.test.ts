import { describe, expect, it } from "vitest";
import { addDays, getZonedParts, isValidDateString, toZonedDateString, zonedTimeToUtc } from "./time";

describe("time helpers", () => {
  it("converts Dhaka business time to UTC (UTC+6, no daylight saving)", () => {
    expect(zonedTimeToUtc("2026-11-20", 9, 0, "Asia/Dhaka").toISOString()).toBe("2026-11-20T03:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-20", 17, 30, "Asia/Dhaka").toISOString()).toBe("2026-11-20T11:30:00.000Z");
  });

  it("handles a time zone with daylight saving time on both sides of the change", () => {
    // New York is UTC-4 in summer and UTC-5 in winter.
    expect(zonedTimeToUtc("2026-07-01", 9, 0, "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-01-15", 9, 0, "America/New_York").toISOString()).toBe("2026-01-15T14:00:00.000Z");
  });

  it("reads the wall-clock parts of a UTC instant in the business time zone", () => {
    expect(getZonedParts(new Date("2026-11-20T03:30:00.000Z"), "Asia/Dhaka")).toEqual({
      year: 2026,
      month: 11,
      day: 20,
      hour: 9,
      minute: 30,
      second: 0,
    });
  });

  it("gives the business calendar date, which can differ from the UTC date", () => {
    // 20:00 UTC on the 20th is already 02:00 on the 21st in Dhaka.
    expect(toZonedDateString(new Date("2026-11-20T20:00:00.000Z"), "Asia/Dhaka")).toBe("2026-11-21");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("accepts only real YYYY-MM-DD dates", () => {
    expect(isValidDateString("2026-11-20")).toBe(true);
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-11-20T00:00")).toBe(false);
    expect(isValidDateString("20-11-2026")).toBe(false);
  });
});
