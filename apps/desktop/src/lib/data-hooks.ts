/**
 * The reads screens share, on top of @planner/data's live queries + @planner/core.
 * Routine tasks are never all stored: `useRoutineTasks` produces them for a range of days
 * from the routines and entries (core `expandRoutineTasks`), with the saved (touched) ones
 * laid over the fresh ones.
 */
import { useMemo } from "react";
import {
  type Clock,
  type LocalDate,
  type Protocol,
  type Routine,
  type Tag,
  type Task,
  type TodoDay,
  expandRoutineTasks,
  todoForDay,
} from "@planner/core";
import { type StoredEntry, isDataError } from "@planner/data";
import { useData, useLive } from "@planner/data/react";
import { toast } from "@/components/ui/toast";
import type { Palette } from "./task-view";

const EMPTY: never[] = [];

/** Every routine and every entry, live. */
export function useRoutineModel(): { routines: Routine[]; entries: StoredEntry[]; isLoading: boolean } {
  const { repos } = useData();
  const r = useLive(repos ? repos.routines.all() : null);
  const e = useLive(repos ? repos.routines.entries() : null);
  return { routines: r.data, entries: e.data, isLoading: r.isLoading || e.isLoading };
}

/** The routine tasks placed on the days from `from` to `to` (fresh + saved), live. */
export function useRoutineTasks(from: LocalDate, to: LocalDate): { tasks: Task[]; isLoading: boolean } {
  const { repos } = useData();
  const { routines, entries, isLoading } = useRoutineModel();
  const saved = useLive(repos ? repos.tasks.savedCopies(from, to) : null);
  const tasks = useMemo(
    () => (routines.length ? expandRoutineTasks({ routines, entries, saved: saved.data, from, to }) : EMPTY),
    [routines, entries, saved.data, from, to],
  );
  return { tasks, isLoading: isLoading || saved.isLoading };
}

/** A day of the Todo list: one-offs + routine tasks, live. */
export function useTodoDay(day: LocalDate, clock: Clock): { todo: TodoDay; tasks: Task[]; isLoading: boolean; error?: Error } {
  const { repos } = useData();
  const oneOffs = useLive(repos ? repos.tasks.aroundDay(day) : null);
  const copies = useRoutineTasks(day, day);
  const tasks = useMemo(() => [...oneOffs.data, ...copies.tasks], [oneOffs.data, copies.tasks]);
  const todo = useMemo(() => todoForDay(tasks, day, clock), [tasks, day, clock]);
  return { todo, tasks, isLoading: oneOffs.isLoading || copies.isLoading, error: oneOffs.error };
}

/** All tags by id, live. */
export function useTagMap(): Map<string, Tag> {
  const { repos } = useData();
  const { data } = useLive(repos ? repos.tags.all() : null);
  return useMemo(() => new Map(data.map((t) => [t.id, t])), [data]);
}

/** All protocols by id, live. */
export function useProtocolMap(): Map<string, Protocol> {
  const { repos } = useData();
  const { data } = useLive(repos ? repos.protocols.all() : null);
  return useMemo(() => new Map(data.map((p) => [p.id, p])), [data]);
}

/** What colors a task: its routine's color, else its first tag's (task-view `toneOf`). */
export function usePalette(): Palette {
  const tags = useTagMap();
  const { routines, entries } = useRoutineModel();
  return useMemo(() => {
    const byId = new Map(routines.map((r) => [r.id, r]));
    const routineOf = new Map<string, Routine>();
    for (const e of entries) {
      const r = byId.get(e.routineId);
      if (r) routineOf.set(e.id, r);
    }
    return { tags, routineOf, entries: new Map(entries.map((e) => [e.id, e])) };
  }, [tags, routines, entries]);
}

/**
 * Runs a repository action; a refusal or failure becomes a toast instead of an
 * unhandled error. Resolves to the result, or undefined when it failed.
 */
export async function act<T>(action: Promise<T>, onDone?: string | ((value: T) => void)): Promise<T | undefined> {
  try {
    const value = await action;
    if (typeof onDone === "string") toast(onDone);
    else onDone?.(value);
    return value;
  } catch (e) {
    console.error(e);
    toast(isDataError(e) ? e.message : `Something went wrong: ${e instanceof Error ? e.message : String(e)}`);
    return undefined;
  }
}
