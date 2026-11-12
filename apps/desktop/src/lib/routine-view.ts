/**
 * How a routine and its entries read ("Mon, Wed, Fri · 18:00 · 1h · Gym warm-up",
 * "Active · 21 days left"). Display only: status, matching days and versions come from
 * @planner/core; date-fns just formats them.
 */
import { format, parseISO } from "date-fns";
import {
  type EntryBlueprint,
  type LocalDate,
  type Protocol,
  type Routine,
  type RoutineStatus,
  type Rule,
  addDays,
  diffDays,
  endTimeOf,
  formatDuration,
  matchesRule,
  maxDate,
  slotDuration,
} from "@planner/core";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NTH = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", [-1]: "last" } as Record<number, string>;

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;
const every = (n: number, unit: string) => (n === 1 ? "" : `Every ${n} ${unit}s · `);

/** "Mon, Wed, Fri" · "Daily" · "Every 2 weeks · Mon" · "Monthly · the 1st" · "Monthly · last Fri" · "Yearly · 14 March". */
export function ruleLabel(rule: Rule): string {
  switch (rule.freq) {
    case "daily":
      return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
    case "weekly": {
      const days = [...rule.weekdays].sort().map((d) => WEEKDAY_SHORT[d - 1]).join(", ");
      return `${every(rule.interval, "week")}${rule.weekdays.length === 7 ? "Every day" : days}`;
    }
    case "monthly":
      return `${rule.interval === 1 ? "Monthly" : `Every ${rule.interval} months`} · ${
        rule.by === "day" ? `the ${ordinal(rule.day)}` : `${NTH[rule.n]} ${WEEKDAY_SHORT[rule.weekday - 1]}`
      }`;
    case "yearly":
      return `${rule.interval === 1 ? "Yearly" : `Every ${rule.interval} years`} · ${rule.day} ${MONTHS[rule.month - 1]}`;
  }
}

/** The whole entry on one line: when · times or count · length · protocol. */
export function entryLabel(b: EntryBlueprint, protocols: Map<string, Protocol>): string {
  const perDay =
    b.perDay.kind === "count"
      ? `${b.perDay.count} times${b.perDay.dueTime ? ` · by ${b.perDay.dueTime}` : ""}`
      : b.perDay.times
          .map((t) => {
            // "18:00–19:00", "18:00", "20m" (sometime that day), then "by 19:30".
            const len = slotDuration(b, t);
            const when = t.startTime ? (len !== undefined ? `${t.startTime}–${endTimeOf(t.startTime, len)}` : t.startTime) : len !== undefined ? formatDuration(len) : "";
            return [when, t.dueTime ? `by ${t.dueTime}` : ""].filter(Boolean).join(" ");
          })
          .filter(Boolean)
          .join(" / ");
  const countLength = b.perDay.kind === "count" && b.duration !== undefined ? `${formatDuration(b.duration)} each` : null;
  return [ruleLabel(b.rule), perDay, countLength, b.protocolId ? protocols.get(b.protocolId)?.title : null]
    .filter(Boolean)
    .join(" · ");
}

const short = (d: LocalDate, today: LocalDate) => format(parseISO(d), d.slice(0, 4) === today.slice(0, 4) ? "d MMM" : "d MMM yyyy");

/** "1 Sep → 30 Nov" (years only when not this year). */
export function periodLabel(r: Pick<Routine, "startDate" | "endDate">, today: LocalDate): string {
  return `${short(r.startDate, today)} → ${short(r.endDate, today)}`;
}

/** "Draft" · "Starts 1 Dec" · "Active · 21 days left" · "Ends today" · "Ended 20 Nov". */
export function statusLabel(r: Routine, status: RoutineStatus, today: LocalDate): string {
  if (status === "draft") return "Draft";
  if (status === "upcoming") return `Starts ${short(r.startDate, today)}`;
  if (status === "ended") return `Ended ${short(r.endDate, today)}`;
  const left = diffDays(today, r.endDate);
  return left === 0 ? "Active · ends today" : `Active · ${left} ${left === 1 ? "day" : "days"} left`;
}

/** The next `n` days the rule lands on, from `from` (or the routine's start) to its end. */
export function nextDays(rule: Rule, r: Pick<Routine, "startDate" | "endDate">, from: LocalDate, n = 3): LocalDate[] {
  const out: LocalDate[] = [];
  let d = maxDate(from, r.startDate);
  for (let i = 0; i < 800 && out.length < n && d <= r.endDate; i++, d = addDays(d, 1)) {
    if (matchesRule(rule, d, r.startDate)) out.push(d);
  }
  return out;
}
