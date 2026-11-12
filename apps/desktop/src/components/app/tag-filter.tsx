/**
 * Tag filter chips (Todo and Calendar): one chip per tag on the tasks in view; picking
 * one shows only that tag's tasks, picking it again shows everything.
 */
import type { Tag, Task } from "@planner/core";
import { cn } from "@/lib/cn";
import { type Tone, toneHex } from "@/lib/tones";

/** The tags on `tasks` (plus the chosen one, so it can be turned off), A→Z. */
export function tagsOf(tasks: Task[], tags: Map<string, Tag>, selected: string | null): Tag[] {
  const ids = new Set<string>();
  for (const t of tasks) for (const id of t.tags) ids.add(id);
  if (selected) ids.add(selected);
  return [...ids]
    .map((id) => tags.get(id))
    .filter((t): t is Tag => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export function TagFilter({
  tags,
  selected,
  onSelect,
  className,
}: {
  tags: Tag[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label="Filter by tag" className={cn("mt-4 flex flex-wrap gap-1.5", className)}>
      {tags.map((t) => {
        const on = t.id === selected;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(on ? null : t.id)}
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-chip px-2.5 font-ui text-[12px] transition-colors duration-[120ms] ease-snap",
              on ? "bg-fg-white text-black hover:bg-primary-hover" : "bg-ink-fill text-fg-secondary hover:bg-ink-fill-hover hover:text-fg-white",
            )}
          >
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: toneHex(t.color as Tone) }} />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
