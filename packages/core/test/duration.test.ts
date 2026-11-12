import { describe, expect, it } from "vitest";
import { formatDuration, parseDuration, parseTimeInput } from "../src";

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
