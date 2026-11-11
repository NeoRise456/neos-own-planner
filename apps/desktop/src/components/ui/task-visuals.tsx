import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { toneHex, type Tone } from "@/lib/tones";
import { CheckIcon, DotsIcon } from "./icons";

/** The four visual states a task can show (worked out elsewhere, later in core). */
export type VisualState = "todo" | "done" | "missed" | "cancelled";

/**
 * Check — 20px circle. DESIGN.md §3 "Check (task)":
 * todo: 1.5px #6B6B6B ring (white on hover) · done: filled tone + black tick ·
 * missed: #3A3A3A ring on #1A1A1A · cancelled: dashed #3A3A3A.
 */
export const Check = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { state: VisualState; tone: Tone; label: string }
>(({ state, tone, label, className, style, ...props }, ref) => {
  const t = toneHex(tone);
  const s: CSSProperties =
    state === "done"
      ? { background: t, border: `1.5px solid ${t}` }
      : state === "missed"
        ? { border: "1.5px solid #3A3A3A", background: "#1A1A1A" }
        : state === "cancelled"
          ? { border: "1.5px dashed #3A3A3A" }
          : { border: "1.5px solid #6B6B6B" };
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center rounded-full transition-[background-color,border-color] duration-200",
        state !== "done" && "hover:border-fg!",
        className,
      )}
      style={{ ...s, ...style }}
      {...props}
    >
      {state === "done" && <CheckIcon className="text-black" />}
    </button>
  );
});
Check.displayName = "Check";

/** Glyph — the two-letter dot-matrix mark (Doto 900, square dots). Decorative. */
export function Glyph({
  children,
  color,
  size = 18,
  className,
  style,
}: {
  children: ReactNode;
  color: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span aria-hidden className={cn("glyph shrink-0", className)} style={{ fontSize: size, lineHeight: `${size}px`, color, ...style }}>
      {children}
    </span>
  );
}

/** Glyph tile — a square with the glyph (outline, or filled with the tone). Panels, headers, entries. */
export function GlyphTile({
  glyph,
  tone,
  filled,
  dim,
  size = 64,
  glyphSize = 30,
  radius = 12,
}: {
  glyph: string;
  tone: Tone;
  filled?: boolean;
  dim?: boolean;
  size?: number;
  glyphSize?: number;
  radius?: number;
}) {
  const t = toneHex(tone);
  return (
    <span
      aria-hidden
      className="box-border flex shrink-0 items-center justify-center transition-colors duration-[350ms] ease-snap"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: filled ? t : undefined,
        border: filled ? undefined : "1px solid #2A2A2A",
      }}
    >
      <Glyph size={glyphSize} color={filled ? "#111111" : dim ? "#3A3A3A" : t}>
        {glyph}
      </Glyph>
    </span>
  );
}

/**
 * Tile — 136×188, radius 12 (DESIGN.md §3 "Tile", screens/02-tiles):
 * group label · "…" menu · glyph 46 · title (Figtree 800 19, bottom) · hairline · footer.
 * Outline = not done · filled with tone = done · missed: grey glyph + MISSED chip ·
 * cancelled: dashed border, struck title · `stack` copies to do = stacked edges.
 */
export function TaskTile({
  group,
  glyph,
  title,
  meta,
  count,
  tone,
  state = "todo",
  stack = 0,
  menu,
  onOpen,
}: {
  group: string;
  glyph: string;
  title: string;
  meta?: string;
  count?: string;
  tone: Tone;
  state?: VisualState;
  stack?: number;
  /** The "…" button, e.g. a <TileMenu>. */
  menu?: ReactNode;
  onOpen?: () => void;
}) {
  const t = toneHex(tone);
  const done = state === "done";
  const missed = state === "missed";
  const cx = state === "cancelled";
  const fg = done ? "#0D0D0D" : missed ? "#9A9A9A" : cx ? "#9A9A9A" : "#FFFFFF";
  const sub = done ? "rgba(0,0,0,0.55)" : missed ? "#9A9A9A" : cx ? "#9A9A9A" : "#BDBDBD";
  const rule = done ? "rgba(0,0,0,0.14)" : cx ? "#3A3A3A" : "#2A2A2A";
  const glyphCol = done ? "#111111" : missed ? "#3A3A3A" : cx ? "#262626" : t;
  const edges = Math.min(stack, 2);

  return (
    <div className="relative shrink-0" style={{ paddingTop: edges * 3, paddingRight: edges * 3 }}>
      {Array.from({ length: edges }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute h-[188px] w-[136px] rounded-tile border border-ink-line bg-black"
          style={{ left: (edges - i) * 3, top: i * 3 }}
        />
      ))}
      <div
        className="relative box-border flex h-[188px] w-[136px] flex-col rounded-tile px-[14px] py-3 transition-colors duration-[350ms] ease-snap"
        style={
          done
            ? { background: t }
            : { background: "#000", border: `1px ${cx ? "dashed #3A3A3A" : "solid #2A2A2A"}` }
        }
      >
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Open ${title}`}
            className="absolute inset-0 rounded-tile focus-visible:outline-offset-2"
          />
        )}
        <div className="relative flex items-center justify-between gap-1.5">
          <span className="truncate font-ui text-[11px] tracking-[.04em] uppercase" style={{ color: sub }}>
            {group}
          </span>
          {done && !menu ? (
            <span className="inline-flex h-[18px] items-center rounded-chip bg-black/40 px-1.5 font-ui text-[11px] text-white">DONE</span>
          ) : missed ? (
            <span className="inline-flex h-[18px] items-center rounded-chip bg-ink-fill px-1.5 font-ui text-[11px] text-fg-label">MISSED</span>
          ) : (
            menu
          )}
        </div>
        <Glyph size={46} color={glyphCol} className="relative mt-0.5 tracking-[-.02em]" style={{ lineHeight: "44px" }}>
          {glyph}
        </Glyph>
        <span
          className={cn("read relative mt-auto line-clamp-2 text-[19px] leading-[21px] font-extrabold", cx && "line-through")}
          style={{ color: fg }}
        >
          {title}
        </span>
        <div
          className="relative mt-3 flex justify-between gap-1.5 pt-2 font-ui text-[11px] whitespace-nowrap uppercase"
          style={{ color: sub, borderTop: `1px ${cx ? "dashed" : "solid"} ${rule}` }}
        >
          <span className="truncate">{meta}</span>
          <span>{count}</span>
        </div>
      </div>
    </div>
  );
}

/** The round "…" trigger on a tile (22px). Outline on black, translucent on a filled tile. */
export const TileDots = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; onTone?: boolean }>(
  ({ label, onTone, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={cn(
        "relative z-10 box-border inline-flex size-[22px] shrink-0 items-center justify-center rounded-full",
        onTone ? "bg-black/40 text-white" : "border border-[#333333] text-fg hover:bg-ink-fill",
        className,
      )}
      {...props}
    >
      <DotsIcon />
    </button>
  ),
);
TileDots.displayName = "TileDots";
