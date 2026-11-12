/**
 * Tag repository. Tags are made on the fly from the task form: typing a name gives the
 * existing tag with that name (ignoring case) or a new one (TASK.md).
 */
import { type Tag, normalizeTagName, tagForName, validateTag } from "@planner/core";
import type { Db, LiveQuery, SqlRunner } from "./db";
import { DataError } from "./errors";
import { tagFromRow } from "./rows";
import { insertRow, updateRow } from "./sql";
import type { RepoDeps } from "./tasks";

export type TagRepository = ReturnType<typeof tagRepository>;

const allTags = async (tx: SqlRunner) => (await tx.getAll("SELECT * FROM tags ORDER BY name, id")).map(tagFromRow);

export function tagRepository(db: Db, deps: RepoDeps) {
  return {
    list: () => allTags(db),

    /** The tag called `name`, created with `color` if there isn't one yet. */
    ensure(name: string, color: string): Promise<Tag> {
      return db.writeTransaction(async (tx) => {
        const result = tagForName(await allTags(tx), name, { id: deps.newId(), color });
        if (!result.ok) throw new DataError("invalid", result.errors);
        const { tag, created } = result.value;
        if (created) {
          const now = deps.nowUtc();
          await insertRow(tx, "tags", tag.id, { name: tag.name, color: tag.color, created_at: now, updated_at: now });
        }
        return tag;
      });
    },

    rename(id: string, name: string): Promise<Tag> {
      return db.writeTransaction(async (tx) => {
        const tags = await allTags(tx);
        const tag = tags.find((t) => t.id === id);
        if (!tag) throw DataError.notFound("tag", id);
        const next = { ...tag, name: normalizeTagName(name) };
        const check = validateTag(next, tags);
        if (check.errors.length) throw new DataError("invalid", check.errors);
        await updateRow(tx, "tags", id, { name: next.name, updated_at: deps.nowUtc() });
        return next;
      });
    },

    all(): LiveQuery<Tag> {
      return { sql: "SELECT * FROM tags ORDER BY name, id", parameters: [], mapper: tagFromRow };
    },
  };
}
