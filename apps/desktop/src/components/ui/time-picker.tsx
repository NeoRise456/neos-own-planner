import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { type LocalTime, minutesToTime, parseTimeInput, splitDateTime, timeToMinutes } from "@planner/core";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { Button } from "./button";
import { ClearButton } from "./date-picker";
import { ClockIcon } from "./icons";
import { Popover, PopoverAnchor, PopoverContent } from "./menu";

/**
 * Time field — DESIGN.md "Date & time fields". 24-hour, like every time in the app.
 * You **type** it ("1830", "18:30", "6pm", "9"), and the **arrow keys** change the part the
 * cursor is on, like a clock's setting buttons:
 * - cursor in the hours (before the ":") → ↑ / ↓ move the hour;
 * - cursor in the minutes → ↑ / ↓ move by 5 minutes (Shift: by 1), staying in that hour.
 * The changed part stays selected, so you see what moves, and typing replaces it.
 * ↑ / ↓ on an empty field start from now. Value "HH:MM", "" = none.
 *
 * Clicking the field also opens **two wheels** (hours 00–23, minutes 00–59) under it: the
 * time is the middle row; spin with the mouse wheel, drag, or click a number to roll it to
 * the middle. They loop (23 → 00) and change the time as they turn; Esc puts back the time
 * the wheels opened with, Enter or a click outside closes them. Typing turns them too.
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
const pad = (n: number) => String(n).padStart(2, "0");

export function TimeField({ value, onChange, required, placeholder = "No time", className, ...aria }: TimeFieldProps) {
  const clock = useClock();
  const [draft, setDraft] = useState(value);
  const [bad, setBad] = useState(false);
  const [open, setOpen] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  /** The value when the wheels opened, for Esc. */
  const openedWith = useRef<LocalTime | "">(value);

  // Follow outside changes (the dialog loading a task, a start time moving its end along, the wheels).
  useEffect(() => {
    setDraft(value);
    setBad(false);
  }, [value]);

  const nowTime = () => splitDateTime(clock.at).time;

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

  function set(next: LocalTime) {
    setBad(false);
    setDraft(next);
    onChange(next);
  }

  /** ↑ / ↓: the hour or the minutes, whichever the cursor is on. */
  function step(dir: 1 | -1, fine: boolean) {
    const el = input.current;
    const typed = parseTimeInput(draft);
    // Empty: start from now, on a 5-minute mark. Unreadable text: leave it to be fixed.
    if (typed === null && draft.trim() !== "") return setBad(true);
    const base = typed ?? minutesToTime((Math.round(timeToMinutes(nowTime()) / STEP) * STEP) % 1440);
    // The cursor's part, when the field shows HH:MM; otherwise the minutes.
    const part = HHMM.test(draft) && (el?.selectionStart ?? 0) <= 2 ? "hour" : "minute";
    const [h, m] = base.split(":").map(Number);
    let next: string;
    if (part === "hour") next = `${pad((h + dir + 24) % 24)}:${pad(m)}`;
    else {
      const by = fine ? 1 : STEP;
      // Up goes to the next mark (18:47 → 18:50), down to the one before (18:47 → 18:45).
      const moved = dir > 0 ? Math.floor(m / by) * by + by : Math.ceil(m / by) * by - by;
      next = `${pad(h)}:${pad((moved + 60) % 60)}`;
    }
    set(next);
    // Keep that part selected, so the next arrow (or typed digits) acts on it again.
    requestAnimationFrame(() => {
      if (document.activeElement !== el) return;
      if (part === "hour") el?.setSelectionRange(0, 2);
      else el?.setSelectionRange(3, 5);
    });
  }

  function openWheels() {
    if (open) return;
    openedWith.current = value;
    setOpen(true);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      // Enter confirms the field; it doesn't submit the form underneath.
      e.preventDefault();
      if (commit()) setOpen(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      step(e.key === "ArrowUp" ? 1 : -1, e.shiftKey);
    }
  }

  // The wheels show what's typed as you type it; an empty field shows now (not chosen until turned).
  const shown = parseTimeInput(draft) ?? (value || nowTime());
  const [hh, mm] = shown.split(":").map(Number);
  const chosen = parseTimeInput(draft) !== null || value !== "";

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
            aria-expanded={open}
            title={bad ? "Type a time like 18:30, 1830 or 6pm" : "Type a time, use ↑ ↓ on the hour or the minutes, or turn the wheels"}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={openWheels}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // The wheels never take the focus, so leaving the field means leaving the picker.
              commit();
              setOpen(false);
            }}
            className="min-w-0 flex-1 bg-transparent font-ui text-[13px] text-fg tabular-nums outline-none placeholder:text-fg-placeholder focus-visible:outline-none"
          />
          {value && !required && <ClearButton label="Clear the time" onClick={() => onChange("")} />}
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Keep the focus (and the cursor) in the field while the wheels are used.
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => {
          if (shell.current?.contains(e.target as Node)) e.preventDefault();
        }}
        onEscapeKeyDown={() => {
          // Esc puts back the time the wheels opened with (only the picker closes, not a dialog).
          setDraft(openedWith.current);
          setBad(false);
          onChange(openedWith.current);
        }}
      >
        <div className="relative flex items-stretch" aria-hidden>
          {/* the middle row: the chosen time */}
          <span
            className="pointer-events-none absolute inset-x-0 rounded-btn bg-ink-fill"
            style={{ top: (VISIBLE >> 1) * ROW, height: ROW }}
          />
          <Wheel count={24} value={hh} chosen={chosen} onTurn={(by) => set(`${pad((((hh + by) % 24) + 24) % 24)}:${pad(mm)}`)} />
          <span
            className={cn("relative flex w-3 items-center justify-center font-ui text-[17px]", chosen ? "text-fg-white" : "text-fg-label")}
            style={{ height: VISIBLE * ROW }}
          >
            :
          </span>
          <Wheel count={60} value={mm} chosen={chosen} onTurn={(by) => set(`${pad(hh)}:${pad((((mm + by) % 60) + 60) % 60)}`)} />
        </div>
        <div className="mt-2 flex justify-end border-t border-ink-line-soft pt-2">
          <Button size="sm" variant="ghost" onClick={() => set(nowTime())}>
            Now
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Rows a wheel shows (odd: the middle one is the value), and their height. */
const VISIBLE = 7;
const ROW = 32;
/** Wheel travel (px) per step. A mouse notch (~100) is always one step; touchpad travel adds up to this. */
const WHEEL_STEP = 50;

/**
 * One looping wheel of numbers 0…count-1. The middle row is `value`; the rows around it
 * fade with distance. Mouse wheel = one step per notch, drag = follows the pointer, click a
 * row = rolls it to the middle. Pointer only: the field keeps the keyboard.
 */
function Wheel({ count, value, chosen, onTurn }: { count: number; value: number; chosen: boolean; onTurn: (by: number) => void }) {
  const el = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const drag = useRef<{ y: number; moved: number; dragging: boolean } | null>(null);
  const turn = useRef(onTurn);
  turn.current = onTurn;

  // A native listener, so the wheel can stop the dialog underneath from scrolling.
  useEffect(() => {
    const node = el.current;
    if (!node) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      // A mouse notch is one big delta: exactly one step. A touchpad sends small ones: add them up.
      if (Math.abs(dy) >= WHEEL_STEP) {
        acc = 0;
        return turn.current(Math.sign(dy));
      }
      acc += dy;
      if (Math.abs(acc) >= WHEEL_STEP) {
        turn.current(Math.sign(acc));
        acc = 0;
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  function down(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, moved: 0, dragging: false };
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    d.moved = Math.max(d.moved, Math.abs(dy));
    if (d.moved < 4) return;
    d.dragging = true;
    // Dragging down brings the earlier numbers to the middle.
    const by = Math.trunc(-dy / ROW);
    if (by !== 0) {
      turn.current(by);
      d.y -= by * ROW;
    }
    setOffset(e.clientY - d.y);
  }
  function up(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.dragging) {
      // A click: roll the clicked row to the middle.
      const top = e.currentTarget.getBoundingClientRect().top;
      const row = Math.floor((e.clientY - top) / ROW) - (VISIBLE >> 1);
      if (row !== 0) turn.current(row);
    } else if (Math.abs(offset) > ROW / 2) turn.current(offset > 0 ? -1 : 1);
    setOffset(0);
  }

  const half = (VISIBLE >> 1) + 1;
  return (
    <div
      ref={el}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        drag.current = null;
        setOffset(0);
      }}
      className="relative w-14 cursor-ns-resize touch-none overflow-hidden select-none"
      style={{
        height: VISIBLE * ROW,
        maskImage: "linear-gradient(to bottom, transparent, #000 28%, #000 72%, transparent)",
      }}
    >
      <div
        className={cn("absolute inset-x-0", drag.current?.dragging ? "" : "transition-transform duration-[120ms] ease-snap")}
        style={{ top: (VISIBLE >> 1) * ROW - half * ROW, transform: `translateY(${offset}px)` }}
      >
        {Array.from({ length: half * 2 + 1 }, (_, i) => {
          const k = i - half;
          const n = (((value + k) % count) + count) % count;
          return (
            <span
              key={k}
              className={cn(
                "flex items-center justify-center font-ui tabular-nums",
                k === 0 ? cn("text-[17px]", chosen ? "text-fg-white" : "text-fg-label") : "text-[13px] text-fg-secondary",
              )}
              style={{ height: ROW }}
            >
              {pad(n)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
