import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toneHex } from "@/lib/tones";
import { useMock } from "@/mock/store";
import type { MockEntry } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Label, Progress } from "@/components/ui/bits";
import { CopyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Glyph, GlyphTile } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog, EditRoutineDialog, EndDateDialog, EntryDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/routines/$routineId")({ component: RoutinePage });

/** Routine detail — screens/30-routines. */
function RoutinePage() {
  const { routineId } = Route.useParams();
  const routine = useMock((s) => s.routines.find((r) => r.id === routineId));
  const duplicate = useMock((s) => s.duplicateRoutine);
  const remove = useMock((s) => s.deleteRoutine);
  const navigate = useNavigate();
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<MockEntry | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);

  if (!routine) {
    return <main className="px-12 pt-11 font-ui text-fg-label">This routine doesn't exist anymore.</main>;
  }

  const ended = !!routine.ended;
  const dup = () => {
    const id = duplicate(routine.id);
    toast("Duplicated. Pick the new dates.");
    navigate({ to: "/routines/$routineId", params: { routineId: id } });
  };

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      <div className="mx-auto flex max-w-[680px] flex-col">
        <div className="flex items-center gap-5">
          <GlyphTile glyph={routine.glyph} tone={routine.tone} filled={!ended} dim={ended} size={76} glyphSize={36} radius={14} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">{routine.name}</h1>
            {routine.purpose && <span className="read text-[17px] text-fg-secondary">{routine.purpose}</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip size="md">{routine.period}</Chip>
          <Chip size="md" className={ended ? "text-fg-label" : "bg-fg-white text-black"}>
            {routine.status}
          </Chip>
        </div>

        {/* Stat card */}
        <section className="mt-8 flex flex-col gap-[14px] rounded-tile border border-ink-line-soft px-[22px] py-5">
          <div className="flex flex-wrap items-baseline gap-[14px]">
            <span className="read text-[56px] leading-[52px] font-extrabold tracking-[-.03em] text-fg-white">{routine.pct}%</span>
            <span className="font-ui text-[12px] text-fg-label">{routine.pctLabel}</span>
          </div>
          <Progress value={routine.pct} label="Consistency" color={ended ? "#6B6B6B" : "#FFFFFF"} />
          <span className="font-ui text-[11px] text-fg-label">Done ÷ (done + missed). Cancelled doesn't count.</span>
        </section>

        {/* Entries */}
        <section className="mt-[34px] flex flex-col">
          <div className="flex items-center justify-between border-b border-ink-line-soft pb-1.5">
            <Label as="h2">Entries</Label>
            <span className="font-ui text-[11px] text-fg-label">
              {routine.entries.length} {routine.entries.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {routine.entries.length === 0 && (
            <EmptyState
              className="py-10"
              glyph={routine.glyph}
              title="No entries yet"
              body="Entries are what the routine repeats: Gym on Mon, Wed and Fri, or Water 4 times a day."
              actions={
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    setEditing(undefined);
                    setEntryOpen(true);
                  }}
                >
                  <PlusIcon />
                  Add the first entry
                </Button>
              }
            />
          )}
          {routine.entries.map((e) => {
            const et = ended ? "#6B6B6B" : toneHex(e.tone ?? routine.tone);
            return (
              <button
                key={e.id}
                type="button"
                aria-label={`${e.title}, ${e.rule}, ${e.score}. Edit entry`}
                onClick={() => {
                  setEditing(e);
                  setEntryOpen(true);
                }}
                className="-mx-3 box-border flex min-h-[68px] w-[calc(100%+24px)] items-center gap-[14px] rounded-drop border-b border-ink-line-faint px-3 py-2.5 text-left transition-colors hover:bg-ink-hover"
              >
                <span aria-hidden className="flex size-[38px] shrink-0 items-center justify-center rounded-card border border-ink-line">
                  <Glyph size={17} color={et}>
                    {e.glyph}
                  </Glyph>
                </span>
                <span className="flex min-w-0 flex-auto flex-col gap-[3px]">
                  <span className="read text-[16px] font-bold text-fg-white">{e.title}</span>
                  <span className="font-ui text-[11px] text-fg-label">{e.rule}</span>
                </span>
                <span aria-hidden className="flex max-w-[150px] flex-wrap justify-end gap-[3px]">
                  {e.seq.split("").map((k, i) => (
                    <span key={i} className="size-[9px] rounded-[2px]" style={{ background: k === "d" ? et : "#2A2A2A" }} />
                  ))}
                </span>
                <span className="min-w-11 text-right font-ui text-[13px] font-semibold text-fg-white tabular-nums">{e.score}</span>
              </button>
            );
          })}
          <Button
            size="sm"
            className="mt-3 h-[30px] self-start"
            onClick={() => {
              setEditing(undefined);
              setEntryOpen(true);
            }}
          >
            <PlusIcon size={10} />
            Add entry
          </Button>
        </section>

        {/* Actions */}
        <div className="mt-10 flex flex-wrap gap-2 border-t border-ink-line-soft pt-5">
          {ended && (
            <Button size="lg" variant="primary" onClick={dup}>
              <CopyIcon />
              Duplicate to restart
            </Button>
          )}
          <Button size="lg" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
          <Button size="lg" onClick={() => setEndOpen(true)}>
            Change end date
          </Button>
          {!ended && (
            <Button size="lg" onClick={dup}>
              Duplicate
            </Button>
          )}
          <Button size="lg" variant="danger" className="ml-auto" onClick={() => setDelOpen(true)}>
            <TrashIcon />
            Delete
          </Button>
        </div>
      </div>

      <EntryDialog routine={routine} entry={editing} open={entryOpen} onOpenChange={setEntryOpen} />
      <EditRoutineDialog routine={routine} open={editOpen} onOpenChange={setEditOpen} />
      <EndDateDialog routine={routine} open={endOpen} onOpenChange={setEndOpen} />
      <ConfirmDialog
        open={delOpen}
        onOpenChange={setDelOpen}
        title={`Delete “${routine.name}”?`}
        body="This deletes its whole history: every done, missed and cancelled task. To stop a routine and keep its history, change its end date instead."
        confirmLabel="Delete routine"
        onConfirm={() => {
          remove(routine.id);
          toast("Routine deleted.");
          navigate({ to: "/routines" });
        }}
      />
    </main>
  );
}
