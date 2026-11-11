/**
 * MOCK DATA — copied from the design screens (design/screens/*.dc.html).
 *
 * These are *view* shapes for the UI (already-worked-out labels like "09:00–11:00"),
 * not the real domain model. When the data layer exists (PLAN.md phase 2),
 * this folder goes away and the screens read from repositories + TanStack Query,
 * with all rules coming from @planner/core.
 */
import type { Tone } from "@/lib/tones";

export type TodoSection = "missed" | "scheduled" | "day" | "anytime";

export interface MockTask {
  id: string;
  title: string;
  glyph: string;
  tone: Tone;
  section: TodoSection;
  /** Right-aligned meta: "09:00–11:00", "by 12:00", "Fri 6 Nov"… */
  meta: string;
  done: boolean;
  /** Meta shown once done: "done 08:52". */
  doneMeta?: string;
  cancelled: boolean;
  /** Count tasks ("Water ×4"): copies done / total. */
  count?: { done: number; of: number };
  /** Routine name, or "One-off". */
  group: string;
  routineId?: string;
  protocolId?: string;
  duration?: string;
  notes?: string;
}

export interface MockEntry {
  id: string;
  title: string;
  glyph: string;
  tone?: Tone;
  rule: string;
  /** One char per recent occurrence: d = done, m = missed. */
  seq: string;
  score: string;
}

export interface MockRoutine {
  id: string;
  name: string;
  glyph: string;
  tone: Tone;
  purpose: string;
  period: string;
  status: string;
  ended?: boolean;
  pct: number;
  pctLabel: string;
  entries: MockEntry[];
}

export interface MockProtocol {
  id: string;
  title: string;
  glyph: string;
  tone: Tone;
  used: { label: string; kind: string; tone: Tone; routineId: string }[];
  steps: string[];
}

export interface MockEvent {
  id: string;
  /** 0 = Monday … 6 = Sunday */
  weekday: number;
  start: number;
  end: number;
  title: string;
  glyph: string;
  tone: Tone;
  /** Only in the reference week (one-offs, and what was already done). */
  refWeekOnly?: boolean;
  doneInRefWeek?: boolean;
}

export const TASKS: MockTask[] = [
  { id: "a", title: "Reply to email", glyph: "Re", tone: "lilac", section: "missed", meta: "Fri 6 Nov", done: false, cancelled: false, group: "One-off", duration: "5m" },
  { id: "b", title: "Morning exercise", glyph: "Mo", tone: "moss", section: "scheduled", meta: "08:00 · due 09:00", done: true, doneMeta: "done 08:52", cancelled: false, group: "Exercise plan", routineId: "exercise" },
  { id: "c", title: "Calculus (Mon)", glyph: "Ca", tone: "stone", section: "scheduled", meta: "09:00–11:00", done: false, cancelled: false, group: "Uni — Term 1", routineId: "uni", duration: "2h" },
  { id: "d", title: "Gym", glyph: "Gy", tone: "moss", section: "scheduled", meta: "18:00–19:00", done: false, cancelled: false, group: "Exercise plan", routineId: "exercise", protocolId: "gym", duration: "1h", notes: "Leg day on Fri" },
  { id: "e", title: "Vitamins", glyph: "Vi", tone: "sand", section: "day", meta: "by 12:00", done: false, cancelled: false, group: "Morning routine", routineId: "morning" },
  { id: "f", title: "Water", glyph: "Wa", tone: "rose", section: "day", meta: "", done: false, cancelled: false, count: { done: 2, of: 4 }, group: "Morning routine", routineId: "morning" },
  { id: "g", title: "Shower", glyph: "Sh", tone: "sand", section: "day", meta: "20m", done: false, cancelled: false, group: "Morning routine", routineId: "morning", protocolId: "shower", duration: "20m" },
  { id: "h", title: "Call mom", glyph: "Ca", tone: "rose", section: "day", meta: "by Sun", done: false, cancelled: false, group: "One-off" },
  { id: "i", title: "Buy milk", glyph: "Bu", tone: "sea", section: "anytime", meta: "", done: false, cancelled: false, group: "One-off" },
];

export const SECTION_NAMES: Record<TodoSection, string> = {
  missed: "Missed",
  scheduled: "Scheduled",
  day: "During the day",
  anytime: "Anytime",
};
export const SECTION_NOTES: Record<TodoSection, string> = {
  missed: "still tickable",
  scheduled: "3h",
  day: "20m + 4 untimed",
  anytime: "no date",
};
export const DAY_SUMMARY = "Scheduled 3h · During the day 20m · +4 untimed";

export const ROUTINES: MockRoutine[] = [
  {
    id: "exercise", name: "Exercise plan", glyph: "Ex", tone: "moss", purpose: "Get stronger and have more energy",
    period: "Sep 1 → Nov 30", status: "Active · 21 days left", pct: 91, pctLabel: "10 of 11 done in November",
    entries: [
      { id: "e1", title: "Morning exercise", glyph: "Mo", rule: "Daily · 08:00 · due 09:00", seq: "dddddmdd", score: "7/8" },
      { id: "e2", title: "Gym", glyph: "Gy", rule: "Mon, Wed, Fri · 18:00 · 1h · Gym warm-up", seq: "ddd", score: "3/3" },
    ],
  },
  {
    id: "morning", name: "Morning routine", glyph: "Mo", tone: "sand", purpose: "Start the day ready",
    period: "Nov 1 → Jan 31", status: "Active · 83 days left", pct: 85, pctLabel: "41 of 48 done in November",
    entries: [
      { id: "e3", title: "Shower", glyph: "Sh", rule: "Daily · 20m · Shower", seq: "dddddddd", score: "8/8" },
      { id: "e4", title: "Vitamins", glyph: "Vi", rule: "Daily · by 12:00", seq: "ddmddddd", score: "7/8" },
      { id: "e5", title: "Water", glyph: "Wa", rule: "Daily · 4 times", seq: "ddmdddmd", score: "26/32", tone: "rose" },
    ],
  },
  {
    id: "uni", name: "Uni — Term 1", glyph: "Un", tone: "sky", purpose: "Pass the term",
    period: "Sep 8 → Jan 23", status: "Active · 75 days left", pct: 100, pctLabel: "3 of 3 done in November",
    entries: [
      { id: "e6", title: "Calculus (Mon)", glyph: "Ca", rule: "Mon · 09:00 · 2h", seq: "d", score: "1/1", tone: "stone" },
      { id: "e7", title: "Physics (Tue)", glyph: "Ph", rule: "Tue · 11:00 · 2h", seq: "d", score: "1/1" },
      { id: "e8", title: "Calculus (Thu)", glyph: "Ca", rule: "Thu · 16:00 · 2h", seq: "d", score: "1/1", tone: "stone" },
    ],
  },
  {
    id: "spring", name: "Exercise — spring", glyph: "Ex", tone: "moss", purpose: "Get back in shape",
    period: "Mar 1 → May 31", status: "Ended", ended: true, pct: 71, pctLabel: "64 of 90 done over the whole period",
    entries: [
      { id: "e9", title: "Morning exercise", glyph: "Mo", rule: "Daily · 08:00 · due 09:00", seq: "ddmdmddmddmdddmd", score: "41/62" },
      { id: "e10", title: "Gym", glyph: "Gy", rule: "Mon, Wed, Fri · 18:00 · 1h · Gym warm-up", seq: "dddmddddmddd", score: "23/28" },
    ],
  },
];

const SHOWER_STEPS = [
  "Get the drier and clothes, go to the bathroom",
  "Turn on the warm water, wait 2 min",
  "Open the shower, make sure the temperature is right",
  "Pick a playlist (≈ 4 songs) or a video if washing hair",
  "Wet hair",
  "Shampoo if needed",
  "Rinse head again",
  "Soap body, rinse body",
  "Wash genitals, butt, ears and neck",
  "Face cleanser for 2 min",
  "Rinse full body again",
  "Close the shower, apply leave-in conditioner",
  "Dry body with the towel, then dry ears",
  "Put on headphones, pick a 10 min video, dry hair",
  "Get dressed",
  "Dirty clothes in the bin, drier back in its place",
];

export const PROTOCOLS: MockProtocol[] = [
  { id: "shower", title: "Shower", glyph: "Sh", tone: "sand", used: [{ label: "Shower", kind: "Morning routine", tone: "sand", routineId: "morning" }], steps: SHOWER_STEPS },
  { id: "gym", title: "Gym warm-up", glyph: "Gy", tone: "moss", used: [{ label: "Gym", kind: "Exercise plan", tone: "moss", routineId: "exercise" }], steps: ["5 min easy bike", "Hip circles and leg swings", "Empty bar, 2 × 10", "One light set per lift"] },
];

/** Calendar week (screens/20-calendar-week). Reference week = the week of Mon 9 Nov 2026. */
export const REF_WEEK_MONDAY = new Date(2026, 10, 9);

export const EVENTS: MockEvent[] = [
  { id: "m0", weekday: 0, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss", doneInRefWeek: true },
  { id: "c0", weekday: 0, start: 9, end: 11, title: "Calculus (Mon)", glyph: "Ca", tone: "stone" },
  { id: "g0", weekday: 0, start: 18, end: 19, title: "Gym", glyph: "Gy", tone: "moss" },
  { id: "m1", weekday: 1, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
  { id: "p1", weekday: 1, start: 11, end: 13, title: "Physics (Tue)", glyph: "Ph", tone: "sky" },
  { id: "m2", weekday: 2, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
  { id: "g2", weekday: 2, start: 18, end: 19, title: "Gym", glyph: "Gy", tone: "moss" },
  { id: "m3", weekday: 3, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
  { id: "d3", weekday: 3, start: 15, end: 16, title: "Dentist", glyph: "De", tone: "sea", refWeekOnly: true },
  { id: "c3", weekday: 3, start: 16, end: 18, title: "Calculus (Thu)", glyph: "Ca", tone: "stone" },
  { id: "m4", weekday: 4, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
  { id: "g4", weekday: 4, start: 18, end: 19, title: "Gym", glyph: "Gy", tone: "moss" },
  { id: "m5", weekday: 5, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
  { id: "m6", weekday: 6, start: 8, end: 8.5, title: "Morning exercise", glyph: "Mo", tone: "moss" },
];

/** Deadline chip on Friday of the reference week. */
export const DEADLINE = { weekday: 4, title: "Finish essay", time: "23:59" };
