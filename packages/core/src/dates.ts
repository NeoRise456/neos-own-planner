/**
 * Dates, times and moments as plain text — no time zones, no Date objects in the rules.
 *
 * - LocalDate      "2026-11-09"            a day on your calendar
 * - LocalTime      "18:00"                 a time on your clock
 * - LocalDateTime  "2026-11-09T18:00"      both (sorts correctly as text)
 * - Moment         "2026-11-09T18:00+01:00" an exact moment: local time + the UTC offset in use
 *
 * Tasks' dates and times are local (TASK.md). "Now" comes from the time-zone setting:
 * a UTC offset, so the same instant gives a different local date/time per offset.
 * Day arithmetic goes through day numbers (days since 1970-01-01), so there's no DST
 * or machine-time-zone involved.
 */

export type LocalDate = string;
export type LocalTime = string;
export type LocalDateTime = string;
export type Moment = string;
/** Minutes east of UTC: +60 = UTC+01:00, -300 = UTC-05:00. */
export type OffsetMinutes = number;

/** The last minute of a day — when a date-only task's time runs out (PLAN.md). */
export const END_OF_DAY: LocalTime = "23:59";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const OFFSET_RE = /^([+-])(\d{2}):(\d{2})$/;
const MOMENT_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})([+-]\d{2}:\d{2})$/;
const MS_PER_DAY = 86_400_000;

// ── Validation ───────────────────────────────────────────────────────────

export function isLocalDate(value: unknown): value is LocalDate {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function isLocalTime(value: unknown): value is LocalTime {
  return typeof value === "string" && TIME_RE.test(value);
}

export function isMoment(value: unknown): value is Moment {
  if (typeof value !== "string") return false;
  const m = MOMENT_RE.exec(value);
  return !!m && isLocalDate(m[1]) && isLocalTime(m[2]) && parseOffset(m[3]!) !== null;
}

/** UTC−12:00 … UTC+14:00, the range real zones use. */
export function isValidOffset(offset: unknown): offset is OffsetMinutes {
  return typeof offset === "number" && Number.isInteger(offset) && offset >= -720 && offset <= 840;
}

// ── Calendar ─────────────────────────────────────────────────────────────

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** month: 1–12 */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseDate(date: LocalDate): { year: number; month: number; day: number } {
  const m = DATE_RE.exec(date);
  if (!m) throw new Error(`Not a date: ${date}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

export function makeDate(year: number, month: number, day: number): LocalDate {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

/** Days since 1970-01-01. */
export function dayNumber(date: LocalDate): number {
  const { year, month, day } = parseDate(date);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

export function fromDayNumber(n: number): LocalDate {
  const d = new Date(n * MS_PER_DAY);
  return makeDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromDayNumber(dayNumber(date) + days);
}

/** b − a in days. */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** 1 = Monday … 7 = Sunday (SYSTEMS.md). */
export function isoWeekday(date: LocalDate): number {
  const d = new Date(dayNumber(date) * MS_PER_DAY).getUTCDay(); // 0 = Sunday
  return d === 0 ? 7 : d;
}

/** The Monday of the date's week. */
export function mondayOf(date: LocalDate): LocalDate {
  return addDays(date, 1 - isoWeekday(date));
}

/** Every day from `from` to `to`, both included. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  for (let n = dayNumber(from), end = dayNumber(to); n <= end; n++) days.push(fromDayNumber(n));
  return days;
}

export function minDate(a: LocalDate, b: LocalDate): LocalDate {
  return a <= b ? a : b;
}

export function maxDate(a: LocalDate, b: LocalDate): LocalDate {
  return a >= b ? a : b;
}

export function clampDate(date: LocalDate, from: LocalDate, to: LocalDate): LocalDate {
  return minDate(maxDate(date, from), to);
}

// ── Times ────────────────────────────────────────────────────────────────

export function timeToMinutes(time: LocalTime): number {
  const m = TIME_RE.exec(time);
  if (!m) throw new Error(`Not a time: ${time}`);
  return Number(m[1]) * 60 + Number(m[2]);
}

export function minutesToTime(minutes: number): LocalTime {
  return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
}

/**
 * A time as people type it → "HH:MM", or null if it can't be read:
 * "18:30", "1830", "930", "18", "9.15", "6pm", "6:30 pm", "12am" (= 00:00).
 */
export function parseTimeInput(text: string): LocalTime | null {
  const m = /^(\d{1,2})(?:[:.h]?(\d{2}))?(am|pm|a|p)?$/.exec(text.trim().toLowerCase().replace(/\s+/g, ""));
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = m[2] !== undefined ? Number(m[2]) : 0;
  const half = m[3]?.[0];
  if (half !== undefined) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (half === "p" ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return null;
  return minutesToTime(hour * 60 + minute);
}

export function dateTime(date: LocalDate, time: LocalTime): LocalDateTime {
  return `${date}T${time}`;
}

export function splitDateTime(dt: LocalDateTime): { date: LocalDate; time: LocalTime } {
  return { date: dt.slice(0, 10), time: dt.slice(11, 16) };
}

/** Adds minutes, rolling over into the next days if needed. */
export function addMinutes(dt: LocalDateTime, minutes: number): LocalDateTime {
  const { date, time } = splitDateTime(dt);
  const total = timeToMinutes(time) + minutes;
  const days = Math.floor(total / 1440);
  return dateTime(addDays(date, days), minutesToTime(total - days * 1440));
}

// ── Moments & "now" ──────────────────────────────────────────────────────

export function formatOffset(offset: OffsetMinutes): string {
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

export function parseOffset(text: string): OffsetMinutes | null {
  const m = OFFSET_RE.exec(text);
  if (!m) return null;
  const value = (Number(m[2]) * 60 + Number(m[3])) * (m[1] === "-" ? -1 : 1);
  return isValidOffset(value) ? value : null;
}

export function toMoment(dt: LocalDateTime, offset: OffsetMinutes): Moment {
  return `${dt}${formatOffset(offset)}`;
}

/** The local date/time part, as it was written. */
export function momentLocal(moment: Moment): LocalDateTime {
  return moment.slice(0, 16);
}

/** The local day a moment happened on (with the offset in use then). */
export function momentDate(moment: Moment): LocalDate {
  return moment.slice(0, 10);
}

/** Milliseconds since the epoch — for ordering moments written with different offsets. */
export function momentToEpoch(moment: Moment): number {
  const m = MOMENT_RE.exec(moment);
  if (!m) throw new Error(`Not a moment: ${moment}`);
  const offset = parseOffset(m[3]!)!;
  return (dayNumber(m[1]!) * 1440 + timeToMinutes(m[2]!) - offset) * 60_000;
}

/**
 * "Now" for the rules: the local date/time in the chosen offset, plus that offset so
 * ticking can write a Moment. Build it with `clockAt(new Date(), settings.offset)`.
 */
export interface Clock {
  at: LocalDateTime;
  offset: OffsetMinutes;
}

export function clockAt(instant: Date | number, offset: OffsetMinutes): Clock {
  const ms = typeof instant === "number" ? instant : instant.getTime();
  const local = new Date(ms + offset * 60_000);
  const date = makeDate(local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate());
  const time = `${pad2(local.getUTCHours())}:${pad2(local.getUTCMinutes())}`;
  return { at: dateTime(date, time), offset };
}

export function todayOf(clock: Clock): LocalDate {
  return clock.at.slice(0, 10);
}

export function nowMoment(clock: Clock): Moment {
  return toMoment(clock.at, clock.offset);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
