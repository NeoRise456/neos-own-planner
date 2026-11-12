/**
 * Protocol repository — SYSTEMS.md "Protocol". A shared list of plain-text steps. Its
 * status (active / past / unused) is worked out from the routines, never stored.
 * Deleting: only an unused one; draft entries and one-off tasks that use it lose it.
 */
import {
  type Protocol,
  type Result,
  addStep,
  canDeleteProtocol,
  createProtocol,
  editStep,
  moveStep,
  removeStep,
  renameProtocol,
  todayOf,
} from "@planner/core";
import type { Db, LiveQuery, SqlRunner } from "./db";
import { DataError } from "./errors";
import { entryColumns, entryFromRow, protocolFromRow, routineFromRow, taskFromRow } from "./rows";
import { deleteRow, insertRow, updateRow } from "./sql";
import type { RepoDeps } from "./tasks";

export type ProtocolRepository = ReturnType<typeof protocolRepository>;

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new DataError("invalid", result.errors);
  return result.value;
}

async function load(tx: SqlRunner, id: string): Promise<Protocol> {
  const row = await tx.getOptional("SELECT * FROM protocols WHERE id = ?", [id]);
  if (!row) throw DataError.notFound("protocol", id);
  return protocolFromRow(row);
}

export function protocolRepository(db: Db, deps: RepoDeps) {
  function change(id: string, rule: (p: Protocol) => Result<Protocol>): Promise<Protocol> {
    return db.writeTransaction(async (tx) => {
      const before = await load(tx, id);
      const after = unwrap(rule(before));
      const cols: Record<string, string> = {};
      if (after.title !== before.title) cols.title = after.title;
      if (JSON.stringify(after.steps) !== JSON.stringify(before.steps)) cols.steps = JSON.stringify(after.steps);
      if (Object.keys(cols).length) await updateRow(tx, "protocols", id, { ...cols, updated_at: deps.nowUtc() });
      return after;
    });
  }

  return {
    create: (title: string, steps: string[] = []): Promise<Protocol> =>
      db.writeTransaction(async (tx) => {
        const p = unwrap(createProtocol(deps.newId(), title, steps));
        const now = deps.nowUtc();
        await insertRow(tx, "protocols", p.id, { title: p.title, steps: JSON.stringify(p.steps), created_at: now, updated_at: now });
        return p;
      }),

    rename: (id: string, title: string) => change(id, (p) => renameProtocol(p, title)),
    /** At `index` (default: the end) — also how a removed step is put back. */
    addStep: (id: string, text: string, index?: number) => change(id, (p) => addStep(p, text, index)),
    editStep: (id: string, index: number, text: string) => change(id, (p) => editStep(p, index, text)),
    removeStep: (id: string, index: number) => change(id, (p) => removeStep(p, index)),
    moveStep: (id: string, from: number, to: number) => change(id, (p) => moveStep(p, from, to)),

    /** Only an unused protocol. Draft entries and one-off tasks that use it just lose it. */
    remove: (id: string): Promise<{ detachedEntries: number; detachedTasks: number }> =>
      db.writeTransaction(async (tx) => {
        const protocol = await load(tx, id);
        const routines = (await tx.getAll("SELECT * FROM routines")).map(routineFromRow);
        const entries = (await tx.getAll("SELECT * FROM routine_entries")).map(entryFromRow);
        const tasks = (await tx.getAll("SELECT * FROM tasks WHERE protocol_id = ?", [id])).map(taskFromRow);
        const out = unwrap(canDeleteProtocol({ protocol, routines, entries, tasks, today: todayOf(deps.clock()) }));
        const now = deps.nowUtc();
        for (const entryId of out.detachEntries) {
          const e = entries.find((x) => x.id === entryId)!;
          const versions = e.versions.map(({ protocolId, ...v }) => (protocolId === id ? v : { ...v, protocolId }));
          await updateRow(tx, "routine_entries", e.id, { versions: entryColumns({ ...e, versions }).versions, updated_at: now });
        }
        for (const taskId of out.detachTasks) await updateRow(tx, "tasks", taskId, { protocol_id: null, updated_at: now });
        await deleteRow(tx, "protocols", id);
        return { detachedEntries: out.detachEntries.length, detachedTasks: out.detachTasks.length };
      }),

    all(): LiveQuery<Protocol> {
      return { sql: "SELECT * FROM protocols ORDER BY title COLLATE NOCASE, id", parameters: [], mapper: protocolFromRow };
    },

    /** One-off tasks that use each protocol (for the delete warning). */
    oneOffUses(id: string): LiveQuery<{ id: string }> {
      return {
        sql: "SELECT id FROM tasks WHERE protocol_id = ? AND routine_entry_id IS NULL",
        parameters: [id],
        mapper: (row) => ({ id: String(row.id) }),
      };
    },
  };
}
