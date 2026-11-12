import { useMemo, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { type DaySummary, type Tag, type Task, addDays, daySummary, diffDays, filterTodoDay, formatDuration, todayOf } from "@planner/core";
import { useData, useLive } from "@planner/data/react";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { act, useTagMap, useTodoDay } from "@/lib/data-hooks";
import { viewOf } from "@/lib/task-view";
import { toneHex, type Tone } from "@/lib/tones";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { EmptyState, Label, Loader, Progress, SectionHeader } from "@/components/ui/bits";
import { QuickAdd } from "@/components/ui/field";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { MonthCalendar } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { TaskPanel, TaskRow } from "@/components/app/todo";

export const Route = createFileRoute("/todo")({ component: TodoPage });

type OpenSection = "missed" | "scheduled" | "during" | "anytime";
const SECTIONS: { key: OpenSection; label: string }[] = [
  { key: "missed", label: "Missed" },
  { key: "scheduled", label: "Scheduled" },
  { key: "during", label: "During the day" },
  { key: "anytime", label: "Anytime" },
];

/** "3h" / "20m + 4 untimed" / "4 untimed". */
function minutesNote(minutes: number, untimed: number): string {
  const parts = [minutes > 0 ? formatDuration(minutes) : null, untimed > 0 ? `${untimed} untimed` : null].filter(Boolean);
  return parts.join(" + ");
}

function sectionNote(key: OpenSection, tasks: Task[]): string {
  if (key === "missed") return "still tickable";
  if (key === "anytime") return "no date";
  const s = daySummary(tasks);
  return minutesNote(key === "scheduled" ? s.scheduledMinutes : s.floatingMinutes, s.untimed);
}

/** "Scheduled 3h · During the day 20m · +4 untimed" (empty parts left out). */
function summaryParts(s: DaySummary): string[] {
  return [
    s.scheduledMinutes > 0 ? `Scheduled ${formatDuration(s.scheduledMinutes)}` : null,
    s.floatingMinutes > 0 ? `During the day ${formatDuration(s.floatingMinutes)}` : null,
    s.untimed > 0 ? `+${s.untimed} untimed` : null,
  ].filter((p): p is string => p !== null);
}

/** Todo — screens/10-todo (+ 11-todo-task-open when a task is open). */
function TodoPage() {
  const { repos, unavailable } = useData();
  const clock = useClock();
  const tags = useTagMap();
  const { todoDayOffset, openTaskId, showDone, showCancelled, todoTagFilter: chosenTag, set } = useUi();
  // A filter on a tag that was deleted or merged away since is no filter.
  const todoTagFilter = chosenTag && tags.has(chosenTag) ? chosenTag : null;
  const [draft, setDraft] = useState("");
  const [jumpOpen, setJumpOpen] = useState(false);
  const quickAdd = useRef<HTMLInputElement>(null);

  const today = todayOf(clock);
  const day = addDays(today, todoDayOffset);
  const { todo: wholeDay, isLoading } = useTodoDay(day, clock);
  const todo = useMemo(() => filterTodoDay(wholeDay, todoTagFilter), [wholeDay, todoTagFilter]);
  // The chips: the tags on this day's tasks (and the chosen one, so it can be turned off).
  const dayTags = useMemo(() => {
    const ids = new Set<string>();
    for (const list of [wholeDay.missed, wholeDay.scheduled, wholeDay.during, wholeDay.anytime, wholeDay.done, wholeDay.cancelled])
      for (const t of list) for (const id of t.tags) ids.add(id);
    if (todoTagFilter) ids.add(todoTagFilter);
    return [...ids].map((id) => tags.get(id)).filter((t): t is Tag => !!t).sort((a, b) => a.name.localeCompare(b.name));
  }, [wholeDay, todoTagFilter, tags]);
  const filterName = todoTagFilter ? tags.get(todoTagFilter)?.name : undefined;
  const { data: opened } = useLive(repos && openTaskId ? repos.tasks.byId(openTaskId) : null);
  const openTask = opened[0];

  const dayLabel = todoDayOffset === 0 ? "Today" : todoDayOffset === 1 ? "Tomorrow" : todoDayOffset === -1 ? "Yesterday" : format(parseISO(day), "EEEE");
  const views = useMemo(() => {
    const v = (ts: Task[]) => ts.map((t) => viewOf(t, day, clock, tags));
    return {
      missed: v(todo.missed),
      scheduled: v(todo.scheduled),
      during: v(todo.during),
      anytime: v(todo.anytime),
      done: v(todo.done),
      cancelled: v(todo.cancelled),
    };
  }, [todo, day, clock, tags]);

  const openCount = todo.missed.length + todo.scheduled.length + todo.during.length + todo.anytime.length;
  const counted = openCount + todo.done.length;
  const shown = counted + todo.cancelled.length;
  const pct = counted ? (todo.done.length / counted) * 100 : 0;
  const summary = summaryParts(todo.summary);

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
              {/* The date is also the way to any day: click it for a month calendar. */}
              <Popover open={jumpOpen} onOpenChange={setJumpOpen}>
                <h1 className="read m-0 min-w-0 text-[clamp(20px,calc((100cqi-164px)/12.5),34px)] leading-[1.12] font-extrabold tracking-[-.02em] text-fg-white">
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title="Go to a day"
                      className="block max-w-full truncate rounded-btn text-left decoration-ink-line-dash decoration-2 underline-offset-[6px] hover:underline"
                    >
                      {format(parseISO(day), "EEEE d MMMM")}
                    </button>
                  </PopoverTrigger>
                </h1>
                <PopoverContent className="p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                  <MonthCalendar
                    value={day}
                    today={today}
                    onPick={(d) => {
                      set({ todoDayOffset: diffDays(today, d), openTaskId: null });
                      setJumpOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
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
          {summary.length > 0 && (
            <div className="@container mt-[14px]">
              <p title={summary.join(" · ")} className="m-0 truncate font-ui text-[12px] text-fg-label">
                {summary.map((part, i) => (
                  // From the third part on ("+4 untimed") drops first when the line gets tight.
                  <span key={part} className={i >= 2 ? "hidden @min-[340px]:inline" : undefined}>
                    {i > 0 && " · "}
                    {part}
                  </span>
                ))}
              </p>
            </div>
          )}
          {counted > 0 && (
            <div className="mt-3 flex items-center gap-3">
              <Progress value={pct} label={`Done ${dayLabel.toLowerCase()}`} className="min-w-0 flex-1" />
              <span className="shrink-0 font-ui text-[12px] whitespace-nowrap text-fg-secondary tabular-nums">
                {todo.done.length} of {counted} done
              </span>
            </div>
          )}

          {!repos ? (
            <EmptyState className="mt-10" glyph="Db" title="Nothing can be saved here" body={unavailable} />
          ) : (
            <>
              <QuickAdd
                ref={quickAdd}
                className="mt-7"
                placeholder={todoDayOffset > 0 ? `Add a task for ${format(parseISO(day), "EEEE d MMM")}` : "Add a task"}
                value={draft}
                onChange={setDraft}
                onSubmit={(v) => {
                  // A later day gets the task; today or a past day → anytime, shown today. The tag filter tags it.
                  void act(repos.tasks.quickAdd(v, day, todoTagFilter));
                  if (todoDayOffset < 0) set({ todoDayOffset: 0 });
                }}
              />

              {dayTags.length > 0 && (
                <TagFilter tags={dayTags} selected={todoTagFilter} onSelect={(id) => set({ todoTagFilter: id })} />
              )}

              {isLoading ? (
                <div className="mt-10 flex justify-center">
                  <Loader label="Loading tasks" />
                </div>
              ) : (
                shown === 0 && (
                  <p className="mt-[30px] mb-0 font-ui text-[12px] text-fg-label">
                    {filterName ? `Nothing tagged “${filterName}” on this day` : "Nothing planned for the day"}
                  </p>
                )
              )}
            </>
          )}

          {SECTIONS.map(({ key, label }) => {
            const rows = views[key];
            if (!rows.length) return null;
            return (
              <section key={key} className="mt-[30px] flex flex-col">
                <SectionHeader label={label} note={sectionNote(key, rows.map((r) => r.task))} labelClassName={key === "missed" ? "text-fg-secondary" : undefined} />
                {rows.map((v) => (
                  <TaskRow key={v.task.id} view={v} selected={v.task.id === openTaskId} />
                ))}
              </section>
            );
          })}

          <Collapsible label="Done" count={views.done.length} open={showDone} onToggle={() => set({ showDone: !showDone })}>
            {views.done.map((v) => (
              <TaskRow key={v.task.id} view={v} selected={v.task.id === openTaskId} />
            ))}
          </Collapsible>
          <Collapsible label="Cancelled" count={views.cancelled.length} open={showCancelled} onToggle={() => set({ showCancelled: !showCancelled })}>
            {views.cancelled.map((v) => (
              <TaskRow key={v.task.id} view={v} selected={v.task.id === openTaskId} />
            ))}
          </Collapsible>
        </div>
      </main>
      {openTask && <TaskPanel key={openTask.id} task={openTask} tags={tags} />}
    </>
  );
}

/**
 * Tag filter — one chip per tag on the day; the chosen one is white (the One White Rule)
 * and shows only its tasks. Clicking it again shows everything.
 */
function TagFilter({ tags, selected, onSelect }: { tags: Tag[]; selected: string | null; onSelect: (id: string | null) => void }) {
  return (
    <div role="group" aria-label="Filter by tag" className="mt-4 flex flex-wrap gap-1.5">
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
