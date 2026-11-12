/**
 * Repetition rules — SYSTEMS.md, "Question 3: matching the rule". Our own code, no RRULE.
 * "Every N" counts from the routine's start date (the anchor).
 */
import { type LocalDate, daysInMonth, diffDays, isoWeekday, mondayOf, parseDate } from "./dates";
import { type Issue, issue } from "./result";

export type Rule =
  | { freq: "daily"; interval: number }
  /** weekdays: 1 = Mon … 7 = Sun */
  | { freq: "weekly"; interval: number; weekdays: number[] }
  /** "the 1st" … "the 31st" (→ the last day in shorter months) */
  | { freq: "monthly"; interval: number; by: "day"; day: number }
  /** "the 2nd Tuesday", "the last Friday" (n = -1) */
  | { freq: "monthly"; interval: number; by: "weekday"; n: 1 | 2 | 3 | 4 | -1; weekday: number }
  /** "14 March" (29 Feb → 28 Feb in other years) */
  | { freq: "yearly"; interval: number; month: number; day: number };

/** Does `day` match the rule, counting "every N" from `anchor` (the routine's start)? */
export function matchesRule(rule: Rule, day: LocalDate, anchor: LocalDate): boolean {
  if (day < anchor) return false;
  const d = parseDate(day);
  const a = parseDate(anchor);

  switch (rule.freq) {
    case "daily":
      return diffDays(anchor, day) % rule.interval === 0;

    case "weekly": {
      if (!rule.weekdays.includes(isoWeekday(day))) return false;
      const weeks = diffDays(mondayOf(anchor), mondayOf(day)) / 7;
      return weeks % rule.interval === 0;
    }

    case "monthly": {
      const months = (d.year - a.year) * 12 + (d.month - a.month);
      if (months % rule.interval !== 0) return false;
      const last = daysInMonth(d.year, d.month);
      if (rule.by === "day") return d.day === Math.min(rule.day, last);
      if (isoWeekday(day) !== rule.weekday) return false;
      return rule.n === -1 ? d.day + 7 > last : Math.ceil(d.day / 7) === rule.n;
    }

    case "yearly": {
      if ((d.year - a.year) % rule.interval !== 0) return false;
      if (d.month !== rule.month) return false;
      return d.day === Math.min(rule.day, daysInMonth(d.year, d.month));
    }
  }
}

export function validateRule(rule: Rule): Issue[] {
  const errors: Issue[] = [];
  if (!Number.isInteger(rule.interval) || rule.interval < 1) {
    errors.push(issue("interval_min", "The interval must be 1 or more.", "interval"));
  }
  const isWeekday = (n: number) => Number.isInteger(n) && n >= 1 && n <= 7;

  switch (rule.freq) {
    case "daily":
      break;
    case "weekly":
      if (rule.weekdays.length === 0) {
        errors.push(issue("weekdays_required", "Weekly needs at least one day.", "weekdays"));
      } else if (!rule.weekdays.every(isWeekday)) {
        errors.push(issue("weekday_invalid", "Days are 1 (Mon) to 7 (Sun).", "weekdays"));
      } else if (new Set(rule.weekdays).size !== rule.weekdays.length) {
        errors.push(issue("weekdays_duplicate", "A day can only be picked once.", "weekdays"));
      }
      break;
    case "monthly":
      if (rule.by === "day") {
        if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > 31) {
          errors.push(issue("month_day_invalid", "The day of the month is 1 to 31.", "day"));
        }
      } else {
        if (![1, 2, 3, 4, -1].includes(rule.n)) {
          errors.push(issue("nth_invalid", "Pick the 1st, 2nd, 3rd, 4th or last.", "n"));
        }
        if (!isWeekday(rule.weekday)) errors.push(issue("weekday_invalid", "Days are 1 (Mon) to 7 (Sun).", "weekday"));
      }
      break;
    case "yearly":
      if (!Number.isInteger(rule.month) || rule.month < 1 || rule.month > 12) {
        errors.push(issue("month_invalid", "The month is 1 to 12.", "month"));
      } else if (!Number.isInteger(rule.day) || rule.day < 1 || rule.day > daysInMonth(2024, rule.month)) {
        // 2024 is a leap year, so 29 Feb is allowed (it falls on 28 Feb in other years).
        errors.push(issue("year_day_invalid", "That day doesn't exist in that month.", "day"));
      }
      break;
  }
  return errors;
}
