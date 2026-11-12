/**
 * Domain objects ↔ table rows. SQL NULL ↔ a missing field; tags as a JSON array of ids.
 */
import type { EntryVersion, Protocol, Routine, RoutineEntry, Tag, Task } from "@planner/core";
import type { Param, Row } from "./db";

const text = (v: unknown): string | undefined => (v === null || v === undefined ? undefined : String(v));
const int = (v: unknown): number | undefined => (v === null || v === undefined ? undefined : Number(v));

function jsonArray(v: unknown): unknown[] {
  if (typeof v !== "string" || v === "") return [];
  try {
    const parsed: unknown = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
const strings = (v: unknown): string[] => jsonArray(v).filter((x): x is string => typeof x === "string");
const tagIds = strings;

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

export function routineFromRow(row: Row): Routine {
  return compact<Routine>({
    id: String(row.id),
    title: String(row.title ?? ""),
    purpose: text(row.purpose),
    startDate: String(row.start_date ?? ""),
    endDate: String(row.end_date ?? ""),
    clonedFrom: text(row.cloned_from),
    lineage: String(row.lineage ?? row.id),
    publishedAt: text(row.published_at),
    color: text(row.color),
  });
}

/** The routine's own columns (without id and the timestamps). */
export function routineColumns(r: Routine): Record<string, Param> {
  return {
    title: r.title,
    purpose: r.purpose ?? null,
    color: r.color ?? null,
    start_date: r.startDate,
    end_date: r.endDate,
    cloned_from: r.clonedFrom ?? null,
    lineage: r.lineage,
    published_at: r.publishedAt ?? null,
  };
}

export function entryFromRow(row: Row): RoutineEntry & { position: number } {
  return compact({
    id: String(row.id),
    routineId: String(row.routine_id ?? ""),
    versions: jsonArray(row.versions) as EntryVersion[],
    removedFrom: text(row.removed_from),
    position: Number(row.position ?? 0),
  });
}

export function entryColumns(e: RoutineEntry): Record<string, Param> {
  return { routine_id: e.routineId, versions: JSON.stringify(e.versions), removed_from: e.removedFrom ?? null };
}

export function protocolFromRow(row: Row): Protocol {
  return { id: String(row.id), title: String(row.title ?? ""), steps: strings(row.steps) };
}
