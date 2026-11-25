import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type Clock,
  type Routine,
  type Task,
  addDays,
  canDeleteRoutine,
  expandRoutineTasks,
  maxDate,
  minDate,
  routineConsistency,
  routineStatus,
  taskState,
  todayOf,
} from "@planner/core";
import type { StoredEntry } from "@planner/data";
import { useData, useLive } from "@planner/data/react";
import { useClock } from "@/lib/clock";
import { act, actOk, useProtocolMap, useRoutineModel } from "@/lib/data-hooks";
import { glyphOf } from "@/lib/glyph";
import { entryLabel, periodLabel, statusLabel } from "@/lib/routine-view";
import { type Tone, toneHex } from "@/lib/tones";
import { Button } from "@/components/ui/button";
import { Chip, EmptyState, Label, Loader, Progress } from "@/components/ui/bits";
import { CopyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { ToneMark } from "@/components/ui/task-visuals";
import { ConfirmDialog, DatesDialog, DuplicateDialog, EditRoutineDialog, EntryDialog } from "@/components/app/dialogs";

export const Route = createFileRoute("/routines/$routineId")({ component: RoutinePage });

type Confirm = "publish" | "end" | "unpublish" | "delete" | null;
/** How many recent occurrences each entry row shows as squares. */
const RECENT = 16;

/**
 * Routine detail — screens/30-routines, on real data. Status, consistency and what may
 * be done (publish, end, back to draft, delete) all come from @planner/core:
 * - draft: no tasks yet, edit anything, a Publish card instead of the stats
 * - published: End (ends today); back to draft / delete only while nothing is done
 * - ended: duplicate to restart
 */
function RoutinePage() {
  const { routineId } = Route.useParams();
  const { repos } = useData();
  const clock = useClock();
  const today = todayOf(clock);
  const navigate = useNavigate();
  const { routines, entries: allEntries, isLoading } = useRoutineModel();
  const protocols = useProtocolMap();
  const routine = routines.find((r) => r.id === routineId);
  const entries = useMemo(() => allEntries.filter((e) => e.routineId === routineId), [allEntries, routineId]);
  const { data: saved } = useLive(repos ? repos.tasks.copiesOfRoutine(routineId) : null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [editing, setEditing] = useState<StoredEntry | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [datesOpen, setDatesOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const stats = useMemo(() => (routine ? routineConsistency({ routine, entries, saved, now: clock }) : null), [routine, entries, saved, clock]);

  if (!routine) {
    return isLoading ? (
      <main className="flex flex-1 justify-center pt-24">
        <Loader label="Loading the routine" />
      </main>
    ) : (
      <main className="px-12 pt-11 font-ui text-fg-label">This routine doesn't exist anymore.</main>
    );
  }

  const status = routineStatus(routine, today);
  const draft = status === "draft";
  const ended = status === "ended";
  const tone = (routine.color ?? "stone") as Tone;
  const hasDone = saved.some((t) => t.doneAt !== undefined);
  const deletable = canDeleteRoutine(routine, saved).ok;
  const live = entries.filter((e) => e.removedFrom === undefined || e.removedFrom > today);
  const { done, missed, rate } = stats!.overall;

  const openEntry = (e?: StoredEntry) => {
    setEditing(e);
    setEntryOpen(true);
  };

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      <div className="mx-auto flex max-w-[680px] flex-col">
        <div className="flex items-center gap-5">
          <ToneMark tone={tone} filled={!ended && !draft} dim={ended} size={18} />
          <div className="flex min-w-0 flex-col gap-1.5">
            <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] break-words text-fg-white">{routine.title}</h1>
            {routine.purpose && <span className="read text-[17px] text-fg-secondary">{routine.purpose}</span>}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          <Chip size="md">{periodLabel(routine, today)}</Chip>
          <Chip
            size="md"
            className={draft ? "border border-ink-line bg-transparent text-fg-secondary" : ended ? "text-fg-label" : "bg-fg-white text-black"}
          >
            {statusLabel(routine, status, today)}
          </Chip>
        </div>

        {draft ? (
          <DraftCard ready={entries.length} onPublish={() => setConfirm("publish")} />
        ) : (
          <section className="mt-8 flex flex-col gap-[14px] rounded-tile border border-ink-line-soft px-[22px] py-5">
            <div className="flex flex-wrap items-baseline gap-[14px]">
              <span className="read text-[56px] leading-[52px] font-extrabold tracking-[-.03em] text-fg-white">
                {rate === null ? "—" : `${Math.round(rate * 100)}%`}
              </span>
              <span className="font-ui text-[12px] text-fg-label">
                {rate === null ? (status === "upcoming" ? "It hasn't started yet." : "Nothing to count yet.") : `${done} of ${done + missed} done`}
              </span>
            </div>
            <Progress value={rate === null ? 0 : rate * 100} label="Consistency" color={ended ? "#6B6B6B" : "#FFFFFF"} />
            <span className="font-ui text-[11px] text-fg-label">Done ÷ (done + missed). Cancelled and not-yet-due tasks don't count.</span>
          </section>
        )}

        {/* Entries */}
        <section className="mt-[34px] flex flex-col">
          <div className="flex items-center justify-between border-b border-ink-line-soft pb-1.5">
            <Label as="h2">Entries</Label>
            <span className="font-ui text-[11px] text-fg-label">
              {live.length} {live.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {live.length === 0 && (
            <EmptyState
              className="py-10"
              glyph={glyphOf(routine.title)}
              title="No entries yet"
              body="Entries are what the routine repeats: Gym on Mon, Wed and Fri, or Water 4 times a day."
              actions={
                !ended && (
                  <Button variant="primary" size="lg" onClick={() => openEntry()}>
                    <PlusIcon />
                    Add the first entry
                  </Button>
                )
              }
            />
          )}
          {live.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              routine={routine}
              saved={saved}
              clock={clock}
              label={entryLabel(e.versions[e.versions.length - 1]!, protocols)}
              score={stats!.byEntry.get(e.id)}
              showStats={!draft}
              tone={ended ? "#6B6B6B" : toneHex(tone)}
              onOpen={() => (ended ? undefined : openEntry(e))}
              locked={ended}
            />
          ))}
          {live.length > 0 && !ended && (
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
              <Button size="lg" variant="primary" onClick={() => setDupOpen(true)}>
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
            {status === "active" && routine.endDate > today && (
              <Button size="lg" onClick={() => setConfirm("end")}>
                End today
              </Button>
            )}
            {!ended && (
              <Button size="lg" onClick={() => setDupOpen(true)}>
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
              <span className="mr-auto font-ui text-[12px] text-fg-label">Published by mistake? Nothing in it is done yet.</span>
              <Button variant="ghost" onClick={() => setConfirm("unpublish")}>
                Back to draft
              </Button>
              <Button variant="danger" onClick={() => setConfirm("delete")}>
                <TrashIcon />
                Delete
              </Button>
            </div>
          )}
          {!deletable && (
            <p className="m-0 font-ui text-[12px] text-fg-label">
              It has done tasks, so it can't be deleted or moved back to draft.{" "}
              {ended ? "Its history stays." : "End it to stop it: that keeps its history."}
            </p>
          )}
        </div>
      </div>

      <EntryDialog routine={routine} entry={editing} open={entryOpen} onOpenChange={setEntryOpen} />
      <EditRoutineDialog routine={routine} open={editOpen} onOpenChange={setEditOpen} />
      <DatesDialog routine={routine} open={datesOpen} onOpenChange={setDatesOpen} />
      <DuplicateDialog
        routine={routine}
        open={dupOpen}
        onOpenChange={setDupOpen}
        onCreated={(id) => navigate({ to: "/routines/$routineId", params: { routineId: id } })}
      />

      <ConfirmDialog
        open={confirm === "publish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title={`Publish “${routine.title}”?`}
        body="Its tasks start showing in Todo and Calendar from today, or from its start date if that's later. Nothing before is filled in as missed. After this, entry changes apply from today on and the start date is locked."
        confirmLabel="Publish"
        cancelLabel="Not yet"
        onConfirm={() => void act(repos!.routines.publish(routine.id), "Published. Its tasks start today.")}
      />
      <ConfirmDialog
        open={confirm === "end"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title={`End “${routine.title}” today?`}
        body="Everything done, missed or cancelled stays as it is. Nothing new shows after today. To come back to it later, duplicate it."
        confirmLabel="End routine"
        onConfirm={() => void act(repos!.routines.end(routine.id), "Ended. Its history stays.")}
      />
      <ConfirmDialog
        open={confirm === "unpublish"}
        onOpenChange={(o) => !o && setConfirm(null)}
        variant="primary"
        title="Move back to draft?"
        body="Its tasks disappear from Todo and Calendar until you publish it again, and tasks you had moved or cancelled go away. Nothing in it is done yet, so no history is lost."
        confirmLabel="Back to draft"
        onConfirm={() => void act(repos!.routines.unpublish(routine.id), "Back to draft.")}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={draft ? `Delete the draft “${routine.title}”?` : `Delete “${routine.title}”?`}
        body={
          draft
            ? "It was never published, so nothing is lost."
            : "Nothing in it is done yet, but its missed and cancelled tasks go too. To stop a routine and keep its history, end it instead."
        }
        confirmLabel={draft ? "Delete draft" : "Delete routine"}
        onConfirm={async () => {
          if (!(await actOk(repos!.routines.remove(routine.id), draft ? "Draft deleted." : "Routine deleted."))) return;
          navigate({ to: "/routines" });
        }}
      />
    </main>
  );
}

/**
 * One entry: glyph, title, its rule on one line; once published, its last occurrences as
 * squares (tone = done, grey = missed) and done / counted.
 */
function EntryRow({
  entry,
  routine,
  saved,
  clock,
  label,
  score,
  showStats,
  tone,
  onOpen,
  locked,
}: {
  entry: StoredEntry;
  routine: Routine;
  saved: Task[];
  clock: Clock;
  label: string;
  score?: { done: number; missed: number };
  showStats: boolean;
  tone: string;
  onOpen: () => void;
  locked: boolean;
}) {
  const today = todayOf(clock);
  const title = entry.versions[entry.versions.length - 1]!.title;
  const recent = useMemo(() => {
    if (!showStats) return [];
    const to = minDate(today, routine.endDate);
    const from = maxDate(routine.startDate, addDays(to, -90));
    if (to < from) return [];
    return expandRoutineTasks({ routines: [routine], entries: [entry], saved, from, to })
      .filter((t) => t.occurrenceDate! <= to)
      .sort((a, b) => a.occurrenceDate!.localeCompare(b.occurrenceDate!) || a.occurrenceSlot! - b.occurrenceSlot!)
      .map((t) => taskState(t, clock.at))
      .filter((s) => s === "done" || s === "missed")
      .slice(-RECENT);
  }, [showStats, today, routine, entry, saved, clock.at]);
  const counted = score ? score.done + score.missed : 0;

  return (
    <button
      type="button"
      aria-label={`${title}, ${label}${showStats && score ? `, ${score.done} of ${counted} done` : ""}${locked ? "" : ". Edit entry"}`}
      onClick={onOpen}
      disabled={locked}
      className="-mx-3 box-border flex min-h-[68px] w-[calc(100%+24px)] items-center gap-[14px] rounded-drop border-b border-ink-line-faint px-3 py-2.5 text-left transition-colors enabled:hover:bg-ink-hover"
    >
      <span className="flex min-w-0 flex-auto flex-col gap-[3px]">
        <span className="read text-[16px] font-bold text-fg-white">{title}</span>
        <span className="font-ui text-[11px] text-fg-label">{label}</span>
      </span>
      {showStats && (
        <>
          <span aria-hidden className="flex max-w-[150px] flex-wrap justify-end gap-[3px]">
            {recent.map((s, i) => (
              <span key={i} className="size-[9px] rounded-[2px]" style={{ background: s === "done" ? tone : "#2A2A2A" }} />
            ))}
          </span>
          <span className="min-w-11 text-right font-ui text-[13px] font-semibold text-fg-white tabular-nums">
            {counted ? `${score!.done}/${counted}` : "—"}
          </span>
        </>
      )}
    </button>
  );
}

/** Takes the stats card's place while it's a draft: what a draft is, and the way out. */
function DraftCard({ ready, onPublish }: { ready: number; onPublish: () => void }) {
  return (
    <section className="mt-8 flex flex-col gap-4 rounded-tile border border-ink-line-soft bg-ink-raised px-[22px] py-5">
      <div className="flex flex-col gap-1.5">
        <Label as="h2">Draft</Label>
        <p className="read m-0 text-[20px] leading-[26px] font-bold text-fg-white">Nothing shows in Todo or Calendar yet.</p>
        <p className="read m-0 max-w-[520px] text-[15px] leading-[21px] text-fg-secondary">
          Set it up freely: changes just overwrite, there's no history yet. Publishing starts its tasks from that day, or from its start date if
          that's later.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="lg" variant="primary" disabled={!ready} onClick={onPublish}>
          Publish
        </Button>
        <span className="font-ui text-[12px] text-fg-label">
          {ready ? `${ready} ${ready === 1 ? "entry" : "entries"} ready` : "Add at least one entry to publish."}
        </span>
      </div>
    </section>
  );
}
