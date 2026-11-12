/**
 * @planner/data — the PowerSync schema and the repositories (PLAN.md §5–6). Shared by
 * every app; only the PowerSync SDK that opens the database differs per platform.
 * Repositories are the only writers, and they ask @planner/core before every write.
 */
import type { Db } from "./db";
import { protocolRepository } from "./protocols";
import { routineRepository } from "./routines";
import { tagRepository } from "./tags";
import { type RepoDeps, taskRepository } from "./tasks";

export * from "./db";
export * from "./errors";
export * from "./schema";
export { taskFromRow, tagFromRow } from "./rows";
export type { DeleteOutcome, RepoDeps, TaskRef, TaskRepository } from "./tasks";
export type { RoutineRepository, StoredEntry } from "./routines";
export type { ProtocolRepository } from "./protocols";
export type { RemovedTag, TagRef, TagRepository, TagUse } from "./tags";

export interface Repositories {
  tasks: ReturnType<typeof taskRepository>;
  tags: ReturnType<typeof tagRepository>;
  routines: ReturnType<typeof routineRepository>;
  protocols: ReturnType<typeof protocolRepository>;
}

export function createRepositories(db: Db, deps: Pick<RepoDeps, "clock"> & Partial<RepoDeps>): Repositories {
  const full: RepoDeps = {
    newId: () => crypto.randomUUID(),
    nowUtc: () => new Date().toISOString(),
    ...deps,
  };
  return {
    tasks: taskRepository(db, full),
    tags: tagRepository(db, full),
    routines: routineRepository(db, full),
    protocols: protocolRepository(db, full),
  };
}
