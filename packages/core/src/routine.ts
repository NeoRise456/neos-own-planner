/**
 * Routines and routine entries — SYSTEMS.md.
 *
 * A routine starts as a **draft**: you set it up freely and it produces no tasks. Once
 * **published**, its history starts: entries produce tasks from the publish day on, and
 * each change to an entry is a new version that applies from today on, so past tasks
 * keep what they were. Tasks are produced on the fly for any day ("the 4 questions"),
 * and only saved once touched; saved copies replace the fresh ones.
 */
import {
  type Clock,
  type LocalDate,
  type LocalTime,
  type Moment,
  eachDay,
  isLocalDate,
  isLocalTime,
  maxDate,
  minDate,
  nowMoment,
  timeToMinutes,
  todayOf,
} from "./dates";
import { type Rule, matchesRule, validateRule } from "./recurrence";
import { type Check, type Issue, type Result, fail, fromCheck, issue, ok } from "./result";
import { type Task, taskState } from "./task";
import { COPY_NAMESPACE, uuidV5 } from "./uuid";

// ── Types ────────────────────────────────────────────────────────────────

export interface Routine {
  id: string;
  title: string;
  /** The why — just text. */
  purpose?: string;
  startDate: LocalDate;
  /** Required: every routine ends. */
  endDate: LocalDate;
  /** The routine it was duplicated from. */
  clonedFrom?: string;
  /** Shared by a routine and all its copies. */
  lineage: string;
  /** When it was published. Not set = a draft: no tasks yet. */
  publishedAt?: Moment;
}

export type RoutineStatus = "draft" | "upcoming" | "active" | "ended";

/** One fixed copy per day: a start time (→ timed), a due time, or neither (→ floating). */
export interface SlotTime {
  startTime?: LocalTime;
  dueTime?: LocalTime;
}

/** What each matching day gets: fixed times, or N floating copies. */
export type PerDay =
  | { kind: "times"; times: SlotTime[] }
  | { kind: "count"; count: number; dueTime?: LocalTime };

/** What + when. Copied into every task the entry produces. */
export interface EntryBlueprint {
  title: string;
  notes?: string;
  tags: string[];
  duration?: number;
  protocolId?: string;
  rule: Rule;
  perDay: PerDay;
}

/** A blueprint that applies from `from` on (until the next version). */
export interface EntryVersion extends EntryBlueprint {
  from: LocalDate;
}

export interface RoutineEntry {
  id: string;
  routineId: string;
  /** Sorted by `from`, oldest first. */
  versions: EntryVersion[];
  /** Removed from this day on: produces nothing from then. */
  removedFrom?: LocalDate;
}

/** No times at all = one floating copy a day. */
export const FLOATING_ONCE: PerDay = { kind: "times", times: [{}] };

// ── Routine ──────────────────────────────────────────────────────────────

export function isDraft(routine: Routine): boolean {
  return routine.publishedAt === undefined;
}

export function routineStatus(routine: Routine, today: LocalDate): RoutineStatus {
  if (isDraft(routine)) return "draft";
  if (today < routine.startDate) return "upcoming";
  if (today > routine.endDate) return "ended";
  return "active";
}

export function validateRoutine(routine: Routine): Check {
  const errors: Issue[] = [];
  if (routine.title.trim() === "") errors.push(issue("title_required", "The title can't be empty.", "title"));
  if (!isLocalDate(routine.startDate)) errors.push(issue("start_required", "A routine needs a start date.", "startDate"));
  if (!isLocalDate(routine.endDate)) {
    errors.push(issue("end_required", "Every routine needs an end date.", "endDate"));
  }
  if (errors.length === 0 && routine.endDate < routine.startDate) {
    errors.push(issue("end_before_start", "The end date can't be before the start date.", "endDate"));
  }
  return { errors, warnings: [] };
}

export interface RoutineFields {
  title: string;
  purpose?: string;
  startDate: LocalDate;
  endDate: LocalDate;
}

/** A new routine: a draft, which can start empty. Its lineage is its own id. */
export function createRoutine(id: string, fields: RoutineFields): Result<Routine> {
  const purpose = fields.purpose?.trim();
  const routine: Routine = {
    id,
    title: fields.title.trim(),
    ...(purpose ? { purpose } : {}),
    startDate: fields.startDate,
    endDate: fields.endDate,
    lineage: id,
  };
  return fromCheck(routine, validateRoutine(routine));
}

/**
 * Edit the title, purpose and dates. Title and purpose: always. Start date: only in a
 * draft (once published, it anchors "every N" and the history). End date: free in a
 * draft; once published, the end-date rules (`changeEndDate`).
 */
export function editRoutine(
  routine: Routine,
  changes: Partial<RoutineFields>,
  copies: Task[] = [],
): Result<Routine> {
  if (!isDraft(routine) && changes.startDate !== undefined && changes.startDate !== routine.startDate) {
    return fail(issue("start_locked", "A published routine's start date can't change.", "startDate"));
  }
  const purpose = changes.purpose !== undefined ? changes.purpose.trim() : routine.purpose;
  const { purpose: _p, ...rest } = routine;
  const next: Routine = {
    ...rest,
    ...(changes.title !== undefined ? { title: changes.title.trim() } : {}),
    ...(purpose ? { purpose } : {}),
    ...(changes.startDate !== undefined ? { startDate: changes.startDate } : {}),
  };
  if (changes.endDate !== undefined && changes.endDate !== routine.endDate) {
    return changeEndDate(next, changes.endDate, copies);
  }
  return fromCheck(next, validateRoutine(next));
}

/**
 * Publishing: the moment its history starts. Needs a valid title and dates, at least one
 * entry, and an end date that isn't already past. Every entry then applies from the
 * publish day — or the start date, if that's later — so nothing before is filled with
 * missed tasks.
 */
export function publishRoutine(
  routine: Routine,
  entries: RoutineEntry[],
  now: Clock,
): Result<{ routine: Routine; entries: RoutineEntry[] }> {
  if (!isDraft(routine)) return fail(issue("already_published", "It's already published."));
  const errors = [...validateRoutine(routine).errors];
  const own = entries.filter((e) => e.routineId === routine.id && e.removedFrom === undefined);
  const today = todayOf(now);
  if (own.length === 0) errors.push(issue("entries_required", "Add at least one entry before publishing.", "entries"));
  if (errors.length === 0 && routine.endDate < today) {
    errors.push(issue("end_in_past", "Its end date has already passed.", "endDate"));
  }
  own.forEach((e) => {
    const v = e.versions[e.versions.length - 1];
    if (!v || validateBlueprint(v).errors.length) {
      errors.push(issue("entry_invalid", `The entry "${v?.title ?? e.id}" isn't complete.`, `entries.${e.id}`));
    }
  });
  if (errors.length) return fail(errors);

  const from = maxDate(today, routine.startDate);
  return ok({
    routine: { ...routine, publishedAt: nowMoment(now) },
    entries: own.map((e) => ({ ...e, versions: [{ ...e.versions[e.versions.length - 1]!, from }] })),
  });
}

/**
 * Published by mistake: back to a draft — only while nothing in it is done. Entries keep
 * their latest blueprint. The caller deletes the routine's saved copies.
 */
export function unpublishRoutine(
  routine: Routine,
  entries: RoutineEntry[],
  copies: Task[],
): Result<{ routine: Routine; entries: RoutineEntry[] }> {
  if (isDraft(routine)) return fail(issue("not_published", "It's still a draft."));
  if (copies.some((t) => t.doneAt !== undefined)) {
    return fail(issue("has_done_tasks", "Something in it is already done. End it instead."));
  }
  const { publishedAt: _p, ...draft } = routine;
  return ok({
    routine: draft,
    entries: entries
      .filter((e) => e.routineId === routine.id && e.removedFrom === undefined)
      .map((e) => ({ ...e, versions: [{ ...e.versions[e.versions.length - 1]!, from: routine.startDate }] })),
  });
}

/**
 * Can it be deleted? A draft: always. Published: only while nothing in it is done (it was
 * a mistake) — the warning says its missed/cancelled tasks go too. Otherwise: end it.
 */
export function canDeleteRoutine(routine: Routine, copies: Task[]): Result<{ warn: boolean }> {
  if (isDraft(routine)) return ok({ warn: false });
  if (copies.some((t) => t.doneAt !== undefined)) {
    return fail(issue("has_done_tasks", "Something in it is already done. End it instead — that keeps its history."));
  }
  return ok({ warn: true });
}

/**
 * The End button: the routine ends today. Everything done, missed or cancelled stays;
 * nothing appears after today. An upcoming routine that hasn't started can't end — move
 * it back to draft or delete it instead.
 */
export function endRoutine(routine: Routine, copies: Task[], now: Clock): Result<Routine> {
  if (isDraft(routine)) return fail(issue("not_published", "A draft has nothing to end. Delete it instead."));
  const today = todayOf(now);
  if (routine.startDate > today) {
    return fail(issue("not_started", "It hasn't started yet. Move it back to draft or delete it."));
  }
  if (routine.endDate <= today) return ok(routine);
  return changeEndDate(routine, today, copies);
}

/** The day of the routine's last done task — its tasks' days, moved or not. */
export function lastDoneDay(copies: Task[]): LocalDate | null {
  let last: LocalDate | null = null;
  for (const t of copies) {
    if (t.doneAt === undefined) continue;
    for (const d of [t.startDate, t.occurrenceDate]) {
      if (d !== undefined && (last === null || d > last)) last = d;
    }
  }
  return last;
}

/**
 * Ending early or extending. Earlier only down to the day of the last done task, so a
 * done task always stays inside its routine's period. `copies` = the routine's saved copies.
 */
export function changeEndDate(routine: Routine, endDate: LocalDate, copies: Task[]): Result<Routine> {
  const next = { ...routine, endDate };
  const check = validateRoutine(next);
  if (check.errors.length) return fail(check.errors);
  const lastDone = lastDoneDay(copies);
  if (lastDone !== null && endDate < lastDone) {
    return fail(issue("end_before_last_done", `It can't end before ${lastDone}, the day of its last done task.`, "endDate"));
  }
  return ok(next);
}

/**
 * Restarting = duplicating into a new routine — a **draft**, to adjust and publish: same
 * title (unless given), purpose and entries (their current blueprint, same protocols),
 * new dates, `clonedFrom` set and the same lineage. Removed entries aren't copied.
 */
export function duplicateRoutine(
  routine: Routine,
  entries: RoutineEntry[],
  options: { id: string; startDate: LocalDate; endDate: LocalDate; title?: string; newEntryId: () => string },
): Result<{ routine: Routine; entries: RoutineEntry[] }> {
  const copy: Routine = {
    id: options.id,
    title: (options.title ?? routine.title).trim(),
    ...(routine.purpose !== undefined ? { purpose: routine.purpose } : {}),
    startDate: options.startDate,
    endDate: options.endDate,
    clonedFrom: routine.id,
    lineage: routine.lineage,
  };
  const check = validateRoutine(copy);
  if (check.errors.length) return fail(check.errors);

  const copiedEntries = entries
    .filter((e) => e.routineId === routine.id && e.removedFrom === undefined && e.versions.length > 0)
    .map((e): RoutineEntry => {
      const { from: _from, ...blueprint } = e.versions[e.versions.length - 1]!;
      return { id: options.newEntryId(), routineId: copy.id, versions: [{ ...blueprint, from: copy.startDate }] };
    });
  return ok({ routine: copy, entries: copiedEntries });
}

/** After deleting a routine: copies made from it stay, they just lose the "came from" link. */
export function detachClones(routines: Routine[], deletedId: string): Routine[] {
  return routines.map((r) => {
    if (r.clonedFrom !== deletedId) return r;
    const { clonedFrom: _c, ...rest } = r;
    return rest;
  });
}

// ── Entries ──────────────────────────────────────────────────────────────

export function validateBlueprint(blueprint: EntryBlueprint): Check {
  const errors: Issue[] = [];
  if (blueprint.title.trim() === "") errors.push(issue("title_required", "The title can't be empty.", "title"));
  if (blueprint.duration !== undefined && !(Number.isInteger(blueprint.duration) && blueprint.duration > 0)) {
    errors.push(issue("duration_positive", "The duration must be a whole number of minutes above 0.", "duration"));
  }
  errors.push(...validateRule(blueprint.rule));

  const perDay = blueprint.perDay;
  if (perDay.kind === "count") {
    if (!Number.isInteger(perDay.count) || perDay.count < 1) {
      errors.push(issue("count_min", "The count must be 1 or more.", "count"));
    }
    if (perDay.dueTime !== undefined && !isLocalTime(perDay.dueTime)) {
      errors.push(issue("invalid_time", "The due time isn't a valid time.", "dueTime"));
    }
  } else {
    if (perDay.times.length === 0) errors.push(issue("times_required", "Add at least one time.", "times"));
    perDay.times.forEach((slot, i) => {
      for (const field of ["startTime", "dueTime"] as const) {
        const v = slot[field];
        if (v !== undefined && !isLocalTime(v)) {
          errors.push(issue("invalid_time", `Time ${i + 1}: ${field} isn't a valid time.`, `times.${i}.${field}`));
        }
      }
      if (
        isLocalTime(slot.startTime) &&
        isLocalTime(slot.dueTime) &&
        timeToMinutes(slot.dueTime) < timeToMinutes(slot.startTime)
      ) {
        errors.push(issue("due_before_start_time", `Time ${i + 1}: the due time can't be before the start time.`, `times.${i}.dueTime`));
      }
    });
  }
  return { errors, warnings: [] };
}

function normalizeBlueprint(b: EntryBlueprint): EntryBlueprint {
  const notes = b.notes?.trim();
  const { notes: _n, ...rest } = b;
  return { ...rest, title: b.title.trim(), ...(notes ? { notes } : {}), tags: [...new Set(b.tags)] };
}

/**
 * A new entry. In a draft it just sits there until publishing. In a published routine it
 * applies from today on — or from the routine's start, if that's later.
 */
export function createEntry(routine: Routine, id: string, blueprint: EntryBlueprint, today: LocalDate): Result<RoutineEntry> {
  const b = normalizeBlueprint(blueprint);
  const from = isDraft(routine) ? routine.startDate : maxDate(today, routine.startDate);
  const entry: RoutineEntry = { id, routineId: routine.id, versions: [{ ...b, from }] };
  return fromCheck(entry, validateBlueprint(b));
}

/**
 * Changing an entry. In a draft the change simply overwrites it (no history yet).
 * Published: the new blueprint applies from today on (or the routine's start, if
 * later); earlier days keep the old one, so history stays true. Saved copies after
 * today keep the changes you made to them (they replace the fresh ones as always).
 */
export function changeEntry(entry: RoutineEntry, routine: Routine, blueprint: EntryBlueprint, today: LocalDate): Result<RoutineEntry> {
  const b = normalizeBlueprint(blueprint);
  const check = validateBlueprint(b);
  if (check.errors.length) return fail(check.errors);
  if (isDraft(routine)) return ok({ ...entry, versions: [{ ...b, from: routine.startDate }] });
  const from = maxDate(today, routine.startDate);
  const versions = [...entry.versions.filter((v) => v.from < from), { ...b, from }];
  return ok({ ...entry, versions });
}

/**
 * Removing an entry. In a draft it's simply deleted. Published: its tasks stop from
 * today on; the past stays as history.
 */
export function removeEntry(
  entry: RoutineEntry,
  routine: Routine,
  today: LocalDate,
): { action: "delete" } | { action: "update"; entry: RoutineEntry } {
  if (isDraft(routine)) return { action: "delete" };
  return { action: "update", entry: { ...entry, removedFrom: today } };
}

/** Question 2: which version of the entry applies that day (null = none). */
export function versionOn(entry: RoutineEntry, day: LocalDate): EntryVersion | null {
  if (entry.removedFrom !== undefined && day >= entry.removedFrom) return null;
  let found: EntryVersion | null = null;
  for (const v of entry.versions) if (v.from <= day) found = v;
  return found;
}

/** The id of the routine copy "entry, day, slot". Always the same for the same three. */
export function copyId(entryId: string, occurrenceDate: LocalDate, slot: number): string {
  return uuidV5(`${entryId}/${occurrenceDate}/${slot}`, COPY_NAMESPACE);
}

export function copyKey(task: Pick<Task, "routineEntryId" | "occurrenceDate" | "occurrenceSlot">): string {
  return `${task.routineEntryId}/${task.occurrenceDate}/${task.occurrenceSlot}`;
}

/**
 * The fresh (never touched) copies an entry produces on one day — "the 4 questions":
 * 1. routine published and active that day? 2. a version applies? 3. the day matches
 * the rule? 4. how many: one per time, or `count` floating copies.
 */
export function freshCopies(routine: Routine, entry: RoutineEntry, day: LocalDate): Task[] {
  if (isDraft(routine)) return [];
  if (day < routine.startDate || day > routine.endDate) return [];
  const v = versionOn(entry, day);
  if (v === null) return [];
  if (!matchesRule(v.rule, day, routine.startDate)) return [];

  const perDay = v.perDay;
  const slots: SlotTime[] =
    perDay.kind === "count"
      ? Array.from({ length: perDay.count }, () => (perDay.dueTime !== undefined ? { dueTime: perDay.dueTime } : {}))
      : perDay.times;

  return slots.map((slot, i) => {
    const n = i + 1;
    const task: Task = {
      id: copyId(entry.id, day, n),
      title: v.title,
      tags: [...v.tags],
      startDate: day,
      routineEntryId: entry.id,
      occurrenceDate: day,
      occurrenceSlot: n,
    };
    if (v.notes !== undefined) task.notes = v.notes;
    if (v.duration !== undefined) task.duration = v.duration;
    if (v.protocolId !== undefined) task.protocolId = v.protocolId;
    if (slot.startTime !== undefined) task.startTime = slot.startTime;
    if (slot.dueTime !== undefined) {
      task.dueDate = day;
      task.dueTime = slot.dueTime;
    }
    return task;
  });
}

/**
 * Should a saved copy still exist?
 * - after the routine's end (or before its start): no — "tasks after the end simply stop existing"
 * - on/after its entry was removed: only if it's done (nothing you did is lost)
 */
function savedCopyStillExists(task: Task, routine: Routine, entry: RoutineEntry): boolean {
  if (isDraft(routine)) return false;
  const day = task.occurrenceDate!;
  if (day < routine.startDate || day > routine.endDate) return false;
  if (entry.removedFrom !== undefined && day >= entry.removedFrom) return task.doneAt !== undefined;
  return true;
}

export interface ExpandInput {
  routines: Routine[];
  entries: RoutineEntry[];
  /**
   * Saved (touched) copies. Pass every saved copy whose occurrence date OR current start
   * date is in the range, so moved copies land where they were moved to.
   */
  saved: Task[];
  from: LocalDate;
  to: LocalDate;
}

/**
 * Every routine task placed on a day in [from, to]: fresh copies from the blueprints,
 * with saved copies shown instead of their fresh version ("already saved? show the
 * saved one"). Placed by their current start date, so a moved copy shows on its new day.
 */
export function expandRoutineTasks(input: ExpandInput): Task[] {
  return mergeCopies(input).filter((t) => t.startDate! >= input.from && t.startDate! <= input.to);
}

/**
 * Fresh copies for every occurrence day in [from, to], then the saved copies on top
 * (replacing their fresh version, or dropped if they shouldn't exist any more).
 */
function mergeCopies({ routines, entries, saved, from, to }: ExpandInput): Task[] {
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const byKey = new Map<string, Task>();

  const days = eachDay(from, to);
  for (const entry of entries) {
    const routine = routineById.get(entry.routineId);
    if (!routine) continue;
    for (const day of days) for (const t of freshCopies(routine, entry, day)) byKey.set(copyKey(t), t);
  }

  for (const t of saved) {
    const entry = t.routineEntryId !== undefined ? entryById.get(t.routineEntryId) : undefined;
    const routine = entry ? routineById.get(entry.routineId) : undefined;
    const key = copyKey(t);
    if (!entry || !routine || !savedCopyStillExists(t, routine, entry)) byKey.delete(key);
    else byKey.set(key, t);
  }
  return [...byKey.values()];
}

// ── Consistency ──────────────────────────────────────────────────────────

export interface Consistency {
  done: number;
  missed: number;
  /** done ÷ (done + missed); null while nothing counts yet. */
  rate: number | null;
}

/** done ÷ (done + missed). Cancelled never counts; not-done doesn't count yet. */
export function consistencyOf(tasks: Task[], now: Clock): Consistency {
  let done = 0;
  let missed = 0;
  for (const t of tasks) {
    const s = taskState(t, now.at);
    if (s === "done") done++;
    else if (s === "missed") missed++;
  }
  return { done, missed, rate: done + missed === 0 ? null : done / (done + missed) };
}

/**
 * A routine's consistency, overall and per entry (count copies count one by one:
 * "Water 12/16"). Only up to the routine's end. `range` narrows it (e.g. "November").
 */
export function routineConsistency(input: {
  routine: Routine;
  entries: RoutineEntry[];
  saved: Task[];
  now: Clock;
  range?: { from: LocalDate; to: LocalDate };
}): { overall: Consistency; byEntry: Map<string, Consistency> } {
  const { routine, now } = input;
  // The whole period (∩ range): future copies are simply "not done" and don't count yet,
  // but one ticked early does. Counted by occurrence day, wherever a copy was moved to.
  const from = input.range ? maxDate(input.range.from, routine.startDate) : routine.startDate;
  const to = input.range ? minDate(input.range.to, routine.endDate) : routine.endDate;

  const entries = input.entries.filter((e) => e.routineId === routine.id);
  const tasks =
    to < from
      ? []
      : mergeCopies({ routines: [routine], entries, saved: input.saved, from, to }).filter(
          (t) => t.occurrenceDate! >= from && t.occurrenceDate! <= to,
        );

  const byEntry = new Map<string, Consistency>();
  for (const e of entries) byEntry.set(e.id, consistencyOf(tasks.filter((t) => t.routineEntryId === e.id), now));
  return { overall: consistencyOf(tasks, now), byEntry };
}
