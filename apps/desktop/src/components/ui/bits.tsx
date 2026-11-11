import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { UploadIcon } from "./icons";

/** Section label — UI 11/14, caps, +8% tracking, #9A9A9A. */
export function Label({ children, className, as: As = "span" }: { children: ReactNode; className?: string; as?: "span" | "h2" | "h3" }) {
  return <As className={cn("label-caps m-0 font-normal", className)}>{children}</As>;
}

/** Section header: label on the left, a faint note on the right, hairline under. */
export function SectionHeader({
  label,
  note,
  className,
  labelClassName,
}: {
  label: ReactNode;
  note?: ReactNode;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("mb-1 flex items-center justify-between border-b border-ink-line-faint pb-1.5", className)}>
      <Label as="h2" className={labelClassName}>
        {label}
      </Label>
      {note != null && <span className="font-ui text-[11px] text-fg-label">{note}</span>}
    </div>
  );
}

/** Chip — 18 or 22 tall, radius 4, #1A1A1A, caps meta. */
export function Chip({
  children,
  size = "sm",
  className,
  style,
}: {
  children: ReactNode;
  size?: "sm" | "md";
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      style={style}
      className={cn(
        "inline-flex shrink-0 items-center rounded-chip bg-ink-fill font-ui text-fg-secondary uppercase",
        size === "sm" ? "h-[18px] px-1.5 text-[11px]" : "h-[22px] px-2 text-[11px]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Progress — 6px (or 3px) rounded bar on #1F1F1F, white fill sliding with the snap ease. */
export function Progress({
  value,
  label,
  thin,
  color = "#FFFFFF",
  className,
}: {
  value: number;
  label: string;
  thin?: boolean;
  color?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cn("overflow-hidden bg-ink-line-mid", thin ? "h-[3px] rounded-[2px]" : "h-1.5 rounded-[3px]", className)}
    >
      <div
        className="h-full rounded-[inherit] transition-[width] duration-[350ms] ease-snap"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

/** Dot loader — a grid of 3px squares blinking out of step. */
export function Loader({ cols = 4, rows = 4, label = "Loading" }: { cols?: number; rows?: number; label?: string }) {
  return (
    <span role="status" aria-label={label} className="grid gap-px" style={{ gridTemplateColumns: `repeat(${cols}, 3px)` }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <span
          key={i}
          className="size-[3px] bg-[#5A5A5A] animate-[blink_1.2s_steps(1)_infinite]"
          style={{ animationDelay: `${((i * 7) % 12) / 10}s` }}
        />
      ))}
    </span>
  );
}

/** Drop zone — dashed #3A3A3A, radius 10. Click to pick or drop files on it. */
export function DropZone({
  title = "Drop a file",
  hint,
  accept,
  onFiles,
}: {
  title?: ReactNode;
  hint?: ReactNode;
  accept?: string;
  onFiles: (files: File[]) => void;
}) {
  const [over, setOver] = useState(false);
  const stop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  return (
    <label
      onDragEnter={(e) => {
        stop(e);
        setOver(true);
      }}
      onDragOver={stop}
      onDragLeave={(e) => {
        stop(e);
        setOver(false);
      }}
      onDrop={(e) => {
        stop(e);
        setOver(false);
        onFiles(Array.from(e.dataTransfer.files));
      }}
      className={cn(
        "flex h-[110px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-drop border border-dashed transition-colors duration-[120ms]",
        over ? "border-fg-white bg-ink-raised" : "border-ink-line-dash hover:bg-ink-raised",
      )}
    >
      <UploadIcon className="text-fg" />
      <span className="font-ui text-[13px] font-bold">{title}</span>
      {hint && <span className="font-ui text-[11px] text-fg-label">{hint}</span>}
      <input type="file" className="sr-only" accept={accept} onChange={(e) => onFiles(Array.from(e.target.files ?? []))} />
    </label>
  );
}

/**
 * Empty state — a dim dot-matrix glyph, a heading that says what's empty,
 * one line of help, and the actions. No dashed box: the design's dashed
 * empty state read like a drop zone, so dashes stay reserved for real drop zones.
 */
export function EmptyState({
  glyph,
  title,
  body,
  actions,
  className,
}: {
  glyph?: string;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      {glyph && (
        <span
          aria-hidden
          className="glyph mb-5 flex size-16 items-center justify-center rounded-tile border border-ink-line text-[30px] text-ink-line-dash"
        >
          {glyph}
        </span>
      )}
      <h2 className="read m-0 text-[23px] leading-[26px] font-extrabold tracking-[-.01em] text-fg-white">{title}</h2>
      {body && <p className="mt-2 mb-0 max-w-[340px] font-ui text-[12px] leading-[18px] text-fg-label">{body}</p>}
      {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

/** Dot-matrix "P" logo — 5×7 grid of 4px squares. */
const LOGO = ["11110", "10001", "10001", "11110", "10000", "10000", "10000"];
export function DotLogo({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("grid grid-cols-[repeat(5,4px)] gap-px", className)}>
      {LOGO.join("")
        .split("")
        .map((b, i) => (
          <span key={i} className="size-1" style={{ background: b === "1" ? "#F5F5F5" : "transparent" }} />
        ))}
    </span>
  );
}

/** Mini square — 8px (radius 2). Count copies and entry history cells. */
export function MiniSquare({ color, outline, size = 8 }: { color?: string; outline?: boolean; size?: number }) {
  return (
    <span
      aria-hidden
      className="box-border shrink-0 rounded-[2px]"
      style={{
        width: size,
        height: size,
        background: outline ? undefined : color,
        border: outline ? "1px solid #3A3A3A" : undefined,
      }}
    />
  );
}
