import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { create } from "zustand";
import { cn } from "@/lib/cn";
import { CloseIcon } from "./icons";
import { Button } from "./button";

/**
 * Toasts — bottom-right, #1A1A1A, 1px #2A2A2A, radius 8 (screens/00-components).
 *
 * They stack like a deck: the newest in front, up to two older ones peeking out
 * behind it (smaller, only their top edge showing). Hover the stack and it fans
 * out so every toast is readable; timers pause while you're over it.
 * Every toast has a ✕. Leaving: it slides up and fades, and the rest glide into place.
 *
 *   toast("Saved.")
 *   toast("Task deleted.", { action: { label: "Undo", onClick } })
 *   toast("Couldn't sync.", { sticky: true, action: { label: "Retry", onClick } })
 */
interface ToastData {
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
  /** Stays until closed. */
  sticky?: boolean;
  leaving?: boolean;
}

const MAX = 8; // kept in the stack; older ones leave
const VISIBLE_BEHIND = 2; // peeking behind the front one when collapsed
const PEEK = 10; // px each older toast shows above the one in front
const GAP = 8; // px between toasts when fanned out
const LEAVE_MS = 220;
const DEFAULT_H = 46;

const useToastStore = create<{ toasts: ToastData[] }>(() => ({ toasts: [] }));

/* ── Timers (pausable while the stack is hovered) ─────────────────── */

const timers = new Map<number, { handle?: number; remaining: number; start: number }>();
let paused = false;

function arm(id: number) {
  const t = timers.get(id);
  if (!t || paused) return;
  t.start = Date.now();
  t.handle = window.setTimeout(() => dismissToast(id), Math.max(t.remaining, 800));
}
function pauseTimers() {
  paused = true;
  timers.forEach((t) => {
    if (t.handle === undefined) return;
    window.clearTimeout(t.handle);
    t.handle = undefined;
    t.remaining -= Date.now() - t.start;
  });
}
function resumeTimers() {
  paused = false;
  timers.forEach((_, id) => arm(id));
}

/* ── Public API ───────────────────────────────────────────────────── */

let seq = 0;

export function toast(text: string, opts: { action?: ToastData["action"]; sticky?: boolean } = {}) {
  const id = ++seq;
  useToastStore.setState((s) => ({ toasts: [...s.toasts, { id, text, ...opts }] }));
  if (!opts.sticky) {
    timers.set(id, { remaining: opts.action ? 6000 : 4000, start: Date.now() });
    arm(id);
  }
  const live = useToastStore.getState().toasts.filter((t) => !t.leaving);
  if (live.length > MAX) dismissToast(live[0].id);
  return id;
}

/** Slide it up and out, then remove it once the animation is done. */
export function dismissToast(id: number) {
  const t = timers.get(id);
  if (t?.handle !== undefined) window.clearTimeout(t.handle);
  timers.delete(id);
  useToastStore.setState((s) => ({ toasts: s.toasts.map((x) => (x.id === id ? { ...x, leaving: true } : x)) }));
  window.setTimeout(() => useToastStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), LEAVE_MS);
}

/* ── Toaster ──────────────────────────────────────────────────────── */

export function Toaster() {
  const toasts = useToastStore((s) => s.toasts);
  const [expanded, setExpanded] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [entered, setEntered] = useState<Record<number, boolean>>({});
  const lastPos = useRef<Record<number, { y: number; scale: number }>>({});

  // New toasts start below and slide in on the next frame.
  useEffect(() => {
    const fresh = toasts.filter((t) => !entered[t.id]).map((t) => t.id);
    if (!fresh.length) return;
    const raf = requestAnimationFrame(() =>
      setEntered((e) => ({ ...e, ...Object.fromEntries(fresh.map((id) => [id, true])) })),
    );
    return () => cancelAnimationFrame(raf);
  }, [toasts, entered]);

  // Nothing left: fold back up and let timers run again.
  useEffect(() => {
    if (toasts.length === 0 && expanded) {
      setExpanded(false);
      resumeTimers();
    }
  }, [toasts.length, expanded]);

  const measure = (id: number, h: number) => setHeights((m) => (m[id] === h ? m : { ...m, [id]: h }));

  // Front = newest. Positions are worked out over the toasts that aren't leaving.
  const stack = [...toasts].reverse();
  const live = stack.filter((t) => !t.leaving);
  const frontH = heights[live[0]?.id] ?? DEFAULT_H;

  let acc = 0;
  const pos: Record<number, { y: number; scale: number; index: number }> = {};
  live.forEach((t, i) => {
    pos[t.id] = expanded ? { y: acc, scale: 1, index: i } : { y: Math.min(i, VISIBLE_BEHIND) * PEEK, scale: 1 - Math.min(i, VISIBLE_BEHIND) * 0.05, index: i };
    acc += (heights[t.id] ?? DEFAULT_H) + GAP;
  });
  const stackHeight = expanded ? Math.max(acc - GAP, 0) : frontH + Math.min(Math.max(live.length - 1, 0), VISIBLE_BEHIND) * PEEK;

  if (!toasts.length) return null;

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      onMouseEnter={() => {
        setExpanded(true);
        pauseTimers();
      }}
      onMouseLeave={() => {
        setExpanded(false);
        resumeTimers();
      }}
      className="fixed right-8 bottom-8 z-[80] w-[356px] max-w-[calc(100vw-64px)] transition-[height] duration-[260ms] ease-snap"
      style={{ height: stackHeight }}
    >
      {stack.map((t) => {
        const p = pos[t.id];
        const leaving = !!t.leaving || !p;
        if (p) lastPos.current[t.id] = { y: p.y, scale: p.scale };
        const last = lastPos.current[t.id] ?? { y: 0, scale: 1 };
        const index = p?.index ?? 0;
        const behind = !expanded && index > 0;
        const hidden = !expanded && index > VISIBLE_BEHIND;
        const y = leaving ? last.y + 12 : entered[t.id] ? p!.y : -40;
        const scale = leaving ? last.scale : (p?.scale ?? 1);
        const natural = heights[t.id] ?? DEFAULT_H;

        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              "absolute right-0 bottom-0 w-full origin-top overflow-hidden rounded-card border border-ink-line bg-ink-fill font-ui text-[13px] text-fg",
              "transition-[translate,scale,opacity,height] duration-[260ms] ease-snap",
              leaving && "pointer-events-none",
            )}
            style={{
              translate: `0 ${-y}px`,
              scale: String(scale),
              height: behind ? frontH : natural,
              opacity: leaving || hidden || !entered[t.id] ? 0 : 1,
              zIndex: 100 - index,
            }}
          >
            <ToastBody
              t={t}
              faded={behind}
              onHeight={(h) => measure(t.id, h)}
            />
          </div>
        );
      })}
    </section>
  );
}

/** The toast's content. Measured so the stack knows each toast's real height. */
function ToastBody({ t, faded, onHeight }: { t: ToastData; faded: boolean; onHeight: (h: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => onHeight(Math.ceil(el.getBoundingClientRect().height) + 2)); // + 2px border
    ro.observe(el);
    return () => ro.disconnect();
    // onHeight is recreated every render; the observer only needs the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className={cn("flex items-center gap-3 py-2.5 pr-2 pl-[14px] transition-opacity duration-200", faded && "opacity-0")}
      aria-hidden={faded || undefined}
    >
      <span className="min-w-0 flex-1 leading-[18px]">{t.text}</span>
      {t.action && (
        <Button
          size="sm"
          tabIndex={faded ? -1 : undefined}
          className="bg-ink-line enabled:hover:bg-ink-line-dash"
          onClick={() => {
            t.action!.onClick();
            dismissToast(t.id);
          }}
        >
          {t.action.label}
        </Button>
      )}
      <button
        type="button"
        aria-label="Close notification"
        tabIndex={faded ? -1 : undefined}
        onClick={() => dismissToast(t.id)}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded-btn text-fg-label transition-colors hover:bg-ink-line-faint hover:text-fg"
      >
        <CloseIcon size={10} />
      </button>
    </div>
  );
}
