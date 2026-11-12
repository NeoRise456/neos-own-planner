/**
 * Settings → Tags: every tag with how many tasks have it. Rename in place, change the
 * color, merge two tags, delete (with Undo), or make a tag ahead of time.
 * Rules live in @planner/core (names, merging) and @planner/data (one write each).
 */
import { useEffect, useState, type KeyboardEvent } from "react";
import { findTag, normalizeTagName } from "@planner/core";
import type { TagUse } from "@planner/data";
import { useData, useLive } from "@planner/data/react";
import { act } from "@/lib/data-hooks";
import { cn } from "@/lib/cn";
import { type Tone, nextTagTone, toneHex } from "@/lib/tones";
import { Button, IconButton } from "@/components/ui/button";
import { Input, inputBase } from "@/components/ui/field";
import { Loader } from "@/components/ui/bits";
import { PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog, TonePicker } from "./dialogs";

const tasksLabel = (n: number) => (n === 0 ? "No tasks" : n === 1 ? "1 task" : `${n} tasks`);

export function TagManager() {
  const { repos, unavailable } = useData();
  const { data: tags, isLoading } = useLive(repos ? repos.tags.withUses() : null);
  const [name, setName] = useState("");

  if (!repos) return <p className="m-0 font-ui text-[12px] text-fg-label">{unavailable}</p>;

  async function add() {
    const n = normalizeTagName(name);
    if (!n) return;
    const same = findTag(tags, n);
    if (same) {
      toast(`There's already a tag “${same.name}”.`);
      return;
    }
    if (await act(repos!.tags.ensure(n, nextTagTone(tags.length)))) setName("");
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <Input aria-label="New tag name" placeholder="New tag name" value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" disabled={!normalizeTagName(name)}>
          <PlusIcon />
          Add tag
        </Button>
      </form>

      {isLoading ? (
        <Loader label="Loading tags" />
      ) : tags.length === 0 ? (
        <p className="m-0 font-ui text-[12px] leading-[18px] text-fg-label">No tags yet. Tags you add to tasks show up here, or make one above.</p>
      ) : (
        <ul aria-label="Tags" className="m-0 flex list-none flex-col divide-y divide-ink-line p-0">
          {tags.map((t) => (
            <TagRow key={t.id} tag={t} all={tags} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TagRow({ tag, all }: { tag: TagUse; all: TagUse[] }) {
  const { repos } = useData();
  const [name, setName] = useState(tag.name);
  /** The other tag the typed name belongs to → offer a merge. */
  const [taken, setTaken] = useState<TagUse | null>(null);
  const [merging, setMerging] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(tag.name);
    setTaken(null);
  }, [tag.name]);

  if (!repos) return null;

  async function saveName() {
    const n = normalizeTagName(name);
    if (n === "" || n === tag.name) {
      setName(tag.name);
      setTaken(null);
      return;
    }
    const other = findTag(
      all.filter((t) => t.id !== tag.id),
      n,
    );
    if (other) {
      setTaken(other);
      return;
    }
    await act(repos!.tags.rename(tag.id, n));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setName(tag.name);
      setTaken(null);
      e.currentTarget.blur();
    }
  }

  async function remove() {
    const removed = await act(repos!.tags.remove(tag.id));
    if (!removed) return;
    const n = removed.from.length;
    toast(n ? `Deleted “${tag.name}” and took it off ${tasksLabel(n).toLowerCase()}.` : `Deleted “${tag.name}”.`, {
      action: { label: "Undo", onClick: () => void act(repos!.tags.restore(removed)) },
    });
  }

  return (
    <li className="flex flex-col gap-2 py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger
            aria-label={`Color of ${tag.name}`}
            title="Change the color"
            className="flex size-8 shrink-0 items-center justify-center rounded-btn border border-ink-line hover:border-fg-muted"
          >
            <span className="size-4 rounded-chip" style={{ background: toneHex(tag.color as Tone) }} />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[326px] p-3">
            <TonePicker value={tag.color as Tone} onChange={(c) => void act(repos.tags.recolor(tag.id, c))} />
          </PopoverContent>
        </Popover>
        <input
          aria-label={`Name of ${tag.name}`}
          title="Click to rename"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setTaken(null);
          }}
          onBlur={() => void saveName()}
          onKeyDown={onKeyDown}
          aria-invalid={taken ? true : undefined}
          className={cn(inputBase, "h-8 min-w-0 flex-1 border-transparent bg-transparent font-ui text-[13px] hover:border-ink-line")}
        />
        <span className="w-[72px] shrink-0 text-right font-ui text-[12px] text-fg-label tabular-nums">{tasksLabel(tag.uses)}</span>
        <IconButton label={`Delete ${tag.name}`} tone="muted" onClick={() => setDeleting(true)}>
          <TrashIcon />
        </IconButton>
      </div>

      {taken && (
        <div className="ml-10 flex flex-wrap items-center gap-2" role="alert">
          <span className="font-ui text-[12px] text-error">There's already a tag “{taken.name}”.</span>
          <Button size="sm" onClick={() => setMerging(true)}>
            Merge into “{taken.name}”
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setName(tag.name);
              setTaken(null);
            }}
          >
            Keep “{tag.name}”
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete “${tag.name}”?`}
        body={
          tag.uses === 0
            ? "No task has this tag. You can undo for a few seconds afterwards."
            : `It comes off ${tag.uses === 1 ? "the 1 task" : `the ${tag.uses} tasks`} that ${tag.uses === 1 ? "has" : "have"} it; the tasks themselves stay. You can undo for a few seconds afterwards.`
        }
        confirmLabel="Delete tag"
        onConfirm={() => void remove()}
      />

      {taken && (
        <ConfirmDialog
          open={merging}
          onOpenChange={setMerging}
          variant="primary"
          title={`Merge “${tag.name}” into “${taken.name}”?`}
          body={`${
            tag.uses === 0
              ? "Nothing is tagged with it, so"
              : tag.uses === 1
                ? `The task tagged “${tag.name}” gets “${taken.name}” instead, and`
                : `The ${tag.uses} tasks tagged “${tag.name}” get “${taken.name}” instead, and`
          } “${tag.name}” is deleted. This can't be undone.`}
          confirmLabel="Merge"
          cancelLabel="Cancel"
          onConfirm={() =>
            void act(repos.tags.merge(tag.id, taken.id), (n) =>
              toast(n ? `Merged. ${tasksLabel(n)} now ${n === 1 ? "has" : "have"} “${taken.name}”.` : `Merged into “${taken.name}”.`),
            )
          }
        />
      )}
    </li>
  );
}
