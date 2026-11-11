import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { cn } from "@/lib/cn";
import { toneHex } from "@/lib/tones";
import { useMock } from "@/mock/store";
import type { MockTask } from "@/mock/data";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { Label, MiniSquare } from "@/components/ui/bits";
import { Input } from "@/components/ui/field";
import { CheckIcon, ChevronRightIcon, CloseIcon } from "@/components/ui/icons";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/menu";
import { Check, Glyph, GlyphTile, type VisualState } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { EditTaskDialog, MoveTaskDialog } from "./dialogs";
import { SidePanel } from "./side-panel";

export function stateOf(t: MockTask): VisualState {
  if (t.cancelled) return "cancelled";
  if (t.done) return "done";
  if (t.section === "missed") return "missed";
  return "todo";
}

/**
 * Task row — 48 tall, radius 8, hover #0F0F0F (DESIGN.md §3 "Task row"):
 * check · glyph (Doto 18, tone) · title (Figtree 15/600) · meta (UI 11 caps, right).
 * Count tasks show one mini square per copy. Done rows sit on #0A0A0A with a grey title.
 */
export function TaskRow({ task, selected }: { task: MockTask; selected?: boolean }) {
  const tick = useMock((s) => s.tick);
  const setCancelled = useMock((s) => s.setCancelled);
  const openTask = useUi((s) => s.set);
  const state = stateOf(task);
  const [lateOpen, setLateOpen] = useState(false);
  const tone = toneHex(task.tone);

  const meta =
    state === "cancelled"
      ? "Cancelled"
      : state === "done"
        ? (task.doneMeta ?? "done")
        : task.count
          ? `${task.count.done}/${task.count.of}`
          : state === "missed"
            ? `Missed · ${task.meta}`
            : task.meta;

  function onCheck() {
    if (state === "cancelled") {
      setCancelled(task.id, false);
      return toast(`“${task.title}” is back.`);
    }
    if (state === "missed") return setLateOpen(true);
    tick(task.id);
  }

  const checkLabel =
    state === "done" ? `Mark not done: ${task.title}` : state === "cancelled" ? `Uncancel: ${task.title}` : `Mark done: ${task.title}`;

  return (
    <div
      className={cn(
        "-mx-3 flex min-h-12 items-center gap-3 rounded-card border border-transparent px-3 transition-colors duration-[250ms]",
        state === "done" ? "mt-0.5 bg-ink-raised" : "hover:bg-ink-hover",
        selected && "border-ink-line bg-ink-well hover:bg-ink-well",
      )}
    >
      <Popover open={lateOpen} onOpenChange={setLateOpen}>
        <PopoverAnchor asChild>
          <Check state={state} tone={task.tone} label={checkLabel} onClick={onCheck} />
        </PopoverAnchor>
        <LateTickOptions task={task} onDone={() => setLateOpen(false)} />
      </Popover>
      <Glyph color={state === "missed" ? "#3A3A3A" : state === "cancelled" ? "#262626" : tone} className="w-7">
        {task.glyph}
      </Glyph>
      <button
        type="button"
        onClick={() => openTask({ openTaskId: task.id })}
        className={cn(
          "read min-w-0 flex-1 truncate text-left text-[15px] font-semibold",
          "underline-offset-[3px] decoration-ink-line-dash hover:underline",
          state === "todo" ? "text-fg-white" : state === "cancelled" ? "text-fg-label line-through" : "text-fg-label",
        )}
      >
        {task.title}
      </button>
      {task.count && state === "todo" && (
        <span aria-hidden className="flex gap-[3px]">
          {Array.from({ length: task.count.of }, (_, i) => (
            <MiniSquare key={i} color={tone} outline={i >= task.count!.done} />
          ))}
        </span>
      )}
      <span className={cn("meta", state === "todo" ? "text-fg-secondary" : "text-fg-label")}>{meta}</span>
    </div>
  );
}

/**
 * Ticking after the time ran out (TASK.md "Ticking"): Done now / Done on time / Pick a time.
 * Not drawn in the design; built from its popover + button styles.
 */
function LateTickOptions({ task, onDone }: { task: MockTask; onDone: () => void }) {
  const tick = useMock((s) => s.tick);
  const [picking, setPicking] = useState(false);
  const [time, setTime] = useState("19:30");
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const done = (label: string) => {
    tick(task.id, label);
    onDone();
    setPicking(false);
  };
  const opt = "flex h-8 w-full items-center justify-between gap-6 rounded-btn px-2.5 text-left font-ui text-[13px] hover:bg-ink-fill";
  return (
    <PopoverContent className="w-[240px]" side="bottom" align="start">
      <div className="px-2.5 pt-1.5 pb-1">
        <Label>Missed · {task.meta}</Label>
      </div>
      {!picking ? (
        <>
          <button type="button" className={opt} onClick={() => done(`done ${hhmm}`)}>
            Done now <span className="meta text-fg-label">{hhmm}</span>
          </button>
          <button type="button" className={opt} onClick={() => done("done on time")}>
            Done on time <span className="meta text-fg-label">{task.meta}</span>
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
            done(`done ${time}`);
          }}
        >
          <Input type="time" aria-label="Done at" value={time} onChange={(e) => setTime(e.target.value)} autoFocus />
          <Button type="submit" variant="primary" size="lg">
            <CheckIcon />
          </Button>
        </form>
      )}
    </PopoverContent>
  );
}

/**
 * Task panel — screens/11-todo-task-open. #050505, left edge #1A1A1A.
 * Tile 64 (fills with the tone when done) · title · meta · ✕ ·
 * routine link · actions (Done/Undo, Move, Edit, Cancel) · protocol steps.
 */
export function TaskPanel({ task }: { task: MockTask }) {
  const tick = useMock((s) => s.tick);
  const setCancelled = useMock((s) => s.setCancelled);
  const routine = useMock((s) => s.routines.find((r) => r.id === task.routineId));
  const protocol = useMock((s) => s.protocols.find((p) => p.id === task.protocolId));
  const close = () => useUi.getState().set({ openTaskId: null });
  const [edit, setEdit] = useState(false);
  const [move, setMove] = useState(false);
  const state = stateOf(task);

  const metaLine = [
    format(new Date(), "EEE d MMM"),
    state === "done" ? task.doneMeta : state === "cancelled" ? "cancelled" : task.section === "day" ? "during the day" : task.meta || "anytime",
    task.duration,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <SidePanel>
    <aside
      aria-label="Task"
      className="flex h-full w-[400px] max-w-[50%] shrink-0 animate-[panel-in_.22s_var(--ease-snap)] flex-col border-l border-ink-line-soft bg-panel"
    >
      {/* 36px under the title bar's clock and window buttons; the content scrolls below it */}
      <div aria-hidden className="h-9 shrink-0" />
      <div className="flex min-h-0 flex-1 flex-col gap-[26px] overflow-y-auto px-9 pt-10 pb-20">
      <div className="flex items-start gap-4">
        <GlyphTile glyph={task.glyph} tone={task.tone} filled={state === "done"} dim={state === "missed" || state === "cancelled"} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 pt-1">
          <h2 className={cn("read m-0 text-[28px] leading-[30px] font-extrabold tracking-[-.01em] text-fg-white", state === "cancelled" && "text-fg-label line-through")}>
            {task.title}
          </h2>
          <span className="meta text-fg-label">{metaLine}</span>
        </div>
        <RoundButton label="Close" onClick={close}>
          <CloseIcon />
        </RoundButton>
      </div>

      {routine && (
        <Link
          to="/routines/$routineId"
          params={{ routineId: routine.id }}
          className="flex items-center gap-3 rounded-drop border border-ink-line-mid px-[14px] py-3 no-underline transition-colors hover:bg-ink-raised"
        >
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-btn" style={{ background: toneHex(routine.tone) }}>
            <Glyph size={13} color="#111111">
              {routine.glyph}
            </Glyph>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-ui text-[11px] tracking-[.06em] text-fg-label uppercase">{routine.name}</span>
            <span className="read truncate text-[15px] font-semibold text-fg-white">{routine.purpose}</span>
          </span>
          <ChevronRightIcon size={10} className="text-fg-placeholder" />
        </Link>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {state === "done" ? (
          <Button size="lg" onClick={() => tick(task.id)}>
            Undo
          </Button>
        ) : state !== "cancelled" ? (
          <Button size="lg" variant="primary" onClick={() => tick(task.id)}>
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
          <Button size="lg" variant="ghost" onClick={() => setCancelled(task.id, false)}>
            Uncancel
          </Button>
        ) : (
          <Button
            size="lg"
            variant="ghost"
            onClick={() => {
              setCancelled(task.id, true);
              toast(`Cancelled “${task.title}”.`, { action: { label: "Undo", onClick: () => setCancelled(task.id, false) } });
            }}
          >
            Cancel
          </Button>
        )}
      </div>

      {task.notes && (
        <PanelSection label="Notes">
          <p className="read m-0 pt-2.5 text-[15px] leading-[21px] text-fg">{task.notes}</p>
        </PanelSection>
      )}

      {protocol && (
        <PanelSection
          label={`Protocol — ${protocol.title}`}
          right={
            <Link to="/protocols/$protocolId" params={{ protocolId: protocol.id }} className="font-ui text-[11px] text-fg-label no-underline hover:text-fg-white">
              {protocol.steps.length} steps · edit
            </Link>
          }
        >
          <ol className="m-0 list-none p-0">
            {protocol.steps.map((s, i) => (
              <li key={i} className="grid grid-cols-[30px_1fr] gap-2.5 border-b border-ink-line-faint py-[9px]">
                <span className="pt-0.5 font-ui text-[11px] text-fg-label tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="read text-[14px] leading-5 text-fg">{s}</span>
              </li>
            ))}
          </ol>
        </PanelSection>
      )}

      <EditTaskDialog task={task} open={edit} onOpenChange={setEdit} />
      <MoveTaskDialog task={task} open={move} onOpenChange={setMove} />
      </div>
    </aside>
    </SidePanel>
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
