/**
 * The Calendar (TASK.md "Decided while building the Calendar"): which tasks a day shows,
 * and where. Only dated tasks are on the calendar; anytime tasks live in Todo.
 *
 * - **Blocks**: timed tasks on their start day, from the start time for their duration
 *   (no duration → a short block). Overlapping blocks nest (`nestBlocks`): one that starts
 *   inside another sits on top of it, shifted right; ones that start together go side by side.
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
 * Lanes for overlapping blocks (the calendar nests overlaps instead, see `nestBlocks`;
 * lanes stay for anything that wants plain columns): blocks are taken by start
 * (longer first on a tie, and a cancelled one before a live one); each
 * goes in the first lane that is free by its start. A group of blocks that overlap one
 * another (directly or through others) shares one lane count.
 */
export function layoutBlocks(blocks: Omit<CalendarBlock, "lane" | "lanes">[]): CalendarBlock[] {
  const live = (b: { task: Task }) => (b.task.cancelledAt === undefined ? 1 : 0);
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end || live(a) - live(b));
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

/** A block placed for the nested layout. */
export interface NestedBlock extends CalendarBlock {
  /** How many blocks it sits inside (0 = full width). */
  depth: number;
  /** Side by side with the blocks that start (almost) together with it: column `col` of `cols`. */
  col: number;
  cols: number;
}

/** Blocks that start within this many minutes of each other go side by side, not nested. */
export const SIDE_BY_SIDE_MINUTES = 20;

/**
 * The nested layout (TASK.md "Overlapping tasks"), like Google Calendar's:
 * - a block that starts inside a longer one sits **on top of it, shifted right**
 *   (depth = one more than the deepest block still running at its start), so the long one's
 *   title and left edge stay visible and every block keeps its own look;
 * - blocks that start within SIDE_BY_SIDE_MINUTES of a running block **and are about as long**
 *   (at least half its length) go **side by side** with it (same depth, the width split in
 *   columns). A short one starting with a long one nests on it instead, so the long one keeps
 *   the whole column ("check food 12:00" on "Recuperación 12:00–14:00").
 * Blocks go by start, longer first. Lay out live and cancelled blocks separately: cancelled
 * ones are drawn behind and take no room from live ones.
 */
export function nestBlocks(blocks: CalendarBlock[]): NestedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.start - b.start || b.end - a.end || a.task.title.localeCompare(b.task.title));
  const out: NestedBlock[] = [];
  /** Blocks that start together share a row: same depth, one column each. */
  const rowOf = new Map<NestedBlock, NestedBlock[]>();
  for (const b of sorted) {
    const running = out.filter((p) => p.end > b.start);
    const partner = running.find((p) => b.start - p.start < SIDE_BY_SIDE_MINUTES && (b.end - b.start) * 2 >= p.end - p.start);
    let placed: NestedBlock;
    if (partner) {
      const row = rowOf.get(partner)!;
      placed = { ...b, depth: partner.depth, col: row.length, cols: 1 };
      row.push(placed);
      rowOf.set(placed, row);
    } else {
      placed = { ...b, depth: running.length ? Math.max(...running.map((p) => p.depth)) + 1 : 0, col: 0, cols: 1 };
      rowOf.set(placed, [placed]);
    }
    out.push(placed);
  }
  for (const p of out) p.cols = rowOf.get(p)!.length;
  return out;
}

/** How far in a nested block sits, as a share of its day's width: 0, 40%, 64%… (each level takes 40% of what's left). */
export const nestIndent = (depth: number): number => 1 - Math.pow(0.6, depth);

/** A block narrower than this share of a normal day column is too narrow to read its title. */
export const READABLE_SHARE = 0.5;
/** A crowded day grows to at most this many normal day widths. */
export const MAX_DAY_WIDTH = 2;

/**
 * How wide a day is in the week, in normal day widths (TASK.md "Overlapping tasks"): 1, unless
 * its narrowest block (nested and/or side by side) would be under READABLE_SHARE of a normal
 * column; then the day grows until it isn't, up to MAX_DAY_WIDTH. The other days give up the room.
 */
export function dayWidth(blocks: NestedBlock[]): number {
  const narrowest = Math.min(1, ...blocks.map((b) => (1 - nestIndent(b.depth)) / b.cols));
  return Math.round(Math.min(MAX_DAY_WIDTH, Math.max(1, READABLE_SHARE / narrowest)) * 100) / 100;
}

/** Where a click in the grid lands: minutes from midnight, rounded down to `step`. */
export function slotAt(minutes: number, step = 30): number {
  const m = Math.max(0, Math.min(DAY_MINUTES - step, minutes));
  return Math.floor(m / step) * step;
}
