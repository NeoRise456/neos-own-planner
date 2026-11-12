import { describe, expect, it } from "vitest";
import { type Task, calendarDay, calendarWeek, hourRange, layoutBlocks, slotAt } from "../src";

const TODAY = "2026-11-11"; // Wed
const t = (id: string, fields: Partial<Task> = {}): Task => ({ id, title: id, tags: [], ...fields });
const ids = (tasks: Task[]) => tasks.map((x) => x.id);

describe("what a calendar day shows", () => {
  const tasks = [
    t("anytime"),
    t("gym", { startDate: TODAY, startTime: "18:00", duration: 60 }),
    t("call", { startDate: TODAY, startTime: "09:30" }),
    t("essay", { startDate: "2026-11-09", dueDate: "2026-11-13", dueTime: "23:59" }),
    t("bill", { dueDate: TODAY, dueTime: "12:00" }),
    t("form", { dueDate: TODAY }),
    t("exam", { startDate: TODAY, startTime: "08:00", duration: 120, dueDate: TODAY, dueTime: "10:00" }),
    t("late", { startDate: TODAY, startTime: "23:30", duration: 90 }),
  ];

  it("timed tasks are blocks on their start day, in minutes from midnight", () => {
    const d = calendarDay(tasks, TODAY, TODAY);
    expect(d.blocks.map((b) => [b.task.id, b.start, b.end, b.hasDuration])).toEqual([
      ["exam", 480, 600, true],
      ["call", 570, 600, false],
      ["gym", 1080, 1140, true],
      ["late", 1410, 1440, true],
    ]);
  });

  it("deadlines are due that day (by time, no time last); a block isn't also a deadline", () => {
    expect(ids(calendarDay(tasks, TODAY, TODAY).deadlines)).toEqual(["bill", "form"]);
    expect(ids(calendarDay(tasks, "2026-11-13", TODAY).deadlines)).toEqual(["essay"]);
  });

  it("floating tasks are 'during the day' across their range, but a deadline on their due day", () => {
    expect(ids(calendarDay(tasks, "2026-11-09", TODAY).during)).toEqual(["essay"]);
    expect(ids(calendarDay(tasks, "2026-11-12", TODAY).during)).toEqual(["essay"]);
    expect(ids(calendarDay(tasks, "2026-11-13", TODAY).during)).toEqual([]);
  });

  it("anytime tasks aren't on the calendar", () => {
    const week = calendarWeek(tasks, "2026-11-09", TODAY);
    expect(week.map((d) => d.day)).toEqual(["2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12", "2026-11-13", "2026-11-14", "2026-11-15"]);
    const all = week.flatMap((d) => [...d.blocks.map((b) => b.task), ...d.deadlines, ...d.during]);
    expect(ids(all)).not.toContain("anytime");
  });
});

describe("overlapping blocks share the width", () => {
  const b = (id: string, start: number, end: number) => ({ task: t(id), start, end, hasDuration: true });
  const lanes = (bs: ReturnType<typeof b>[]) => layoutBlocks(bs).map((x) => `${x.task.id}:${x.lane}/${x.lanes}`);

  it("side by side only while they overlap", () => {
    expect(lanes([b("a", 540, 660), b("b", 600, 720), b("c", 780, 840)])).toEqual(["a:0/2", "b:1/2", "c:0/1"]);
  });

  it("a free lane is reused, and the whole group counts the lanes", () => {
    expect(lanes([b("a", 540, 720), b("b", 540, 600), b("c", 600, 660), b("d", 610, 630)])).toEqual(["a:0/3", "b:1/3", "c:1/3", "d:2/3"]);
  });

  it("touching blocks don't overlap", () => {
    expect(lanes([b("a", 540, 600), b("b", 600, 660)])).toEqual(["a:0/1", "b:0/1"]);
  });
});

it("the grid shows 07–21, stretched to fit every block", () => {
  const day = (start: number, end: number) => ({ day: TODAY, deadlines: [], during: [], blocks: [{ task: t("x"), start, end, hasDuration: true, lane: 0, lanes: 1 }] });
  expect(hourRange([])).toEqual({ from: 7, to: 21 });
  expect(hourRange([day(390, 420), day(1290, 1350)])).toEqual({ from: 6, to: 23 });
  expect(hourRange([day(600, 1440)])).toEqual({ from: 7, to: 24 });
  expect(hourRange([], 23 * 60 + 30)).toEqual({ from: 7, to: 24 });
  expect(hourRange([], 5 * 60 + 10)).toEqual({ from: 5, to: 21 });
});

it("a click lands on the half hour above it", () => {
  expect(slotAt(9 * 60 + 47)).toBe(9 * 60 + 30);
  expect(slotAt(-5)).toBe(0);
  expect(slotAt(24 * 60 + 10)).toBe(23 * 60 + 30);
});
