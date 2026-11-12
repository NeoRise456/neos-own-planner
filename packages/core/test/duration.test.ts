import { describe, expect, it } from "vitest";
import { endTimeOf, formatDuration, minutesBetween, parseDuration, parseTimeInput } from "../src";

describe("end time ↔ duration (the task form)", () => {
  it("the end is start + length, stopping at 23:59", () => {
    expect(endTimeOf("07:00", 150)).toBe("09:30");
    expect(endTimeOf("22:30", 180)).toBe("23:59");
  });
  it("the length is end − start, only when the end is after the start", () => {
    expect(minutesBetween("07:00", "09:30")).toBe(150);
    expect(minutesBetween("09:30", "09:30")).toBeNull();
    expect(minutesBetween("10:00", "09:00")).toBeNull();
  });
});

describe("parseDuration", () => {
  it.each([
    ["20m", 20],
    ["20 min", 20],
    ["90", 90],
    ["1h", 60],
    ["1h 30m", 90],
    ["1h30", 90],
    ["1.5h", 90],
    ["1,5h", 90],
    [" 2H ", 120],
  ])("%s → %i", (text, minutes) => expect(parseDuration(text)).toBe(minutes));

  it.each(["", "  ", "0", "0m", "abc", "h", "1x", "-5"])("%j can't be read", (text) => expect(parseDuration(text)).toBeNull());
});

describe("formatDuration", () => {
  it.each([
    [20, "20m"],
    [60, "1h"],
    [90, "1h 30m"],
    [150, "2h 30m"],
  ])("%i → %s", (minutes, text) => expect(formatDuration(minutes)).toBe(text));

  it("round-trips", () => {
    for (const n of [5, 45, 60, 61, 125]) expect(parseDuration(formatDuration(n))).toBe(n);
  });
});

describe("parseTimeInput", () => {
  it.each([
    ["18:30", "18:30"],
    ["1830", "18:30"],
    ["930", "09:30"],
    ["9", "09:00"],
    ["18", "18:00"],
    ["9.15", "09:15"],
    ["6pm", "18:00"],
    ["6:30 pm", "18:30"],
    ["12am", "00:00"],
    ["12pm", "12:00"],
    ["0:05", "00:05"],
    [" 7 a ", "07:00"],
  ])("%j → %s", (text, time) => expect(parseTimeInput(text)).toBe(time));

  it.each(["", "24", "25:00", "18:60", "13pm", "0am", "abc", "1:2", "12345"])("%j can't be read", (text) =>
    expect(parseTimeInput(text)).toBeNull(),
  );
});
