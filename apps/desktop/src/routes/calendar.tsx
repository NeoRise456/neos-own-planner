import { createFileRoute } from "@tanstack/react-router";
import {
  addDays,
  addWeeks,
  differenceInCalendarWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { cn } from "@/lib/cn";
import { tint, toneHex } from "@/lib/tones";
import { useNow } from "@/lib/use-now";
import { DEADLINE, EVENTS, REF_WEEK_MONDAY, type MockEvent } from "@/mock/data";
import { useUi } from "@/stores/ui";
import { Button, RoundButton } from "@/components/ui/button";
import { Label } from "@/components/ui/bits";
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FlagIcon } from "@/components/ui/icons";
import { UnderlineTabs } from "@/components/ui/tabs";
import { Glyph } from "@/components/ui/task-visuals";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

const START_H = 7;
const END_H = 21;
const HOUR = 48;
const WEEK = { weekStartsOn: 1 as const };

/** Mock events for a given week: routine ones repeat, one-offs only in the reference week. */
function eventsFor(weekStart: Date, weekday: number) {
  const ref = isSameDay(weekStart, REF_WEEK_MONDAY);
  return EVENTS.filter((e) => e.weekday === weekday && (ref || !e.refWeekOnly)).map((e) => ({ ...e, done: ref && !!e.doneInRefWeek }));
}

const hm = (x: number) => {
  const h = Math.floor(x);
  const m = Math.round((x - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

/** Calendar — screens/20-calendar-week. */
function CalendarPage() {
  const { calWeekOffset, calView, set } = useUi();
  const weekStart = startOfWeek(addWeeks(new Date(), calWeekOffset), WEEK);
  const weekEnd = addDays(weekStart, 6);
  const monthAnchor = addDays(weekStart, 3);

  const title =
    calView === "month"
      ? format(monthAnchor, "MMMM yyyy")
      : isSameMonth(weekStart, weekEnd)
        ? `${format(weekStart, "d")} – ${format(weekEnd, "d MMMM")}`
        : `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM")}`;

  const step = (dir: 1 | -1) => {
    if (calView === "week") return set({ calWeekOffset: calWeekOffset + dir });
    // Month: jump to the same week-of-month in the next/previous month.
    const target = startOfMonth(addDays(startOfMonth(monthAnchor), dir * 32));
    set({ calWeekOffset: differenceInCalendarWeeks(addDays(target, 7), new Date(), WEEK) });
  };

  return (
    <main className="min-w-0 flex-1 px-8">
      <div className="mx-auto max-w-[1200px] pt-10 pb-16">
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

        <div className="mt-7 overflow-x-auto">
          {calView === "week" ? <WeekGrid weekStart={weekStart} /> : <MonthGrid anchor={monthAnchor} />}
        </div>
      </div>
    </main>
  );
}

function WeekGrid({ weekStart }: { weekStart: Date }) {
  const { calSelected, set } = useUi();
  const now = useNow();
  const today = new Date();
  const ref = isSameDay(weekStart, REF_WEEK_MONDAY);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const showNow = now.hours >= START_H && now.hours <= END_H;
  const nowTop = (now.hours - START_H) * HOUR;
  const cols = "grid grid-cols-[56px_repeat(7,minmax(0,1fr))]";

  return (
    <div className="min-w-[600px]">
      {/* day header */}
      <div className={cn(cols, "border-b border-ink-line-soft pb-2.5")}>
        <span />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="flex items-center gap-2 px-2">
              <span className={cn("font-ui text-[11px] uppercase", isToday ? "text-fg-white" : "text-fg-label")}>{format(d, "EEE")}</span>
              <span className={cn("font-ui text-[12px] tabular-nums", isToday ? "rounded-[5px] bg-fg-white px-1.5 py-px font-bold text-black" : "text-fg-secondary")}>
                {format(d, "d")}
              </span>
            </div>
          );
        })}
      </div>

      {/* all-day row */}
      <div className={cn(cols, "border-b border-ink-line-soft")}>
        <span className="py-2.5 font-ui text-[11px] leading-[14px] text-fg-label uppercase">
          All
          <br />
          day
        </span>
        {days.map((d, i) => (
          <div key={d.toISOString()} className="flex flex-col gap-1.5 border-l border-ink-line-faint px-1 py-2">
            <span className="px-1 font-ui text-[11px] text-fg-label">4 during the day</span>
            {ref && i === DEADLINE.weekday && (
              <div className="flex h-[26px] items-center gap-1.5 rounded-btn border border-fg-white px-2" title={`Deadline: ${DEADLINE.title} ${DEADLINE.time}`}>
                <FlagIcon className="shrink-0 text-fg-white" />
                <span className="read truncate text-[12px] font-bold text-fg-white">{DEADLINE.title}</span>
                <span className="ml-auto font-ui text-[11px] text-fg-secondary tabular-nums">{DEADLINE.time}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* hours */}
      <div className={cn(cols, "pt-1.5")}>
        <div className="relative" style={{ height: (END_H - START_H) * HOUR }}>
          {Array.from({ length: END_H - START_H }, (_, k) => (
            <span key={k} className="absolute left-0 font-ui text-[11px] text-fg-label tabular-nums" style={{ top: k * HOUR + 3 }}>
              {hm(START_H + k)}
            </span>
          ))}
          {showNow && days.some((d) => isSameDay(d, today)) && (
            <span className="absolute left-0 z-[3] rounded-step bg-fg-white px-1 py-px font-ui text-[11px] text-black tabular-nums" style={{ top: nowTop - 8 }}>
              {now.label}
            </span>
          )}
        </div>
        {days.map((d, i) => (
          <div
            key={d.toISOString()}
            className="relative border-l border-ink-line-faint"
            style={{
              height: (END_H - START_H) * HOUR,
              background: `repeating-linear-gradient(to bottom,#161616 0 1px,transparent 1px ${HOUR}px)`,
            }}
          >
            {eventsFor(weekStart, i).map((e) => (
              <Block
                key={e.id}
                ev={e}
                day={format(d, "EEE")}
                selected={calSelected === `${e.id}`}
                onPick={() => set({ calSelected: calSelected === e.id ? null : e.id })}
              />
            ))}
            {showNow && isSameDay(d, today) && (
              <div aria-label="Now" className="absolute right-0 -left-px z-[3] h-0.5 bg-fg-white" style={{ top: nowTop }}>
                <span className="absolute -top-[3px] -left-1 size-2 rounded-full bg-fg-white" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Calendar block (DESIGN.md §3): not done = tinted tone, white title;
 * done = solid tone, dark text, "· done"; selected = white.
 * 13px status circle on the right — ring, or dark disc with a tone tick.
 */
function Block({ ev, day, selected, onPick }: { ev: MockEvent & { done: boolean }; day: string; selected: boolean; onPick: () => void }) {
  const t = toneHex(ev.tone);
  const h = (ev.end - ev.start) * HOUR - 1;
  const tall = h >= 40;
  const dark = selected || ev.done;
  const time = `${hm(ev.start)}–${hm(ev.end)}${ev.done ? " · done" : ""}`;
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${ev.title}, ${day} ${hm(ev.start)}–${hm(ev.end)}${ev.done ? ", done" : ""}`}
      onClick={onPick}
      className={cn(
        "absolute right-1 left-1 box-border flex flex-col gap-0.5 overflow-hidden rounded-card px-2 text-left transition-[background-color,border-color,filter] duration-200 hover:brightness-115",
        tall ? "py-[5px]" : "justify-center py-1",
      )}
      style={{
        top: (ev.start - START_H) * HOUR + 1,
        height: h,
        background: selected ? "#FFFFFF" : ev.done ? t : tint(ev.tone, 0.2),
        border: `1px solid ${selected ? "#FFFFFF" : ev.done ? t : tint(ev.tone, 0.55)}`,
      }}
    >
      <span className="flex w-full min-w-0 items-center gap-1.5">
        <Glyph size={12} color={dark ? "#111111" : t} style={{ lineHeight: "13px" }}>
          {ev.glyph}
        </Glyph>
        <span className="read min-w-0 flex-1 truncate text-[12px] leading-[14px] font-bold" style={{ color: dark ? "#0D0D0D" : "#FFFFFF" }}>
          {ev.title}
        </span>
        <span
          aria-hidden
          className="box-border flex size-[13px] shrink-0 items-center justify-center rounded-full"
          style={ev.done ? { background: "#0D0D0D" } : { border: `1.5px solid ${selected ? "rgba(0,0,0,0.45)" : tint(ev.tone, 0.7)}` }}
        >
          {ev.done && <CheckIcon size={8} style={{ color: selected ? "#FFFFFF" : t }} />}
        </span>
      </span>
      {tall && (
        <span className="font-ui text-[11px] whitespace-nowrap uppercase tabular-nums" style={{ color: dark ? "rgba(0,0,0,0.6)" : "#BDBDBD" }}>
          {time}
        </span>
      )}
    </button>
  );
}

/**
 * Month — not drawn in the design yet. Same voice as the week: day numbers in
 * the UI font, events as tone squares + titles, today as a white pill.
 * Clicking a day opens that week.
 */
function MonthGrid({ anchor }: { anchor: Date }) {
  const set = useUi((s) => s.set);
  const today = new Date();
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(anchor), WEEK),
    end: endOfWeek(endOfMonth(anchor), WEEK),
  });
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
          const weekStart = startOfWeek(d, WEEK);
          const evs = eventsFor(weekStart, (d.getDay() + 6) % 7);
          const inMonth = isSameMonth(d, anchor);
          const isToday = isSameDay(d, today);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => set({ calView: "week", calWeekOffset: differenceInCalendarWeeks(d, today, WEEK) })}
              aria-label={`${format(d, "EEEE d MMMM")}, ${evs.length} tasks. Open week`}
              className="flex min-h-[112px] flex-col gap-1 border-b border-l border-ink-line-faint p-1.5 text-left transition-colors hover:bg-ink-hover"
            >
              <span
                className={cn(
                  "mb-0.5 self-start px-1.5 py-px font-ui text-[12px] tabular-nums",
                  isToday ? "rounded-[5px] bg-fg-white font-bold text-black" : inMonth ? "text-fg-secondary" : "text-ink-line-dash",
                )}
              >
                {format(d, "d")}
              </span>
              {inMonth &&
                evs.slice(0, 3).map((e) => (
                  <span key={e.id} className="flex min-w-0 items-center gap-1.5 px-1">
                    <span aria-hidden className="size-2 shrink-0 rounded-[2px]" style={{ background: toneHex(e.tone) }} />
                    <span className="read truncate text-[11px] font-semibold text-fg">{e.title}</span>
                  </span>
                ))}
              {inMonth && evs.length > 3 && <span className="px-1 font-ui text-[11px] text-fg-label">+{evs.length - 3} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
