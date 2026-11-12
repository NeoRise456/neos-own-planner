/**
 * The Calendar (TASK.md "Decided while building the Calendar"): which tasks a day shows,
 * and where. Only dated tasks are on the calendar; anytime tasks live in Todo.
 *
 * - **Blocks**: timed tasks on their start day, from the start time for their duration
 *   (no duration → a short block). Blocks that overlap sit side by side in lanes.
 * - **Deadlines**: a task due that day, unless it starts that same day (then it's a block,
 *   or "during the day, by 12:00").
 * - **During the day**: floating tasks that show that day, as in Todo, except on
 *   their due day, where they are a deadline instead. A timed task due on a later day
 *   is its block on its start day, then "during the day" until its deadline.
 */
import { type LocalDate, addDays, splitDateTime, timeToMinutes } from "./dates";
import { type Task, blockOf, dueOf, taskKind } from "./task";
import { showsOn } from "./todo";

/** How tall a block without a duration is drawn, in minutes. */
export const NO_DURATION_MINUTES = 30;
const DAY_MINUTES = 24 * 60;

export interface CalendarBlock {
  task: Task;
  /** Minutes from midnight. A block never runs past midnight (crossing midnight isn't supported). */
  start: number;
  end: number;
  hasDuration: boolean;
  /** Side by side with the blocks it overlaps: lane `lane` of `lanes`. */
  lane: number;
  lanes: number;
}

export interface CalendarDay {
  day: LocalDate;
  blocks: CalendarBlock[];
  /** By due time; a due date without a time sorts last (end of day). */
  deadlines: Task[];
  during: Task[];
}

/** One day of the calendar. `tasks` may hold tasks of any day; the ones that don't show are left out. */
export function calendarDay(tasks: Task[], day: LocalDate, today: LocalDate): CalendarDay {
  const raw: Omit<CalendarBlock, "lane" | "lanes">[] = [];
  const deadlines: Task[] = [];
  const during: Task[] = [];

  for (const task of tasks) {
    const kind = taskKind(task);
    if (kind === "anytime") continue;
    const isBlockToday = kind === "timed" && task.startDate === day;
    if (isBlockToday) {
      const b = blockOf(task)!;
      const start = timeToMinutes(splitDateTime(b.start).time);
      const fullEnd = b.end ? start + (task.duration ?? 0) : start + NO_DURATION_MINUTES;
      raw.push({ task, start, end: Math.min(Math.max(fullEnd, start + 1), DAY_MINUTES), hasDuration: b.end !== null });
    }
    // A deadline ends something: a due date on its own, or the last day of a span. Due the
    // same day it starts ("Vitamins, by 12:00") is just "during the day, by 12:00".
    if (task.dueDate === day && !isBlockToday && task.startDate !== day) deadlines.push(task);
    // Floating — or timed, on the days after its block until the deadline.
    else if (!isBlockToday && showsOn(task, day, today)) during.push(task);
  }

  deadlines.sort((a, b) => dueOf(a)!.localeCompare(dueOf(b)!));
  return { day, blocks: layoutBlocks(raw), deadlines, during };
}

/** Seven days from `monday`. */
export function calendarWeek(tasks: Task[], monday: LocalDate, today: LocalDate): CalendarDay[] {
  return Array.from({ length: 7 }, (_, i) => calendarDay(tasks, addDays(monday, i), today));
}

/**
 * Lanes for overlapping blocks: blocks are taken by start (longer first on a tie); each
 * goes in the first lane that is free by its start. A group of blocks that overlap one
 * another (directly or through others) shares one lane count.
 */
export function layoutBlocks(blocks: Omit<CalendarBlock, "lane" | "lanes">[]): CalendarBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: CalendarBlock[] = [];
  let group: CalendarBlock[] = [];
  let laneEnds: number[] = [];
  let groupEnd = -1;

  const closeGroup = () => {
    for (const b of group) b.lanes = laneEnds.length;
    group = [];
    laneEnds = [];
  };

  for (const b of sorted) {
    if (b.start >= groupEnd) closeGroup();
    let lane = laneEnds.findIndex((end) => end <= b.start);
    if (lane === -1) lane = laneEnds.push(0) - 1;
    laneEnds[lane] = b.end;
    const placed: CalendarBlock = { ...b, lane, lanes: 1 };
    group.push(placed);
    out.push(placed);
    groupEnd = Math.max(groupEnd, b.end);
  }
  closeGroup();
  return out;
}

/** Where a click in the grid lands: minutes from midnight, rounded down to `step`. */
export function slotAt(minutes: number, step = 30): number {
  const m = Math.max(0, Math.min(DAY_MINUTES - step, minutes));
  return Math.floor(m / step) * step;
}
