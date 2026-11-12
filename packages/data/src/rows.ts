/**
 * Domain objects ↔ table rows. SQL NULL ↔ a missing field; tags as a JSON array of ids.
 */
import type { Tag, Task } from "@planner/core";
import type { Param, Row } from "./db";

const text = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const int = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));

function tagIds(v: unknown): string[] {
  if (typeof v !== "string" || v === "") return [];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function compact<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export function taskFromRow(row: Row): Task {
  return compact<Task>({
    id: String(row.id),
    title: String(row.title ?? ""),
    notes: text(row.notes),
    tags: tagIds(row.tag_ids),
    duration: int(row.duration),
    startDate: text(row.start_date),
    startTime: text(row.start_time),
    dueDate: text(row.due_date),
    dueTime: text(row.due_time),
    protocolId: text(row.protocol_id),
    doneAt: text(row.done_at),
    loggedAt: text(row.logged_at),
    cancelledAt: text(row.cancelled_at),
    routineEntryId: text(row.routine_entry_id),
    occurrenceDate: text(row.occurrence_date),
    occurrenceSlot: int(row.occurrence_slot),
  });
}

/** The task's own columns (without id and the timestamps). */
export function taskColumns(task: Task): Record<string, Param> {
  return {
    title: task.title,
    notes: task.notes ?? null,
    tag_ids: JSON.stringify(task.tags),
    duration: task.duration ?? null,
    start_date: task.startDate ?? null,
    start_time: task.startTime ?? null,
    due_date: task.dueDate ?? null,
    due_time: task.dueTime ?? null,
    protocol_id: task.protocolId ?? null,
    done_at: task.doneAt ?? null,
    logged_at: task.loggedAt ?? null,
    cancelled_at: task.cancelledAt ?? null,
    routine_entry_id: task.routineEntryId ?? null,
    occurrence_date: task.occurrenceDate ?? null,
    occurrence_slot: task.occurrenceSlot ?? null,
  };
}

export function tagFromRow(row: Row): Tag {
  return { id: String(row.id), name: String(row.name ?? ""), color: String(row.color ?? "") };
}

/** Only the columns whose value changed — updates upload just those (PLAN.md §7, last write wins per field). */
export function changedColumns(before: Record<string, Param>, after: Record<string, Param>): Record<string, Param> {
  return Object.fromEntries(Object.entries(after).filter(([k, v]) => before[k] !== v));
}
