import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { format, parseISO } from "date-fns";
import { type LocalDate, addDays, daysInMonth, isoWeekday, makeDate, parseDate, todayOf } from "@planner/core";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { Button, RoundButton } from "./button";
import { inputBase } from "./field";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./icons";
import { Popover, PopoverContent, PopoverTrigger } from "./menu";

/**
 * Date field — DESIGN.md "Date & time fields". Looks like an input (black, 1px #2A2A2A,
 * radius 6, UI 13); opens a month calendar. Value is a "YYYY-MM-DD" day, "" = none.
 * Weeks start on Monday, like the rest of the app. Date math comes from @planner/core.
 */
export interface DateFieldProps {
  value: LocalDate | "";
  onChange: (value: LocalDate | "") => void;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  /** No "clear": a day must be picked. */
  required?: boolean;
  placeholder?: string;
  min?: LocalDate;
  max?: LocalDate;
  className?: string;
}

/** "Wed 11 Nov", with the year when it isn't this year. */
function dayLabel(d: LocalDate, today: LocalDate) {
  return format(parseISO(d), d.slice(0, 4) === today.slice(0, 4) ? "EEE d MMM" : "EEE d MMM yyyy");
}

export function DateField({ value, onChange, required, placeholder = "No date", min, max, className, ...aria }: DateFieldProps) {
  const today = todayOf(useClock());
  const [open, setOpen] = useState(false);
  const pick = (d: LocalDate | "") => {
    onChange(d);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("relative", className)}>
        <PopoverTrigger asChild>
          <button
            type="button"
            {...aria}
            className={cn(inputBase, "flex h-9 items-center gap-2.5 text-left font-ui text-[13px] tabular-nums", value && !required ? "pr-8" : "pr-2.5")}
          >
            <CalendarIcon size={14} className="shrink-0 text-fg-label" />
            <span className={cn("truncate", value ? "text-fg" : "text-fg-placeholder")}>{value ? dayLabel(value, today) : placeholder}</span>
          </button>
        </PopoverTrigger>
        {value && !required && (
          <ClearButton label="Clear the date" onClick={() => onChange("")} />
        )}
      </div>
      <PopoverContent className="p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
        <MonthCalendar value={value || undefined} today={today} min={min} max={max} onPick={pick} onClear={required ? undefined : () => pick("")} />
      </PopoverContent>
    </Popover>
  );
}

/** The small ✕ inside a field, on the right. */
export function ClearButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-btn text-fg-label transition-colors duration-[120ms] hover:bg-ink-fill hover:text-fg-white"
    >
      <CloseIcon size={9} />
    </button>
  );
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Same day `delta` months away (31 Jan + 1 month → 28/29 Feb). */
function shiftMonth(d: LocalDate, delta: number): LocalDate {
  const { year, month, day } = parseDate(d);
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return makeDate(y, m, Math.min(day, daysInMonth(y, m)));
}

/**
 * The month grid — 7 columns of 36px day keys. Selected = white key (the One White
 * Rule), today = grey ring, days outside min/max are greyed out. Keyboard: arrows move a
 * day / a week, Home / End the week, Page Up / Down the month, Enter or Space picks.
 */
export function MonthCalendar({
  value,
  today,
  min,
  max,
  onPick,
  onClear,
}: {
  value?: LocalDate;
  today: LocalDate;
  min?: LocalDate;
  max?: LocalDate;
  onPick: (d: LocalDate) => void;
  onClear?: () => void;
}) {
  const [focus, setFocus] = useState<LocalDate>(value ?? today);
  const grid = useRef<HTMLDivElement>(null);
  /** Bumped by keyboard moves (and 0 on open): focus follows the focused day then. */
  const [keyMoves, setKeyMoves] = useState(0);
  const { year, month } = parseDate(focus);
  const first = makeDate(year, month, 1);
  const lead = isoWeekday(first) - 1;
  const days = daysInMonth(year, month);
  // Always 6 week rows: the popover keeps one size from month to month, so it never
  // re-places itself (flipping above / below the field) and the ‹ › buttons stay under
  // the pointer while you click through months.
  const weeks = 6;
  const out = (d: LocalDate) => (min !== undefined && d < min) || (max !== undefined && d > max);

  // Focus the day key on open, and follow keyboard moves (not clicks on the month arrows).
  useEffect(() => {
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focus}"]`)?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyMoves]);

  function onKeyDown(e: KeyboardEvent) {
    const wd = isoWeekday(focus);
    const next: Record<string, LocalDate> = {
      ArrowLeft: addDays(focus, -1),
      ArrowRight: addDays(focus, 1),
      ArrowUp: addDays(focus, -7),
      ArrowDown: addDays(focus, 7),
      Home: addDays(focus, 1 - wd),
      End: addDays(focus, 7 - wd),
      PageUp: shiftMonth(focus, -1),
      PageDown: shiftMonth(focus, 1),
    };
    if (!(e.key in next)) return;
    e.preventDefault();
    setFocus(next[e.key]);
    setKeyMoves((n) => n + 1);
  }

  return (
    <div className="flex w-[264px] flex-col">
      <div className="flex items-center justify-between pb-2 pl-1.5">
        <span aria-live="polite" className="read text-[15px] font-extrabold text-fg-white">
          {format(parseISO(first), "MMMM yyyy")}
        </span>
        <div className="flex gap-1.5">
          <RoundButton small label="Previous month" onClick={() => setFocus(shiftMonth(focus, -1))}>
            <ChevronLeftIcon size={9} />
          </RoundButton>
          <RoundButton small label="Next month" onClick={() => setFocus(shiftMonth(focus, 1))}>
            <ChevronRightIcon size={9} />
          </RoundButton>
        </div>
      </div>

      <div ref={grid} role="grid" aria-label={format(parseISO(first), "MMMM yyyy")} onKeyDown={onKeyDown} className="flex flex-col gap-0.5">
        <div role="row" className="grid grid-cols-7 gap-0.5">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="flex h-7 items-center justify-center font-ui text-[11px] tracking-[.08em] text-fg-label uppercase">
              {w}
            </span>
          ))}
        </div>
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} role="row" className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 7 }, (_, c) => {
              const n = w * 7 + c - lead + 1;
              if (n < 1 || n > days) return <span key={c} role="gridcell" className="h-9" />;
              const d = makeDate(year, month, n);
              const selected = d === value;
              const disabled = out(d);
              return (
                <span key={c} role="gridcell" aria-selected={selected}>
                  <button
                    type="button"
                    data-day={d}
                    tabIndex={d === focus ? 0 : -1}
                    disabled={disabled}
                    aria-label={format(parseISO(d), "EEEE d MMMM yyyy")}
                    aria-current={d === today ? "date" : undefined}
                    onClick={() => onPick(d)}
                    onFocus={() => setFocus(d)}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-btn border font-ui text-[13px] tabular-nums transition-colors duration-[120ms] ease-snap",
                      selected
                        ? "border-transparent bg-fg-white text-black hover:bg-primary-hover"
                        : d === today
                          ? "border-fg-label text-fg-white hover:bg-ink-fill active:bg-ink-fill-hover"
                          : "border-transparent text-fg hover:bg-ink-fill active:bg-ink-fill-hover",
                      disabled && "cursor-default text-fg-disabled hover:bg-transparent",
                    )}
                  >
                    {n}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-ink-line-soft pt-2">
        {onClear ? (
          <Button size="sm" variant="ghost" onClick={onClear}>
            Clear
          </Button>
        ) : (
          <span />
        )}
        <Button size="sm" disabled={out(today)} onClick={() => onPick(today)}>
          Today
        </Button>
      </div>
    </div>
  );
}
