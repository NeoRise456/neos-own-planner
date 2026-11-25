import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { type LocalTime, minutesToTime, parseTimeInput, splitDateTime, timeToMinutes } from "@planner/core";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { ClearButton } from "./date-picker";
import { ClockIcon } from "./icons";

/**
 * Time field — DESIGN.md "Date & time fields". 24-hour, like every time in the app.
 * No list to pick from: you **type** it ("1830", "18:30", "6pm", "9"), and the **arrow keys**
 * change the part the cursor is on, like a clock's setting buttons:
 * - cursor in the hours (before the ":") → ↑ / ↓ move the hour;
 * - cursor in the minutes → ↑ / ↓ move by 5 minutes (Shift: by 1), staying in that hour.
 * The changed part stays selected, so you see what moves, and typing replaces it.
 * ↑ / ↓ on an empty field start from now. Value "HH:MM", "" = none.
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
const HHMM = /^\d{2}:\d{2}$/;

export function TimeField({ value, onChange, required, placeholder = "No time", className, ...aria }: TimeFieldProps) {
  const clock = useClock();
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Follow outside changes (the dialog loading a task, a start time moving its end along).
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

  /** ↑ / ↓: the hour or the minutes, whichever the cursor is on. */
  function step(dir: 1 | -1, fine: boolean) {
    const el = input.current;
    const typed = parseTimeInput(draft);
    // Empty: start from now, on a 5-minute mark. Unreadable text: leave it to be fixed.
    if (typed === null && draft.trim() !== "") return setBad(true);
    const base = typed ?? minutesToTime(Math.round(timeToMinutes(splitDateTime(clock.at).time) / STEP) * STEP % 1440);
    // The cursor's part, when the field shows HH:MM; otherwise the minutes.
    const part = HHMM.test(draft) && (el?.selectionStart ?? 0) <= 2 ? "hour" : "minute";
    const [h, m] = base.split(":").map(Number);
    let next: string;
    if (part === "hour") next = `${String((h + dir + 24) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    else {
      const by = fine ? 1 : STEP;
      // Up goes to the next mark (18:47 → 18:50), down to the one before (18:47 → 18:45).
      const moved = dir > 0 ? Math.floor(m / by) * by + by : Math.ceil(m / by) * by - by;
      next = `${String(h).padStart(2, "0")}:${String((moved + 60) % 60).padStart(2, "0")}`;
    }
    setBad(false);
    setDraft(next);
    onChange(next);
    // Keep that part selected, so the next arrow (or typed digits) acts on it again.
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      if (part === "hour") el?.setSelectionRange(0, 2);
      else el?.setSelectionRange(3, 5);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Enter confirms the field; it doesn't submit the form underneath.
      e.preventDefault();
      commit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      step(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
    }
  }

  return (
    <div
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
        title={bad ? "Type a time like 18:30, 1830 or 6pm" : "Type a time, or use ↑ ↓ on the hour or the minutes"}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => void commit()}
        className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-fg tabular-nums outline-none placeholder:text-fg-placeholder focus-visible:outline-none"
      />
      {value && !required && <ClearButton label="Clear the time" onClick={() => onChange("")} />}
    </div>
  );
}
