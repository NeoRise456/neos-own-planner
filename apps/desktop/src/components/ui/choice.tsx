import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Radio dot — 12px (16 in rows). Selected: white with a black center.
 * The ring is an inset shadow (not a border) and the center is flex-centered with
 * whole-pixel sizes (16→6, 12→4), so it always lands exactly in the middle.
 */
export function RadioDot({ on, large }: { on: boolean; large?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        large ? "size-4" : "size-3",
        on ? "bg-fg-white" : "shadow-[inset_0_0_0_1.5px_#DDDDDD]",
      )}
    >
      {on && <span className={cn("rounded-full bg-black", large ? "size-1.5" : "size-1")} />}
    </span>
  );
}

/**
 * Choice card — 76 tall, #1A1A1A, radius 8. Selected: black with a 2px white border.
 * Group several inside <ChoiceGroup>.
 */
export function ChoiceCard({
  label,
  sub,
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: ReactNode; sub?: ReactNode; selected: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex h-[76px] flex-col items-center justify-center gap-1 rounded-card border-2 transition-colors duration-[120ms]",
        selected ? "border-fg-white bg-black" : "border-transparent bg-ink-fill hover:bg-[#222222]",
        className,
      )}
      {...props}
    >
      <span className="flex items-center gap-1.5 font-ui text-[13px] font-bold text-fg-white">
        <RadioDot on={selected} />
        {label}
      </span>
      {sub && <span className="font-ui text-[11px] text-fg-muted">{sub}</span>}
    </button>
  );
}

/**
 * Radio row — a full-width option: small bold label + Figtree example on the left,
 * a 16px radio on the right. Selected: 2px white border on #0A0A0A.
 */
export function RadioRow({
  label,
  example,
  selected,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: ReactNode; example?: ReactNode; selected: boolean }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      className={cn(
        "flex w-full items-center justify-between rounded-card text-left transition-colors duration-[120ms]",
        // The design file had 36px of empty left padding here; text now aligns like every other card.
        // Selected has a 2px border, so it loses 1px of padding to keep the text from shifting.
        selected
          ? "border-2 border-fg-white bg-ink-raised py-2.5 pr-[15px] pl-[15px]"
          : "border border-ink-line bg-black py-[11px] pr-4 pl-4 hover:bg-ink-hover",
        className,
      )}
      {...props}
    >
      <span className="flex flex-col items-start gap-[3px]">
        <span className="font-ui text-[12px] font-bold text-fg-white">{label}</span>
        {example && <span className="read text-[17px] font-medium text-fg">{example}</span>}
      </span>
      <RadioDot on={selected} large />
    </button>
  );
}

export function ChoiceGroup({
  label,
  columns,
  children,
  className,
}: {
  label: string;
  columns?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(columns ? "grid gap-1.5" : "flex flex-col gap-1.5", className)}
      style={columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
    >
      {children}
    </div>
  );
}

/** Numbered step heading: a 16px white badge (radius 3) + caps label. */
export function StepHeading({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex size-4 items-center justify-center rounded-step bg-fg-white font-ui text-[11px] text-black">
        {n}
      </span>
      <span className="label-caps text-fg-secondary!">{children}</span>
    </div>
  );
}
