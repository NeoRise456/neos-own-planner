/**
 * Tags — TASK.md. A name and a color; made on the fly from the task form.
 */
import { type Check, type Issue, type Result, fromCheck, issue, ok } from "./result";

export interface Tag {
  id: string;
  name: string;
  /** A tone name ("sky") or "#RRGGBB" — the UI decides how it looks. */
  color: string;
}

/** Trimmed, inner spaces collapsed. Names match ignoring case. */
export function normalizeTagName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function findTag<T extends Tag>(tags: T[], name: string): T | undefined {
  const wanted = normalizeTagName(name).toLocaleLowerCase();
  return tags.find((t) => t.name.toLocaleLowerCase() === wanted);
}

export function validateTag(tag: Tag, others: Tag[] = []): Check {
  const errors: Issue[] = [];
  if (normalizeTagName(tag.name) === "") errors.push(issue("name_required", "A tag needs a name.", "name"));
  if (tag.color.trim() === "") errors.push(issue("color_required", "A tag needs a color.", "color"));
  const same = findTag(others, tag.name);
  if (same && same.id !== tag.id) errors.push(issue("name_taken", `There's already a tag "${same.name}".`, "name"));
  return { errors, warnings: [] };
}

/**
 * The tag box's list for what was typed: the exact name first, then names that start
 * with it, then names that contain it (each A→Z, ignoring case). Empty text → every tag.
 * `create` is the name to offer as a new tag when no tag has exactly that name.
 */
export function searchTags(tags: Tag[], text: string): { matches: Tag[]; create: string | null } {
  const name = normalizeTagName(text);
  const q = name.toLocaleLowerCase();
  const byName = [...tags].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  if (q === "") return { matches: byName, create: null };
  const rank = (t: Tag) => {
    const n = t.name.toLocaleLowerCase();
    return n === q ? 0 : n.startsWith(q) ? 1 : n.includes(q) ? 2 : 3;
  };
  const matches = byName.filter((t) => rank(t) < 3).sort((a, b) => rank(a) - rank(b));
  return { matches, create: matches.length > 0 && rank(matches[0]!) === 0 ? null : name };
}

/* ── A task's tag list when a tag is deleted or merged ───────────────
 * Order matters: a one-off task's color is its first tag's color. */

/** Deleting a tag: it leaves every task that had it. */
export function withoutTag(ids: string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

/** Undo of a delete: the tag goes back where it was (or last, if the list got shorter). */
export function withTagAt(ids: string[], id: string, index: number): string[] {
  if (ids.includes(id)) return ids;
  const at = Math.max(0, Math.min(index, ids.length));
  return [...ids.slice(0, at), id, ...ids.slice(at)];
}

/** Merging `from` into `into`: `from` becomes `into` in its place, never twice. */
export function mergeTagInto(ids: string[], from: string, into: string): string[] {
  const out: string[] = [];
  for (const x of ids) {
    const v = x === from ? into : x;
    if (!out.includes(v)) out.push(v);
  }
  return out;
}

/**
 * Typing a tag name in the task form: the existing tag with that name, or a new one.
 * `created` says whether it has to be saved.
 */
export function tagForName(
  tags: Tag[],
  name: string,
  make: { id: string; color: string },
): Result<{ tag: Tag; created: boolean }> {
  const existing = findTag(tags, name);
  if (existing) return ok({ tag: existing, created: false });
  const tag: Tag = { id: make.id, name: normalizeTagName(name), color: make.color };
  return fromCheck({ tag, created: true }, validateTag(tag, tags));
}
