import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Underline tabs — DESIGN.md §3. #8C8C8C text; the active one is white,
 * bold, with a 2px white underline. Used for Calendar Week | Month.
 */
export function UnderlineTabs<T extends string>({
  items,
  value,
  onValueChange,
  label,
  className,
}: {
  items: { value: T; label: ReactNode }[];
  value: T;
  onValueChange: (v: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex gap-5", className)}>
      {items.map((it) => {
        const on = it.value === value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onValueChange(it.value)}
            className={cn(
              "border-b-2 py-1.5 font-ui text-[13px] transition-colors duration-[120ms]",
              on ? "border-fg-white font-semibold text-fg-white" : "border-transparent text-fg-muted hover:text-[#E5E5E5]",
            )}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
