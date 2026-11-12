import { describe, expect, it } from "vitest";
import { type Clock, type Task, calendarDay, countProgress, daySummary, filterByTag, filterTodoDay, nextCopyToTick, quickAddFields, showsOn, todoForDay } from "../src";

const now: Clock = { at: "2026-11-11T10:00", offset: 60 };
const TODAY = "2026-11-11";
const t = (id: string, fields: Partial<Task> = {}): Task => ({ id, title: id, tags: [], ...fields });
const ids = (tasks: Task[]) => tasks.map((x) => x.id);

describe("which days a task shows on", () => {
  it("timed → its start date", () => {
    const dentist = t("dentist", { startDate: "2026-11-12", startTime: "15:00" });
    expect(showsOn(dentist, "2026-11-12", TODAY)).toBe(true);
    expect(showsOn(dentist, TODAY, TODAY)).toBe(false);
  });

  it("a multi-day floating task shows every day of its range until it's done", () => {
    const callMom = t("callMom", { startDate: "2026-11-09", dueDate: "2026-11-15" });
    expect(["2026-11-08", "2026-11-09", "2026-11-12", "2026-11-15", "2026-11-16"].map((d) => showsOn(callMom, d, TODAY))).toEqual([
      false,
      true,
      true,
      true,
      false,
    ]);
    const done = { ...callMom, doneAt: "2026-11-11T09:00+01:00", loggedAt: "2026-11-11T09:00+01:00" };
    expect(showsOn(done, "2026-11-11", TODAY)).toBe(true);
    expect(showsOn(done, "2026-11-12", TODAY)).toBe(false);
  });

  it("only a due date → from today until the due date", () => {
    const essay = t("essay", { dueDate: "2026-11-13" });
    expect(showsOn(essay, TODAY, TODAY)).toBe(true);
    expect(showsOn(essay, "2026-11-13", TODAY)).toBe(true);
    expect(showsOn(essay, "2026-11-10", TODAY)).toBe(false);
  });

  it("anytime → today while open, then the day it was done", () => {
    const milk = t("milk");
    expect(showsOn(milk, TODAY, TODAY)).toBe(true);
    expect(showsOn(milk, "2026-11-12", TODAY)).toBe(false);
    const done = { ...milk, doneAt: "2026-11-09T18:00+01:00", loggedAt: "2026-11-09T18:00+01:00" };
    expect(showsOn(done, "2026-11-09", TODAY)).toBe(true);
    expect(showsOn(done, TODAY, TODAY)).toBe(false);
  });
});

describe("todoForDay", () => {
  const tasks: Task[] = [
    t("milk"),
    t("lateEmail", { startDate: "2026-11-09" }), // one-off, ran out on Monday → Missed
    t("exercise", { startDate: TODAY, dueDate: TODAY, dueTime: "09:00" }), // one-off, ran out today
    t("gymMissed", { startDate: "2026-11-10", startTime: "18:00", duration: 60, routineEntryId: "gym", occurrenceDate: "2026-11-10", occurrenceSlot: 1 }),
    t("physics", { startDate: TODAY, startTime: "11:00", duration: 120 }),
    t("calculus", { startDate: TODAY, startTime: "09:30", duration: 60, doneAt: "2026-11-11T09:30+01:00", loggedAt: "2026-11-11T09:40+01:00" }),
    t("dentist", { startDate: TODAY, startTime: "15:00" }),
    t("vitamins", { startDate: TODAY, dueDate: TODAY, dueTime: "12:00" }),
    t("callMom", { startDate: "2026-11-09", dueDate: "2026-11-15" }),
    t("reply", { startDate: TODAY, duration: 5 }),
    t("party", { startDate: TODAY, startTime: "20:00", cancelledAt: "2026-11-10T12:00+01:00" }),
  ];
  const day = todoForDay(tasks, TODAY, now);

  it("Missed = one-off tasks whose time ran out (only there)", () => {
    expect(ids(day.missed)).toEqual(["lateEmail", "exercise"]);
  });

  it("a missed routine task shows only on its own day", () => {
    expect([...day.missed, ...day.scheduled, ...day.during].some((x) => x.id === "gymMissed")).toBe(false);
    expect(ids(todoForDay(tasks, "2026-11-10", now).scheduled)).toContain("gymMissed");
  });

  it("Scheduled = timed tasks by time; During the day = floating by due time", () => {
    expect(ids(day.scheduled)).toEqual(["physics", "dentist"]);
    expect(ids(day.during)).toEqual(["vitamins", "callMom", "reply"]);
  });

  it("Anytime, Done and Cancelled", () => {
    expect(ids(day.anytime)).toEqual(["milk"]);
    expect(ids(day.done)).toEqual(["calculus"]);
    expect(ids(day.cancelled)).toEqual(["party"]);
  });

  it("past days act as history: no Missed section, no anytime", () => {
    const monday = todoForDay(tasks, "2026-11-09", now);
    expect(monday.missed).toEqual([]);
    expect(monday.anytime).toEqual([]);
    expect(ids(monday.during)).toEqual(["callMom", "lateEmail"]);
  });

  it("the day total: Scheduled · Floating + untimed", () => {
    // physics 120 + calculus 60 (done counts as planned); dentist has no duration.
    // reply 5; vitamins and callMom have none.
    expect(day.summary).toEqual({ scheduledMinutes: 180, floatingMinutes: 5, untimed: 3 });
  });

  it("daySummary ignores anytime tasks", () => {
    expect(daySummary([t("milk", { duration: 10 })])).toEqual({ scheduledMinutes: 0, floatingMinutes: 0, untimed: 0 });
  });
});

describe("count copies — Water 2/4", () => {
  const water = [1, 2, 3, 4].map((slot) =>
    t(`w${slot}`, { startDate: TODAY, routineEntryId: "water", occurrenceDate: TODAY, occurrenceSlot: slot }),
  );
  const done = (x: Task): Task => ({ ...x, doneAt: "2026-11-11T09:00+01:00", loggedAt: "2026-11-11T09:00+01:00" });

  it("ticks one copy at a time", () => {
    const copies = [done(water[0]!), done(water[1]!), water[2]!, water[3]!];
    expect(countProgress(copies)).toEqual({ done: 2, total: 4 });
    expect(nextCopyToTick(copies)!.id).toBe("w3");
    expect(nextCopyToTick(copies.map(done))).toBeNull();
  });

  it("a cancelled copy doesn't count", () => {
    const copies = [done(water[0]!), { ...water[1]!, cancelledAt: "2026-11-11T08:00+01:00" }, water[2]!, water[3]!];
    expect(countProgress(copies)).toEqual({ done: 1, total: 3 });
  });
});

describe("tag filter", () => {
  const now: Clock = { at: "2026-11-11T10:00", offset: 60 };
  const t = (id: string, tags: string[], f: Partial<Task> = {}): Task => ({ id, title: id, tags, ...f });
  const tasks = [
    t("milk", ["home"]),
    t("essay", ["uni"], { startDate: "2026-11-11", duration: 60 }),
    t("gym", ["home", "health"], { startDate: "2026-11-11", startTime: "18:00", duration: 60 }),
    t("call", []),
  ];

  it("keeps only tasks with the tag; null keeps all", () => {
    expect(filterByTag(tasks, "home").map((x) => x.id)).toEqual(["milk", "gym"]);
    expect(filterByTag(tasks, null)).toBe(tasks);
  });

  it("filters every section and the day total follows", () => {
    const day = filterTodoDay(todoForDay(tasks, "2026-11-11", now), "uni");
    expect(day.during.map((x) => x.id)).toEqual(["essay"]);
    expect(day.scheduled).toEqual([]);
    expect(day.anytime).toEqual([]);
    expect(day.summary).toEqual({ scheduledMinutes: 0, floatingMinutes: 60, untimed: 0 });
  });
});

describe("quick-add on a day", () => {
  it("a later day → floating on that day; today or before → anytime", () => {
    expect(quickAddFields("Pack", "2026-11-13", "2026-11-11")).toEqual({ title: "Pack", startDate: "2026-11-13" });
    expect(quickAddFields("Pack", "2026-11-11", "2026-11-11")).toEqual({ title: "Pack" });
    expect(quickAddFields("Pack", "2026-11-09", "2026-11-11")).toEqual({ title: "Pack" });
  });

  it("with the tag filter on, it gets that tag", () => {
    expect(quickAddFields("Pack", "2026-11-11", "2026-11-11", "trip")).toEqual({ title: "Pack", tags: ["trip"] });
  });
});

describe("a timed task due on a later day", () => {
  // Starts Mon 16 Nov 08:30, deadline Fri 20 Nov (TASK.md, phase 4).
  const task = t("report", { startDate: "2026-11-16", startTime: "08:30", duration: 60, dueDate: "2026-11-20" });
  const mon: Clock = { at: "2026-11-16T10:00", offset: 60 };
  const wed: Clock = { at: "2026-11-18T10:00", offset: 60 };

  it("is its block on its start day, then 'during the day' until the deadline", () => {
    expect(ids(todoForDay([task], "2026-11-16", mon).scheduled)).toEqual(["report"]);
    expect(ids(todoForDay([task], "2026-11-18", wed).during)).toEqual(["report"]);
    expect(ids(todoForDay([task], "2026-11-20", wed).during)).toEqual(["report"]);
    expect(showsOn(task, "2026-11-21", "2026-11-18")).toBe(false);
  });

  it("isn't missed before its deadline, and its block only counts on its own day", () => {
    expect(todoForDay([task], "2026-11-18", wed).missed).toEqual([]);
    expect(todoForDay([task], "2026-11-16", mon).summary.scheduledMinutes).toBe(60);
    expect(todoForDay([task], "2026-11-18", wed).summary).toEqual({ scheduledMinutes: 0, floatingMinutes: 0, untimed: 0 });
  });

  it("done on Wed shows on Wed only", () => {
    const done = { ...task, doneAt: "2026-11-18T09:00+01:00", loggedAt: "2026-11-18T09:00+01:00" };
    expect(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19"].map((d) => showsOn(done, d, "2026-11-18"))).toEqual([false, false, true, false]);
  });

  it("on the calendar: block Mon, during Tue–Thu, deadline Fri", () => {
    const at = (d: string) => {
      const c = calendarDay([task], d, "2026-11-16");
      return [c.blocks.length, c.during.length, c.deadlines.length];
    };
    expect(["2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20"].map(at)).toEqual([
      [1, 0, 0],
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 1],
    ]);
  });
});
