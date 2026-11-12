import { describe, expect, it } from "vitest";
import { type Rule, eachDay, matchesRule, validateRule } from "../src";

/** SYSTEMS.md's example routine starts Monday 1 Sep — that's 2025. */
const START = "2025-09-01";
const matches = (rule: Rule, from: string, to: string) => eachDay(from, to).filter((d) => matchesRule(rule, d, START));

describe("matching the rule (SYSTEMS.md, question 3)", () => {
  it("daily", () => {
    expect(matches({ freq: "daily", interval: 1 }, "2025-09-01", "2025-09-03")).toEqual(["2025-09-01", "2025-09-02", "2025-09-03"]);
  });

  it("every 2 days → Sep 1, 3, 5", () => {
    expect(matches({ freq: "daily", interval: 2 }, "2025-09-01", "2025-09-06")).toEqual(["2025-09-01", "2025-09-03", "2025-09-05"]);
  });

  it("weekly Mon/Wed/Fri → Sep 1, 3, 5, 8", () => {
    expect(matches({ freq: "weekly", interval: 1, weekdays: [1, 3, 5] }, "2025-09-01", "2025-09-08")).toEqual([
      "2025-09-01",
      "2025-09-03",
      "2025-09-05",
      "2025-09-08",
    ]);
  });

  it("every 2 weeks, Mon → Sep 1, 15, 29", () => {
    expect(matches({ freq: "weekly", interval: 2, weekdays: [1] }, "2025-09-01", "2025-09-30")).toEqual(["2025-09-01", "2025-09-15", "2025-09-29"]);
  });

  it("every 2 weeks counts whole weeks from the start's week, even when it starts mid-week", () => {
    // Starts Wed 3 Sep: its week (Mon 1 Sep) is week 0 → Fri 5, Fri 19
    const rule: Rule = { freq: "weekly", interval: 2, weekdays: [5] };
    expect(eachDay("2025-09-03", "2025-09-30").filter((d) => matchesRule(rule, d, "2025-09-03"))).toEqual(["2025-09-05", "2025-09-19"]);
  });

  it("monthly, the 1st → Sep 1, Oct 1, Nov 1", () => {
    expect(matches({ freq: "monthly", interval: 1, by: "day", day: 1 }, "2025-09-01", "2025-11-30")).toEqual(["2025-09-01", "2025-10-01", "2025-11-01"]);
  });

  it("monthly, last Friday → Sep 26, Oct 31, Nov 28", () => {
    expect(matches({ freq: "monthly", interval: 1, by: "weekday", n: -1, weekday: 5 }, "2025-09-01", "2025-11-30")).toEqual([
      "2025-09-26",
      "2025-10-31",
      "2025-11-28",
    ]);
  });

  it("monthly, the 2nd Tuesday", () => {
    expect(matches({ freq: "monthly", interval: 1, by: "weekday", n: 2, weekday: 2 }, "2025-10-01", "2025-10-31")).toEqual(["2025-10-14"]);
  });

  it("every 2 months counts from the start's month", () => {
    expect(matches({ freq: "monthly", interval: 2, by: "day", day: 1 }, "2025-09-01", "2026-01-31")).toEqual(["2025-09-01", "2025-11-01", "2026-01-01"]);
  });

  it("yearly, 14 March", () => {
    expect(matches({ freq: "yearly", interval: 1, month: 3, day: 14 }, "2025-09-01", "2027-12-31")).toEqual(["2026-03-14", "2027-03-14"]);
  });

  it("never before the start", () => {
    expect(matchesRule({ freq: "daily", interval: 1 }, "2025-08-31", START)).toBe(false);
  });
});

describe("edge rules", () => {
  it('"the 31st" in a shorter month → its last day', () => {
    expect(matches({ freq: "monthly", interval: 1, by: "day", day: 31 }, "2025-09-01", "2026-02-28")).toEqual([
      "2025-09-30",
      "2025-10-31",
      "2025-11-30",
      "2025-12-31",
      "2026-01-31",
      "2026-02-28",
    ]);
  });

  it('"29 Feb" yearly in a non-leap year → 28 Feb', () => {
    expect(matches({ freq: "yearly", interval: 1, month: 2, day: 29 }, "2025-09-01", "2028-12-31")).toEqual(["2026-02-28", "2027-02-28", "2028-02-29"]);
  });
});

describe("rule validation", () => {
  const codes = (r: Rule) => validateRule(r).map((e) => e.code);

  it("interval ≥ 1", () => {
    expect(codes({ freq: "daily", interval: 0 })).toContain("interval_min");
    expect(codes({ freq: "daily", interval: 1.5 })).toContain("interval_min");
  });

  it("weekly needs at least one weekday, 1–7, no duplicates", () => {
    expect(codes({ freq: "weekly", interval: 1, weekdays: [] })).toContain("weekdays_required");
    expect(codes({ freq: "weekly", interval: 1, weekdays: [0] })).toContain("weekday_invalid");
    expect(codes({ freq: "weekly", interval: 1, weekdays: [1, 1] })).toContain("weekdays_duplicate");
    expect(codes({ freq: "weekly", interval: 1, weekdays: [1, 3, 5] })).toEqual([]);
  });

  it("monthly and yearly days must exist", () => {
    expect(codes({ freq: "monthly", interval: 1, by: "day", day: 32 })).toContain("month_day_invalid");
    expect(codes({ freq: "yearly", interval: 1, month: 2, day: 30 })).toContain("year_day_invalid");
    expect(codes({ freq: "yearly", interval: 1, month: 2, day: 29 })).toEqual([]);
    expect(codes({ freq: "yearly", interval: 1, month: 13, day: 1 })).toContain("month_invalid");
  });
});
