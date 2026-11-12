import { describe, expect, it } from "vitest";
import {
  type Clock,
  type EntryBlueprint,
  type SlotTime,
  type Routine,
  type RoutineEntry,
  type Task,
  FLOATING_ONCE,
  changeEndDate,
  changeEntry,
  copyId,
  createEntry,
  createRoutine,
  detachClones,
  duplicateRoutine,
  editTask,
  expandRoutineTasks,
  freshCopies,
  moveTask,
  removeEntry,
  canDeleteRoutine,
  editRoutine,
  endRoutine,
  isDraft,
  publishRoutine,
  unpublishRoutine,
  routineConsistency,
  routineStatus,
  taskKind,
  tickTask,
  cancelTask,
  validateBlueprint,
  validateRoutine,
} from "../src";

// SYSTEMS.md: "Exercise plan", Sep 1 → Nov 30 (2025: Sep 1 is a Monday).
const exercise: Routine = {
  id: "exercise",
  title: "Exercise plan",
  purpose: "Get stronger and have more energy",
  startDate: "2025-09-01",
  endDate: "2025-11-30",
  lineage: "exercise",
  publishedAt: "2025-08-31T20:00+01:00",
};

/** Removing an entry from a published routine → the updated entry. */
const removedFrom = (e: RoutineEntry, day: string): RoutineEntry => {
  const r = removeEntry(e, exercise, day);
  if (r.action !== "update") throw new Error();
  return r.entry;
};

const gymBlueprint: EntryBlueprint = {
  title: "Gym",
  notes: "Leg day on Fri",
  tags: ["health"],
  duration: 60,
  protocolId: "gym-warmup",
  rule: { freq: "weekly", interval: 1, weekdays: [1, 3, 5] },
  perDay: { kind: "times", times: [{ startTime: "18:00" }] },
};

const entry = (id: string, blueprint: EntryBlueprint, from = exercise.startDate, routineId = exercise.id): RoutineEntry => ({
  id,
  routineId,
  versions: [{ ...blueprint, from }],
});

const gym = entry("gym", gymBlueprint);
const water = entry("water", { title: "Water", tags: [], rule: { freq: "daily", interval: 1 }, perDay: { kind: "count", count: 4 } });
const clock = (at: string): Clock => ({ at, offset: 60 });
const m = (local: string) => `${local}+01:00`;

describe("routine status", () => {
  it("draft until published", () => {
    const { publishedAt: _p, ...draft } = exercise;
    expect(routineStatus(draft, "2025-10-01")).toBe("draft");
  });

  it("upcoming / active / ended, from the dates", () => {
    expect(routineStatus(exercise, "2025-08-31")).toBe("upcoming");
    expect(routineStatus(exercise, "2025-09-01")).toBe("active");
    expect(routineStatus(exercise, "2025-11-30")).toBe("active");
    expect(routineStatus(exercise, "2025-12-01")).toBe("ended");
  });
});

describe("routine validation", () => {
  it("needs a title, a start and an end; the end not before the start", () => {
    const codes = (r: Partial<Routine>) => validateRoutine({ ...exercise, ...r }).errors.map((e) => e.code);
    expect(codes({})).toEqual([]);
    expect(codes({ title: " " })).toContain("title_required");
    expect(codes({ endDate: "" })).toContain("end_required");
    expect(codes({ endDate: "2025-08-01" })).toContain("end_before_start");
  });

  it("a new routine is an empty draft; its lineage is itself", () => {
    const r = createRoutine("r1", { title: "Morning routine", startDate: "2025-11-01", endDate: "2026-01-31" });
    expect(r.ok && r.value.lineage).toBe("r1");
    expect(r.ok && isDraft(r.value)).toBe(true);
  });
});

describe("draft → publish", () => {
  const { publishedAt: _p, ...draft } = exercise;
  const today = "2025-11-11";
  const now = clock(`${today}T10:00`);

  it("a draft produces no tasks", () => {
    expect(freshCopies(draft, gym, "2025-11-12")).toEqual([]);
    expect(expandRoutineTasks({ routines: [draft], entries: [gym], saved: [], from: "2025-11-10", to: "2025-11-16" })).toEqual([]);
  });

  it("in a draft, changing an entry just overwrites it, and removing it deletes it", () => {
    const changed = changeEntry(gym, draft, { ...gymBlueprint, duration: 90 }, today);
    expect(changed.ok && changed.value.versions).toEqual([{ ...gymBlueprint, duration: 90, from: draft.startDate }]);
    expect(removeEntry(gym, draft, today)).toEqual({ action: "delete" });
  });

  it("in a draft, the start and end dates are free; once published, the start is locked", () => {
    const moved = editRoutine(draft, { startDate: "2025-11-17", endDate: "2026-02-28" });
    expect(moved.ok && [moved.value.startDate, moved.value.endDate]).toEqual(["2025-11-17", "2026-02-28"]);
    const locked = editRoutine(exercise, { startDate: "2025-09-08" });
    expect(!locked.ok && locked.errors[0]!.code).toBe("start_locked");
    const renamed = editRoutine(exercise, { title: "Exercise — autumn", purpose: "" });
    expect(renamed.ok && renamed.value).toMatchObject({ title: "Exercise — autumn", startDate: exercise.startDate });
    expect(renamed.ok && renamed.value.purpose).toBeUndefined();
  });

  it("publishing starts its tasks from the publish day — no missed tasks before", () => {
    const r = publishRoutine(draft, [gym, water], now);
    if (!r.ok) throw new Error(JSON.stringify(r.errors));
    expect(r.value.routine.publishedAt).toBe(m(`${today}T10:00`));
    expect(r.value.entries.every((e) => e.versions.length === 1 && e.versions[0]!.from === today)).toBe(true);
    const [published, entries] = [r.value.routine, r.value.entries];
    const tasks = expandRoutineTasks({ routines: [published], entries, saved: [], from: "2025-11-01", to: "2025-11-14" });
    expect(tasks.every((t) => t.startDate! >= today)).toBe(true);
    expect(tasks.filter((t) => t.routineEntryId === "gym").map((t) => t.startDate)).toEqual(["2025-11-12", "2025-11-14"]);
    // Water ×4 from Nov 11: the 11th, 12th and 13th are missed by the 14th — nothing before.
    expect(routineConsistency({ routine: published, entries, saved: [], now: clock("2025-11-14T10:00") }).byEntry.get("water")!.missed).toBe(12);
  });

  it("published before its start → tasks from the start date", () => {
    const later: Routine = { ...draft, startDate: "2025-12-01", endDate: "2026-02-28" };
    const r = publishRoutine(later, [{ ...gym, versions: [{ ...gymBlueprint, from: later.startDate }] }], now);
    expect(r.ok && r.value.entries[0]!.versions[0]!.from).toBe("2025-12-01");
    expect(r.ok && routineStatus(r.value.routine, today)).toBe("upcoming");
  });

  it("publishing needs at least one complete entry and an end date not yet past", () => {
    const codes = (r: ReturnType<typeof publishRoutine>) => (r.ok ? [] : r.errors.map((e) => e.code));
    expect(codes(publishRoutine(draft, [], now))).toContain("entries_required");
    expect(codes(publishRoutine(draft, [gym], clock("2025-12-05T10:00")))).toContain("end_in_past");
    const broken = { ...gym, versions: [{ ...gymBlueprint, title: "", from: draft.startDate }] };
    expect(codes(publishRoutine(draft, [broken], now))).toContain("entry_invalid");
    expect(codes(publishRoutine(exercise, [gym], now))).toContain("already_published");
  });

  it("published by mistake → back to draft, only while nothing is done", () => {
    const back = unpublishRoutine(exercise, [gym], []);
    expect(back.ok && isDraft(back.value.routine)).toBe(true);
    const done = tickTask(freshCopies(exercise, gym, "2025-11-10")[0]!, now);
    if (!done.ok) throw new Error();
    const refused = unpublishRoutine(exercise, [gym], [done.value]);
    expect(!refused.ok && refused.errors[0]!.code).toBe("has_done_tasks");
  });

  it("deleting: a draft freely; published only while nothing is done (with a warning)", () => {
    expect(canDeleteRoutine(draft, [])).toEqual({ ok: true, value: { warn: false }, warnings: [] });
    expect(canDeleteRoutine(exercise, [])).toEqual({ ok: true, value: { warn: true }, warnings: [] });
    const done = tickTask(freshCopies(exercise, gym, "2025-11-10")[0]!, now);
    if (!done.ok) throw new Error();
    const refused = canDeleteRoutine(exercise, [done.value]);
    expect(!refused.ok && refused.errors[0]!.code).toBe("has_done_tasks");
  });

  it("End = it ends today; history stays", () => {
    const r = endRoutine(exercise, [], now);
    expect(r.ok && r.value.endDate).toBe(today);
    expect(r.ok && freshCopies(r.value, gym, "2025-11-12")).toEqual([]);
    expect(r.ok && freshCopies(r.value, gym, "2025-11-10")).toHaveLength(1);
  });

  it("End refuses a draft, and a routine that hasn't started", () => {
    expect(endRoutine(draft, [], now).ok).toBe(false);
    const upcoming: Routine = { ...exercise, startDate: "2025-12-01", endDate: "2026-02-28" };
    const r = endRoutine(upcoming, [], now);
    expect(!r.ok && r.errors[0]!.code).toBe("not_started");
  });

  it("End can't cut off a task ticked early, after today", () => {
    const early = tickTask(freshCopies(exercise, gym, "2025-11-14")[0]!, now);
    if (!early.ok) throw new Error();
    const r = endRoutine(exercise, [early.value], now);
    expect(!r.ok && r.errors[0]!.code).toBe("end_before_last_done");
  });
});

describe("the 4 questions (SYSTEMS.md)", () => {
  it('"Gym" on Wed 5 Nov → one task with everything copied from the blueprint', () => {
    expect(freshCopies(exercise, gym, "2025-11-05")).toEqual([
      {
        id: copyId("gym", "2025-11-05", 1),
        title: "Gym",
        notes: "Leg day on Fri",
        tags: ["health"],
        duration: 60,
        protocolId: "gym-warmup",
        startDate: "2025-11-05",
        startTime: "18:00",
        routineEntryId: "gym",
        occurrenceDate: "2025-11-05",
        occurrenceSlot: 1,
      },
    ]);
  });

  it("Tue 4 Nov fails question 3; Mon 1 Dec fails question 1", () => {
    expect(freshCopies(exercise, gym, "2025-11-04")).toEqual([]);
    expect(freshCopies(exercise, gym, "2025-12-01")).toEqual([]);
  });

  it("question 4 — several times → one task per time", () => {
    const pills = entry("pills", {
      title: "Pills",
      tags: [],
      rule: { freq: "daily", interval: 1 },
      perDay: { kind: "times", times: [{ startTime: "08:00" }, { startTime: "14:00" }, { startTime: "20:00" }] },
    });
    const day = freshCopies(exercise, pills, "2025-11-05");
    expect(day.map((t) => [t.startTime, t.occurrenceSlot])).toEqual([["08:00", 1], ["14:00", 2], ["20:00", 3]]);
  });

  it("question 4 — a count → N floating tasks", () => {
    const day = freshCopies(exercise, water, "2025-11-05");
    expect(day).toHaveLength(4);
    expect(day.every((t) => taskKind(t) === "floating")).toBe(true);
    expect(day.map((t) => t.occurrenceSlot)).toEqual([1, 2, 3, 4]);
  });

  it("question 4 — a count with a due time; no times → one floating task", () => {
    const vitamins = entry("vitamins", { title: "Vitamins", tags: [], rule: { freq: "daily", interval: 1 }, perDay: { kind: "count", count: 1, dueTime: "12:00" } });
    expect(freshCopies(exercise, vitamins, "2025-11-05")[0]).toMatchObject({ dueDate: "2025-11-05", dueTime: "12:00" });
    const shower = entry("shower", { title: "Shower", tags: [], rule: { freq: "daily", interval: 1 }, perDay: FLOATING_ONCE });
    const t = freshCopies(exercise, shower, "2025-11-05");
    expect(t).toHaveLength(1);
    expect(taskKind(t[0]!)).toBe("floating");
  });

  it("entry + occurrence date + slot = the task's identity", () => {
    expect(freshCopies(exercise, gym, "2025-11-05")[0]!.id).toBe(freshCopies(exercise, gym, "2025-11-05")[0]!.id);
  });
});

describe("saved or not", () => {
  const week = { from: "2025-11-03", to: "2025-11-09" };

  it("looking at days produces their tasks fresh", () => {
    const tasks = expandRoutineTasks({ routines: [exercise], entries: [gym], saved: [], ...week });
    expect(tasks.map((t) => t.startDate)).toEqual(["2025-11-03", "2025-11-05", "2025-11-07"]);
  });

  it("a touched task replaces its fresh version", () => {
    const fresh = freshCopies(exercise, gym, "2025-11-05")[0]!;
    const ticked = tickTask(fresh, clock("2025-11-05T19:05"));
    if (!ticked.ok) throw new Error();
    const tasks = expandRoutineTasks({ routines: [exercise], entries: [gym], saved: [ticked.value], ...week });
    expect(tasks).toHaveLength(3);
    expect(tasks.find((t) => t.startDate === "2025-11-05")!.doneAt).toBe(m("2025-11-05T19:05"));
  });

  it("a moved task shows on its new day only", () => {
    const fresh = freshCopies(exercise, gym, "2025-11-07")[0]!;
    const moved = moveTask(fresh, { startDate: "2025-11-11", startTime: "18:00" });
    if (!moved.ok) throw new Error();
    const thisWeek = expandRoutineTasks({ routines: [exercise], entries: [gym], saved: [moved.value], ...week });
    expect(thisWeek.map((t) => t.startDate)).toEqual(["2025-11-03", "2025-11-05"]);
    const tuesday = expandRoutineTasks({ routines: [exercise], entries: [gym], saved: [moved.value], from: "2025-11-11", to: "2025-11-11" });
    expect(tuesday.map((t) => t.occurrenceDate)).toEqual(["2025-11-07"]);
  });
});

describe("changing an entry mid-routine", () => {
  const changed = changeEntry(gym, exercise, { ...gymBlueprint, perDay: { kind: "times", times: [{ startTime: "19:00" }] } }, "2025-11-10");
  if (!changed.ok) throw new Error();

  it("applies from today on; earlier tasks keep what they were", () => {
    expect(freshCopies(exercise, changed.value, "2025-11-07")[0]!.startTime).toBe("18:00");
    expect(freshCopies(exercise, changed.value, "2025-11-10")[0]!.startTime).toBe("19:00");
  });

  it("tasks after today you already touched keep your changes", () => {
    const noted = editTask(freshCopies(exercise, gym, "2025-11-12")[0]!, { notes: "With Sam" });
    if (!noted.ok) throw new Error();
    const [wed] = expandRoutineTasks({ routines: [exercise], entries: [changed.value], saved: [noted.value], from: "2025-11-12", to: "2025-11-12" });
    expect(wed).toMatchObject({ notes: "With Sam", startTime: "18:00" });
  });

  it("changing twice on the same day keeps one version for that day", () => {
    const again = changeEntry(changed.value, exercise, { ...gymBlueprint, duration: 90 }, "2025-11-10");
    expect(again.ok && again.value.versions.map((v) => v.from)).toEqual(["2025-09-01", "2025-11-10"]);
  });

  it("a new entry applies from today on (or the routine's start, if later)", () => {
    const added = createEntry(exercise, "stretch", { title: "Stretch", tags: [], rule: { freq: "daily", interval: 1 }, perDay: FLOATING_ONCE }, "2025-11-10");
    if (!added.ok) throw new Error();
    expect(freshCopies(exercise, added.value, "2025-11-09")).toEqual([]);
    expect(freshCopies(exercise, added.value, "2025-11-10")).toHaveLength(1);
    const early = createEntry(exercise, "s2", { title: "Stretch", tags: [], rule: { freq: "daily", interval: 1 }, perDay: FLOATING_ONCE }, "2025-08-15");
    expect(early.ok && early.value.versions[0]!.from).toBe("2025-09-01");
  });
});

describe("removing an entry", () => {
  const removed = removedFrom(gym, "2025-11-10");

  it("its tasks stop from today on; past tasks stay", () => {
    expect(freshCopies(exercise, removed, "2025-11-07")).toHaveLength(1);
    expect(freshCopies(exercise, removed, "2025-11-10")).toEqual([]);
  });

  it("a done task is never lost; other touched tasks after that go", () => {
    const done = tickTask(freshCopies(exercise, gym, "2025-11-10")[0]!, clock("2025-11-10T08:00"));
    const noted = editTask(freshCopies(exercise, gym, "2025-11-12")[0]!, { notes: "x" });
    if (!done.ok || !noted.ok) throw new Error();
    const tasks = expandRoutineTasks({ routines: [exercise], entries: [removed], saved: [done.value, noted.value], from: "2025-11-10", to: "2025-11-16" });
    expect(tasks.map((t) => t.startDate)).toEqual(["2025-11-10"]);
  });
});

describe("entry validation", () => {
  const codes = (b: Partial<EntryBlueprint>) => validateBlueprint({ ...gymBlueprint, ...b }).errors.map((e) => e.code);

  it("follows SYSTEMS.md", () => {
    expect(codes({})).toEqual([]);
    expect(codes({ title: "" })).toContain("title_required");
    expect(codes({ rule: { freq: "daily", interval: 0 } })).toContain("interval_min");
    expect(codes({ rule: { freq: "weekly", interval: 1, weekdays: [] } })).toContain("weekdays_required");
    expect(codes({ perDay: { kind: "count", count: 0 } })).toContain("count_min");
    expect(codes({ perDay: { kind: "times", times: [] } })).toContain("times_required");
    expect(codes({ perDay: { kind: "times", times: [{ startTime: "10:00", dueTime: "09:00" }] } })).toContain("due_before_start_time");
    expect(codes({ perDay: { kind: "times", times: [{ startTime: "10:00", duration: 0 }] } })).toContain("duration_positive");
  });

  it("warns when a time's deadline falls inside its block", () => {
    const warn = (times: SlotTime[], duration?: number) =>
      validateBlueprint({ ...gymBlueprint, ...(duration ? { duration } : {}), perDay: { kind: "times", times } }).warnings.map((w) => w.message);
    expect(warn([{ startTime: "07:00", duration: 180, dueTime: "09:30" }])).toEqual(["Time 1: the deadline (09:30) is before it ends (10:00)."]);
    expect(warn([{ startTime: "07:00", duration: 180, dueTime: "10:00" }])).toEqual([]);
    // Older entries: the entry's length counts for every time.
    expect(warn([{ startTime: "07:00", dueTime: "07:30" }], 60)).toHaveLength(1);
  });
});

describe("each time has its own length", () => {
  it("08:00 takes 15m, 18:00 takes 1h", () => {
    const meds = entry("meds", {
      title: "Meds",
      tags: [],
      rule: { freq: "daily", interval: 1 },
      perDay: { kind: "times", times: [{ startTime: "08:00", duration: 15 }, { startTime: "18:00", duration: 60 }, {}] },
    });
    expect(freshCopies(exercise, meds, "2025-11-05").map((t) => t.duration)).toEqual([15, 60, undefined]);
  });

  it("an older entry's length applies to every time; a time's own wins", () => {
    const old = entry("old", {
      title: "Old",
      tags: [],
      duration: 30,
      rule: { freq: "daily", interval: 1 },
      perDay: { kind: "times", times: [{ startTime: "08:00" }, { startTime: "18:00", duration: 60 }] },
    });
    expect(freshCopies(exercise, old, "2025-11-05").map((t) => t.duration)).toEqual([30, 60]);
  });
});

describe("ending early / extending", () => {
  const doneCopy = (day: string): Task => {
    const t = tickTask(freshCopies(exercise, gym, day)[0]!, clock(`${day}T19:00`));
    if (!t.ok) throw new Error();
    return t.value;
  };

  it("earlier only down to the day of the last done task", () => {
    const saved = [doneCopy("2025-11-05"), doneCopy("2025-11-10")];
    const tooEarly = changeEndDate(exercise, "2025-11-09", saved);
    expect(!tooEarly.ok && tooEarly.errors[0]!.code).toBe("end_before_last_done");
    expect(changeEndDate(exercise, "2025-11-10", saved).ok).toBe(true);
  });

  it("a done task moved later counts by its day too", () => {
    const moved = moveTask(doneCopy("2025-11-10"), { startDate: "2025-11-14", startTime: "18:00" });
    if (!moved.ok) throw new Error();
    expect(changeEndDate(exercise, "2025-11-12", [moved.value]).ok).toBe(false);
  });

  it("later → its entries keep producing until the new end", () => {
    const longer = changeEndDate(exercise, "2025-12-31", []);
    if (!longer.ok) throw new Error();
    expect(freshCopies(longer.value, gym, "2025-12-01")).toHaveLength(1);
  });

  it("after the end, tasks you had touched go away too", () => {
    const ended = changeEndDate(exercise, "2025-11-20", []);
    const noted = editTask(freshCopies(exercise, gym, "2025-11-24")[0]!, { notes: "x" });
    if (!ended.ok || !noted.ok) throw new Error();
    expect(expandRoutineTasks({ routines: [ended.value], entries: [gym], saved: [noted.value], from: "2025-11-21", to: "2025-11-30" })).toEqual([]);
  });

  it("can't end before it starts", () => {
    expect(changeEndDate(exercise, "2025-08-01", []).ok).toBe(false);
  });
});

describe("restarting — duplicate", () => {
  it("copies title, purpose and current entries into a draft with new dates; same lineage and protocols", () => {
    const changed = changeEntry(gym, exercise, { ...gymBlueprint, duration: 90 }, "2025-11-10");
    if (!changed.ok) throw new Error();
    const gone = removedFrom(water, "2025-10-01");
    let n = 0;
    const r = duplicateRoutine(exercise, [changed.value, gone], {
      id: "exercise-spring",
      startDate: "2026-03-02",
      endDate: "2026-05-31",
      newEntryId: () => `e${++n}`,
    });
    if (!r.ok) throw new Error();
    expect(r.value.routine).toEqual({
      id: "exercise-spring",
      title: "Exercise plan",
      purpose: "Get stronger and have more energy",
      startDate: "2026-03-02",
      endDate: "2026-05-31",
      clonedFrom: "exercise",
      lineage: "exercise",
    });
    expect(r.value.entries).toHaveLength(1);
    expect(r.value.entries[0]).toMatchObject({ id: "e1", routineId: "exercise-spring" });
    expect(r.value.entries[0]!.versions).toEqual([{ ...gymBlueprint, duration: 90, from: "2026-03-02" }]);
  });

  it("deleting the original only drops the 'came from' link", () => {
    const copy: Routine = { ...exercise, id: "copy", clonedFrom: "exercise" };
    expect(detachClones([copy], "exercise")[0]!.clonedFrom).toBeUndefined();
  });
});

describe("consistency = done ÷ (done + missed)", () => {
  const now = clock("2025-11-12T20:00");
  const copy = (e: RoutineEntry, day: string, slot = 1) => freshCopies(exercise, e, day)[slot - 1]!;
  const tick = (t: Task) => {
    const r = tickTask(t, now);
    if (!r.ok) throw new Error();
    return r.value;
  };
  const cancel = (t: Task) => {
    const r = cancelTask(t, now);
    if (!r.ok) throw new Error();
    return r.value;
  };

  it("cancelled doesn't count; not-done doesn't count yet; count copies count one by one", () => {
    // Gym in November up to now: Mon 3, Wed 5, Fri 7, Mon 10, Wed 12 (18:00–19:00, now 20:00).
    const saved = [
      tick(copy(gym, "2025-11-03")),
      tick(copy(gym, "2025-11-05")),
      cancel(copy(gym, "2025-11-07")),
      tick(copy(gym, "2025-11-10")),
      // 12th untouched → missed
      tick(copy(water, "2025-11-11", 1)),
    ];
    const r = routineConsistency({
      routine: exercise,
      entries: [gym, water],
      saved,
      now,
      range: { from: "2025-11-01", to: "2025-11-30" },
    });
    expect(r.byEntry.get("gym")).toEqual({ done: 3, missed: 1, rate: 0.75 });
    // Water ×4: Nov 1–10 untouched (40 missed) + Nov 11: 1 done, 3 missed. Nov 12 still in time.
    expect(r.byEntry.get("water")).toEqual({ done: 1, missed: 43, rate: 1 / 44 });
    expect(r.overall).toEqual({ done: 4, missed: 44, rate: 4 / 48 });
  });

  it("a task ticked early, in the future, counts", () => {
    const r = routineConsistency({ routine: exercise, entries: [gym], saved: [tick(copy(gym, "2025-11-14"))], now, range: { from: "2025-11-13", to: "2025-11-30" } });
    expect(r.overall).toEqual({ done: 1, missed: 0, rate: 1 });
  });

  it("nothing counts yet → no rate", () => {
    const r = routineConsistency({ routine: exercise, entries: [gym], saved: [], now: clock("2025-08-01T10:00") });
    expect(r.overall).toEqual({ done: 0, missed: 0, rate: null });
  });
});
