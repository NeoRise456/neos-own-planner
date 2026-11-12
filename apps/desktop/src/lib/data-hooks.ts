/**
 * The reads screens share, on top of @planner/data's live queries + @planner/core.
 */
import { useMemo } from "react";
import { type Clock, type LocalDate, type Tag, type TodoDay, todoForDay } from "@planner/core";
import { isDataError } from "@planner/data";
import { useData, useLive } from "@planner/data/react";
import { toast } from "@/components/ui/toast";

/** A day of the Todo list, live. */
export function useTodoDay(day: LocalDate, clock: Clock): { todo: TodoDay; isLoading: boolean; error?: Error } {
  const { repos } = useData();
  const { data, isLoading, error } = useLive(repos ? repos.tasks.aroundDay(day) : null);
  const todo = useMemo(() => todoForDay(data, day, clock), [data, day, clock]);
  return { todo, isLoading, error };
}

/** All tags by id, live. */
export function useTagMap(): Map<string, Tag> {
  const { repos } = useData();
  const { data } = useLive(repos ? repos.tags.all() : null);
  return useMemo(() => new Map(data.map((t) => [t.id, t])), [data]);
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
