import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { type Tag, type Task, dateTime, inMissedList, momentLocal, splitDateTime, tickOptions, toMoment } from "@planner/core";
import { useRepos } from "@planner/data/react";
import { cn } from "@/lib/cn";
import { toneHex } from "@/lib/tones";
import { currentClock, useClock } from "@/lib/clock";
import { act, useProtocolMap } from "@/lib/data-hooks";
import { type Palette, panelLine, toneOf, visualState, type TaskView } from "@/lib/task-view";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { Chip, Label, MiniSquare } from "@/components/ui/bits";
import { DateField } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-picker";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/menu";
import { Check, ToneMark } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { EditTaskDialog, MoveTaskDialog } from "./task-dialogs";
import { SidePanel } from "./side-panel";
import { TagBox, toTagRefs } from "./tag-box";

/**
 * The task panel closes when you click outside it (in Todo and in the Calendar). Not on clicks
 * that belong to it or open another task: its own dialogs, menus and popovers (they render
 * outside it), the toasts, the title bar, and anything marked `data-opens-task` (a row's title,
 * a calendar block…), which switches the panel to that task instead. While a dialog is open
 * (Edit, Move…), clicks go to the dialog.
 */
function useCloseOnOutsideClick(panel: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target || panel.current?.contains(target)) return;
      if (document.querySelector("[role=dialog]")) return;
      if (target.closest('[data-radix-popper-content-wrapper],[aria-label="Notifications"],header,[data-opens-task]')) return;
      close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Tick / untick / uncancel from the check box — the same everywhere a task shows. */
function useTaskActions(task: Task) {
  const repos = useRepos();
  return {
    tick: (doneAt?: string) => act(repos.tasks.tick(task, doneAt)),
    untick: () => act(repos.tasks.untick(task)),
    cancel: () =>
      act(repos.tasks.cancel(task), () =>
        toast(`Cancelled “${task.title}”.`, { action: { label: "Undo", onClick: () => void act(repos.tasks.uncancel(task)) } }),
      ),
    uncancel: () => act(repos.tasks.uncancel(task), `“${task.title}” is back.`),
    // TASK.md "Missed tasks": it stays missed on its own day, it just stops following you.
    letGo: () =>
      act(repos.tasks.letGo(task), () =>
        toast(`Let go of “${task.title}”. It stays missed on its day.`, { action: { label: "Undo", onClick: () => void act(repos.tasks.takeBack(task)) } }),
      ),
  };
}

/**
 * Task row — 48 tall, radius 8, hover #0F0F0F (DESIGN.md §3 "Task row"):
 * check · title (Figtree 15/600) · meta (UI 11 caps, right). The check carries the tone.
 * (The two-letter glyph that sat after the check is gone: it told you nothing the title didn't.)
 * Count tasks show one mini square per copy. Done rows sit on #0A0A0A with a grey title.
 * In the Missed list (`missedList`), hovering the row shows "Let it go".
 */
export function TaskRow({
  view,
  selected,
  count,
  missedList,
}: {
  view: TaskView;
  selected?: boolean;
  count?: { done: number; of: number };
  missedList?: boolean;
}) {
  const { task, state, tone: toneName, meta } = view;
  const actions = useTaskActions(task);
  const openTask = useUi((s) => s.set);
  const [lateOpen, setLateOpen] = useState(false);
  const tone = toneHex(toneName);

  function onCheck() {
    if (state === "cancelled") return void actions.uncancel();
    if (state === "missed") return setLateOpen(true);
    if (state === "done") return void actions.untick();
    void actions.tick();
  }

  const checkLabel =
    state === "done" ? `Mark not done: ${task.title}` : state === "cancelled" ? `Uncancel: ${task.title}` : `Mark done: ${task.title}`;

  return (
    <div
      className={cn(
        "group -mx-3 flex min-h-12 items-center gap-3 rounded-card border border-transparent px-3 transition-colors duration-[250ms]",
        state === "done" ? "mt-0.5 bg-ink-raised" : "hover:bg-ink-hover",
        selected && "border-ink-line bg-ink-well hover:bg-ink-well",
      )}
    >
      <Popover open={lateOpen} onOpenChange={setLateOpen}>
        <PopoverAnchor asChild>
          <Check state={state} tone={toneName} label={checkLabel} onClick={onCheck} />
        </PopoverAnchor>
        {lateOpen && <LateTickOptions task={task} label={meta} onDone={() => setLateOpen(false)} />}
      </Popover>
      <button
        type="button"
        data-opens-task
        onClick={() => openTask({ openTaskId: task.id })}
        className={cn(
          "read min-w-0 flex-1 truncate text-left text-[15px] font-semibold",
          "underline-offset-[3px] decoration-ink-line-dash hover:underline",
          state === "todo" ? "text-fg-white" : state === "cancelled" ? "text-fg-label line-through" : "text-fg-label",
        )}
      >
        {task.title}
      </button>
      {count && state === "todo" && (
        <span aria-hidden className="flex gap-[3px]">
          {Array.from({ length: count.of }, (_, i) => (
            <MiniSquare key={i} color={tone} outline={i >= count.done} />
          ))}
        </span>
      )}
      {missedList && (
        <Button
          size="sm"
          variant="ghost"
          title="It stays missed on its day, but stops following you here"
          className="opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 focus-visible:opacity-100"
          onClick={() => void actions.letGo()}
        >
          Let it go
        </Button>
      )}
      <span className={cn("meta", state === "todo" ? "text-fg-secondary" : "text-fg-label")}>{meta}</span>
    </div>
  );
}

/** "Fri 6 Nov 23:59" — for the late-tick options. */
const momentLabel = (m: string) => {
  const { date, time } = splitDateTime(momentLocal(m));
  return `${format(parseISO(date), "EEE d MMM")} ${time}`;
};

/**
 * Ticking after the time ran out (TASK.md "Ticking"): Done now / Done on time / Pick a time.
 * The moments come from @planner/core's tickOptions. Not drawn in the design; built from
 * its popover + button styles.
 */
function LateTickOptions({ task, label, onDone }: { task: Task; label: string; onDone: () => void }) {
  const actions = useTaskActions(task);
  const [options] = useState(() => tickOptions(task, currentClock()));
  const [picking, setPicking] = useState(false);
  const [pickedDate, setPickedDate] = useState(() => (options ? splitDateTime(momentLocal(options.onTime)).date : ""));
  const [pickedTime, setPickedTime] = useState(() => (options ? splitDateTime(momentLocal(options.onTime)).time : ""));
  if (!options) return null;
  const done = (doneAt: string) => {
    void actions.tick(doneAt);
    onDone();
  };
  const opt = "flex h-8 w-full items-center justify-between gap-6 rounded-btn px-2.5 text-left font-ui text-[13px] whitespace-nowrap hover:bg-ink-fill";
  return (
    <PopoverContent className="w-auto min-w-[240px]" side="bottom" align="start">
      <div className="px-2.5 pt-1.5 pb-1">
        <Label>{label}</Label>
      </div>
      {!picking ? (
        <>
          <button type="button" className={opt} onClick={() => done(options.doneNow)}>
            Done now <span className="meta text-fg-label">{splitDateTime(momentLocal(options.doneNow)).time}</span>
          </button>
          <button type="button" className={opt} onClick={() => done(options.onTime)}>
            Done on time <span className="meta text-fg-label">{momentLabel(options.onTime)}</span>
          </button>
          <button type="button" className={opt} onClick={() => setPicking(true)}>
            Pick a time… <ChevronRightIcon size={9} className="text-fg-label" />
          </button>
        </>
      ) : (
        <form
          className="flex items-center gap-2 p-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pickedDate && pickedTime) done(toMoment(dateTime(pickedDate, pickedTime), currentClock().offset));
          }}
        >
          <DateField aria-label="Done on" required value={pickedDate} onChange={setPickedDate} className="w-[150px]" />
          <TimeField aria-label="Done at" required value={pickedTime} onChange={setPickedTime} className="w-[96px]" />
          <Button type="submit" variant="primary" size="lg" aria-label="Save" disabled={!pickedDate || !pickedTime}>
            <CheckIcon />
          </Button>
        </form>
      )}
    </PopoverContent>
  );
}

/**
 * Task panel — screens/11-todo-task-open. #050505, left edge #1A1A1A.
 * Tile 64 (fills with the tone when done) · title · when · ✕ · actions
 * (Done/Undo, Move, Edit, Cancel) · its routine (name, purpose) · tags · notes · its
 * protocol's steps (read-only: a reminder, nothing to tick).
 */
export function TaskPanel({ task, palette }: { task: Task; palette: Palette }) {
  const tags = palette.tags;
  const routine = task.routineEntryId !== undefined ? palette.routineOf.get(task.routineEntryId) : undefined;
  const protocol = useProtocolMap().get(task.protocolId ?? "");
  const actions = useTaskActions(task);
  const clock = useClock();
  const close = () => useUi.getState().set({ openTaskId: null });
  const panel = useRef<HTMLElement>(null);
  useCloseOnOutsideClick(panel, close);
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState(false);
  const state = visualState(task, clock);
  const repos = useRepos();
  const taskTags = task.tags.map((id) => tags.get(id)).filter((t): t is Tag => t !== undefined);

  return (
    <SidePanel>
      <aside
        ref={panel}
        aria-label="Task"
        className="flex h-full w-[400px] max-w-[50%] shrink-0 animate-[panel-in_.22s_var(--ease-snap)] flex-col border-l border-ink-line-soft bg-panel"
      >
        {/* 36px under the title bar's clock and window buttons; the content scrolls below it */}
        <div aria-hidden className="h-9 shrink-0" />
        <div className="flex min-h-0 flex-1 flex-col gap-[26px] overflow-y-auto px-9 pt-10 pb-20">
          <div className="flex items-start gap-4">
            <span className="pt-[9px]">
              <ToneMark tone={toneOf(task, palette)} filled={state === "done"} dim={state === "missed" || state === "cancelled"} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
              <h2
                className={cn(
                  "read m-0 text-[28px] leading-[30px] font-extrabold tracking-[-.01em] break-words text-fg-white",
                  state === "cancelled" && "text-fg-label line-through",
                )}
              >
                {task.title}
              </h2>
              <span className="meta text-fg-label">{panelLine(task, clock)}</span>
            </div>
            <RoundButton label="Close" onClick={close}>
              <CloseIcon />
            </RoundButton>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {state === "done" ? (
              <Button size="lg" onClick={() => void actions.untick()}>
                Undo
              </Button>
            ) : state === "missed" ? (
              <LateDoneButton task={task} />
            ) : state !== "cancelled" ? (
              <Button size="lg" variant="primary" onClick={() => void actions.tick()}>
                <CheckIcon size={12} />
                Done
              </Button>
            ) : null}
            <Button size="lg" onClick={() => setMove(true)}>
              Move
            </Button>
            <Button size="lg" onClick={() => setEdit(true)}>
              Edit
            </Button>
            {state === "cancelled" ? (
              <Button size="lg" variant="ghost" onClick={() => void actions.uncancel()}>
                Uncancel
              </Button>
            ) : (
              state !== "done" && (
                <Button size="lg" variant="ghost" onClick={() => void actions.cancel()}>
                  Cancel
                </Button>
              )
            )}
            {inMissedList(task, clock.at) && (
              <Button size="lg" variant="ghost" title="It stays missed on its day, but stops following you in Missed" onClick={() => void actions.letGo()}>
                Let it go
              </Button>
            )}
          </div>

          {state === "done" && task.doneAt && <DoneAt key={task.doneAt} task={task} />}

          {routine && (
            <PanelSection label="Routine">
              <Link
                to="/routines/$routineId"
                params={{ routineId: routine.id }}
                className="group mt-2.5 flex flex-col gap-1 rounded-card no-underline"
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: toneHex(toneOf(task, palette)) }} />
                  <span className="read text-[15px] font-bold text-fg-white underline-offset-[3px] group-hover:underline">{routine.title}</span>
                  <ChevronRightIcon size={9} className="text-fg-label" />
                </span>
                {routine.purpose && <span className="read pl-4 text-[14px] leading-[19px] text-fg-secondary">{routine.purpose}</span>}
              </Link>
            </PanelSection>
          )}

          <PanelSection label="Tags">
            <div className="pt-2.5">
              <TagBox
                aria-label="Tags"
                placeholder={taskTags.length ? "Add another tag" : "Add a tag"}
                value={taskTags}
                known={[...tags.values()]}
                // Saved at once; a new name becomes a tag in the same write.
                onChange={(next) => void act(repos.tasks.edit(task, {}, toTagRefs(next)))}
              />
            </div>
          </PanelSection>

          {task.notes && (
            <PanelSection label="Notes">
              <p className="read m-0 pt-2.5 text-[15px] leading-[21px] whitespace-pre-wrap text-fg">{task.notes}</p>
            </PanelSection>
          )}

          {protocol && (
            <PanelSection
              label="Protocol"
              right={
                <Link to="/protocols/$protocolId" params={{ protocolId: protocol.id }} className="font-ui text-[11px] text-fg-label no-underline hover:text-fg-white">
                  {protocol.title} ›
                </Link>
              }
            >
              {protocol.steps.length === 0 ? (
                <p className="m-0 pt-2.5 font-ui text-[12px] text-fg-label">No steps yet.</p>
              ) : (
                <ol className="m-0 list-none p-0 pt-1">
                  {protocol.steps.map((step, i) => (
                    <li key={`${i}-${step}`} className="grid grid-cols-[26px_1fr] gap-2 border-b border-ink-line-faint py-2 last:border-b-0">
                      <span className="pt-[3px] font-ui text-[11px] text-fg-label tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <span className="read text-[14px] leading-[19px] text-fg">{step}</span>
                    </li>
                  ))}
                </ol>
              )}
            </PanelSection>
          )}

          <EditTaskDialog task={task} open={edit} onOpenChange={setEdit} />
          <MoveTaskDialog task={task} open={move} onOpenChange={setMove} />
        </div>
      </aside>
    </SidePanel>
  );
}

/**
 * When a done task was done (editable, TASK.md "done_at") and when it was ticked in the
 * app (automatic) — the second only when they differ.
 */
function DoneAt({ task }: { task: Task }) {
  const repos = useRepos();
  const local = splitDateTime(momentLocal(task.doneAt!));
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(local.date);
  const [time, setTime] = useState(local.time);
  const ticked = task.loggedAt && momentLocal(task.loggedAt) !== momentLocal(task.doneAt!) ? momentLabel(task.loggedAt) : null;

  return (
    <PanelSection
      label="Done"
      right={
        !editing && (
          <button type="button" onClick={() => setEditing(true)} className="font-ui text-[11px] text-fg-label hover:text-fg-white">
            Change
          </button>
        )
      }
    >
      {editing ? (
        <form
          className="flex flex-col gap-2.5 pt-2.5"
          onSubmit={async (e) => {
            e.preventDefault();
            const saved = await act(repos.tasks.setDoneAt(task, toMoment(dateTime(date, time), currentClock().offset)), "Done time changed.");
            if (saved) setEditing(false);
          }}
        >
          <div className="grid grid-cols-[1fr_112px] gap-2">
            <DateField aria-label="Done on" required value={date} onChange={setDate} />
            <TimeField aria-label="Done at" required value={time} onChange={setTime} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!date || !time}>
              Save
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setDate(local.date);
                setTime(local.time);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <dl className="m-0 grid grid-cols-[64px_1fr] gap-y-1.5 pt-2.5 font-ui text-[13px] tabular-nums">
          <dt className="text-fg-label">Done</dt>
          <dd className="m-0 text-fg">{momentLabel(task.doneAt!)}</dd>
          {ticked && (
            <>
              <dt className="text-fg-label">Ticked</dt>
              <dd className="m-0 text-fg-secondary">{ticked}</dd>
            </>
          )}
        </dl>
      )}
    </PanelSection>
  );
}

/** "Done" on a missed task opens the same three choices as its check box. */
function LateDoneButton({ task }: { task: Task }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Button size="lg" variant="primary" onClick={() => setOpen(true)}>
          <CheckIcon size={12} />
          Done…
        </Button>
      </PopoverAnchor>
      {open && <LateTickOptions task={task} label="Missed" onDone={() => setOpen(false)} />}
    </Popover>
  );
}

/** A tag as a chip. `isNew`: only typed so far, made when the task is saved. */
export function TagChip({ tag, isNew, onRemove }: { tag: Pick<Tag, "name" | "color">; isNew?: boolean; onRemove?: () => void }) {
  return (
    <Chip size="md" className="gap-1.5 normal-case">
      <span aria-hidden className="size-2 rounded-[2px]" style={{ background: toneHex(tag.color as Parameters<typeof toneHex>[0]) }} />
      {tag.name}
      {isNew && <span className="text-[10px] text-fg-label">new</span>}
      {onRemove && (
        <button type="button" aria-label={`Remove tag ${tag.name}`} onClick={onRemove} className="-mr-1 ml-0.5 text-fg-label hover:text-fg-white">
          <CloseIcon size={8} />
        </button>
      )}
    </Chip>
  );
}

function PanelSection({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col">
      <div className="flex items-baseline justify-between border-b border-ink-line-soft pb-2">
        <Label as="h3">{label}</Label>
        {right}
      </div>
      {children}
    </section>
  );
}
