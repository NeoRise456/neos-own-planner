import { describe, expect, it } from "vitest";
import {
  type Clock,
  type Task,
  blockOf,
  cancelTask,
  createTask,
  deleteTask,
  editTask,
  historyDate,
  moveTask,
  movedFrom,
  runsOutAt,
  scheduleForMove,
  setDoneAt,
  taskKind,
  taskState,
  tickOptions,
  tickTask,
  uncancelTask,
  untickTask,
  validateTask,
} from "../src";

const clock = (at: string, offset = 60): Clock => ({ at, offset });
const task = (fields: Partial<Task>): Task => ({ id: "t", title: "Task", tags: [], ...fields });
const codes = (t: Task) => validateTask(t).errors.map((e) => e.code);

/** The examples in TASK.md, as written there. */
const examples = {
  buyMilk: task({ title: "Buy milk", tags: ["home"] }),
  replyEmail: task({ title: "Reply to email", startDate: "2026-11-06", duration: 5 }),
  callMom: task({ title: "Call mom", startDate: "2026-11-09", dueDate: "2026-11-15" }),
  essay: task({ title: "Finish essay", dueDate: "2026-11-13", dueTime: "23:59", tags: ["uni"] }),
  dentist: task({ title: "Dentist", startDate: "2026-11-12", startTime: "15:00", duration: 60 }),
  phoneBill: task({ title: "Pay phone bill", dueDate: "2026-11-01", doneAt: "2026-11-01T19:30+01:00", loggedAt: "2026-11-03T10:00+01:00" }),
  calculus: task({
    title: "Calculus (Mon)",
    routineEntryId: "calc-mon",
    occurrenceDate: "2026-11-09",
    occurrenceSlot: 1,
    startDate: "2026-11-09",
    startTime: "09:00",
    duration: 120,
  }),
  cancelledCalculus: task({
    title: "Calculus (Mon)",
    routineEntryId: "calc-mon",
    occurrenceDate: "2026-12-08",
    occurrenceSlot: 1,
    startDate: "2026-12-08",
    cancelledAt: "2026-12-01T10:00+01:00",
  }),
};

describe("TASK.md examples", () => {
  it("are all valid", () => {
    for (const [name, t] of Object.entries(examples)) expect(codes(t), name).toEqual([]);
  });

  it("have the right kind", () => {
    expect(taskKind(examples.buyMilk)).toBe("anytime");
    expect(taskKind(examples.replyEmail)).toBe("floating");
    expect(taskKind(examples.callMom)).toBe("floating");
    expect(taskKind(examples.essay)).toBe("floating");
    expect(taskKind(examples.dentist)).toBe("timed");
    expect(taskKind(examples.calculus)).toBe("timed");
  });

  it("have the right state", () => {
    const now = "2026-11-11T12:00";
    expect(taskState(examples.buyMilk, now)).toBe("not_done");
    expect(taskState(examples.replyEmail, now)).toBe("missed");
    expect(taskState(examples.callMom, now)).toBe("not_done");
    expect(taskState(examples.essay, now)).toBe("not_done");
    expect(taskState(examples.dentist, now)).toBe("not_done");
    expect(taskState(examples.phoneBill, now)).toBe("done");
    expect(taskState(examples.calculus, now)).toBe("missed");
    expect(taskState(examples.cancelledCalculus, now)).toBe("cancelled");
  });
});

describe("kind", () => {
  it("adding a start time makes it timed; removing it makes it floating again", () => {
    const timed = editTask(examples.replyEmail, { startTime: "10:00" });
    expect(timed.ok && taskKind(timed.value)).toBe("timed");
    const floating = timed.ok ? editTask(timed.value, { startTime: undefined }) : timed;
    expect(floating.ok && taskKind(floating.value)).toBe("floating");
  });
});

describe("when the time runs out (first rule that applies)", () => {
  it("1. due date ± time → the due moment, or the end of the due day", () => {
    expect(runsOutAt(examples.essay)).toBe("2026-11-13T23:59");
    expect(runsOutAt(task({ startDate: "2026-11-11", startTime: "08:00", dueDate: "2026-11-11", dueTime: "09:00" }))).toBe("2026-11-11T09:00");
    expect(runsOutAt(task({ dueDate: "2026-11-13" }))).toBe("2026-11-13T23:59");
    // The due date wins over the block
    expect(runsOutAt(task({ startDate: "2026-11-11", startTime: "09:00", duration: 120, dueDate: "2026-11-12" }))).toBe("2026-11-12T23:59");
  });

  it("2. start time + duration → the end of its block", () => {
    expect(runsOutAt(task({ startDate: "2026-11-09", startTime: "09:00", duration: 120 }))).toBe("2026-11-09T11:00");
  });

  it("3. only a start date (± time) → the end of that day", () => {
    expect(runsOutAt(task({ startDate: "2026-11-06" }))).toBe("2026-11-06T23:59");
    expect(runsOutAt(task({ startDate: "2026-11-06", startTime: "15:00" }))).toBe("2026-11-06T23:59");
  });

  it("4. no date → never", () => {
    expect(runsOutAt(examples.buyMilk)).toBeNull();
    expect(taskState(examples.buyMilk, "2099-01-01T00:00")).toBe("not_done");
  });

  it("missed starts the minute after", () => {
    const exercise = task({ startDate: "2026-11-11", dueDate: "2026-11-11", dueTime: "09:00" });
    expect(taskState(exercise, "2026-11-11T09:00")).toBe("not_done");
    expect(taskState(exercise, "2026-11-11T09:01")).toBe("missed");
    expect(taskState(task({ startDate: "2026-11-11" }), "2026-11-11T23:59")).toBe("not_done");
    expect(taskState(task({ startDate: "2026-11-11" }), "2026-11-12T00:00")).toBe("missed");
  });

  it("gives timed tasks a calendar block", () => {
    expect(blockOf(examples.dentist)).toEqual({ start: "2026-11-12T15:00", end: "2026-11-12T16:00" });
    expect(blockOf(task({ startDate: "2026-11-12", startTime: "15:00" }))).toEqual({ start: "2026-11-12T15:00", end: null });
    expect(blockOf(examples.replyEmail)).toBeNull();
  });
});

describe("validation", () => {
  it("needs a title (trimmed)", () => {
    expect(codes(task({ title: "   " }))).toContain("title_required");
  });

  it("needs a duration above 0", () => {
    expect(codes(task({ duration: 0 }))).toContain("duration_positive");
    expect(codes(task({ duration: -5 }))).toContain("duration_positive");
    expect(codes(task({ duration: 5 }))).toEqual([]);
  });

  it("a time always goes with its date", () => {
    expect(codes(task({ startTime: "10:00" }))).toContain("time_without_date");
    expect(codes(task({ dueTime: "10:00" }))).toContain("time_without_date");
  });

  it("due before start → allowed, with a warning", () => {
    const check = validateTask(task({ startDate: "2026-11-12", dueDate: "2026-11-10" }));
    expect(check.errors).toEqual([]);
    expect(check.warnings.map((w) => w.code)).toEqual(["due_before_start"]);
    const sameDay = validateTask(task({ startDate: "2026-11-12", startTime: "15:00", dueDate: "2026-11-12", dueTime: "14:00" }));
    expect(sameDay.warnings.map((w) => w.code)).toEqual(["due_before_start"]);
  });

  it("due already in the past → allowed, no warning, missed from the start", () => {
    const created = createTask("t", { title: "Pay phone bill", dueDate: "2026-11-01" });
    expect(created.ok && created.warnings).toEqual([]);
    expect(created.ok && taskState(created.value, "2026-11-11T12:00")).toBe("missed");
  });

  it("can't be both done and cancelled", () => {
    expect(codes(task({ doneAt: "2026-11-01T10:00+01:00", loggedAt: "2026-11-01T10:00+01:00", cancelledAt: "2026-11-01T10:00+01:00" }))).toContain("done_and_cancelled");
  });

  it("a one-off task never has occurrence fields", () => {
    expect(codes(task({ occurrenceDate: "2026-11-09" }))).toContain("one_off_with_occurrence");
  });

  it("a routine copy needs its occurrence and stays on a day", () => {
    const copy = examples.calculus;
    expect(codes({ ...copy, occurrenceSlot: 0 })).toContain("copy_needs_slot");
    const { startDate: _s, startTime: _t, ...anytime } = copy;
    expect(codes({ ...anytime })).toContain("copy_needs_date");
  });

  it("rejects malformed dates and times", () => {
    expect(codes(task({ startDate: "2026-02-30" }))).toContain("invalid_date");
    expect(codes(task({ startDate: "2026-11-09", startTime: "25:00" }))).toContain("invalid_time");
  });
});

describe("creating & editing", () => {
  it("quick-add: just a title → anytime one-off", () => {
    const r = createTask("t1", { title: "  Buy milk  " });
    expect(r.ok && r.value).toEqual({ id: "t1", title: "Buy milk", tags: [] });
    expect(r.ok && taskKind(r.value)).toBe("anytime");
  });

  it("drops empty notes and duplicate tags", () => {
    const r = createTask("t1", { title: "x", notes: "  ", tags: ["a", "a", "b"] });
    expect(r.ok && r.value).toEqual({ id: "t1", title: "x", tags: ["a", "b"] });
  });

  it("refuses an invalid task", () => {
    const r = createTask("t1", { title: "" });
    expect(r.ok).toBe(false);
  });

  it("edits clear a field set to undefined", () => {
    const r = editTask(examples.dentist, { duration: undefined, notes: "Bring the card" });
    expect(r.ok && r.value.duration).toBeUndefined();
    expect(r.ok && r.value.notes).toBe("Bring the card");
  });
});

describe("ticking", () => {
  const now = clock("2026-11-11T09:40");

  it("sets done_at (now by default) and logged_at", () => {
    const r = tickTask(examples.buyMilk, now);
    expect(r.ok && r.value.doneAt).toBe("2026-11-11T09:40+01:00");
    expect(r.ok && r.value.loggedAt).toBe("2026-11-11T09:40+01:00");
  });

  it("done_at can be set to when it really happened; logged_at stays automatic", () => {
    const r = tickTask(task({ title: "Pay phone bill", dueDate: "2026-11-01" }), now, "2026-11-01T19:30+01:00");
    expect(r.ok && r.value.doneAt).toBe("2026-11-01T19:30+01:00");
    expect(r.ok && r.value.loggedAt).toBe("2026-11-11T09:40+01:00");
    const edited = r.ok ? setDoneAt(r.value, "2026-11-01T20:00+01:00") : r;
    expect(edited.ok && edited.value.doneAt).toBe("2026-11-01T20:00+01:00");
  });

  it("after the time ran out, offers Done now / Done on time", () => {
    const exercise = task({ title: "Exercise", startDate: "2026-11-11", dueDate: "2026-11-11", dueTime: "09:00" });
    expect(tickOptions(exercise, now)).toEqual({ doneNow: "2026-11-11T09:40+01:00", onTime: "2026-11-11T09:00+01:00" });
    // Still in time → no options, just tick
    expect(tickOptions(exercise, clock("2026-11-11T08:30"))).toBeNull();
  });

  it("'on time' is the start for a timed task without a due date, else the end of its day", () => {
    const cls = task({ startDate: "2026-11-10", startTime: "09:00", duration: 120 });
    expect(tickOptions(cls, now)?.onTime).toBe("2026-11-10T09:00+01:00");
    expect(tickOptions(examples.replyEmail, now)?.onTime).toBe("2026-11-06T23:59+01:00");
  });

  it("a missed task can still be ticked", () => {
    const r = tickTask(examples.calculus, now, "2026-11-09T09:00+01:00");
    expect(r.ok && taskState(r.value, now.at)).toBe("done");
  });

  it("a task from a past day stays on its day; history uses done_at", () => {
    const r = tickTask(examples.replyEmail, now);
    expect(r.ok && r.value.startDate).toBe("2026-11-06");
    expect(r.ok && historyDate(r.value)).toBe("2026-11-11");
  });

  it("unticking clears done_at / logged_at and goes back to what the time says", () => {
    const done = tickTask(examples.calculus, now);
    const back = done.ok ? untickTask(done.value) : done;
    expect(back.ok && back.value.doneAt).toBeUndefined();
    expect(back.ok && back.value.loggedAt).toBeUndefined();
    expect(back.ok && taskState(back.value, now.at)).toBe("missed");
  });

  it("can't tick twice or tick a cancelled task", () => {
    expect(tickTask(examples.phoneBill, now).ok).toBe(false);
    const r = tickTask(examples.cancelledCalculus, now);
    expect(!r.ok && r.errors[0]!.code).toBe("cancelled_cannot_tick");
  });
});

describe("cancelling", () => {
  const now = clock("2026-11-11T10:00");

  it("sets cancelled_at; uncancel returns it to what its time says", () => {
    const c = cancelTask(examples.replyEmail, now);
    expect(c.ok && taskState(c.value, now.at)).toBe("cancelled");
    const u = c.ok ? uncancelTask(c.value) : c;
    expect(u.ok && taskState(u.value, now.at)).toBe("missed");
  });

  it("to cancel a done task, untick it first", () => {
    const r = cancelTask(examples.phoneBill, now);
    expect(!r.ok && r.errors[0]!.code).toBe("done_cannot_cancel");
  });
});

describe("moving", () => {
  it("a routine copy keeps its occurrence date → 'moved from Mon'", () => {
    const r = moveTask(examples.calculus, { startDate: "2026-11-10", startTime: "09:00" });
    expect(r.ok && r.value.occurrenceDate).toBe("2026-11-09");
    expect(r.ok && movedFrom(r.value)).toBe("2026-11-09");
    expect(movedFrom(examples.calculus)).toBeNull();
  });

  it("a moved task's time runs out by its new date/time", () => {
    const r = moveTask(examples.calculus, { startDate: "2026-11-12", startTime: "09:00" });
    expect(r.ok && taskState(r.value, "2026-11-11T12:00")).toBe("not_done");
  });

  it("a routine copy can't be moved to anytime", () => {
    expect(moveTask(examples.calculus, {}).ok).toBe(false);
  });

  describe("scheduleForMove (move to a day / time)", () => {
    it("a timed task: new start, the due date moves along and keeps its time", () => {
      const t = task({ startDate: "2026-11-11", startTime: "08:00", dueDate: "2026-11-11", dueTime: "09:00" });
      expect(scheduleForMove(t, "2026-11-12", "08:30")).toEqual({
        startDate: "2026-11-12",
        startTime: "08:30",
        dueDate: "2026-11-12",
        dueTime: "09:00",
      });
    });

    it("a floating range keeps its length", () => {
      expect(scheduleForMove(examples.callMom, "2026-11-11")).toEqual({
        startDate: "2026-11-11",
        startTime: undefined,
        dueDate: "2026-11-17",
        dueTime: undefined,
      });
    });

    it("no time → it floats on the new day", () => {
      const r = moveTask(examples.dentist, scheduleForMove(examples.dentist, "2026-11-13"));
      expect(r.ok && taskKind(r.value)).toBe("floating");
      expect(r.ok && r.value.duration).toBe(60);
    });

    it("only a due date → the due date moves", () => {
      expect(scheduleForMove(examples.essay, "2026-11-20", "18:00")).toEqual({ dueDate: "2026-11-20", dueTime: "18:00" });
    });

    it("an anytime task gets the day", () => {
      expect(scheduleForMove(examples.buyMilk, "2026-11-12", "10:00")).toEqual({
        startDate: "2026-11-12",
        startTime: "10:00",
        dueDate: undefined,
        dueTime: undefined,
      });
    });
  });
});

describe("deleting", () => {
  const now = clock("2026-11-11T10:00");

  it("removes a one-off, whatever its state (a mistake you don't want to keep)", () => {
    for (const t of [examples.buyMilk, examples.replyEmail /* missed */, examples.phoneBill /* done */]) {
      const r = deleteTask(t, now);
      expect(r.ok && r.value.action).toBe("delete");
    }
  });

  it("cancels a routine copy instead (the entry would just produce it again)", () => {
    const r = deleteTask(examples.calculus, now);
    expect(r.ok && r.value.action).toBe("cancel");
    expect(r.ok && r.value.action === "cancel" && r.value.task.cancelledAt).toBe("2026-11-11T10:00+01:00");
  });
});
