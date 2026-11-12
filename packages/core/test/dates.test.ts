import { describe, expect, it } from "vitest";
import {
  addDays,
  addMinutes,
  clockAt,
  daysInMonth,
  diffDays,
  eachDay,
  isLocalDate,
  isLocalTime,
  isMoment,
  isoWeekday,
  momentDate,
  momentToEpoch,
  mondayOf,
  nowMoment,
  parseOffset,
  formatOffset,
  todayOf,
} from "../src";

describe("dates", () => {
  it("validates dates, times and moments", () => {
    expect(isLocalDate("2026-11-09")).toBe(true);
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-13-01")).toBe(false);
    expect(isLocalDate("26-11-09")).toBe(false);
    expect(isLocalTime("23:59")).toBe(true);
    expect(isLocalTime("24:00")).toBe(false);
    expect(isLocalTime("9:00")).toBe(false);
    expect(isMoment("2026-11-01T19:30+01:00")).toBe(true);
    expect(isMoment("2026-11-01T19:30")).toBe(false);
    expect(isMoment("2026-11-01T19:30+15:00")).toBe(false);
  });

  it("does day arithmetic across months, years and leap days", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-09", "2026-11-15")).toBe(6);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(eachDay("2026-11-29", "2026-12-02")).toEqual(["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-02"]);
  });

  it("numbers weekdays 1 = Mon … 7 = Sun", () => {
    expect(isoWeekday("2026-11-09")).toBe(1); // Monday
    expect(isoWeekday("2026-11-15")).toBe(7); // Sunday
    expect(mondayOf("2026-11-15")).toBe("2026-11-09");
    expect(mondayOf("2026-11-09")).toBe("2026-11-09");
  });

  it("adds minutes with day rollover", () => {
    expect(addMinutes("2026-11-09T09:00", 120)).toBe("2026-11-09T11:00");
    expect(addMinutes("2026-11-09T23:30", 60)).toBe("2026-11-10T00:30");
  });

  it("works out now from an instant and the offset setting", () => {
    const instant = Date.UTC(2026, 10, 9, 23, 30); // 2026-11-09 23:30 UTC
    expect(clockAt(instant, 0).at).toBe("2026-11-09T23:30");
    const plusOne = clockAt(instant, 60);
    expect(plusOne.at).toBe("2026-11-10T00:30");
    expect(todayOf(plusOne)).toBe("2026-11-10");
    expect(nowMoment(plusOne)).toBe("2026-11-10T00:30+01:00");
    expect(clockAt(instant, -300).at).toBe("2026-11-09T18:30");
  });

  it("formats and parses offsets", () => {
    expect(formatOffset(60)).toBe("+01:00");
    expect(formatOffset(-210)).toBe("-03:30");
    expect(formatOffset(0)).toBe("+00:00");
    expect(parseOffset("+05:45")).toBe(345);
    expect(parseOffset("-12:00")).toBe(-720);
    expect(parseOffset("+15:00")).toBeNull();
  });

  it("orders moments written with different offsets", () => {
    const a = "2026-11-10T00:30+01:00"; // 23:30 UTC on the 9th
    const b = "2026-11-09T23:45+00:00";
    expect(momentToEpoch(a)).toBeLessThan(momentToEpoch(b));
    expect(momentDate(a)).toBe("2026-11-10");
  });
});
