/**
 * MOCK DATA — copied from the design screens (design/screens/*.dc.html), for the
 * screens not on real data yet: routines, protocols, calendar.
 *
 * These are *view* shapes for the UI (already-worked-out labels like "Daily · 08:00"),
 * not the real domain model. Tasks left this folder in phase 2 (they're in the
 * database now); routines and protocols follow in phase 5.
 */
import type { Tone } from "@/lib/tones";

export interface MockEntry {
  id: string;
  title: string;
  glyph: string;
  tone?: Tone;
  rule: string;
  /** One char per recent occurrence: d = done, m = missed. */
  seq: string;
  score: string;
  /** The protocol its tasks get (kept in sync with MockProtocol.used). */
  protocolId?: string;
}

export interface MockRoutine {
  id: string;
  name: string;
  glyph: string;
  tone: Tone;
  purpose: string;
  period: string;
  status: string;
  /** Not published yet: no tasks, edit freely (SYSTEMS.md "Draft → publish"). */
  draft?: boolean;
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
  /**
   * Where routines use it: `label` = the entry, `kind` = the routine. `past` = only an
   * older version used it (history). The status comes from the routines — see protocolStatusOf.
   */
  used: { label: string; kind: string; tone: Tone; routineId: string; entryId: string; past?: boolean }[];
  steps: string[];
}

export const ROUTINES: MockRoutine[] = [
  {
    id: "exercise", name: "Exercise plan", glyph: "Ex", tone: "moss", purpose: "Get stronger and have more energy",
    period: "Sep 1 → Nov 30", status: "Active · 21 days left", pct: 91, pctLabel: "10 of 11 done in November",
    entries: [
      { id: "e1", title: "Morning exercise", glyph: "Mo", rule: "Daily · 08:00 · due 09:00", seq: "dddddmdd", score: "7/8" },
      { id: "e2", title: "Gym", glyph: "Gy", rule: "Mon, Wed, Fri · 18:00 · 1h · Gym warm-up", seq: "ddd", score: "3/3", protocolId: "gym" },
    ],
  },
  {
    id: "morning", name: "Morning routine", glyph: "Mo", tone: "sand", purpose: "Start the day ready",
    period: "Nov 1 → Jan 31", status: "Active · 83 days left", pct: 85, pctLabel: "41 of 48 done in November",
    entries: [
      { id: "e3", title: "Shower", glyph: "Sh", rule: "Daily · 20m · Shower", seq: "dddddddd", score: "8/8", protocolId: "shower" },
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
    id: "reading", name: "Reading habit", glyph: "Re", tone: "lilac", purpose: "Read more, scroll less",
    period: "Nov 9 → Feb 28", status: "Draft", draft: true, pct: 0, pctLabel: "",
    entries: [
      { id: "e11", title: "Read", glyph: "Re", rule: "Daily · 20m · Wind down", seq: "", score: "", protocolId: "wind-down" },
    ],
  },
  {
    id: "spring", name: "Exercise — spring", glyph: "Ex", tone: "moss", purpose: "Get back in shape",
    period: "Mar 1 → May 31", status: "Ended", ended: true, pct: 71, pctLabel: "64 of 90 done over the whole period",
    entries: [
      { id: "e9", title: "Morning exercise", glyph: "Mo", rule: "Daily · 08:00 · due 09:00 · Spring stretch", seq: "ddmdmddmddmdddmd", score: "41/62", protocolId: "stretch" },
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
  { id: "shower", title: "Shower", glyph: "Sh", tone: "sand", used: [{ label: "Shower", kind: "Morning routine", tone: "sand", routineId: "morning", entryId: "e3" }], steps: SHOWER_STEPS },
  { id: "gym", title: "Gym warm-up", glyph: "Gy", tone: "moss", used: [{ label: "Gym", kind: "Exercise plan", tone: "moss", routineId: "exercise", entryId: "e2" }], steps: ["5 min easy bike", "Hip circles and leg swings", "Empty bar, 2 × 10", "One light set per lift"] },
  // Past: only the ended "Exercise — spring" used it.
  { id: "stretch", title: "Spring stretch", glyph: "St", tone: "moss", used: [{ label: "Morning exercise", kind: "Exercise — spring", tone: "moss", routineId: "spring", entryId: "e9" }], steps: ["Neck rolls", "Shoulder circles", "Hamstrings, 30 s each side", "Hip flexors, 30 s each side"] },
  // Unused: only the draft "Reading habit" uses it (drafts don't count).
  { id: "wind-down", title: "Wind down", glyph: "Wi", tone: "lilac", used: [{ label: "Read", kind: "Reading habit", tone: "lilac", routineId: "reading", entryId: "e11" }], steps: ["Phone on the charger, out of reach", "Dim the lights", "Pick up the book"] },
  // Unused: nothing uses it.
  { id: "packing", title: "Packing list", glyph: "Pa", tone: "sea", used: [], steps: ["Charger", "Water bottle", "Headphones", "Keys"] },
];
