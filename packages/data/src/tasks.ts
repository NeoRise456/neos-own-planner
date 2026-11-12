/**
 * Task repository — the use-cases of TASK.md on top of the database. Every write loads
 * the task, asks @planner/core for the new version (which validates it), and saves only
 * what changed. Nothing here decides a rule.
 */
import {
  type Clock,
  type LocalDate,
  type Moment,
  type Result,
  type Task,
  type TaskFields,
  type TaskSchedule,
  cancelTask,
  createTask,
  deleteTask,
  editTask,
  isRoutineCopy,
  moveTask,
  quickAddFields,
  setDoneAt,
  tickTask,
  uncancelTask,
  todayOf,
  untickTask,
  validateTask,
} from "@planner/core";
import type { Db, LiveQuery, SqlRunner } from "./db";
import { DataError } from "./errors";
import { changedColumns, taskColumns, taskFromRow } from "./rows";
import { deleteRow, insertRow, updateRow } from "./sql";
import { type TagRef, resolveTags } from "./tags";

export interface RepoDeps {
  /** "Now" for the rules — from the time zone setting. */
  clock: () => Clock;
  newId: () => string;
  /** The current instant as UTC ISO text, for created_at / updated_at. */
  nowUtc: () => string;
}

/**
 * Which task an action is for: its id, or the task itself. A routine task that was never
 * touched isn't in the database yet ("Saved or not", SYSTEMS.md): pass the task, and the
 * first action saves it (touch-to-save).
 */
export type TaskRef = string | Task;

/** `createdAt` lets `restore` put a deleted task back in its old place in the lists. */
export type DeleteOutcome = { action: "deleted"; task: Task; createdAt: string | null } | { action: "cancelled"; task: Task };

export type TaskRepository = ReturnType<typeof taskRepository>;

function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new DataError("invalid", result.errors);
  return result.value;
}

export function taskRepository(db: Db, deps: RepoDeps) {
  /** The saved task, or (for a routine task never touched) the fresh one passed in, not saved yet. */
  async function loadRef(tx: SqlRunner, ref: TaskRef): Promise<{ task: Task; saved: boolean }> {
    const id = typeof ref === "string" ? ref : ref.id;
    const row = await tx.getOptional("SELECT * FROM tasks WHERE id = ?", [id]);
    if (row) return { task: taskFromRow(row), saved: true };
    if (typeof ref !== "string" && isRoutineCopy(ref)) return { task: ref, saved: false };
    throw DataError.notFound("task", id);
  }

  /** Load → rule → save the changed columns (touching a fresh routine task saves all of it). */
  async function changeIn(tx: SqlRunner, ref: TaskRef, rule: (task: Task) => Result<Task>): Promise<Task> {
    const { task: before, saved } = await loadRef(tx, ref);
    const after = unwrap(rule(before));
    if (!saved) return insertIn(tx, after);
    const changed = changedColumns(taskColumns(before), taskColumns(after));
    if (Object.keys(changed).length > 0) await updateRow(tx, "tasks", after.id, { ...changed, updated_at: deps.nowUtc() });
    return after;
  }

  const change = (ref: TaskRef, rule: (task: Task) => Result<Task>) => db.writeTransaction((tx) => changeIn(tx, ref, rule));

  async function insertIn(tx: SqlRunner, task: Task, createdAt?: string | null): Promise<Task> {
    const now = deps.nowUtc();
    await insertRow(tx, "tasks", task.id, { ...taskColumns(task), created_at: createdAt ?? now, updated_at: now });
    return task;
  }
  const insert = (task: Task, createdAt?: string | null) => db.writeTransaction((tx) => insertIn(tx, task, createdAt));

  /**
   * A new one-off task from the task form. `tags` (optional) replaces `fields.tags`; names
   * in it become new tags in the same transaction, so a refused task creates no tag.
   */
  const create = async (fields: TaskFields, tags?: TagRef[]): Promise<Task> => {
    if (!tags) return insert(unwrap(createTask(deps.newId(), fields)));
    return db.writeTransaction(async (tx) => {
      // Check the task before making any tag (tags can't make it invalid).
      unwrap(createTask("check", { ...fields, tags: [] }));
      return insertIn(tx, unwrap(createTask(deps.newId(), { ...fields, tags: await resolveTags(tx, deps, tags) })));
    });
  };

  return {
    create,

    /** Quick-add: a title → a one-off task; on a later day it goes on that day; a tag filter tags it. */
    quickAdd: (title: string, day?: LocalDate, tagId: string | null = null) =>
      create(quickAddFields(title, day ?? todayOf(deps.clock()), todayOf(deps.clock()), tagId)),

    get(id: string): Promise<Task | null> {
      return db.getOptional("SELECT * FROM tasks WHERE id = ?", [id]).then((row) => (row ? taskFromRow(row) : null));
    },

    /**
     * `tags` (optional) replaces the task's tags; names in it become new tags. All in one
     * transaction: if the task is refused, no tag is created either.
     */
    edit: (ref: TaskRef, changes: Partial<TaskFields>, tags?: TagRef[]) =>
      db.writeTransaction(async (tx) => {
        const all = tags ? { ...changes, tags: await resolveTags(tx, deps, tags) } : changes;
        return changeIn(tx, ref, (t) => editTask(t, all));
      }),
    move: (ref: TaskRef, schedule: TaskSchedule) => change(ref, (t) => moveTask(t, schedule)),
    tick: (ref: TaskRef, doneAt?: Moment) => change(ref, (t) => tickTask(t, deps.clock(), doneAt)),
    setDoneAt: (ref: TaskRef, doneAt: Moment) => change(ref, (t) => setDoneAt(t, doneAt)),
    untick: (ref: TaskRef) => change(ref, (t) => untickTask(t)),
    cancel: (ref: TaskRef) => change(ref, (t) => cancelTask(t, deps.clock())),
    uncancel: (ref: TaskRef) => change(ref, (t) => uncancelTask(t)),

    /** One-offs are removed; a routine copy is cancelled instead (TASK.md "Deleting"). */
    remove(ref: TaskRef): Promise<DeleteOutcome> {
      return db.writeTransaction(async (tx) => {
        const { task, saved } = await loadRef(tx, ref);
        const id = task.id;
        const outcome = unwrap(deleteTask(task, deps.clock()));
        if (outcome.action === "cancel" && !saved) return { action: "cancelled", task: await insertIn(tx, outcome.task) };
        if (outcome.action === "delete") {
          const row = await tx.getOptional<{ created_at: string | null }>("SELECT created_at FROM tasks WHERE id = ?", [id]);
          await deleteRow(tx, "tasks", id);
          return { action: "deleted", task, createdAt: row?.created_at ?? null };
        }
        const changed = changedColumns(taskColumns(task), taskColumns(outcome.task));
        if (Object.keys(changed).length > 0) await updateRow(tx, "tasks", id, { ...changed, updated_at: deps.nowUtc() });
        return { action: "cancelled", task: outcome.task };
      });
    },

    /** Undo a delete: put the same task back — same id, fields and place in the lists. */
    async restore(task: Task, createdAt?: string | null): Promise<Task> {
      const check = validateTask(task);
      if (check.errors.length) throw new DataError("invalid", check.errors);
      return insert(task, createdAt);
    },

    // ── Reads the UI watches ──────────────────────────────────────────

    /**
     * Every task that might show on `day` — @planner/core's `todoForDay` decides which
     * really do and where. The SQL only narrows: open tasks, plus closed ones whose
     * start, due or done/cancelled day is that day (or that only have a due date).
     */
    aroundDay(day: LocalDate): LiveQuery<Task> {
      return {
        sql: `SELECT * FROM tasks
              WHERE routine_entry_id IS NULL
                AND ((done_at IS NULL AND cancelled_at IS NULL)
                 OR substr(coalesce(done_at, cancelled_at), 1, 10) = ?
                 OR start_date = ? OR due_date = ?
                 OR (start_date IS NULL AND due_date IS NOT NULL))
              ORDER BY created_at, id`,
        parameters: [day, day, day],
        mapper: taskFromRow,
      };
    },

    /**
     * Every task that might show on the calendar from `from` to `to` (inclusive) —
     * @planner/core's `calendarDay` decides. Dated tasks only: a start or due date in the
     * range, a range that spans it, or only a due date that hasn't passed before `from`.
     */
    between(from: LocalDate, to: LocalDate): LiveQuery<Task> {
      return {
        sql: `SELECT * FROM tasks
              WHERE routine_entry_id IS NULL
                AND (start_date BETWEEN ? AND ?
                 OR due_date BETWEEN ? AND ?
                 OR (start_date < ? AND due_date > ?)
                 OR (start_date IS NULL AND due_date >= ?))
              ORDER BY created_at, id`,
        parameters: [from, to, from, to, from, to, from],
        mapper: taskFromRow,
      };
    },

    /**
     * Saved (touched) routine tasks whose own day or current day is in the range: what
     * @planner/core's `expandRoutineTasks` lays over the fresh ones.
     */
    savedCopies(from: LocalDate, to: LocalDate): LiveQuery<Task> {
      return {
        sql: `SELECT * FROM tasks
              WHERE routine_entry_id IS NOT NULL
                AND (occurrence_date BETWEEN ? AND ? OR start_date BETWEEN ? AND ?)
              ORDER BY occurrence_date, occurrence_slot, id`,
        parameters: [from, to, from, to],
        mapper: taskFromRow,
      };
    },

    /** Every saved task of one routine (consistency, the end-date and delete rules). */
    copiesOfRoutine(routineId: string): LiveQuery<Task> {
      return {
        sql: `SELECT tasks.* FROM tasks JOIN routine_entries ON tasks.routine_entry_id = routine_entries.id
              WHERE routine_entries.routine_id = ? ORDER BY tasks.occurrence_date, tasks.occurrence_slot`,
        parameters: [routineId],
        mapper: taskFromRow,
      };
    },

    byId(id: string): LiveQuery<Task> {
      return { sql: "SELECT * FROM tasks WHERE id = ?", parameters: [id], mapper: taskFromRow };
    },
  };
}
