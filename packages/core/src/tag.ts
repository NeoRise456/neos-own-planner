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

export function findTag(tags: Tag[], name: string): Tag | undefined {
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
