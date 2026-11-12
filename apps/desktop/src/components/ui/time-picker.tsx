import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { type LocalTime, minutesToTime, parseTimeInput, splitDateTime, timeToMinutes } from "@planner/core";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { Button } from "./button";
import { ClearButton } from "./date-picker";
import { ClockIcon } from "./icons";
import { Popover, PopoverAnchor, PopoverContent } from "./menu";

/**
 * Time field — DESIGN.md "Date & time fields". 24-hour, like every time in the app.
 * Type it ("1830", "18:30", "6pm", "9") or pick it: the field opens an hour column and
 * a minute column (5-minute steps). ↑ / ↓ move it by 5 minutes. Value "HH:MM", "" = none.
 * Reading what was typed is @planner/core's `parseTimeInput`.
 */
export interface TimeFieldProps {
  value: LocalTime | "";
  onChange: (value: LocalTime | "") => void;
  id?: string;
  "aria-label"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
}

const STEP = 5;
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));

export function TimeField({ value, onChange, required, placeholder = "No time", className, ...aria }: TimeFieldProps) {
  const clock = useClock();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // Follow outside changes (picking, "Now", the dialog loading a task).
  useEffect(() => {
    setDraft(value);
    setBad(false);
  }, [value]);

  /** Typed text → the value. Unreadable text stays, marked red, until it's fixed. */
  function commit(): boolean {
    const text = draft.trim();
    if (text === "") {
      if (!required) onChange("");
      else setDraft(value);
      setBad(false);
      return true;
    }
    const t = parseTimeInput(text);
    setBad(t === null);
    if (t === null) return false;
    setDraft(t);
    onChange(t);
    return true;
  }

  function nudge(delta: number) {
    const base = parseTimeInput(draft) ?? (value || splitDateTime(clock.at).time);
    const m = timeToMinutes(base);
    const next = minutesToTime((((Math.round(m / STEP) * STEP + delta) % 1440) + 1440) % 1440);
    onChange(next);
    setDraft(next);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Enter confirms the field; it doesn't submit the form underneath.
      e.preventDefault();
      if (commit()) setOpen(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      nudge(e.key === "ArrowUp" ? STEP : -STEP);
    }
  }

  const [hh, mm] = value ? value.split(":") : [undefined, undefined];
  const steps = Array.from({ length: 60 / STEP }, (_, i) => String(i * STEP).padStart(2, "0"));
  // A typed 18:47 still shows as chosen, in its place.
  const minutes = [...new Set([...steps, ...(mm !== undefined ? [mm] : [])])].sort();

  const pickHour = (h: string) => onChange(`${h}:${mm ?? "00"}`);
  const pickMinute = (m: string) => {
    onChange(`${hh ?? splitDateTime(clock.at).time.slice(0, 2)}:${m}`);
    setOpen(false);
    input.current?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={shell}
          className={cn(
            "relative flex h-9 w-full items-center gap-2.5 rounded-btn border border-ink-line bg-black pl-2.5 transition-colors duration-[120ms]",
            // Room for the ✕ only when there is one.
            value && !required ? "pr-8" : "pr-2.5",
            "focus-within:border-fg-muted",
            (bad || aria["aria-invalid"]) && "border-error-line focus-within:border-error-line",
            className,
          )}
        >
          <ClockIcon size={14} className="shrink-0 text-fg-label" />
          <input
            ref={input}
            {...aria}
            aria-invalid={bad || aria["aria-invalid"] || undefined}
            title={bad ? "Type a time like 18:30, 1830 or 6pm" : undefined}
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={onKeyDown}
            onBlur={(e) => {
              // Moving into the columns keeps it open; leaving the field confirms what was typed.
              if (content.current?.contains(e.relatedTarget as Node)) return;
              commit();
              setOpen(false);
            }}
            className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-fg tabular-nums outline-none placeholder:text-fg-placeholder focus-visible:outline-none"
          />
          {value && !required && <ClearButton label="Clear the time" onClick={() => onChange("")} />}
        </div>
      </PopoverAnchor>
      <PopoverContent
        ref={content}
        className="p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (shell.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <div className="flex gap-1.5">
          <Column label="Hour" items={HOURS} selected={hh} onPick={pickHour} />
          <Column label="Min" items={minutes} selected={mm} onPick={pickMinute} />
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-ink-line-soft pt-2">
          {!required ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Clear
            </Button>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            onClick={() => {
              onChange(splitDateTime(clock.at).time);
              setOpen(false);
            }}
          >
            Now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One scrolling column of 32px keys; the chosen one is white and starts in the middle. */
function Column({ label, items, selected, onPick }: { label: string; items: string[]; selected?: string; onPick: (v: string) => void }) {
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = list.current;
    const chosen = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el && chosen) el.scrollTop = chosen.offsetTop - el.clientHeight / 2 + chosen.offsetHeight / 2;
    // Only on open: picking shouldn't jump the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex w-[62px] flex-col">
      <span className="flex h-7 items-center justify-center pr-1.5 font-ui text-[11px] tracking-[.08em] text-fg-label uppercase">{label}</span>
      <div ref={list} role="listbox" aria-label={label} className="relative flex h-[232px] flex-col gap-0.5 overflow-y-auto pr-1.5">
        {items.map((v) => (
          <button
            key={v}
            type="button"
            role="option"
            aria-selected={v === selected}
            onClick={() => onPick(v)}
            className={cn(
              "flex h-8 shrink-0 items-center justify-center rounded-btn font-ui text-[13px] tabular-nums transition-colors duration-[120ms] ease-snap",
              v === selected ? "bg-fg-white text-black hover:bg-primary-hover" : "text-fg hover:bg-ink-fill active:bg-ink-fill-hover",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
