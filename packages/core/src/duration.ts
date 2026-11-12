import { type LocalTime, minutesToTime, timeToMinutes } from "./dates";

/**
 * Durations as people type them in the task form ("20m", "1h", "1h 30m", "1.5h", "90")
 * ↔ whole minutes, which is what a task stores.
 */

/** Minutes, or null when it can't be read. A plain number means minutes. */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, "");
  if (s === "") return null;
  if (/^\d+$/.test(s)) return positive(Number(s));
  const m = /^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+)(?:m|min)?)?$/.exec(s);
  if (!m || (m[1] === undefined && m[2] === undefined)) return null;
  // "1h30" reads as 1h 30m; a lone "30" was handled above.
  const hours = m[1] !== undefined ? Number(m[1].replace(",", ".")) : 0;
  const minutes = m[2] !== undefined ? Number(m[2]) : 0;
  return positive(Math.round(hours * 60 + minutes));
}

function positive(n: number): number | null {
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The task form shows a timed task's length as an end time (TASK.md, phase 4).
 * The end of `start` + `minutes`; a block never runs past midnight, so it stops at 23:59.
 */
export function endTimeOf(start: LocalTime, minutes: number): LocalTime {
  return minutesToTime(Math.min(timeToMinutes(start) + minutes, 23 * 60 + 59));
}

/** Minutes from `start` to `end` on the same day; null when the end isn't after the start. */
export function minutesBetween(start: LocalTime, end: LocalTime): number | null {
  const m = timeToMinutes(end) - timeToMinutes(start);
  return m > 0 ? m : null;
}

/** 20 → "20m", 60 → "1h", 90 → "1h 30m". */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
