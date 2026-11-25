import { describe, expect, it } from "vitest";
import { type Task, calendarDay, calendarWeek, dayWidth, layoutBlocks, nestBlocks, slotAt } from "../src";

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

  it("due the same day it starts → during the day, not a deadline", () => {
    const vitamins = t("vitamins", { startDate: TODAY, dueDate: TODAY, dueTime: "12:00" });
    const d = calendarDay([vitamins], TODAY, TODAY);
    expect([ids(d.deadlines), ids(d.during)]).toEqual([[], ["vitamins"]]);
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

describe("overlapping blocks: lanes (stacked in the calendar)", () => {
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

  it("same start and length: a cancelled block goes under the live one (lane 0)", () => {
    const cancelled = { ...b("x", 540, 720), task: t("x", { cancelledAt: "2026-11-10T08:00-05:00" }) };
    expect(lanes([b("live", 540, 720), cancelled])).toEqual(["x:0/2", "live:1/2"]);
  });
});

describe("overlapping blocks nest (like Google Calendar)", () => {
  const b = (id: string, start: number, end: number) => ({ task: t(id), start, end, hasDuration: true, lane: 0, lanes: 1 });
  const nest = (bs: ReturnType<typeof b>[]) => nestBlocks(bs).map((x) => `${x.task.id}:d${x.depth} ${x.col}/${x.cols}`);

  it("a task that starts inside a longer one sits on it, one level in; the long one stays full width", () => {
    // Recuperación 12:00–14:00 with check food 12:30 and eat 13:00 inside it
    expect(nest([b("recup", 720, 840), b("food", 750, 765), b("eat", 780, 810)])).toEqual(["recup:d0 0/1", "food:d1 0/1", "eat:d1 0/1"]);
  });

  it("tasks that start (almost) together and are about as long go side by side", () => {
    expect(nest([b("calc", 540, 720), b("phys", 540, 660)])).toEqual(["calc:d0 0/2", "phys:d0 1/2"]);
    expect(nest([b("a", 540, 720), b("b", 555, 700)])).toEqual(["a:d0 0/2", "b:d0 1/2"]); // 15 min later: still together
  });

  it("a short task starting with a long one nests on it, so the long one keeps the column", () => {
    expect(nest([b("recup", 720, 840), b("food", 720, 735), b("eat", 780, 810)])).toEqual(["recup:d0 0/1", "food:d1 0/1", "eat:d1 0/1"]);
  });

  it("nesting goes deeper only while the outer ones still run; apart again after", () => {
    expect(nest([b("day", 540, 900), b("meet", 600, 720), b("call", 660, 690), b("lunch", 780, 840), b("free", 960, 990)])).toEqual([
      "day:d0 0/1",
      "meet:d1 0/1",
      "call:d2 0/1",
      "lunch:d1 0/1",
      "free:d0 0/1",
    ]);
  });
});

describe("a crowded day gets wider", () => {
  const b = (id: string, start: number, end: number) => ({ task: t(id), start, end, hasDuration: true, lane: 0, lanes: 1 });

  it("a normal day, or one with a task nested one level in, keeps the normal width", () => {
    expect(dayWidth(nestBlocks([b("a", 540, 600), b("b", 660, 720)]))).toBe(1);
    expect(dayWidth(nestBlocks([b("recup", 720, 840), b("eat", 780, 810)]))).toBe(1);
    expect(dayWidth(nestBlocks([b("calc", 540, 720), b("phys", 540, 660)]))).toBe(1); // two side by side: half each
    expect(dayWidth([])).toBe(1);
  });

  it("grows until its narrowest block is readable", () => {
    // Wed 18: Recuperación 12:00–14:00, check food and food 2 both at 12:00, side by side on it
    expect(dayWidth(nestBlocks([b("recup", 720, 840), b("check", 720, 740), b("food2", 720, 735)]))).toBe(1.67);
  });

  it("but never past two normal days", () => {
    const deep = nestBlocks([b("a", 540, 900), b("b", 600, 840), b("c", 660, 780), b("d", 700, 760), b("e", 700, 750), b("f", 700, 745)]);
    expect(dayWidth(deep)).toBe(2);
  });
});

it("a click lands on the half hour above it", () => {
  expect(slotAt(9 * 60 + 47)).toBe(9 * 60 + 30);
  expect(slotAt(-5)).toBe(0);
  expect(slotAt(24 * 60 + 10)).toBe(23 * 60 + 30);
});
