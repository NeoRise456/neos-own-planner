/**
 * The database schema (PLAN.md §6). PowerSync tables are views over JSON rows, so there
 * are no client migrations: adding a column = adding it here. Every table also gets an
 * `id` (UUID text) from PowerSync.
 *
 * Only what phase 2 uses so far: tasks and tags. Routines, entries, protocols and
 * settings arrive with their phases.
 */
import { Schema, Table, column } from "@powersync/common";

export type ColumnType = "text" | "integer";

/** The columns of each table, as plain data (also used to build the test database). */
export const TABLES = {
  tasks: {
    title: "text",
    notes: "text",
    /** JSON array of tag ids. */
    tag_ids: "text",
    /** Minutes. */
    duration: "integer",
    start_date: "text",
    start_time: "text",
    due_date: "text",
    due_time: "text",
    protocol_id: "text",
    done_at: "text",
    logged_at: "text",
    cancelled_at: "text",
    // Only routine copies (phase 5):
    routine_entry_id: "text",
    occurrence_date: "text",
    occurrence_slot: "integer",
    /** UTC ISO instants, set by the repositories. */
    created_at: "text",
    updated_at: "text",
  },
  tags: {
    name: "text",
    color: "text",
    created_at: "text",
    updated_at: "text",
  },
} as const satisfies Record<string, Record<string, ColumnType>>;

export type TableName = keyof typeof TABLES;

export const schema = new Schema(
  Object.fromEntries(
    Object.entries(TABLES).map(([name, cols]) => [
      name,
      new Table(Object.fromEntries(Object.entries(cols).map(([c, type]) => [c, column[type as ColumnType]]))),
    ]),
  ),
);
