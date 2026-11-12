import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toneHex } from "@/lib/tones";
import { useMock } from "@/mock/store";
import type { MockEntry, MockRoutine } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Label, Progress } from "@/components/ui/bits";
import { CopyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { Glyph, GlyphTile } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { ConfirmDialog, EditRoutineDialog, EndDateDialog, EntryDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/routines/$routineId")({ component: RoutinePage });

type Confirm = "publish" | "end" | "unpublish" | "delete" | null;

/**
 * Routine detail — screens/30-routines, plus the draft → publish flow (SYSTEMS.md):
 * - draft: no tasks yet, edit anything, Publish card instead of the stats
 * - published: End (ends today); back to draft / delete only while nothing is done
 * - ended: duplicate to restart
 */
function RoutinePage() {
  const { routineId } = Route.useParams();
  const routine = useMock((s) => s.routines.find((r) => r.id === routineId));
  const store = useMock.getState();
  const navigate = useNavigate();
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<MockEntry | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  if (!routine) {
    return <main className="px-12 pt-11 font-ui text-fg-label">This routine doesn't exist anymore.</main>;
  }

  const draft = !!routine.draft;
  const ended = !!routine.ended;
  // Mock stand-in for "has a done task" (core: lastDoneDay / canDeleteRoutine).
  const hasDone = routine.entries.some((e) => e.seq.includes("d"));
  const canDelete = draft || !hasDone;

  const openEntry = (e?: MockEntry) => {
    setEditing(e);
    setEntryOpen(true);
  };
  const dup = () => {
    const id = store.duplicateRoutine(routine.id);
    toast("Duplicated as a draft. Pick the new dates, then publish.");
    navigate({ to: "/routines/$routineId", params: { routineId: id } });
  };

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      <div className="mx-auto flex max-w-[680px] flex-col">
        <div className="flex items-center gap-5">
          <GlyphTile glyph={routine.glyph} tone={routine.tone} filled={!ended && !draft} dim={ended} size={76} glyphSize={36} radius={14} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">{routine.name}</h1>
            {routine.purpose && <span className="read text-[17px] text-fg-secondary">{routine.purpose}</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip size="md">{routine.period}</Chip>
          <Chip
            size="md"
            className={draft ? "border border-ink-line bg-transparent text-fg-secondary" : ended ? "text-fg-label" : "bg-fg-white text-black"}
          >
            {routine.status}
          </Chip>
        </div>

        {draft ? (
          <DraftCard routine={routine} onPublish={() => setConfirm("publish")} />
        ) : (
          <section className="mt-8 flex flex-col gap-[14px] rounded-tile border border-ink-line-soft px-[22px] py-5">
            <div className="flex flex-wrap items-baseline gap-[14px]">
              <span className="read text-[56px] leading-[52px] font-extrabold tracking-[-.03em] text-fg-white">{routine.pct}%</span>
              <span className="font-ui text-[12px] text-fg-label">{routine.pctLabel}</span>
            </div>
            <Progress value={routine.pct} label="Consistency" color={ended ? "#6B6B6B" : "#FFFFFF"} />
            <span className="font-ui text-[11px] text-fg-label">Done ÷ (done + missed). Cancelled doesn't count.</span>
          </section>
        )}

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
                <Button variant="primary" size="lg" onClick={() => openEntry()}>
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
                aria-label={`${e.title}, ${e.rule}${draft ? "" : `, ${e.score}`}. Edit entry`}
                onClick={() => openEntry(e)}
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
                {!draft && (
                  <>
                    <span aria-hidden className="flex max-w-[150px] flex-wrap justify-end gap-[3px]">
                      {e.seq.split("").map((k, i) => (
                        <span key={i} className="size-[9px] rounded-[2px]" style={{ background: k === "d" ? et : "#2A2A2A" }} />
                      ))}
                    </span>
                    <span className="min-w-11 text-right font-ui text-[13px] font-semibold text-fg-white tabular-nums">{e.score}</span>
                  </>
                )}
              </button>
            );
          })}
          {routine.entries.length > 0 && (
            <Button size="sm" className="mt-3 h-[30px] self-start" onClick={() => openEntry()}>
              <PlusIcon size={10} />
              Add entry
            </Button>
          )}
        </section>

        {/* Actions */}
        <div className="mt-10 flex flex-col gap-3 border-t border-ink-line-soft pt-5">
          <div className="flex flex-wrap gap-2">
            {ended && (
              <Button size="lg" variant="primary" onClick={dup}>
                <CopyIcon />
                Duplicate to restart
              </Button>
            )}
            <Button size="lg" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button size="lg" onClick={() => setDatesOpen(true)}>
              {draft ? "Change dates" : "Change end date"}
            </Button>
            {!draft && !ended && (
              <Button size="lg" onClick={() => setConfirm("end")}>
                End today
              </Button>
            )}
            {!ended && (
              <Button size="lg" onClick={dup}>
                Duplicate
              </Button>
            )}
            {draft && (
              <Button size="lg" variant="danger" className="ml-auto" onClick={() => setConfirm("delete")}>
                <TrashIcon />
                Delete draft
              </Button>
            )}
          </div>
          {!draft && !hasDone && (
            // Published, nothing done yet: the "published by mistake" way out.
            <div className="flex flex-wrap items-center gap-2 rounded-tile bg-ink-raised px-4 py-3">
              <span className="mr-auto font-ui text-[12px] text-fg-label">
                Published by mistake? Nothing in it is done yet.
              </span>
              <Button variant="ghost" onClick={() => setConfirm("unpublish")}>
                Back to draft
              </Button>
              <Button variant="danger" onClick={() => setConfirm("delete")}>
                <TrashIcon />
                Delete
              </Button>
            </div>
          )}
          {!canDelete && (
            <p className="m-0 font-ui text-[12px] text-fg-label">
              It has done tasks, so it can't be deleted or moved back to draft. {ended ? "Its history stays." : "End it to stop it — that keeps its history."}
            </p>
          )}
        </div>
      </div>

      <EntryDialog routine={routine} entry={editing} open={entryOpen} onOpenChange={setEntryOpen} />
      <EditRoutineDialog routine={routine} open={editOpen} onOpenChange={setEditOpen} />
      <EndDateDialog routine={routine} open={datesOpen} onOpenChange={setDatesOpen} />

      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title={`Publish “${routine.name}”?`}
        body="Its tasks start showing in Todo and Calendar from today, or from its start date if that's later. Nothing before is filled in as missed. After this, entry changes apply from today on and the start date is locked."
        confirmLabel="Publish"
        cancelLabel="Not yet"
        onConfirm={() => {
          store.publishRoutine(routine.id);
          toast("Published. Its tasks start today.");
        }}
      />
      <ConfirmDialog
        open={confirm === "end"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title={`End “${routine.name}” today?`}
        body="Everything done, missed or cancelled stays as it is. Nothing new shows after today. To come back to it later, duplicate it."
        confirmLabel="End routine"
        onConfirm={() => {
          store.endRoutine(routine.id);
          toast("Ended. Its history stays.");
        }}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title="Move back to draft?"
        body="Its tasks disappear from Todo and Calendar until you publish it again. Nothing in it is done yet, so no history is lost."
        confirmLabel="Back to draft"
        onConfirm={() => {
          store.unpublishRoutine(routine.id);
          toast("Back to draft.");
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={draft ? `Delete the draft “${routine.name}”?` : `Delete “${routine.name}”?`}
        body={
          draft
            ? "It was never published, so nothing is lost."
            : "Nothing in it is done yet, but its missed and cancelled tasks go too. To stop a routine and keep its history, end it instead."
        }
        confirmLabel={draft ? "Delete draft" : "Delete routine"}
        onConfirm={() => {
          store.deleteRoutine(routine.id);
          toast(draft ? "Draft deleted." : "Routine deleted.");
          navigate({ to: "/routines" });
        }}
      />
    </main>
  );
}

/** Takes the stats card's place while it's a draft: what a draft is, and the way out. */
function DraftCard({ routine, onPublish }: { routine: MockRoutine; onPublish: () => void }) {
  const ready = routine.entries.length > 0;
  return (
    <section className="mt-8 flex flex-col gap-4 rounded-tile border border-ink-line-soft bg-ink-raised px-[22px] py-5">
      <div className="flex flex-col gap-1.5">
        <Label as="h2">Draft</Label>
        <p className="read m-0 text-[20px] leading-[26px] font-bold text-fg-white">Nothing shows in Todo or Calendar yet.</p>
        <p className="read m-0 max-w-[520px] text-[15px] leading-[21px] text-fg-secondary">
          Set it up freely: changes just overwrite, there's no history yet. Publishing starts its tasks from that day, or from its
          start date if that's later.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" variant="primary" disabled={!ready} onClick={onPublish}>
          Publish
        </Button>
        <span className="font-ui text-[12px] text-fg-label">
          {ready
            ? `${routine.entries.length} ${routine.entries.length === 1 ? "entry" : "entries"} ready`
            : "Add at least one entry to publish."}
        </span>
      </div>
    </section>
  );
}
