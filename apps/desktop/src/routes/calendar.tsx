import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  type CalendarBlock,
  type CalendarDay,
  type Clock,
  type LocalDate,
  type Task,
  type TaskFields,
  addDays,
  calendarDay,
  daysInMonth,
  diffDays,
  eachDay,
  filterByTag,
  makeDate,
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
import { glyphOf } from "@/lib/glyph";
import { type Palette, dayShort, groupCounts, toneOf, visualState } from "@/lib/task-view";
import { type Tone, tint, toneHex } from "@/lib/tones";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { EmptyState, Label } from "@/components/ui/bits";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon, PlusIcon } from "@/components/ui/icons";
import { UnderlineTabs } from "@/components/ui/tabs";
import { Glyph, type VisualState } from "@/components/ui/task-visuals";
import { TaskPanel } from "@/components/app/todo";
import { NewTaskDialog } from "@/components/app/task-dialogs";
import { TagFilter, tagsOf } from "@/components/app/tag-filter";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

/** Pixels per hour (DESIGN.md "Calendar block"). */
const HOUR = 48;
/** The scrollbar's width (styles/index.css): the header rows leave room for it so the columns line up. */
const SCROLLBAR = 6;
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
      <main className={cn("min-w-0 flex-1 px-8", calView === "week" && "flex h-full min-h-0 flex-col self-stretch")}>
        <div className={cn("mx-auto w-full max-w-[1200px] pt-10", calView === "week" ? "flex min-h-0 flex-1 flex-col pb-6" : "pb-16")}>
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
                <Button onClick={() => create()}>
                  <PlusIcon />
                  New task
                </Button>
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
            <div className={cn("mt-7 overflow-x-auto", calView === "week" && "flex min-h-0 flex-1 flex-col overflow-y-hidden")}>
              {calView === "week" ? (
                <WeekGrid days={days} today={today} clock={clock} palette={palette} openTaskId={openTaskId} onOpen={open} onCreate={create} />
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

function WeekGrid({ days, today, clock, palette, openTaskId, onOpen, onCreate }: GridProps & { openTaskId: string | null; onCreate: (f: Partial<TaskFields>) => void }) {
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
  const cols = "grid grid-cols-[56px_repeat(7,minmax(0,1fr))]";
  const [allDayOpen, setAllDayOpen] = useState(false);
  /** The empty half hour under the pointer: day + minutes. */
  const [hover, setHover] = useState<{ day: LocalDate; min: number } | null>(null);

  const slotOf = (e: MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    return slotAt(from * 60 + (y / HOUR) * 60);
  };
  const moreRows = Math.max(0, ...days.map((d) => groupCounts(d.during, d.during, palette).length - DURING_ROWS));

  return (
    <div className="flex min-h-0 min-w-[600px] flex-1 flex-col">
      {/* day header */}
      <div className={cn(cols, "border-b border-ink-line-soft pb-2.5")} style={{ paddingRight: SCROLLBAR }}>
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
      <div className={cn(cols, "border-b border-ink-line-soft")} style={{ paddingRight: SCROLLBAR }}>
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
              <button
                type="button"
                aria-label={`New task on ${dayShort(d.day)}`}
                title="New task on this day"
                onClick={() => onCreate({ startDate: d.day })}
                className="mt-auto flex h-6 items-center justify-center self-stretch rounded-btn text-fg-label opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:bg-ink-line-faint hover:text-fg-white focus-visible:opacity-100"
              >
                <PlusIcon size={10} />
              </button>
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

      {/* hours: 00–24, scrolling on their own */}
      <div ref={scroller} aria-label="Hours" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
        <div className={cn(cols, "pt-1.5")}>
          <div className="relative" style={{ height }}>
            {Array.from({ length: to - from }, (_, k) => (
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
          {days.map((d) => (
            <div
              key={d.day}
              className="relative cursor-pointer border-l border-ink-line-faint"
              style={{ height, background: `repeating-linear-gradient(to bottom,#161616 0 1px,transparent 1px ${HOUR}px)` }}
              onMouseMove={(e) => {
                if (e.target !== e.currentTarget) return setHover(null);
                const min = slotOf(e);
                if (hover?.day !== d.day || hover.min !== min) setHover({ day: d.day, min });
              }}
              onMouseLeave={() => setHover(null)}
              onClick={(e) => {
                // Only empty space: a click on a block opens the task instead.
                if (e.target !== e.currentTarget) return;
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
              {d.blocks.map((b) => (
                <Block key={b.task.id} block={b} from={from} clock={clock} palette={palette} selected={b.task.id === openTaskId} onOpen={() => onOpen(b.task.id)} />
              ))}
              {showNow && d.day === today && (
                <div aria-label="Now" className="pointer-events-none absolute right-0 -left-px z-[3] h-0.5 bg-fg-white" style={{ top: nowTop }}>
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
 * title; cancelled = dashed outline, struck title. 13px status circle on the right.
 * Blocks that overlap share the column (lanes).
 */
function Block({
  block,
  from,
  clock,
  palette,
  selected,
  onOpen,
}: {
  block: CalendarBlock;
  from: number;
  clock: Clock;
  palette: Palette;
  selected: boolean;
  onOpen: () => void;
}) {
  const { task, start, end, lane, lanes, hasDuration } = block;
  const tone = toneOf(task, palette);
  const t = toneHex(tone);
  const state = visualState(task, clock);
  const h = Math.max(((end - start) / 60) * HOUR - 2, 14);
  const tall = h >= 40;
  const dark = selected || state === "done";
  const time = `${hasDuration ? `${hm(start)}–${hm(end)}` : hm(start)}${state === "done" ? " · done" : state === "missed" ? " · missed" : state === "cancelled" ? " · cancelled" : ""}`;
  const look = blockLook(state, tone, selected);
  const place = { left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - ${lanes > 1 ? 6 : 8}px)` };

  // No end time: a marker at its start (a 2px line + a label), not a block with a made-up length.
  if (!hasDuration) {
    const line = selected ? "#FFFFFF" : state === "done" ? t : state === "todo" ? tint(tone, 0.8) : "#3A3A3A";
    return (
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`${task.title}, ${time}`}
        title={`${task.title} · ${time} (no end time)`}
        onClick={onOpen}
        className="group absolute z-[2] flex h-[22px] flex-col text-left"
        style={{ top: ((start - from * 60) / 60) * HOUR - 1, ...place }}
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
      onClick={onOpen}
      className={cn(
        "absolute z-[2] box-border flex flex-col gap-0.5 overflow-hidden rounded-card px-2 text-left transition-[background-color,border-color,filter] duration-200 hover:brightness-115",
        tall ? "py-[5px]" : "justify-center py-0.5",
      )}
      style={{
        top: ((start - from * 60) / 60) * HOUR + 1,
        height: h,
        ...place,
        ...look,
      }}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        {/* Side by side, the title needs the room more than the glyph. */}
        {lanes === 1 && (
          <Glyph size={12} color={dark ? "#111111" : state === "missed" || state === "cancelled" ? "#7A7A7A" : t} style={{ lineHeight: "13px" }}>
            {glyphOf(task.title)}
          </Glyph>
        )}
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
  if (state === "cancelled") return { background: "transparent", border: "1px dashed #3A3A3A" };
  if (state === "missed") return { background: tint(tone, 0.08), border: `1px solid ${tint(tone, 0.3)}` };
  return { background: tint(tone, 0.2), border: `1px solid ${tint(tone, 0.55)}` };
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

/**
 * Month — not drawn in the design. Same voice as the week: day numbers in the UI font,
 * tasks as tone squares + titles (timed ones with their time, deadlines with a flag),
 * today as a white pill. Clicking a day opens its week; clicking a task opens it.
 */
function MonthGrid({ days, month, today, clock, palette, onOpen, onPickDay }: Omit<GridProps, "openTaskId"> & { month: string; onPickDay: (d: LocalDate) => void }) {
  return (
    <div className="min-w-[600px]">
      <div className="grid grid-cols-7 border-b border-ink-line-soft pb-2.5">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="px-2 font-ui text-[11px] text-fg-label uppercase">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const items: { task: Task; time?: string; deadline?: boolean }[] = [
            ...d.deadlines.map((task) => ({ task, deadline: true, time: task.dueTime })),
            ...d.blocks.map((b) => ({ task: b.task, time: hm(b.start) })),
            ...groupCounts(d.during, d.during, palette).map(({ task, count }) => ({ task, time: count ? `${count.done}/${count.of}` : undefined })),
          ];
          const inMonth = d.day.slice(0, 7) === month;
          const isToday = d.day === today;
          return (
            <div
              key={d.day}
              onClick={() => onPickDay(d.day)}
              className={cn(
                "flex min-h-[112px] cursor-pointer flex-col gap-0.5 border-b border-l border-ink-line-faint p-1.5 transition-colors hover:bg-ink-hover",
                !inMonth && "opacity-50",
              )}
            >
              <button
                type="button"
                aria-label={`${label(d.day, "EEEE d MMMM")}, ${items.length} tasks. Open week`}
                onClick={(e) => {
                  e.stopPropagation();
                  onPickDay(d.day);
                }}
                className={cn(
                  "mb-0.5 self-start rounded-[5px] px-1.5 py-px font-ui text-[12px] tabular-nums",
                  isToday ? "bg-fg-white font-bold text-black" : inMonth ? "text-fg-secondary hover:text-fg-white" : "text-fg-label",
                )}
              >
                {label(d.day, "d")}
              </button>
              {items.slice(0, 3).map(({ task, time, deadline }) =>
                deadline ? (
                  <button
                    key={`d-${task.id}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpen(task.id);
                    }}
                    title={`Deadline: ${task.title}`}
                    className="flex h-[22px] min-w-0 shrink-0 items-center gap-1.5 rounded-btn px-1 text-left hover:bg-ink-line-faint"
                  >
                    <FlagIcon className="shrink-0 text-fg-white" />
                    {time && <span className="shrink-0 font-ui text-[11px] text-fg-label tabular-nums">{time}</span>}
                    <span className="read min-w-0 truncate text-[11px] font-semibold text-fg-white">{task.title}</span>
                  </button>
                ) : (
                  <TaskLine key={task.id} task={task} clock={clock} palette={palette} time={time} onOpen={() => onOpen(task.id)} />
                ),
              )}
              {items.length > 3 && <span className="px-1 font-ui text-[11px] text-fg-label">+{items.length - 3} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
