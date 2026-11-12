/**
 * Routine repository — SYSTEMS.md "Routine" and "Routine entry". Routines and their
 * entries are stored; routine tasks are not, until touched (the task repository saves
 * them on the first action). Every write loads, asks @planner/core, and saves what changed.
 * Where a rule makes saved tasks "stop existing" (an earlier end, a removed entry, back to
 * draft, delete), they're deleted here in the same transaction.
 */
import {
  type EntryBlueprint,
  type LocalDate,
  type Result,
  type Routine,
  type RoutineEntry,
  type RoutineFields,
  type Task,
  canDeleteRoutine,
  changeEntry,
  createEntry,
  createRoutine,
  duplicateRoutine,
  editRoutine,
  endRoutine,
  publishRoutine,
  removeEntry,
  todayOf,
  unpublishRoutine,
} from "@planner/core";
import type { Db, LiveQuery, SqlRunner } from "./db";
import { DataError } from "./errors";
import { changedColumns, entryColumns, entryFromRow, routineColumns, routineFromRow, taskFromRow } from "./rows";
import { deleteRow, insertRow, updateRow } from "./sql";
import { type TagRef, resolveTags } from "./tags";
import type { RepoDeps } from "./tasks";

export type RoutineRepository = ReturnType<typeof routineRepository>;

/** An entry with its place in the routine's list. */
export type StoredEntry = RoutineEntry & { position: number };

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new DataError("invalid", result.errors);
  return result.value;
}

async function loadRoutine(tx: SqlRunner, id: string): Promise<Routine> {
  const row = await tx.getOptional("SELECT * FROM routines WHERE id = ?", [id]);
  if (!row) throw DataError.notFound("routine", id);
  return routineFromRow(row);
}

async function loadEntries(tx: SqlRunner, routineId: string): Promise<StoredEntry[]> {
  return (await tx.getAll("SELECT * FROM routine_entries WHERE routine_id = ? ORDER BY position, id", [routineId])).map(entryFromRow);
}

async function loadEntry(tx: SqlRunner, id: string): Promise<StoredEntry> {
  const row = await tx.getOptional("SELECT * FROM routine_entries WHERE id = ?", [id]);
  if (!row) throw DataError.notFound("routine entry", id);
  return entryFromRow(row);
}

/** The routine's saved (touched) tasks. */
async function savedOf(tx: SqlRunner, routineId: string): Promise<Task[]> {
  const rows = await tx.getAll(
    "SELECT tasks.* FROM tasks JOIN routine_entries ON tasks.routine_entry_id = routine_entries.id WHERE routine_entries.routine_id = ?",
    [routineId],
  );
  return rows.map(taskFromRow);
}

export function routineRepository(db: Db, deps: RepoDeps) {
  const today = () => todayOf(deps.clock());
  const stamp = () => deps.nowUtc();

  async function saveRoutine(tx: SqlRunner, before: Routine, after: Routine) {
    const changed = changedColumns(routineColumns(before), routineColumns(after));
    if (Object.keys(changed).length) await updateRow(tx, "routines", after.id, { ...changed, updated_at: stamp() });
  }

  async function saveEntry(tx: SqlRunner, before: RoutineEntry, after: RoutineEntry) {
    const changed = changedColumns(entryColumns(before), entryColumns(after));
    if (Object.keys(changed).length) await updateRow(tx, "routine_entries", after.id, { ...changed, updated_at: stamp() });
  }

  async function insertRoutine(tx: SqlRunner, r: Routine) {
    const now = stamp();
    await insertRow(tx, "routines", r.id, { ...routineColumns(r), created_at: now, updated_at: now });
  }

  async function insertEntry(tx: SqlRunner, e: RoutineEntry, position: number) {
    const now = stamp();
    await insertRow(tx, "routine_entries", e.id, { ...entryColumns(e), position, created_at: now, updated_at: now });
  }

  /** Saved tasks of the routine that no longer exist under the rules: delete them. */
  async function dropSaved(tx: SqlRunner, routineId: string, keep: (t: Task) => boolean) {
    for (const t of await savedOf(tx, routineId)) if (!keep(t)) await deleteRow(tx, "tasks", t.id);
  }

  return {
    /** A new routine: always a draft. */
    create: (fields: RoutineFields): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const r = unwrap(createRoutine(deps.newId(), fields));
        await insertRoutine(tx, r);
        return r;
      }),

    /** Title, purpose, color, dates. A published start is locked; an earlier end can't pass the last done task. */
    edit: (id: string, changes: Partial<RoutineFields>): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const before = await loadRoutine(tx, id);
        const after = unwrap(editRoutine(before, changes, await savedOf(tx, id)));
        await saveRoutine(tx, before, after);
        // Tasks after an earlier end simply stop existing.
        await dropSaved(tx, id, (t) => t.occurrenceDate! <= after.endDate && t.occurrenceDate! >= after.startDate);
        return after;
      }),

    /** Its history starts: entries apply from today (or its start, if later). */
    publish: (id: string): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const before = await loadRoutine(tx, id);
        const entries = await loadEntries(tx, id);
        const out = unwrap(publishRoutine(before, entries, deps.clock()));
        await saveRoutine(tx, before, out.routine);
        for (const e of out.entries) await saveEntry(tx, entries.find((x) => x.id === e.id)!, e);
        return out.routine;
      }),

    /** Published by mistake, nothing done: back to a draft. Touched tasks go away. */
    unpublish: (id: string): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const before = await loadRoutine(tx, id);
        const entries = await loadEntries(tx, id);
        const out = unwrap(unpublishRoutine(before, entries, await savedOf(tx, id)));
        await saveRoutine(tx, before, out.routine);
        for (const e of out.entries) await saveEntry(tx, entries.find((x) => x.id === e.id)!, e);
        // Removed entries have no place in a draft.
        for (const e of entries) if (!out.entries.some((x) => x.id === e.id)) await deleteRow(tx, "routine_entries", e.id);
        await dropSaved(tx, id, () => false);
        return out.routine;
      }),

    /** The End button: it ends today. */
    end: (id: string): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const before = await loadRoutine(tx, id);
        const after = unwrap(endRoutine(before, await savedOf(tx, id), deps.clock()));
        await saveRoutine(tx, before, after);
        await dropSaved(tx, id, (t) => t.occurrenceDate! <= after.endDate);
        return after;
      }),

    /** A draft, or a published routine with nothing done (its tasks go too). Copies made from it keep going. */
    remove: (id: string): Promise<void> =>
      db.writeTransaction(async (tx) => {
        const routine = await loadRoutine(tx, id);
        unwrap(canDeleteRoutine(routine, await savedOf(tx, id)));
        await dropSaved(tx, id, () => false);
        for (const e of await loadEntries(tx, id)) await deleteRow(tx, "routine_entries", e.id);
        await deleteRow(tx, "routines", id);
        for (const row of await tx.getAll<{ id: string }>("SELECT id FROM routines WHERE cloned_from = ?", [id])) {
          await updateRow(tx, "routines", row.id, { cloned_from: null, updated_at: stamp() });
        }
      }),

    /** Restarting: a new draft with the same entries (as they are now), new dates. */
    duplicate: (id: string, options: { startDate: LocalDate; endDate: LocalDate; title?: string }): Promise<Routine> =>
      db.writeTransaction(async (tx) => {
        const routine = await loadRoutine(tx, id);
        const entries = await loadEntries(tx, id);
        const out = unwrap(duplicateRoutine(routine, entries, { ...options, id: deps.newId(), newEntryId: deps.newId }));
        await insertRoutine(tx, out.routine);
        for (const [i, e] of out.entries.entries()) await insertEntry(tx, e, i);
        return out.routine;
      }),

    // ── Entries ────────────────────────────────────────────────────────

    /** `tags` (optional) replaces the blueprint's tags; new names become tags in the same write. */
    addEntry: (routineId: string, blueprint: EntryBlueprint, tags?: TagRef[]): Promise<RoutineEntry> =>
      db.writeTransaction(async (tx) => {
        const routine = await loadRoutine(tx, routineId);
        unwrap(createEntry(routine, "check", { ...blueprint, tags: [] }, today())); // check before making tags
        const b = tags ? { ...blueprint, tags: await resolveTags(tx, deps, tags) } : blueprint;
        const entry = unwrap(createEntry(routine, deps.newId(), b, today()));
        const last = await tx.getOptional<{ p: number | null }>("SELECT max(position) AS p FROM routine_entries WHERE routine_id = ?", [routineId]);
        await insertEntry(tx, entry, (last?.p ?? -1) + 1);
        return entry;
      }),

    /** Draft: overwrites. Published: a new version from today on; the past keeps the old one. */
    changeEntry: (entryId: string, blueprint: EntryBlueprint, tags?: TagRef[]): Promise<RoutineEntry> =>
      db.writeTransaction(async (tx) => {
        const before = await loadEntry(tx, entryId);
        const routine = await loadRoutine(tx, before.routineId);
        unwrap(changeEntry(before, routine, { ...blueprint, tags: [] }, today())); // check before making tags
        const b = tags ? { ...blueprint, tags: await resolveTags(tx, deps, tags) } : blueprint;
        const after = unwrap(changeEntry(before, routine, b, today()));
        await saveEntry(tx, before, after);
        return after;
      }),

    /** Draft: deleted. Published: its tasks stop from today on (done ones stay). */
    removeEntry: (entryId: string): Promise<void> =>
      db.writeTransaction(async (tx) => {
        const entry = await loadEntry(tx, entryId);
        const routine = await loadRoutine(tx, entry.routineId);
        const out = removeEntry(entry, routine, today());
        if (out.action === "delete") {
          await deleteRow(tx, "routine_entries", entryId);
          return;
        }
        await saveEntry(tx, entry, out.entry);
        const from = out.entry.removedFrom!;
        await dropSaved(tx, routine.id, (t) => t.routineEntryId !== entryId || t.occurrenceDate! < from || t.doneAt !== undefined);
      }),

    // ── Reads the UI watches ────────────────────────────────────────────

    all(): LiveQuery<Routine> {
      return { sql: "SELECT * FROM routines ORDER BY start_date, title COLLATE NOCASE, id", parameters: [], mapper: routineFromRow };
    },

    /** Every entry of every routine, in each routine's order. */
    entries(): LiveQuery<StoredEntry> {
      return { sql: "SELECT * FROM routine_entries ORDER BY routine_id, position, id", parameters: [], mapper: entryFromRow };
    },
  };
}
