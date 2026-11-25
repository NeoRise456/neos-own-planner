import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  type NestedBlock,
  type CalendarDay,
  type Clock,
  type LocalDate,
  type Task,
  type TaskFields,
  addDays,
  calendarDay,
  dayWidth,
  daysInMonth,
  diffDays,
  eachDay,
  filterByTag,
  isRoutineCopy,
  makeDate,
  nestBlocks,
  nestIndent,
  minutesToTime,
  mondayOf,
  parseDate,
  slotAt,
  splitDateTime,
  timeToMinutes,
  todayOf,
} from "@planner/core";
import { useData, useLive } from "@planner/data/react";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { usePalette, useRoutineTasks } from "@/lib/data-hooks";
import { type Palette, dayShort, groupCounts, toneOf, visualState } from "@/lib/task-view";
import { type Tone, tint, toneHex } from "@/lib/tones";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { EmptyState, Label } from "@/components/ui/bits";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon, PlusIcon } from "@/components/ui/icons";
import { UnderlineTabs } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import type { VisualState } from "@/components/ui/task-visuals";
import { TaskPanel } from "@/components/app/todo";
import { NewTaskDialog } from "@/components/app/task-dialogs";
import { TagFilter, tagsOf } from "@/components/app/tag-filter";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

/** Pixels per hour (DESIGN.md "Calendar block"). */
const HOUR = 48;
/** The scrollbar's width (styles/index.css): the header rows leave room for it so the columns line up. */
const SCROLLBAR = 6;
/** Room under 24:00, so a task at 23:59 (and its label) isn't cut off at the bottom. */
const END_ROOM = 32;
/** How many "during the day" rows an all-day cell shows before "+N more". */
const DURING_ROWS = 3;

const hm = (minutes: number) => (minutes >= 24 * 60 ? "24:00" : minutesToTime(minutes));
const label = (d: LocalDate, f: string) => format(parseISO(d), f);

/**
 * Calendar — screens/20-calendar-week, on real data. Which tasks a day shows and where
 * is @planner/core's `calendarDay`; this only draws it. Only dated tasks are here:
 * anytime tasks live in Todo. Routine tasks join in phase 5.
 */
function CalendarPage() {
  const { repos, unavailable } = useData();
  const clock = useClock();
  const today = todayOf(clock);
  const palette = usePalette();
  const tags = palette.tags;
  const { calWeekOffset, calView, calTagFilter: chosen, openTaskId, set } = useUi();
  const tagFilter = chosen && tags.has(chosen) ? chosen : null;
  const [creating, setCreating] = useState<Partial<TaskFields> | null>(null);
  // The calendar is for looking: clicking the grid makes a task only in Add mode (off each
  // time you open the calendar). Esc leaves it.
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    if (!adding || creating) return;
    // An Esc that closed a dialog (or a menu) is that dialog's: only a free Esc leaves Add mode.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[role=dialog]") && setAdding(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, creating]);

  const monday = addDays(mondayOf(today), calWeekOffset * 7);
  const sunday = addDays(monday, 6);
  // The month view shows the month that holds this week's Thursday.
  const anchor = parseDate(addDays(monday, 3));
  const monthFirst = makeDate(anchor.year, anchor.month, 1);
  const monthLast = makeDate(anchor.year, anchor.month, daysInMonth(anchor.year, anchor.month));
  const [from, to] = calView === "week" ? [monday, sunday] : [mondayOf(monthFirst), addDays(mondayOf(monthLast), 6)];

  const { data: oneOffs } = useLive(repos ? repos.tasks.between(from, to) : null);
  const { tasks: routineTasks } = useRoutineTasks(from, to);
  const tasks = useMemo(() => [...oneOffs, ...routineTasks], [oneOffs, routineTasks]);
  const shown = useMemo(() => filterByTag(tasks, tagFilter), [tasks, tagFilter]);
  const days = useMemo(() => eachDay(from, to).map((d) => calendarDay(shown, d, today)), [shown, from, to, today]);
  const rangeTags = useMemo(() => {
    const onCalendar = eachDay(from, to).flatMap((d) => {
      const c = calendarDay(tasks, d, today);
      return [...c.blocks.map((b) => b.task), ...c.deadlines, ...c.during];
    });
    return tagsOf(onCalendar, tags, tagFilter);
  }, [tasks, from, to, today, tags, tagFilter]);
  const { data: opened } = useLive(repos && openTaskId ? repos.tasks.byId(openTaskId) : null);
  // A routine task never touched isn't saved yet: find it among the tasks on screen.
  const openTask = opened[0] ?? tasks.find((t) => t.id === openTaskId);

  const title =
    calView === "month"
      ? label(monthFirst, "MMMM yyyy")
      : monday.slice(0, 7) === sunday.slice(0, 7)
        ? `${label(monday, "d")} – ${label(sunday, "d MMMM")}`
        : `${label(monday, "d MMM")} – ${label(sunday, "d MMM")}`;

  const step = (dir: 1 | -1) => {
    if (calView === "week") return set({ calWeekOffset: calWeekOffset + dir });
    // Month: to the next/previous month, on the week that holds its 8th (always inside it).
    const m = anchor.month + dir;
    const target = makeDate(anchor.year + Math.floor((m - 1) / 12), ((m - 1 + 12) % 12) + 1, 8);
    set({ calWeekOffset: diffDays(mondayOf(today), mondayOf(target)) / 7 });
  };

  /** New task: the clicked slot, or today (the first day shown when today isn't). */
  const create = (initial?: Partial<TaskFields>) =>
    setCreating(initial ?? { startDate: today >= from && today <= to ? today : from, tags: tagFilter ? [tagFilter] : [] });
  const open = (id: string) => set({ openTaskId: openTaskId === id ? null : id });

  return (
    <>
      {/* Both views fill the window: the week's hours and the month's weeks share out its height. */}
      <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col self-stretch px-8">
        <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col pt-10 pb-6">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
            <div className="flex flex-col gap-2">
              <Label>Calendar</Label>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">{title}</h1>
                <div className="flex items-center gap-1.5">
                  <RoundButton label={calView === "week" ? "Previous week" : "Previous month"} onClick={() => step(-1)}>
                    <ChevronLeftIcon />
                  </RoundButton>
                  <Button onClick={() => set({ calWeekOffset: 0 })}>Today</Button>
                  <RoundButton label={calView === "week" ? "Next week" : "Next month"} onClick={() => step(1)}>
                    <ChevronRightIcon />
                  </RoundButton>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5">
              {repos && (
                <div className="flex items-center gap-2">
                  {calView === "week" && (
                    <Button
                      aria-pressed={adding}
                      variant={adding ? "primary" : "quiet"}
                      title={adding ? "Stop adding (Esc)" : "Click a time on the grid to add a task there"}
                      onClick={() => setAdding(!adding)}
                    >
                      <PlusIcon />
                      {adding ? "Adding: click a time" : "Add mode"}
                    </Button>
                  )}
                </div>
              )}
              <UnderlineTabs
                label="Calendar view"
                value={calView}
                onValueChange={(v) => set({ calView: v })}
                items={[
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                ]}
              />
            </div>
          </div>

          {rangeTags.length > 0 && <TagFilter tags={rangeTags} selected={tagFilter} onSelect={(id) => set({ calTagFilter: id })} />}

          {!repos ? (
            <EmptyState glyph="Ca" title="Nothing can be saved here" body={unavailable} className="mt-10" />
          ) : (
            <div className={cn("mt-7 flex min-h-0 flex-1 flex-col overflow-x-auto", calView === "week" ? "overflow-y-hidden" : "overflow-y-auto")}>
              {calView === "week" ? (
                <WeekGrid
                  days={days}
                  today={today}
                  clock={clock}
                  palette={palette}
                  openTaskId={openTaskId}
                  adding={adding}
                  onOpen={open}
                  onCreate={create}
                />
              ) : (
                <MonthGrid
                  days={days}
                  month={monthFirst.slice(0, 7)}
                  today={today}
                  clock={clock}
                  palette={palette}
                  onOpen={open}
                  onPickDay={(d) => set({ calView: "week", calWeekOffset: diffDays(mondayOf(today), mondayOf(d)) / 7 })}
                />
              )}
            </div>
          )}
        </div>
      </main>
      {openTask && <TaskPanel key={openTask.id} task={openTask} palette={palette} />}
      {creating && (
        <NewTaskDialog
          open
          initial={creating}
          onOpenChange={(o) => !o && setCreating(null)}
          onCreated={(t) => set({ openTaskId: t.id })}
        />
      )}
    </>
  );
}

/* ── Week ─────────────────────────────────────────────────────────── */

type GridProps = {
  days: CalendarDay[];
  today: LocalDate;
  clock: Clock;
  palette: Palette;
  onOpen: (id: string) => void;
};

function WeekGrid({
  days,
  today,
  clock,
  palette,
  openTaskId,
  adding,
  onOpen,
  onCreate,
}: GridProps & { openTaskId: string | null; adding: boolean; onCreate: (f: Partial<TaskFields>) => void }) {
  const nowMin = timeToMinutes(splitDateTime(clock.at).time);
  const showNow = days.some((d) => d.day === today);
  // The whole day; it opens scrolled to Settings → Calendar → "Opens at".
  const from = 0;
  const to = 24;
  const height = (to - from) * HOUR;
  const startHour = useUi((s) => s.calStartHour);
  const scroller = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (scroller.current) scroller.current.scrollTop = startHour * HOUR;
    // Only when the grid appears (opening the calendar, or Month → Week).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nowTop = ((nowMin - from * 60) / 60) * HOUR;
  // Overlaps nest (core `nestBlocks`). Cancelled blocks take no room from live ones: laid out
  // among themselves, drawn behind. A crowded day gets wider (core `dayWidth`), so what's
  // nested in it stays readable; the other days give up the room.
  const laid = useMemo(
    () =>
      days.map((d) => [
        ...nestBlocks(d.blocks.filter((b) => b.task.cancelledAt !== undefined)),
        ...nestBlocks(d.blocks.filter((b) => b.task.cancelledAt === undefined)),
      ]),
    [days],
  );
  const cols = "grid";
  const colsStyle = { gridTemplateColumns: `56px ${laid.map((bs) => `minmax(0,${dayWidth(bs)}fr)`).join(" ")}` };
  const [allDayOpen, setAllDayOpen] = useState(false);
  /** The empty half hour under the pointer (Add mode only): day + minutes. */
  const [hover, setHover] = useState<{ day: LocalDate; min: number } | null>(null);
  useEffect(() => {
    if (!adding) setHover(null);
  }, [adding]);

  const slotOf = (e: MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    return slotAt(from * 60 + (y / HOUR) * 60);
  };
  const moreRows = Math.max(0, ...days.map((d) => groupCounts(d.during, d.during, palette).length - DURING_ROWS));

  return (
    <div className="flex min-h-0 min-w-[600px] flex-1 flex-col">
      {/* day header */}
      <div className={cn(cols, "border-b border-ink-line-soft pb-2.5")} style={{ ...colsStyle, paddingRight: SCROLLBAR }}>
        <span />
        {days.map(({ day }) => {
          const isToday = day === today;
          return (
            <div key={day} className="flex items-center gap-2 px-2">
              <span className={cn("font-ui text-[11px] uppercase", isToday ? "text-fg-white" : "text-fg-label")}>{label(day, "EEE")}</span>
              <span className={cn("font-ui text-[12px] tabular-nums", isToday ? "rounded-[5px] bg-fg-white px-1.5 py-px font-bold text-black" : "text-fg-secondary")}>
                {label(day, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* all-day row: deadlines, then the tasks that float through the day */}
      <div className={cn(cols, "border-b border-ink-line-soft")} style={{ ...colsStyle, paddingRight: SCROLLBAR }}>
        <span className="py-2.5 font-ui text-[11px] leading-[14px] text-fg-label uppercase">
          All
          <br />
          day
        </span>
        {days.map((d) => {
          // "Water 2/4": a count entry's copies are one row.
          const during = groupCounts(d.during, d.during, palette);
          const rows = allDayOpen ? during : during.slice(0, DURING_ROWS);
          const hidden = during.length - rows.length;
          return (
            <div key={d.day} className="group relative flex min-h-[64px] flex-col gap-1 border-l border-ink-line-faint px-1 py-2">
              {d.deadlines.map((t) => (
                <DeadlineChip key={t.id} task={t} clock={clock} selected={t.id === openTaskId} onOpen={() => onOpen(t.id)} />
              ))}
              {during.length > 0 && <span className="px-1 font-ui text-[11px] text-fg-label">{during.length} during the day</span>}
              {rows.map(({ task: t, count }) => (
                <TaskLine
                  key={t.id}
                  task={t}
                  clock={clock}
                  palette={palette}
                  time={count ? `${count.done}/${count.of}` : undefined}
                  selected={t.id === openTaskId}
                  onOpen={() => onOpen(t.id)}
                />
              ))}
              {hidden > 0 && (
                <button type="button" onClick={() => setAllDayOpen(true)} className="self-start rounded-btn px-1 font-ui text-[11px] text-fg-label hover:text-fg-white">
                  +{hidden} more
                </button>
              )}
              {adding && (
                <button
                  type="button"
                  aria-label={`New task on ${dayShort(d.day)}`}
                  title="New task on this day"
                  onClick={() => onCreate({ startDate: d.day })}
                  className="mt-auto flex h-6 items-center justify-center self-stretch rounded-btn border border-dashed border-ink-line-dash text-fg-label transition-colors duration-[120ms] hover:bg-ink-line-faint hover:text-fg-white"
                >
                  <PlusIcon size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {allDayOpen && moreRows > 0 && (
        <div className="flex justify-end pt-1">
          <button type="button" onClick={() => setAllDayOpen(false)} className="rounded-btn px-1 font-ui text-[11px] text-fg-label hover:text-fg-white">
            Show less
          </button>
        </div>
      )}

      {/* hours: 00–24, scrolling on their own. Room under 24:00, so a task at 23:59 isn't cut off. */}
      <div ref={scroller} aria-label="Hours" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
        <div className={cn(cols, "pt-1.5")} style={{ ...colsStyle, paddingBottom: END_ROOM }}>
          <div className="relative" style={{ height }}>
            {Array.from({ length: to - from + 1 }, (_, k) => (
              <span key={k} className="absolute left-0 font-ui text-[11px] text-fg-label tabular-nums" style={{ top: k * HOUR + 3 }}>
                {hm((from + k) * 60)}
              </span>
            ))}
            {showNow && (
              <span className="absolute left-0 z-[3] rounded-step bg-fg-white px-1 py-px font-ui text-[11px] text-black tabular-nums" style={{ top: nowTop - 8 }}>
                {hm(nowMin)}
              </span>
            )}
          </div>
          {days.map((d, i) => (
            <div
              key={d.day}
              className={cn("relative border-l border-ink-line-faint", adding && "cursor-pointer")}
              style={{
                height,
                // the hour lines, and a closing line at 24:00
                background: `repeating-linear-gradient(to bottom,#161616 0 1px,transparent 1px ${HOUR}px)`,
                boxShadow: "inset 0 -1px 0 #161616",
              }}
              onMouseMove={(e) => {
                if (!adding) return;
                if (e.target !== e.currentTarget) return setHover(null);
                const min = slotOf(e);
                if (hover?.day !== d.day || hover.min !== min) setHover({ day: d.day, min });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                // Add mode, empty space only: a click on a block opens the task instead.
                if (!adding || e.target !== e.currentTarget) return;
                onCreate({ startDate: d.day, startTime: minutesToTime(slotOf(e)), duration: 60 });
              }}
            >
              {hover?.day === d.day && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute right-1 left-1 flex items-start gap-1 rounded-card border border-ink-line px-2 py-1 font-ui text-[11px] text-fg-label tabular-nums"
                  style={{ top: ((hover.min - from * 60) / 60) * HOUR + 1, height: HOUR / 2 - 2 }}
                >
                  <PlusIcon size={8} className="mt-[3px]" />
                  {hm(hover.min)}
                </div>
              )}
              {laid[i].map((b) => (
                <Block key={b.task.id} block={b} from={from} clock={clock} palette={palette} selected={b.task.id === openTaskId} onOpen={() => onOpen(b.task.id)} />
              ))}
              {showNow && d.day === today && (
                <div aria-label="Now" className="pointer-events-none absolute right-0 -left-px z-[25] h-0.5 bg-fg-white" style={{ top: nowTop }}>
                  <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-fg-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Calendar block (DESIGN.md "Calendar block"): not done = tinted tone, white title;
 * done = solid tone, dark text, "· done"; selected = white; missed = faint tint, grey
 * title; cancelled = dashed outline, struck title, behind everything live. 13px status
 * circle on the right.
 *
 * Overlaps nest (core `nestBlocks`, like Google Calendar): a block that starts inside another
 * sits on top of it, shifted right by core `nestIndent(depth)` with a black outline, so the one
 * underneath keeps its title and left edge; blocks that start together split the rest of
 * the width in columns.
 */
function Block({
  block,
  from,
  clock,
  palette,
  selected,
  onOpen,
}: {
  block: NestedBlock;
  from: number;
  clock: Clock;
  palette: Palette;
  selected: boolean;
  onOpen: () => void;
}) {
  const { task, start, end, hasDuration, depth, col, cols } = block;
  const tone = toneOf(task, palette);
  const t = toneHex(tone);
  const state = visualState(task, clock);
  const h = Math.max(((end - start) / 60) * HOUR - 2, 14);
  const tall = h >= 40;
  const dark = selected || state === "done";
  const time = `${hasDuration ? `${hm(start)}–${hm(end)}` : hm(start)}${state === "done" ? " · done" : state === "missed" ? " · missed" : state === "cancelled" ? " · cancelled" : ""}`;
  const look = blockLook(state, tone, selected);
  const top = ((start - from * 60) / 60) * HOUR + (hasDuration ? 1 : -1);
  const indent = nestIndent(depth) * 100;
  const each = `((100% - ${indent}% - 8px) / ${cols})`;
  const place = {
    left: `calc(4px + ${indent}% + ${col} * ${each})`,
    width: `calc(${each} - ${cols > 1 ? 2 : 0}px)`,
    // Deeper blocks are always in front; selecting one only lifts it above its own level,
    // so a selected long block never hides the tasks inside it. Cancelled stay behind.
    zIndex: state === "cancelled" ? 1 : 2 + depth * 2 + (selected ? 1 : 0),
    // A block inside another gets a black outline, so the two read as separate.
    ...(depth > 0 ? { boxShadow: "0 0 0 1px #000" } : {}),
  };

  // No end time: a marker at its start (a 2px line + a label), not a block with a made-up length.
  if (!hasDuration) {
    const line = selected ? "#FFFFFF" : state === "done" ? t : state === "todo" ? tint(tone, 0.8) : "#3A3A3A";
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${task.title}, ${time}`}
        title={`${task.title} · ${time} (no end time)`}
        data-opens-task
        onClick={onOpen}
        className="group absolute flex h-[22px] flex-col text-left"
        style={{ top, ...place }}
      >
        <span aria-hidden className="h-0.5 w-full shrink-0 rounded-full" style={{ background: line }} />
        <span
          className={cn(
            "flex h-[18px] max-w-full min-w-0 items-center gap-1.5 self-start rounded-b-[5px] px-1.5 transition-colors duration-[120ms]",
            selected ? "bg-fg-white" : "bg-ink-well group-hover:bg-ink-fill",
          )}
        >
          <span className={cn("shrink-0 font-ui text-[11px] tabular-nums", selected ? "text-black/60" : "text-fg-label")}>{hm(start)}</span>
          <span
            className={cn("read min-w-0 truncate text-[11px] font-bold", state === "cancelled" && "line-through")}
            style={{ color: selected ? "#0D0D0D" : state === "todo" ? "#FFFFFF" : state === "done" ? t : "#A3A3A3" }}
          >
            {task.title}
          </span>
          {state === "done" && <CheckIcon size={8} className="shrink-0" style={{ color: selected ? "#000" : t }} />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${task.title}, ${time}`}
      title={`${task.title} · ${time}`}
      data-opens-task
      onClick={onOpen}
      className={cn(
        "absolute box-border flex flex-col gap-0.5 overflow-hidden rounded-card px-2 text-left transition-[background-color,border-color,filter] duration-200 hover:brightness-115",
        tall ? "py-[5px]" : "justify-center py-0.5",
      )}
      style={{ top, height: h, ...look, ...place, ...(depth > 0 && state === "cancelled" ? { background: "#000" } : {}) }}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <span
          className={cn("read min-w-0 flex-1 truncate text-[12px] leading-[14px] font-bold", state === "cancelled" && "line-through")}
          style={{ color: dark ? "#0D0D0D" : state === "missed" || state === "cancelled" ? "#A3A3A3" : "#FFFFFF" }}
        >
          {task.title}
        </span>
        <StatusCircle state={state} tone={tone} selected={selected} />
      </span>
      {tall && (
        <span className="truncate font-ui text-[11px] uppercase tabular-nums" style={{ color: dark ? "rgba(0,0,0,0.6)" : "#BDBDBD" }}>
          {time}
        </span>
      )}
    </button>
  );
}

function blockLook(state: VisualState, tone: Tone, selected: boolean) {
  const t = toneHex(tone);
  if (selected) return { background: "#FFFFFF", border: "1px solid #FFFFFF" };
  if (state === "done") return { background: t, border: `1px solid ${t}` };
  // Cancelled: a faint dashed outline, drawn behind live blocks (it takes no room).
  if (state === "cancelled") return { background: "transparent", border: "1px dashed #3A3A3A" };
  if (state === "missed") return { background: `linear-gradient(${tint(tone, 0.08)},${tint(tone, 0.08)}),#000`, border: `1px solid ${tint(tone, 0.3)}` };
  return { background: `linear-gradient(${tint(tone, 0.2)},${tint(tone, 0.2)}),#000`, border: `1px solid ${tint(tone, 0.55)}` };
}

/** Ring when not done; dark disc with a tone tick when done. */
function StatusCircle({ state, tone, selected }: { state: VisualState; tone: Tone; selected: boolean }) {
  const t = toneHex(tone);
  return (
    <span
      aria-hidden
      className="box-border flex size-[13px] shrink-0 items-center justify-center rounded-full"
      style={
        state === "done"
          ? { background: "#0D0D0D" }
          : { border: `1.5px solid ${selected ? "rgba(0,0,0,0.45)" : state === "todo" ? tint(tone, 0.7) : "#3A3A3A"}` }
      }
    >
      {state === "done" && <CheckIcon size={8} style={{ color: selected ? "#FFFFFF" : t }} />}
    </span>
  );
}

/** Deadline chip (all-day row): 1px white border, flag, title, due time. */
function DeadlineChip({ task, clock, selected, onOpen }: { task: Task; clock: Clock; selected: boolean; onOpen: () => void }) {
  const state = visualState(task, clock);
  const closed = state === "done" || state === "cancelled";
  const when = task.dueTime ?? "";
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Deadline: ${task.title}${when ? ` ${when}` : ""}${state === "todo" ? "" : `, ${state}`}`}
      data-opens-task
      onClick={onOpen}
      className={cn(
        "flex h-[26px] min-w-0 shrink-0 items-center gap-1.5 rounded-btn border px-2 text-left transition-colors duration-[120ms]",
        selected ? "border-fg-white bg-fg-white" : closed ? "border-ink-line-dash hover:border-fg-muted" : "border-fg-white hover:bg-ink-line-faint",
      )}
    >
      {state === "done" ? (
        <CheckIcon size={10} className={cn("shrink-0", selected ? "text-black" : "text-fg-label")} />
      ) : (
        <FlagIcon className={cn("shrink-0", selected ? "text-black" : closed ? "text-fg-label" : "text-fg-white")} />
      )}
      <span
        className={cn(
          "read min-w-0 shrink truncate text-[12px] font-bold",
          selected ? "text-black" : closed ? "text-fg-label" : state === "missed" ? "text-fg-secondary" : "text-fg-white",
          state === "cancelled" && "line-through",
        )}
      >
        {task.title}
      </span>
      {/* When it's tight, the time gives way before the title. */}
      {when && (
        <span className={cn("ml-auto min-w-0 shrink-[100] overflow-hidden font-ui text-[11px] whitespace-nowrap tabular-nums", selected ? "text-black/60" : "text-fg-secondary")}>
          {when}
        </span>
      )}
    </button>
  );
}

/** One compact row: tone square + title (+ time). Used for "during the day" and in the month. */
function TaskLine({
  task,
  clock,
  palette,
  time,
  selected,
  onOpen,
}: {
  task: Task;
  clock: Clock;
  palette: Palette;
  time?: string;
  selected?: boolean;
  onOpen: () => void;
}) {
  const state = visualState(task, clock);
  const closed = state === "done" || state === "cancelled";
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-opens-task
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      title={task.title}
      className={cn(
        "flex h-[22px] min-w-0 shrink-0 items-center gap-1.5 rounded-btn px-1 text-left transition-colors duration-[120ms]",
        selected ? "bg-fg-white" : "hover:bg-ink-line-faint",
      )}
    >
      {state === "done" ? (
        <CheckIcon size={8} className="shrink-0" style={{ color: selected ? "#000" : toneHex(toneOf(task, palette)) }} />
      ) : (
        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: state === "todo" ? toneHex(toneOf(task, palette)) : "#3A3A3A" }} />
      )}
      {time && <span className={cn("shrink-0 font-ui text-[11px] tabular-nums", selected ? "text-black/60" : "text-fg-label")}>{time}</span>}
      <span
        className={cn(
          "read min-w-0 truncate text-[11px] font-semibold",
          selected ? "text-black" : closed || state === "missed" ? "text-fg-label" : "text-fg",
          state === "cancelled" && "line-through",
        )}
      >
        {task.title}
      </span>
    </button>
  );
}

/* ── Month ────────────────────────────────────────────────────────── */

/** One line of a month cell. */
type MonthItem =
  | { kind: "deadline"; key: string; task: Task }
  | { kind: "task"; key: string; task: Task; time?: string }
  | { kind: "routine"; key: string; title: string; tone: Tone; done: number; of: number };

/**
 * A day of the month, most useful first (TASK.md "Month view"):
 * 1. deadlines; 2. your one-off tasks (timed by time, then the rest);
 * 3. routine tasks, **one line per routine** ("Morning routine 2/5"), in the order of the
 *    day: they repeat every day and you know they're there. A routine with one task that day
 *    shows the task itself. Cancelled one-offs come last.
 * Cancelled routine tasks don't count, like "Water 2/4".
 */
function monthItems(d: CalendarDay, palette: Palette): MonthItem[] {
  const deadlines: MonthItem[] = d.deadlines.map((task) => ({ kind: "deadline", key: `d-${task.id}`, task }));
  const timed = d.blocks.map((b) => ({ task: b.task, time: hm(b.start) }));
  const floating = groupCounts(d.during, d.during, palette).map(({ task, count }) => ({ task, time: count ? `${count.done}/${count.of}` : undefined }));
  const oneOffs: MonthItem[] = [...timed, ...floating]
    .filter(({ task }) => !isRoutineCopy(task))
    .map(({ task, time }) => ({ kind: "task", key: task.id, task, time }));
  // Cancelled one-offs won't happen: they go last, after the routines.
  const cancelled = (it: MonthItem) => it.kind === "task" && it.task.cancelledAt !== undefined;

  const byRoutine = new Map<string, { title: string; tone: Tone; items: { task: Task; time?: string }[]; tasks: Task[] }>();
  const routineTasks = [...d.blocks.map((b) => b.task), ...d.during].filter(isRoutineCopy);
  for (const { task, time } of [...timed, ...floating].filter(({ task }) => isRoutineCopy(task))) {
    const r = palette.routineOf.get(task.routineEntryId!);
    const key = r?.id ?? "routine";
    const g = byRoutine.get(key) ?? { title: r?.title ?? "Routine", tone: toneOf(task, palette), items: [], tasks: [] };
    g.items.push({ task, time });
    byRoutine.set(key, g);
  }
  for (const t of routineTasks) {
    const key = palette.routineOf.get(t.routineEntryId!)?.id ?? "routine";
    byRoutine.get(key)?.tasks.push(t);
  }
  // Routines in the order of the day: by their first time (untimed ones last), then by name.
  const firstTime = (g: { items: { time?: string }[] }) => g.items.map((i) => (i.time && i.time.includes(":") ? i.time : "~")).sort()[0] ?? "~";
  const routines: MonthItem[] = [...byRoutine.entries()]
    .sort(([, a], [, b]) => firstTime(a).localeCompare(firstTime(b)) || a.title.localeCompare(b.title))
    .map(([key, g]) => {
      const live = g.tasks.filter((t) => t.cancelledAt === undefined);
      if (g.items.length === 1 && g.tasks.length === 1) return { kind: "task", key: g.items[0].task.id, task: g.items[0].task, time: g.items[0].time };
      return { kind: "routine", key: `r-${key}`, title: g.title, tone: g.tone, done: live.filter((t) => t.doneAt !== undefined).length, of: live.length };
    });
  return [...deadlines, ...oneOffs.filter((it) => !cancelled(it)), ...routines, ...oneOffs.filter(cancelled)];
}

/** Every task of the day, one per line (the "+N more" list): deadlines, one-offs, then routine tasks. */
function monthDayList(d: CalendarDay, palette: Palette): { task: Task; time?: string; deadline?: boolean }[] {
  const tasks = [
    ...d.blocks.map((b) => ({ task: b.task, time: hm(b.start) })),
    ...groupCounts(d.during, d.during, palette).map(({ task, count }) => ({ task, time: count ? `${count.done}/${count.of}` : undefined })),
  ];
  return [
    ...d.deadlines.map((task) => ({ task, time: task.dueTime, deadline: true })),
    ...tasks.filter((x) => !isRoutineCopy(x.task)),
    ...tasks.filter((x) => isRoutineCopy(x.task)),
  ];
}

const MONTH_LINE = 24; // a 22px line + its gap
const MONTH_CELL_MIN = 96;

/**
 * Month — not drawn in the design. Same voice as the week: day numbers in the UI font,
 * tasks as tone squares + titles (timed ones with their time, deadlines with a flag),
 * today as a white pill. It fills the window: the weeks share its height, and each cell
 * shows as many lines as fit, then "+N more", which lists the whole day.
 * Clicking a day opens its week; clicking a task opens it; a routine line opens the week.
 */
function MonthGrid({ days, month, today, clock, palette, onOpen, onPickDay }: Omit<GridProps, "openTaskId"> & { month: string; onPickDay: (d: LocalDate) => void }) {
  const weeks = days.length / 7;
  const grid = useRef<HTMLDivElement>(null);
  const [cellH, setCellH] = useState(MONTH_CELL_MIN);
  useLayoutEffect(() => {
    const el = grid.current;
    if (!el) return;
    const measure = () => setCellH(Math.max(MONTH_CELL_MIN, el.clientHeight / weeks));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);
  // A cell's padding (12) and day number (22) come first; the rest is lines.
  const fit = Math.max(1, Math.floor((cellH - 12 - 22) / MONTH_LINE));

  return (
    <div className="flex min-h-0 min-w-[600px] flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-ink-line-soft pb-2.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="px-2 font-ui text-[11px] text-fg-label uppercase">
            {d}
          </span>
        ))}
      </div>
      <div ref={grid} className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(${MONTH_CELL_MIN}px, 1fr))` }}>
        {days.map((d) => {
          const items = monthItems(d, palette);
          const shown = items.length > fit ? items.slice(0, fit - 1) : items;
          const hidden = items.length - shown.length;
          const inMonth = d.day.slice(0, 7) === month;
          const isToday = d.day === today;
          return (
            <div
              key={d.day}
              onClick={() => onPickDay(d.day)}
              className={cn(
                "flex min-h-0 cursor-pointer flex-col gap-0.5 overflow-hidden border-b border-l border-ink-line-faint p-1.5 transition-colors hover:bg-ink-hover",
                !inMonth && "opacity-50",
              )}
            >
              <button
                type="button"
                aria-label={`${label(d.day, "EEEE d MMMM")}, ${items.length} items. Open week`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPickDay(d.day);
                }}
                className={cn(
                  "mb-0.5 shrink-0 self-start rounded-[5px] px-1.5 py-px font-ui text-[12px] tabular-nums",
                  isToday ? "bg-fg-white font-bold text-black" : inMonth ? "text-fg-secondary hover:text-fg-white" : "text-fg-label",
                )}
              >
                {label(d.day, "d")}
              </button>
              {shown.map((it) =>
                it.kind === "deadline" ? (
                  <MonthDeadline key={it.key} task={it.task} onOpen={() => onOpen(it.task.id)} />
                ) : it.kind === "task" ? (
                  <TaskLine key={it.key} task={it.task} clock={clock} palette={palette} time={it.time} onOpen={() => onOpen(it.task.id)} />
                ) : (
                  <RoutineLine key={it.key} item={it} onOpen={() => onPickDay(d.day)} />
                ),
              )}
              {hidden > 0 && <MoreList day={d} hidden={hidden} clock={clock} palette={palette} onOpen={onOpen} onPickDay={onPickDay} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthDeadline({ task, time, onOpen }: { task: Task; time?: string; onOpen: () => void }) {
  const when = time ?? task.dueTime;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      data-opens-task
      title={`Deadline: ${task.title}`}
      className="flex h-[22px] min-w-0 shrink-0 items-center gap-1.5 rounded-btn px-1 text-left hover:bg-ink-line-faint"
    >
      <FlagIcon className="shrink-0 text-fg-white" />
      {when && <span className="shrink-0 font-ui text-[11px] text-fg-label tabular-nums">{when}</span>}
      <span className="read min-w-0 truncate text-[11px] font-semibold text-fg-white">{task.title}</span>
    </button>
  );
}

/** "Morning routine 2/5": a routine's tasks of one day as one line. Opens that week. */
function RoutineLine({ item, onOpen }: { item: Extract<MonthItem, { kind: "routine" }>; onOpen: () => void }) {
  const all = item.of > 0 && item.done === item.of;
  return (
    <button
      type="button"
      aria-label={`${item.title}: ${item.done} of ${item.of} done. Open week`}
      title={`${item.title} · ${item.done}/${item.of} done`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className="flex h-[22px] min-w-0 shrink-0 items-center gap-1.5 rounded-btn px-1 text-left hover:bg-ink-line-faint"
    >
      {all ? (
        <CheckIcon size={8} className="shrink-0" style={{ color: toneHex(item.tone) }} />
      ) : (
        <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: toneHex(item.tone) }} />
      )}
      <span className={cn("read min-w-0 truncate text-[11px] font-semibold", all ? "text-fg-label" : "text-fg-secondary")}>{item.title}</span>
      <span className="ml-auto shrink-0 font-ui text-[11px] text-fg-label tabular-nums">
        {item.done}/{item.of}
      </span>
    </button>
  );
}

/** "+N more": the whole day in a popover, every task on its own line. */
function MoreList({
  day: d,
  hidden,
  clock,
  palette,
  onOpen,
  onPickDay,
}: {
  day: CalendarDay;
  hidden: number;
  clock: Clock;
  palette: Palette;
  onOpen: (id: string) => void;
  onPickDay: (d: LocalDate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 self-start rounded-btn px-1 font-ui text-[11px] text-fg-label hover:bg-ink-line-faint hover:text-fg-white"
      >
        +{hidden} more
      </PopoverTrigger>
      <PopoverContent align="start" className="flex max-h-[360px] w-[260px] flex-col gap-0.5 overflow-y-auto p-2" onClick={(e) => e.stopPropagation()}>
        <span className="px-1 pb-1.5 font-ui text-[11px] text-fg-label uppercase">{label(d.day, "EEEE d MMMM")}</span>
        {monthDayList(d, palette).map(({ task, time, deadline }) =>
          deadline ? (
            <MonthDeadline key={`d-${task.id}`} task={task} time={time} onOpen={() => {
              setOpen(false);
              onOpen(task.id);
            }} />
          ) : (
            <TaskLine key={task.id} task={task} clock={clock} palette={palette} time={time} onOpen={() => {
              setOpen(false);
              onOpen(task.id);
            }} />
          ),
        )}
        <Button size="sm" variant="ghost" className="mt-1 self-start" onClick={() => {
            setOpen(false);
            onPickDay(d.day);
          }}>
          Open the week
        </Button>
      </PopoverContent>
    </Popover>
  );
}
