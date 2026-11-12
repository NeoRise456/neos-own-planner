/**
 * The Todo view's questions — PLAN.md section 12: which tasks show on a day, in which
 * section, in what order, and the day's total.
 *
 * Where a task shows (decided in phase 1, see TASK.md "Which days a task shows on"):
 * - timed → its start date
 * - floating → every day from its start to its due date (only a start: that day;
 *   only a due date: from today until the due date) — until it's done or cancelled,
 *   then only on the day that happened (kept inside its range)
 * - anytime → today while open; once done or cancelled, the day that happened
 * - on **today**, one-off tasks whose time ran out also show in **Missed** (and only there)
 */
import { type Clock, type LocalDate, clampDate, minDate, momentDate, momentToEpoch, todayOf } from "./dates";
import { type Task, type TaskFields, dueOf, isRoutineCopy, runsOutAt, taskKind, taskState } from "./task";

export type TodoSectionName = "missed" | "scheduled" | "during" | "anytime" | "done" | "cancelled";

export interface TodoDay {
  day: LocalDate;
  /** One-off tasks whose time ran out (only on today). */
  missed: Task[];
  /** Timed tasks, by start time. */
  scheduled: Task[];
  /** Floating tasks, by due time ("by 12:00", "by Sun"); no due time last. */
  during: Task[];
  /** No date (only on today). */
  anytime: Task[];
  done: Task[];
  cancelled: Task[];
  summary: DaySummary;
}

export interface DaySummary {
  /** Planned minutes of the timed tasks. */
  scheduledMinutes: number;
  /** Planned minutes of the floating tasks. */
  floatingMinutes: number;
  /** Dated tasks without a duration ("+3 untimed"). */
  untimed: number;
}

/** A timed task due on a later day than it starts (TASK.md, phase 4). */
export function runsPastStartDay(task: Task): boolean {
  return taskKind(task) === "timed" && task.dueDate !== undefined && task.dueDate > task.startDate!;
}

/** Does the task show on `day`? (Missed section aside — see `todoForDay`.) */
export function showsOn(task: Task, day: LocalDate, today: LocalDate): boolean {
  const closedAt = task.doneAt ?? task.cancelledAt;
  const kind = taskKind(task);

  if (kind === "anytime") return closedAt !== undefined ? momentDate(closedAt) === day : day === today;
  if (kind === "timed") {
    // Due on a later day: after its block it runs on through the day until the deadline.
    if (!runsPastStartDay(task)) return task.startDate === day;
    if (closedAt !== undefined) return clampDate(momentDate(closedAt), task.startDate!, task.dueDate!) === day;
    return day >= task.startDate! && day <= task.dueDate!;
  }

  const first = task.startDate ?? minDate(today, task.dueDate!);
  const last = task.dueDate !== undefined && task.dueDate > first ? task.dueDate : first;
  if (closedAt !== undefined) return clampDate(momentDate(closedAt), first, last) === day;
  return day >= first && day <= last;
}

/** A day of the Todo list. `tasks` = one-offs + the routine copies placed around that day. */
export function todoForDay(tasks: Task[], day: LocalDate, now: Clock): TodoDay {
  const today = todayOf(now);
  const out: Omit<TodoDay, "summary"> = { day, missed: [], scheduled: [], during: [], anytime: [], done: [], cancelled: [] };

  for (const task of tasks) {
    const state = taskState(task, now.at);
    if (day === today && state === "missed" && !isRoutineCopy(task)) {
      out.missed.push(task);
      continue;
    }
    if (!showsOn(task, day, today)) continue;
    if (state === "done") out.done.push(task);
    else if (state === "cancelled") out.cancelled.push(task);
    else {
      const kind = taskKind(task);
      if (kind === "timed" && task.startDate === day) out.scheduled.push(task);
      // Floating — or a timed task on the days after its block, until its deadline.
      else if (kind !== "anytime") out.during.push(task);
      else out.anytime.push(task);
    }
  }

  const byTitle = (a: Task, b: Task) => a.title.localeCompare(b.title);
  out.missed.sort((a, b) => cmp(runsOutAt(a) ?? "", runsOutAt(b) ?? "") || byTitle(a, b));
  out.scheduled.sort((a, b) => cmp(a.startTime!, b.startTime!) || slotOrder(a, b) || byTitle(a, b));
  out.during.sort((a, b) => {
    const da = a.dueDate !== undefined ? dueOf(a)! : "~"; // "~" sorts after any date
    const db = b.dueDate !== undefined ? dueOf(b)! : "~";
    return cmp(da, db) || slotOrder(a, b) || byTitle(a, b);
  });
  out.done.sort((a, b) => momentToEpoch(a.doneAt!) - momentToEpoch(b.doneAt!));
  out.cancelled.sort((a, b) => momentToEpoch(a.cancelledAt!) - momentToEpoch(b.cancelledAt!));

  // A block counts on its own day only, not on the days it runs on after.
  const planned = [...out.scheduled, ...out.during, ...out.done.filter((t) => taskKind(t) !== "anytime")].filter(
    (t) => taskKind(t) !== "timed" || t.startDate === day,
  );
  return { ...out, summary: daySummary(planned) };
}

/** `Scheduled 3h · Floating 45m` + "+N untimed", over the given dated tasks. */
export function daySummary(tasks: Task[]): DaySummary {
  const summary: DaySummary = { scheduledMinutes: 0, floatingMinutes: 0, untimed: 0 };
  for (const t of tasks) {
    const kind = taskKind(t);
    if (kind === "anytime") continue;
    if (t.duration === undefined) summary.untimed++;
    else if (kind === "timed") summary.scheduledMinutes += t.duration;
    else summary.floatingMinutes += t.duration;
  }
  return summary;
}

/** "Water 2/4": the copies of one count entry on one day. Cancelled copies don't count. */
export function countProgress(copies: Task[]): { done: number; total: number } {
  const live = copies.filter((t) => t.cancelledAt === undefined);
  return { done: live.filter((t) => t.doneAt !== undefined).length, total: live.length };
}

/** Which copy a tick on "Water 2/4" ticks: the first open one, by slot. */
export function nextCopyToTick(copies: Task[]): Task | null {
  const open = copies.filter((t) => t.doneAt === undefined && t.cancelledAt === undefined);
  open.sort((a, b) => (a.occurrenceSlot ?? 0) - (b.occurrenceSlot ?? 0));
  return open[0] ?? null;
}

/** The Todo tag filter (PLAN.md §12): only tasks carrying that tag; no tag → every task. */
export function filterByTag(tasks: Task[], tagId: string | null): Task[] {
  return tagId === null ? tasks : tasks.filter((t) => t.tags.includes(tagId));
}

/** A day's list with the tag filter applied to every section (the summary follows). */
export function filterTodoDay(todo: TodoDay, tagId: string | null): TodoDay {
  if (tagId === null) return todo;
  const pick = (ts: Task[]) => filterByTag(ts, tagId);
  const out = {
    day: todo.day,
    missed: pick(todo.missed),
    scheduled: pick(todo.scheduled),
    during: pick(todo.during),
    anytime: pick(todo.anytime),
    done: pick(todo.done),
    cancelled: pick(todo.cancelled),
  };
  const planned = [...out.scheduled, ...out.during, ...out.done.filter((t) => taskKind(t) !== "anytime")];
  return { ...out, summary: daySummary(planned) };
}

/**
 * What quick-add makes while you look at `day` (decided in phase 3): on a later day, a
 * task floating on that day; on today or a past day, an anytime task (it shows today).
 * With the tag filter on, it gets that tag, so it stays in view.
 */
export function quickAddFields(title: string, day: LocalDate, today: LocalDate, tagId: string | null = null): TaskFields {
  return { title, ...(day > today ? { startDate: day } : {}), ...(tagId !== null ? { tags: [tagId] } : {}) };
}

/** Plain text order — dates and times sort correctly this way (localeCompare doesn't). */
function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function slotOrder(a: Task, b: Task): number {
  if (a.routineEntryId === undefined || a.routineEntryId !== b.routineEntryId) return 0;
  return (a.occurrenceSlot ?? 0) - (b.occurrenceSlot ?? 0);
}
