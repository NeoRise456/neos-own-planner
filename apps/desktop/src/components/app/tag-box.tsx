/**
 * Tag box — DESIGN.md "Tag box". The chosen tags as chips, and a text box that searches
 * your tags as you type (@planner/core `searchTags`: exact name, then starts-with, then
 * contains). The first match is highlighted, so Enter takes it; ↑ / ↓ pick another;
 * a click works too. When no tag has exactly the typed name, the list ends with
 * "Create …": that tag is kept here, marked new, and made when the task is saved.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { type Tag, findTag, normalizeTagName, searchTags } from "@planner/core";
import type { TagRef } from "@planner/data";
import { cn } from "@/lib/cn";
import { type Tone, nextTagTone, toneHex } from "@/lib/tones";
import { inputBase } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/menu";
import { TagChip } from "./todo";

/** A tag in a form: an existing one (id), or a name to create on save. */
export type FormTag = { id?: string; name: string; color: string };

export const toTagRefs = (tags: FormTag[]): TagRef[] => tags.map((t) => (t.id ? { id: t.id } : { name: t.name, color: t.color }));

type Option = { kind: "tag"; tag: Tag } | { kind: "create"; name: string };

export function TagBox({
  value,
  onChange,
  known,
  placeholder = "Add a tag",
  ...a
}: {
  value: FormTag[];
  onChange: (tags: FormTag[]) => void;
  known: Tag[];
  placeholder?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const shell = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const listId = useId();

  const chosen = (t: Pick<FormTag, "id" | "name">) =>
    value.some((v) => (t.id && v.id === t.id) || v.name.toLocaleLowerCase() === t.name.toLocaleLowerCase());

  const options = useMemo<Option[]>(() => {
    const { matches, create } = searchTags(known, text);
    const out: Option[] = matches.filter((t) => !chosen(t)).map((tag) => ({ kind: "tag", tag }));
    if (create && !chosen({ name: create })) out.push({ kind: "create", name: create });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known, text, value]);

  // Typing starts again from the first match.
  useEffect(() => setActive(0), [text]);
  const current = Math.min(active, options.length - 1);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const newCount = value.filter((t) => !t.id).length;

  function pick(o: Option) {
    if (o.kind === "tag") onChange([...value, { id: o.tag.id, name: o.tag.name, color: o.tag.color }]);
    else onChange([...value, { name: o.name, color: nextTagTone(known.length + newCount) }]);
    setText("");
  }

  /** Enter with no option highlighted: that exact name (never a partial match). Leaving the box adds nothing. */
  function takeTyped() {
    const name = normalizeTagName(text);
    setText("");
    if (!name || chosen({ name })) return;
    const tag = findTag(known, name);
    onChange([...value, tag ? { id: tag.id, name: tag.name, color: tag.color } : { name, color: nextTagTone(known.length + newCount) }]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (options.length) setActive((current + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
    } else if (e.key === "Enter" || e.key === ",") {
      // With text, Enter adds a tag; it doesn't submit the form underneath.
      if (text.trim() === "" && e.key === "Enter") return;
      e.preventDefault();
      const o = options[current];
      if (o) pick(o);
      else takeTyped();
    } else if (e.key === "Backspace" && text === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  const showList = open && options.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <TagChip key={t.id ?? `new:${t.name}`} tag={t} isNew={!t.id} onRemove={() => onChange(value.filter((x) => x !== t))} />
          ))}
        </div>
      )}
      <Popover open={showList} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={shell}>
            <input
              {...a}
              role="combobox"
              aria-expanded={showList}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={showList ? `${listId}-${current}` : undefined}
              autoComplete="off"
              placeholder={placeholder}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onClick={() => setOpen(true)}
              onKeyDown={onKeyDown}
              onBlur={() => setOpen(false)}
              className={cn(inputBase, "h-9 font-ui text-[13px]")}
            />
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-1"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (shell.current?.contains(e.target as Node)) e.preventDefault();
          }}
        >
          <div ref={list} id={listId} role="listbox" aria-label="Tags" className="flex max-h-[232px] flex-col gap-0.5 overflow-y-auto">
            {options.map((o, i) => (
              <div
                key={o.kind === "tag" ? o.tag.id : "create"}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === current}
                // Keep the focus in the text box, so clicking doesn't count as leaving it.
                onMouseDown={(e) => e.preventDefault()}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(o)}
                className={cn(
                  "flex h-8 shrink-0 cursor-pointer items-center gap-2.5 rounded-btn px-2.5 font-ui text-[13px] transition-colors duration-[120ms]",
                  i === current ? "bg-ink-fill-hover text-fg-white" : "text-fg",
                  o.kind === "create" && i > 0 && "mt-0.5",
                )}
              >
                {o.kind === "tag" ? (
                  <>
                    <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: toneHex(o.tag.color as Tone) }} />
                    <span className="min-w-0 flex-1 truncate">{o.tag.name}</span>
                  </>
                ) : (
                  <>
                    <PlusIcon size={10} className="shrink-0 text-fg-label" />
                    <span className="min-w-0 flex-1 truncate">
                      Create <span className="text-fg-white">“{o.name}”</span>
                    </span>
                    <span className="shrink-0 text-[11px] text-fg-label">new tag</span>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="mt-1 flex justify-between border-t border-ink-line-soft px-2.5 pt-1.5 pb-0.5 font-ui text-[11px] text-fg-label">
            <span>↑ ↓ to choose</span>
            <span>Enter to add</span>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
