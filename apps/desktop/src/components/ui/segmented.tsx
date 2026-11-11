import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Segmented control — DESIGN.md §3.
 * Track: #111, 1px #262626 border, radius 8, padding 2, 26px segments.
 * Selected: black with a #333 border, white bold text.
 * big: black track, 30px segments, the selected one is white with black text.
 * Arrow keys move the selection (role=radiogroup).
 */
export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

export function Segmented<T extends string>({
  items,
  value,
  onValueChange,
  label,
  big,
  segmentClassName,
  className,
}: {
  items: SegmentItem<T>[];
  value: T;
  onValueChange: (v: T) => void;
  label: string;
  big?: boolean;
  segmentClassName?: string;
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent) {
    const live = items.filter((i) => !i.disabled);
    const idx = live.findIndex((i) => i.value === value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % live.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (idx - 1 + live.length) % live.length;
    if (next < 0) return;
    e.preventDefault();
    onValueChange(live[next].value);
    refs.current[items.indexOf(live[next])]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "inline-flex gap-0.5 border border-[#262626]",
        big ? "rounded-drop bg-black p-[3px]" : "rounded-card bg-ink-well p-0.5",
        className,
      )}
    >
      {items.map((it, i) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "inline-flex items-center justify-center rounded-btn border border-transparent font-ui whitespace-nowrap",
              "transition-colors duration-[120ms] ease-snap",
              big ? "h-[30px] min-w-[98px] px-[18px] text-[13px]" : "h-[26px] px-[18px] text-[12px]",
              on
                ? big
                  ? "border-fg-white bg-fg-white font-semibold text-black"
                  : "border-[#333333] bg-black font-semibold text-fg-white"
                : "text-fg-muted hover:text-[#E5E5E5] disabled:cursor-default disabled:text-[#555555] disabled:hover:text-[#555555]",
              segmentClassName,
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
