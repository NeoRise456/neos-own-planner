import { useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, format } from "date-fns";
import { cn } from "@/lib/cn";
import { useMock } from "@/mock/store";
import { DAY_SUMMARY, SECTION_NAMES, SECTION_NOTES, type TodoSection } from "@/mock/data";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { Label, Progress, SectionHeader } from "@/components/ui/bits";
import { QuickAdd } from "@/components/ui/field";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { TaskPanel, TaskRow } from "@/components/app/todo";

export const Route = createFileRoute("/todo")({ component: TodoPage });

const SECTIONS: TodoSection[] = ["missed", "scheduled", "day", "anytime"];

/** Todo — screens/10-todo (+ 11-todo-task-open when a task is open). */
function TodoPage() {
  const tasks = useMock((s) => s.tasks);
  const addTask = useMock((s) => s.addTask);
  const { todoDayOffset, openTaskId, showDone, showCancelled, set } = useUi();
  const [draft, setDraft] = useState("");
  const quickAdd = useRef<HTMLInputElement>(null);

  const day = addDays(new Date(), todoDayOffset);
  const dayLabel = todoDayOffset === 0 ? "Today" : todoDayOffset === 1 ? "Tomorrow" : todoDayOffset === -1 ? "Yesterday" : format(day, "EEEE");
  // The mock data only covers today; other days show the empty state.
  const shown = todoDayOffset === 0 ? tasks : [];

  const open = shown.filter((t) => !t.done && !t.cancelled);
  const done = shown.filter((t) => t.done);
  const cancelled = shown.filter((t) => t.cancelled);
  const counted = shown.filter((t) => !t.cancelled);
  const pct = counted.length ? (done.length / counted.length) * 100 : 0;
  const openTask = tasks.find((t) => t.id === openTaskId);

  return (
    <>
      <main className={cn("min-w-0 flex-1", openTask ? "px-10" : "px-8")}>
        <div className={cn("mx-auto flex flex-col pt-11 pb-20", openTask ? "max-w-[540px]" : "max-w-[720px]")}>
          {/* The day switch never wraps under the date: one row, and the date's size
              follows the row's width (34px max; "Wednesday 30 September" is ~12.5em
              wide, the switch ~150px). Truncates only below the 20px floor. */}
          <div className="@container flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2">
              <Label>{dayLabel}</Label>
              <h1 className="read m-0 truncate text-[clamp(20px,calc((100cqi-164px)/12.5),34px)] leading-[1.12] font-extrabold tracking-[-.02em] text-fg-white">
                {format(day, "EEEE d MMMM")}
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <RoundButton label="Previous day" onClick={() => set({ todoDayOffset: todoDayOffset - 1, openTaskId: null })}>
                <ChevronLeftIcon />
              </RoundButton>
              <Button onClick={() => set({ todoDayOffset: 0 })} disabled={todoDayOffset === 0} className="disabled:bg-ink-fill disabled:text-fg-muted">
                Today
              </Button>
              <RoundButton label="Next day" onClick={() => set({ todoDayOffset: todoDayOffset + 1, openTaskId: null })}>
                <ChevronRightIcon />
              </RoundButton>
            </div>
          </div>

          {/* Summary and progress each get their own row, so nothing wraps or floats
              at any width — only the bar's length changes. */}
          {shown.length > 0 && (
            <div className="@container mt-[14px]">
              <p title={DAY_SUMMARY} className="m-0 truncate font-ui text-[12px] text-fg-label">
                {DAY_SUMMARY.split(" · ").map((part, i) => (
                  // From the third part on ("+4 untimed") drops first when the line gets tight.
                  <span key={part} className={i >= 2 ? "hidden @min-[340px]:inline" : undefined}>
                    {i > 0 && " · "}
                    {part}
                  </span>
                ))}
              </p>
            </div>
          )}
          {counted.length > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <Progress value={pct} label="Done today" className="min-w-0 flex-1" />
              <span className="shrink-0 font-ui text-[12px] whitespace-nowrap text-fg-secondary tabular-nums">
                {done.length} of {counted.length} done
              </span>
            </div>
          )}

          <QuickAdd
            ref={quickAdd}
            className="mt-7"
            placeholder="Add a task"
            value={draft}
            onChange={setDraft}
            onSubmit={(v) => {
              addTask(v);
              set({ todoDayOffset: 0 });
            }}
          />

          {shown.length === 0 && (
            <p className="mt-[30px] mb-0 font-ui text-[12px] text-fg-label">
              Nothing planned for the day
            </p>
          )}

          {SECTIONS.map((sec) => {
            const rows = open.filter((t) => t.section === sec);
            if (!rows.length) return null;
            return (
              <section key={sec} className="mt-[30px] flex flex-col">
                <SectionHeader label={SECTION_NAMES[sec]} note={SECTION_NOTES[sec]} labelClassName={sec === "missed" ? "text-fg-secondary" : undefined} />
                {rows.map((t) => (
                  <TaskRow key={t.id} task={t} selected={t.id === openTaskId} />
                ))}
              </section>
            );
          })}

          <Collapsible label="Done" count={done.length} open={showDone} onToggle={() => set({ showDone: !showDone })}>
            {done.map((t) => (
              <TaskRow key={t.id} task={t} selected={t.id === openTaskId} />
            ))}
          </Collapsible>
          <Collapsible label="Cancelled" count={cancelled.length} open={showCancelled} onToggle={() => set({ showCancelled: !showCancelled })}>
            {cancelled.map((t) => (
              <TaskRow key={t.id} task={t} selected={t.id === openTaskId} />
            ))}
          </Collapsible>
        </div>
      </main>
      {openTask && <TaskPanel key={openTask.id} task={openTask} />}
    </>
  );
}

/** Done / Cancelled — a toggle header (label · count · rotating chevron) and its rows. */
function Collapsible({
  label,
  count,
  open,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <section className="mt-[30px] flex flex-col">
      <div className="mb-1 flex items-center justify-between border-b border-ink-line-faint">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="-ml-2.5 inline-flex h-8 items-center gap-2 rounded-btn px-2.5 hover:bg-ink-line-faint"
        >
          <Label>{label}</Label>
          <span className="font-ui text-[11px] text-fg-label tabular-nums">{count}</span>
          <ChevronRightIcon size={9} className="text-fg-label transition-transform duration-200" style={{ transform: `rotate(${open ? 90 : 0}deg)` }} />
        </button>
        <span className="font-ui text-[11px] text-fg-label">{open ? "Hide" : "Show"}</span>
      </div>
      {open && children}
    </section>
  );
}
