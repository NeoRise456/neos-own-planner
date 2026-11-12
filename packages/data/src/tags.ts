/**
 * Tag repository. Tags are their own records (id, name, color); tasks keep a list of
 * tag ids. Typing a name gives the existing tag with that name (ignoring case) or a new
 * one (TASK.md). Settings â†’ Tags renames, recolors, merges and deletes them.
 */
import { type Tag, mergeTagInto, normalizeTagName, tagForName, validateTag, withTagAt, withoutTag } from "@planner/core";
import type { Db, LiveQuery, Row, SqlRunner } from "./db";
import { DataError } from "./errors";
import { tagFromRow } from "./rows";
import { deleteRow, insertRow, updateRow } from "./sql";
import type { RepoDeps } from "./tasks";

export type TagRepository = ReturnType<typeof tagRepository>;

/** A tag for a task: one that exists, or a name (and color) to create when the task is saved. */
export type TagRef = { id: string } | { name: string; color: string };

/** A tag and how many tasks have it (Settings â†’ Tags). */
export interface TagUse extends Tag {
  uses: number;
}

/** What a delete took away, so Undo can put it all back. */
export interface RemovedTag {
  tag: Tag;
  createdAt: string | null;
  /** Each task that had it, and where it was in that task's list. */
  from: { taskId: string; index: number }[];
}

const allTags = async (tx: SqlRunner) => (await tx.getAll("SELECT * FROM tags ORDER BY name, id")).map(tagFromRow);

async function loadTag(tx: SqlRunner, id: string): Promise<Tag> {
  const row = await tx.getOptional("SELECT * FROM tags WHERE id = ?", [id]);
  if (!row) throw DataError.notFound("tag", id);
  return tagFromRow(row);
}

/** The tasks that have tag `id`, with their tag lists. */
async function tasksWith(tx: SqlRunner, id: string): Promise<{ id: string; tags: string[] }[]> {
  const rows = await tx.getAll<{ id: string; tag_ids: string | null }>(
    "SELECT id, tag_ids FROM tasks WHERE EXISTS (SELECT 1 FROM json_each(tasks.tag_ids) WHERE value = ?)",
    [id],
  );
  return rows.map((r) => ({ id: r.id, tags: JSON.parse(r.tag_ids ?? "[]") as string[] }));
}

async function setTaskTags(tx: SqlRunner, deps: RepoDeps, taskId: string, tags: string[]) {
  await updateRow(tx, "tasks", taskId, { tag_ids: JSON.stringify(tags), updated_at: deps.nowUtc() });
}

/** The tag called `name`, created with `color` if there isn't one yet â€” inside a transaction. */
export async function ensureTag(tx: SqlRunner, deps: RepoDeps, name: string, color: string): Promise<Tag> {
  const result = tagForName(await allTags(tx), name, { id: deps.newId(), color });
  if (!result.ok) throw new DataError("invalid", result.errors);
  const { tag, created } = result.value;
  if (created) {
    const now = deps.nowUtc();
    await insertRow(tx, "tags", tag.id, { name: tag.name, color: tag.color, created_at: now, updated_at: now });
  }
  return tag;
}

/** TagRefs â†’ tag ids, creating the new ones (in order, no doubles). */
export async function resolveTags(tx: SqlRunner, deps: RepoDeps, refs: TagRef[]): Promise<string[]> {
  const ids: string[] = [];
  for (const ref of refs) {
    const id = "id" in ref ? ref.id : (await ensureTag(tx, deps, ref.name, ref.color)).id;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function tagRepository(db: Db, deps: RepoDeps) {
  /** Load â†’ change â†’ check â†’ save name/color. */
  function change(id: string, edit: (tag: Tag) => Tag): Promise<Tag> {
    return db.writeTransaction(async (tx) => {
      const tags = await allTags(tx);
      const tag = tags.find((t) => t.id === id);
      if (!tag) throw DataError.notFound("tag", id);
      const next = edit(tag);
      const check = validateTag(next, tags);
      if (check.errors.length) throw new DataError("invalid", check.errors);
      const changed: Record<string, string> = {};
      if (next.name !== tag.name) changed.name = next.name;
      if (next.color !== tag.color) changed.color = next.color;
      if (Object.keys(changed).length) await updateRow(tx, "tags", id, { ...changed, updated_at: deps.nowUtc() });
      return next;
    });
  }

  return {
    list: () => allTags(db),

    /** The tag called `name`, created with `color` if there isn't one yet. */
    ensure: (name: string, color: string): Promise<Tag> => db.writeTransaction((tx) => ensureTag(tx, deps, name, color)),

    /** A name another tag has is refused (`name_taken`) â€” merge instead. */
    rename: (id: string, name: string) => change(id, (t) => ({ ...t, name: normalizeTagName(name) })),

    recolor: (id: string, color: string) => change(id, (t) => ({ ...t, color })),

    /** Deletes the tag and takes it off every task, in one go. `restore` undoes it. */
    remove(id: string): Promise<RemovedTag> {
      return db.writeTransaction(async (tx) => {
        const tag = await loadTag(tx, id);
        const row = await tx.getOptional<{ created_at: string | null }>("SELECT created_at FROM tags WHERE id = ?", [id]);
        const from: RemovedTag["from"] = [];
        for (const t of await tasksWith(tx, id)) {
          from.push({ taskId: t.id, index: t.tags.indexOf(id) });
          await setTaskTags(tx, deps, t.id, withoutTag(t.tags, id));
        }
        await deleteRow(tx, "tags", id);
        return { tag, createdAt: row?.created_at ?? null, from };
      });
    },

    /** Undo of a delete: the same tag back, on the same tasks, in the same place. */
    restore(removed: RemovedTag): Promise<Tag> {
      return db.writeTransaction(async (tx) => {
        const { tag } = removed;
        const check = validateTag(tag, await allTags(tx));
        if (check.errors.length) throw new DataError("invalid", check.errors);
        const now = deps.nowUtc();
        await insertRow(tx, "tags", tag.id, { name: tag.name, color: tag.color, created_at: removed.createdAt ?? now, updated_at: now });
        for (const { taskId, index } of removed.from) {
          const row = await tx.getOptional<{ tag_ids: string | null }>("SELECT tag_ids FROM tasks WHERE id = ?", [taskId]);
          if (!row) continue; // deleted since
          await setTaskTags(tx, deps, taskId, withTagAt(JSON.parse(row.tag_ids ?? "[]") as string[], tag.id, index));
        }
        return tag;
      });
    },

    /** Every task with `fromId` gets `intoId` instead; then `fromId` is deleted. Returns how many tasks changed. */
    merge(fromId: string, intoId: string): Promise<number> {
      return db.writeTransaction(async (tx) => {
        if (fromId === intoId) return 0;
        await loadTag(tx, fromId);
        await loadTag(tx, intoId);
        const tasks = await tasksWith(tx, fromId);
        for (const t of tasks) await setTaskTags(tx, deps, t.id, mergeTagInto(t.tags, fromId, intoId));
        await deleteRow(tx, "tags", fromId);
        return tasks.length;
      });
    },

    all(): LiveQuery<Tag> {
      return { sql: "SELECT * FROM tags ORDER BY name COLLATE NOCASE, id", parameters: [], mapper: tagFromRow };
    },

    /** Every tag with the number of tasks (open or closed) that have it. */
    withUses(): LiveQuery<TagUse> {
      return {
        sql: `SELECT tags.*, (SELECT count(*) FROM tasks, json_each(tasks.tag_ids) j WHERE j.value = tags.id) AS uses
              FROM tags ORDER BY name COLLATE NOCASE, id`,
        parameters: [],
        mapper: (row: Row) => ({ ...tagFromRow(row), uses: Number(row.uses ?? 0) }),
      };
    },
  };
}
