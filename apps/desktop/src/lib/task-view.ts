/**
 * How a task looks: its labels ("09:00–11:00", "by Sun", "Missed · Fri 6 Nov",
 * "done 08:52"), glyph and color. Display only — every state and time comes from
 * @planner/core; date-fns just formats them.
 */
import { format, parseISO } from "date-fns";
import {
  versionOn,
  nextCopyToTick,
  countProgress,
  movedFrom,
  type RoutineEntry,
  type Routine,
  validateTask,
  type LocalDateTime,
  type Clock,
  type LocalDate,
  type Moment,
  type Tag,
  type Task,
  END_OF_DAY,
  blockOf,
  diffDays,
  formatDuration,
  momentLocal,
  runsOutAt,
  splitDateTime,
  taskKind,
  taskState,
  todayOf,
} from "@planner/core";
import type { VisualState } from "@/components/ui/task-visuals";
import type { Tone } from "@/lib/tones";
import { glyphOf } from "./glyph";

/** "Fri 6 Nov" */
export const dayShort = (d: LocalDate) => format(parseISO(d), "EEE d MMM");
/** "Fri" */
const weekday = (d: LocalDate) => format(parseISO(d), "EEE");

export function visualState(task: Task, clock: Clock): VisualState {
  const s = taskState(task, clock.at);
  return s === "not_done" ? "todo" : s;
}

/** What a task's color depends on: its tags, and for a routine task its routine (by entry id). */
export interface Palette {
  tags: Map<string, Tag>;
  routineOf: Map<string, Routine>;
  entries: Map<string, RoutineEntry>;
}

/** A routine task: its routine's color. A one-off: its first tag's. Else stone. */
export function toneOf(task: Task, palette: Palette): Tone {
  const routine = task.routineEntryId !== undefined ? palette.routineOf.get(task.routineEntryId) : undefined;
  if (routine?.color) return routine.color as Tone;
  const first = task.tags.map((id) => palette.tags.get(id)).find(Boolean);
  return (first?.color as Tone | undefined) ?? "stone";
}

/** "by 12:00" (that day) · "by Sun" (within the week) · "by 15 Nov" (later). */
function dueLabel(task: Task, day: LocalDate): string | null {
  if (task.dueDate === undefined) return null;
  const time = task.dueTime ? ` ${task.dueTime}` : "";
  if (task.dueDate === day) return task.dueTime ? `by ${task.dueTime}` : "by end of day";
  const ahead = diffDays(day, task.dueDate);
  if (ahead > 0 && ahead < 7) return `by ${weekday(task.dueDate)}${time}`;
  return `by ${format(parseISO(task.dueDate), "d MMM")}${time}`;
}

/** When it is, from the point of view of `day` (the Todo row's meta). */
function scheduleLabel(task: Task, day: LocalDate): string {
  const kind = taskKind(task);
  const duration = task.duration !== undefined ? formatDuration(task.duration) : null;
  if (kind === "timed") {
    // The days after its block (due later): like a floating task, "by Fri".
    if (day !== task.startDate) return [`since ${weekday(task.startDate!)}`, dueLabel(task, day)].filter(Boolean).join(" · ");
    const block = blockOf(task)!;
    const start = splitDateTime(block.start).time;
    const range = block.end ? `${start}–${splitDateTime(block.end).time}` : start;
    if (task.dueDate === undefined) return range;
    return `${range} · by ${task.dueDate === task.startDate ? (task.dueTime ?? "end of day") : `${dayShort(task.dueDate)}${task.dueTime ? ` ${task.dueTime}` : ""}`}`;
  }
  return [kind === "floating" ? dueLabel(task, day) : null, duration].filter(Boolean).join(" · ");
}

/** "done 08:52", or with the day when it was another day. */
export function doneLabel(doneAt: Moment, day: LocalDate): string {
  const { date, time } = splitDateTime(momentLocal(doneAt));
  return date === day ? `done ${time}` : `done ${dayShort(date)} ${time}`;
}

/** "Missed · 09:00" (today) or "Missed · Fri 6 Nov". */
export function missedLabel(task: Task, clock: Clock): string {
  const out = runsOutAt(task);
  if (out === null) return "Missed";
  const { date, time } = splitDateTime(out);
  const when = date === todayOf(clock) ? time : time === END_OF_DAY ? dayShort(date) : `${dayShort(date)} ${time}`;
  return `Missed · ${when}`;
}

export interface TaskView {
  task: Task;
  state: VisualState;
  glyph: string;
  tone: Tone;
  /** Right-aligned row label. */
  meta: string;
}

export function viewOf(task: Task, day: LocalDate, clock: Clock, palette: Palette): TaskView {
  const state = visualState(task, clock);
  const meta =
    state === "cancelled"
      ? "Cancelled"
      : state === "done"
        ? doneLabel(task.doneAt!, day)
        : state === "missed"
          ? missedLabel(task, clock)
          : withMoved(task, scheduleLabel(task, day));
  return { task, state, glyph: glyphOf(task.title), tone: toneOf(task, palette), meta };
}

/** A routine task moved off its own day: "… · moved from Mon". */
function withMoved(task: Task, label: string): string {
  const from = movedFrom(task);
  return from ? [label, `moved from ${weekday(from)}`].filter(Boolean).join(" · ") : label;
}

/** The task panel's line under the title: "Thu 12 Nov · 15:00–16:00 · 1h". */
export function panelLine(task: Task, clock: Clock): string {
  const kind = taskKind(task);
  const state = visualState(task, clock);
  const when =
    kind === "timed"
      ? `${dayShort(task.startDate!)} · ${scheduleLabel(task, task.startDate!)}`
      : kind === "anytime"
        ? "Anytime"
        : task.startDate !== undefined && task.dueDate !== undefined && task.dueDate !== task.startDate
          ? `${dayShort(task.startDate)} → ${dayShort(task.dueDate)}${task.dueTime ? ` ${task.dueTime}` : ""}`
          : task.startDate !== undefined
            ? `${dayShort(task.startDate)} · during the day${task.dueTime ? ` · by ${task.dueTime}` : ""}`
            : `by ${dayShort(task.dueDate!)}${task.dueTime ? ` ${task.dueTime}` : ""}`;
  const status =
    state === "done" ? doneLabel(task.doneAt!, todayOf(clock)) : state === "cancelled" ? "cancelled" : state === "missed" ? "missed" : null;
  const duration = kind !== "timed" && task.duration !== undefined ? formatDuration(task.duration) : null;
  const moved = movedFrom(task);
  return [when, duration, status, moved && `moved from ${dayShort(moved)}`].filter(Boolean).join(" · ");
}

/**
 * The task form's summary line: what the task will do, in plain words, as it's filled in
 * ("Thu 12 Nov, 07:00–10:00 · missed after 10:00"). Every fact comes from @planner/core
 * (kind, block, when its time runs out, warnings). Null while the fields don't make a valid task.
 */
export function formSummary(task: Task): { text: string; warnings: string[] } | null {
  const check = validateTask(task);
  if (check.errors.length) return null;
  const kind = taskKind(task);
  const firstDay = task.startDate ?? task.dueDate;
  const at = (dt: LocalDateTime) => {
    const { date, time } = splitDateTime(dt);
    return date === firstDay ? time : `${dayShort(date)} ${time}`;
  };
  const parts: string[] = [];

  if (kind === "anytime") parts.push("Anytime: shows today until it's done");
  else if (kind === "timed") {
    const block = blockOf(task)!;
    const start = splitDateTime(block.start).time;
    parts.push(`${dayShort(task.startDate!)}, ${block.end ? `${start}–${splitDateTime(block.end).time}` : `${start} (no end time)`}`);
    if (task.dueDate !== undefined && task.dueDate > task.startDate!) parts.push(`then during the day until ${dayShort(task.dueDate)}`);
    else if (task.dueDate !== undefined) parts.push(`deadline ${task.dueTime ?? "end of day"}`);
  } else {
    if (task.startDate !== undefined && task.dueDate !== undefined && task.dueDate > task.startDate)
      parts.push(`${dayShort(task.startDate)} → ${dayShort(task.dueDate)}, during the day`);
    else if (task.startDate !== undefined) parts.push(`${dayShort(task.startDate)}, during the day`);
    else parts.push(`From today until ${dayShort(task.dueDate!)}`);
    if (task.duration !== undefined) parts.push(`${formatDuration(task.duration)} planned`);
  }

  const out = runsOutAt(task);
  parts.push(out ? `missed after ${at(out)}` : "never missed");
  return { text: parts.join(" · "), warnings: check.warnings.map((w) => w.message) };
}

/** The copies of a count entry on one day share this key ("Water ×4"); any other task: null. */
export function countKeyOf(task: Task, palette: Palette): string | null {
  const entry = task.routineEntryId !== undefined ? palette.entries.get(task.routineEntryId) : undefined;
  const v = entry && task.occurrenceDate !== undefined ? versionOn(entry, task.occurrenceDate) : null;
  return v?.perDay.kind === "count" ? `${task.routineEntryId}/${task.occurrenceDate}` : null;
}

/**
 * "Water 2/4": a count entry's copies of one day as one item — the next copy to tick
 * stands for them, with done / total (cancelled copies don't count). `all` = every task of
 * the day, so done copies count even when they're listed elsewhere.
 */
export function groupCounts(tasks: Task[], all: Task[], palette: Palette): { task: Task; count?: { done: number; of: number } }[] {
  const seen = new Set<string>();
  const out: { task: Task; count?: { done: number; of: number } }[] = [];
  for (const t of tasks) {
    const key = countKeyOf(t, palette);
    if (key === null) {
      out.push({ task: t });
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const copies = all.filter((x) => countKeyOf(x, palette) === key).sort((a, b) => a.occurrenceSlot! - b.occurrenceSlot!);
    const { done, total } = countProgress(copies);
    out.push({ task: nextCopyToTick(copies) ?? t, count: { done, of: total } });
  }
  return out;
}
