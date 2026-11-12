import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "@/lib/cn";
import { luminance } from "@/lib/tones";
import { Button } from "./button";
import { inputBase } from "./field";

/**
 * Color picker — DESIGN.md "Color picker". Never the browser's `<input type="color">`
 * (on Windows it opens the system's light, bevelled dialog). A saturation × brightness
 * square, a hue bar and a hex field, on the app's popover card. Nothing is applied while
 * you drag: "Use color" (or Enter in the hex field) hands back one "#RRGGBB".
 */
export function ColorPicker({ value, onPick, onCancel }: { value: string; onPick: (hex: string) => void; onCancel: () => void }) {
  const [hsv, setHsv] = useState(() => hexToHsv(value) ?? { h: 255, s: 0.3, v: 0.94 });
  const hex = hsvToHex(hsv);
  const [text, setText] = useState(hex);
  const typing = useRef(false);

  // Keep the hex field in step with the square and the bar (not while typing in it).
  useEffect(() => {
    if (!typing.current) setText(hex);
  }, [hex]);

  const typed = normalizeHex(text);
  const tooDark = luminance(hex) < 0.3;

  return (
    <div className="flex w-[232px] flex-col gap-3 p-1">
      <Area
        hue={hsv.h}
        s={hsv.s}
        v={hsv.v}
        onChange={(s, v) => {
          typing.current = false;
          setHsv((c) => ({ ...c, s, v }));
        }}
      />
      <HueBar
        hue={hsv.h}
        onChange={(h) => {
          typing.current = false;
          setHsv((c) => ({ ...c, h }));
        }}
      />
      <div className="flex items-center gap-2">
        <span aria-hidden className="size-9 shrink-0 rounded-btn border border-ink-line" style={{ background: hex }} />
        <input
          aria-label="Hex color"
          spellCheck={false}
          value={text}
          onChange={(e) => {
            typing.current = true;
            setText(e.target.value);
            const h = normalizeHex(e.target.value);
            const next = h && hexToHsv(h);
            if (next) setHsv(next);
          }}
          onBlur={() => {
            typing.current = false;
            setText(hex);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (typed) onPick(typed);
            }
          }}
          aria-invalid={!typed || undefined}
          className={cn(inputBase, "h-9 min-w-0 flex-1 font-ui text-[13px] uppercase tabular-nums")}
        />
      </div>
      {tooDark && <span className="font-ui text-[11px] leading-[15px] text-error">Quite dark: done tiles put dark text on it, so it may be hard to read.</span>}
      <div className="flex justify-end gap-2 border-t border-ink-line-soft pt-2.5">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={() => onPick(hex)}>
          Use color
        </Button>
      </div>
    </div>
  );
}

/** Drag (or arrow keys) across a box; reports 0…1 on each axis. */
function useDrag(onMove: (x: number, y: number) => void) {
  const ref = useRef<HTMLDivElement>(null);
  const at = (e: PointerEvent<HTMLDivElement>) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height));
  };
  return {
    ref,
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.focus();
      at(e);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e);
    },
  };
}

function Area({ hue, s, v, onChange }: { hue: number; s: number; v: number; onChange: (s: number, v: number) => void }) {
  const drag = useDrag((x, y) => onChange(x, 1 - y));
  const step = (e: KeyboardEvent) => {
    const d = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange(clamp(s + m[0]), clamp(v + m[1]));
  };
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuetext={`Saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`}
      onKeyDown={step}
      className="relative h-[136px] w-full cursor-crosshair touch-none rounded-btn border border-ink-line outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-white"
      style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fg-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
        style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
      />
    </div>
  );
}

function HueBar({ hue, onChange }: { hue: number; onChange: (h: number) => void }) {
  const drag = useDrag((x) => onChange(Math.round(x * 359)));
  return (
    <div
      {...drag}
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={hue}
      onKeyDown={(e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        onChange((hue + d * (e.shiftKey ? 15 : 3) + 360) % 360);
      }}
      className="relative h-3 w-full cursor-pointer touch-none rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-white"
      style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-fg-white shadow-[0_0_0_1px_rgba(0,0,0,.6)]"
        style={{ left: `${(hue / 359) * 100}%`, background: `hsl(${hue} 100% 50%)` }}
      />
    </div>
  );
}

// ── Color math (display only) ──────────────────────────────────────────

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/** "b9a6f0", "#B9A6F0", "#abc" → "#B9A6F0"; anything else → null. */
export function normalizeHex(text: string): string | null {
  let t = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) t = t.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/i.test(t) ? `#${t.toUpperCase()}` : null;
}

function hexToHsv(hex: string): { h: number; s: number; v: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  const int = parseInt(n.slice(1), 16);
  const [r, g, b] = [(int >> 16) / 255, ((int >> 8) & 255) / 255, (int & 255) / 255];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: Math.round((h * 60 + 360) % 360), s: max ? d / max : 0, v: max };
}

function hsvToHex({ h, s, v }: { h: number; s: number; v: number }): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return `#${[f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
