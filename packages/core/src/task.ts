/**
 * The Task — TASK.md. Kinds, time-runs-out, states, validation, and the actions
 * (tick, untick, cancel, uncancel, move, edit, delete). Everything here is pure:
 * actions return a new task (or the reasons they can't), they never save.
 */
import {
  type Clock,
  type LocalDate,
  type LocalDateTime,
  type LocalTime,
  type Moment,
  END_OF_DAY,
  addDays,
  addMinutes,
  dateTime,
  diffDays,
  isLocalDate,
  isLocalTime,
  isMoment,
  momentDate,
  nowMoment,
  splitDateTime,
  toMoment,
} from "./dates";
import { type Check, type Issue, type Result, fail, fromCheck, issue, ok } from "./result";

export interface Task {
  id: string;
  title: string;
  notes?: string;
  /** Tag ids. Several allowed. */
  tags: string[];
  /** Minutes, > 0. */
  duration?: number;
  startDate?: LocalDate;
  startTime?: LocalTime;
  dueDate?: LocalDate;
  dueTime?: LocalTime;
  protocolId?: string;
  /** When it was really done. Editable. */
  doneAt?: Moment;
  /** When it was ticked in the app. Automatic. */
  loggedAt?: Moment;
  cancelledAt?: Moment;
  // Only routine copies:
  routineEntryId?: string;
  /** The day the entry originally placed it on (kept when moved). */
  occurrenceDate?: LocalDate;
  /** 1st, 2nd… copy of that day. */
  occurrenceSlot?: number;
}

export type TaskKind = "anytime" | "floating" | "timed";
export type TaskState = "not_done" | "done" | "missed" | "cancelled";

/** The fields you can type into the task form. */
export interface TaskFields {
  title: string;
  notes?: string;
  tags?: string[];
  duration?: number;
  startDate?: LocalDate;
  startTime?: LocalTime;
  dueDate?: LocalDate;
  dueTime?: LocalTime;
  protocolId?: string;
}

export type TaskSchedule = Pick<TaskFields, "startDate" | "startTime" | "dueDate" | "dueTime">;

export function isRoutineCopy(task: Task): boolean {
  return task.routineEntryId !== undefined;
}

// ── Kind & time ──────────────────────────────────────────────────────────

/** Never stored — worked out from which fields are filled. */
export function taskKind(task: Pick<Task, "startDate" | "startTime" | "dueDate">): TaskKind {
  if (task.startTime !== undefined) return "timed";
  if (task.startDate !== undefined || task.dueDate !== undefined) return "floating";
  return "anytime";
}

/** The start as date + time, for timed tasks. */
export function startOf(task: Task): LocalDateTime | null {
  return task.startDate !== undefined && task.startTime !== undefined
    ? dateTime(task.startDate, task.startTime)
    : null;
}

/** The due moment: the due time, or the end of the due day. */
export function dueOf(task: Task): LocalDateTime | null {
  return task.dueDate !== undefined ? dateTime(task.dueDate, task.dueTime ?? END_OF_DAY) : null;
}

/** A timed task's calendar block. `end` is null without a duration. */
export function blockOf(task: Task): { start: LocalDateTime; end: LocalDateTime | null } | null {
  const start = startOf(task);
  if (start === null) return null;
  return { start, end: task.duration !== undefined ? addMinutes(start, task.duration) : null };
}

/**
 * When the task's time runs out (TASK.md, first rule that applies):
 * 1. due date (± time) → the due moment, or the end of the due day
 * 2. start time + duration → the end of its block
 * 3. only a start date (± time) → the end of that day
 * 4. no date → never (null)
 */
export function runsOutAt(task: Task): LocalDateTime | null {
  const due = dueOf(task);
  if (due !== null) return due;
  const block = blockOf(task);
  if (block?.end) return block.end;
  if (task.startDate !== undefined) return dateTime(task.startDate, END_OF_DAY);
  return null;
}

/**
 * Exactly one of four states, worked out from the fields and "now". Missed starts the
 * minute after the time runs out (due 09:00 → missed from 09:01).
 */
export function taskState(task: Task, now: LocalDateTime): TaskState {
  if (task.doneAt !== undefined) return "done";
  if (task.cancelledAt !== undefined) return "cancelled";
  const runsOut = runsOutAt(task);
  return runsOut !== null && now > runsOut ? "missed" : "not_done";
}

/** For a moved routine copy: the day it was originally on ("moved from Mon"). */
export function movedFrom(task: Task): LocalDate | null {
  if (!isRoutineCopy(task) || task.occurrenceDate === undefined) return null;
  return task.startDate !== task.occurrenceDate ? task.occurrenceDate : null;
}

/** History = done tasks by the day of their done_at. */
export function historyDate(task: Task): LocalDate | null {
  return task.doneAt !== undefined ? momentDate(task.doneAt) : null;
}

// ── Validation ───────────────────────────────────────────────────────────

export function validateTask(task: Task): Check {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  if (task.title.trim() === "") errors.push(issue("title_required", "The title can't be empty.", "title"));
  if (task.duration !== undefined && !(Number.isInteger(task.duration) && task.duration > 0)) {
    errors.push(issue("duration_positive", "The duration must be a whole number of minutes above 0.", "duration"));
  }

  for (const field of ["startDate", "dueDate", "occurrenceDate"] as const) {
    const v = task[field];
    if (v !== undefined && !isLocalDate(v)) errors.push(issue("invalid_date", `${field} isn't a valid date.`, field));
  }
  for (const field of ["startTime", "dueTime"] as const) {
    const v = task[field];
    if (v !== undefined && !isLocalTime(v)) errors.push(issue("invalid_time", `${field} isn't a valid time.`, field));
  }
  for (const field of ["doneAt", "loggedAt", "cancelledAt"] as const) {
    const v = task[field];
    if (v !== undefined && !isMoment(v)) errors.push(issue("invalid_moment", `${field} isn't a valid moment.`, field));
  }

  if (task.startTime !== undefined && task.startDate === undefined) {
    errors.push(issue("time_without_date", "A start time needs a start date.", "startTime"));
  }
  if (task.dueTime !== undefined && task.dueDate === undefined) {
    errors.push(issue("time_without_date", "A deadline time needs a deadline day.", "dueTime"));
  }

  if (task.doneAt !== undefined && task.cancelledAt !== undefined) {
    errors.push(issue("done_and_cancelled", "A task can't be both done and cancelled."));
  }
  if (task.loggedAt !== undefined && task.doneAt === undefined) {
    errors.push(issue("logged_without_done", "logged_at only exists on a done task.", "loggedAt"));
  }

  if (isRoutineCopy(task)) {
    if (task.occurrenceDate === undefined) {
      errors.push(issue("copy_needs_occurrence", "A routine copy needs its occurrence date.", "occurrenceDate"));
    }
    if (task.occurrenceSlot === undefined || !Number.isInteger(task.occurrenceSlot) || task.occurrenceSlot < 1) {
      errors.push(issue("copy_needs_slot", "A routine copy needs its slot (1 or more).", "occurrenceSlot"));
    }
    if (task.startDate === undefined) {
      errors.push(issue("copy_needs_date", "A routine copy always stays on a day; it can't become anytime.", "startDate"));
    }
  } else if (task.occurrenceDate !== undefined || task.occurrenceSlot !== undefined) {
    errors.push(issue("one_off_with_occurrence", "A one-off task never belongs to a routine entry."));
  }

  const start = task.startDate !== undefined ? dateTime(task.startDate, task.startTime ?? "00:00") : null;
  const due = dueOf(task);
  if (start !== null && due !== null && due < start && errors.length === 0) {
    warnings.push(issue("due_before_start", "The deadline is before the start.", "dueDate"));
  }
  // A deadline inside the block: the task is missed before its block is over.
  const block = errors.length === 0 ? blockOf(task) : null;
  if (block?.end && due !== null && due >= block.start && due < block.end) {
    const at = (dt: string) => (splitDateTime(dt).date === task.startDate ? splitDateTime(dt).time : dt.replace("T", " "));
    warnings.push(issue("due_before_end", `The deadline (${at(due)}) is before the block ends (${at(block.end)}).`, "dueTime"));
  }

  return { errors, warnings };
}

// ── Creating & editing ───────────────────────────────────────────────────

/** Trims text, drops empty optional text, removes duplicate tags. */
function normalizeFields<T extends Partial<TaskFields>>(fields: T): T {
  const out: T = { ...fields };
  if (out.title !== undefined) out.title = out.title.trim();
  if (out.notes !== undefined) {
    const notes = out.notes.trim();
    out.notes = notes === "" ? undefined : notes;
  }
  if (out.tags !== undefined) out.tags = [...new Set(out.tags)];
  return out;
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

/** A new one-off task (quick-add or the task form). */
export function createTask(id: string, fields: TaskFields): Result<Task> {
  const f = normalizeFields(fields);
  const task = withoutUndefined<Task>({ ...f, id, tags: f.tags ?? [] });
  return fromCheck(task, validateTask(task));
}

/**
 * Change any form field (title, notes, tags, duration, dates/times, protocol). A field
 * set to `undefined` is cleared. Works the same for one-offs and routine copies.
 */
export function editTask(task: Task, changes: Partial<TaskFields>): Result<Task> {
  const c = normalizeFields(changes);
  const next = withoutUndefined<Task>({ ...task, ...c, tags: c.tags ?? task.tags });
  return fromCheck(next, validateTask(next));
}

/**
 * Moving = changing the date/time. No new state; a routine copy keeps its occurrence
 * date (so it can show "moved from …"). Its time then runs out by the new date/time.
 */
export function moveTask(task: Task, schedule: TaskSchedule): Result<Task> {
  return editTask(task, {
    startDate: schedule.startDate,
    startTime: schedule.startTime,
    dueDate: schedule.dueDate,
    dueTime: schedule.dueTime,
  });
}

/**
 * "Move to this day (and time)" as a full schedule for `moveTask` (decided in phase 2):
 * - the start goes to the new day and time (no time → the task floats on that day);
 * - a due date moves along by the same number of days and keeps its time, so
 *   "08:00, due 09:00" moved to tomorrow is still due an hour after it starts;
 * - a task with only a due date moves its due date instead;
 * - an anytime task gets the day (and time).
 */
export function scheduleForMove(task: Task, day: LocalDate, time?: LocalTime): TaskSchedule {
  if (task.startDate === undefined && task.dueDate !== undefined) return { dueDate: day, dueTime: time };
  const shift = task.startDate !== undefined ? diffDays(task.startDate, day) : 0;
  return {
    startDate: day,
    startTime: time,
    dueDate: task.dueDate !== undefined ? addDays(task.dueDate, shift) : undefined,
    dueTime: task.dueDate !== undefined ? task.dueTime : undefined,
  };
}

// ── Ticking & cancelling ─────────────────────────────────────────────────

/** Sets done_at (now unless given) and logged_at (always now). */
export function tickTask(task: Task, clock: Clock, doneAt?: Moment): Result<Task> {
  if (task.doneAt !== undefined) return fail(issue("already_done", "It's already done."));
  if (task.cancelledAt !== undefined) {
    return fail(issue("cancelled_cannot_tick", "It's cancelled. Uncancel it before ticking it."));
  }
  if (doneAt !== undefined && !isMoment(doneAt)) {
    return fail(issue("invalid_moment", "done_at isn't a valid moment.", "doneAt"));
  }
  const now = nowMoment(clock);
  return ok({ ...task, doneAt: doneAt ?? now, loggedAt: now });
}

/** Change when a done task was really done. */
export function setDoneAt(task: Task, doneAt: Moment): Result<Task> {
  if (task.doneAt === undefined) return fail(issue("not_done", "Only a done task has a done time."));
  if (!isMoment(doneAt)) return fail(issue("invalid_moment", "done_at isn't a valid moment.", "doneAt"));
  return ok({ ...task, doneAt });
}

/** Clears done_at and logged_at; the state goes back to what its time says. */
export function untickTask(task: Task): Result<Task> {
  if (task.doneAt === undefined) return fail(issue("not_done", "It isn't done."));
  const { doneAt: _d, loggedAt: _l, ...rest } = task;
  return ok(rest);
}

export function cancelTask(task: Task, clock: Clock): Result<Task> {
  if (task.doneAt !== undefined) {
    return fail(issue("done_cannot_cancel", "It's done. Untick it before cancelling it."));
  }
  if (task.cancelledAt !== undefined) return fail(issue("already_cancelled", "It's already cancelled."));
  return ok({ ...task, cancelledAt: nowMoment(clock) });
}

export function uncancelTask(task: Task): Result<Task> {
  if (task.cancelledAt === undefined) return fail(issue("not_cancelled", "It isn't cancelled."));
  const { cancelledAt: _c, ...rest } = task;
  return ok(rest);
}

/**
 * The quick options when ticking a task whose time ran out (TASK.md):
 * "Done now", "Done on time" (+ "Pick a time…", which is just `tickTask` with a moment).
 * Null when the task isn't missed — then ticking simply means "done now".
 *
 * "On time" = the due moment; else the start of a timed task; else the end of its day.
 */
export function tickOptions(task: Task, clock: Clock): { doneNow: Moment; onTime: Moment } | null {
  if (taskState(task, clock.at) !== "missed") return null;
  const onTime = dueOf(task) ?? startOf(task) ?? runsOutAt(task)!;
  return { doneNow: nowMoment(clock), onTime: toMoment(onTime, clock.offset) };
}

/**
 * Deleting: a one-off is removed. A routine copy is cancelled instead — otherwise its
 * entry would just produce it again (TASK.md).
 */
export function deleteTask(task: Task, clock: Clock): Result<{ action: "delete" } | { action: "cancel"; task: Task }> {
  if (!isRoutineCopy(task)) return ok({ action: "delete" });
  if (task.cancelledAt !== undefined) return ok({ action: "cancel", task });
  const cancelled = cancelTask(task, clock);
  return cancelled.ok ? ok({ action: "cancel", task: cancelled.value }) : cancelled;
}
