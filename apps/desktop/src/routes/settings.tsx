import { useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { createFileRoute, Link } from "@tanstack/react-router";
import { formatOffset, useUi } from "@/stores/ui";
import { useNow } from "@/lib/use-now";
import { Label } from "@/components/ui/bits";
import { Select } from "@/components/ui/field";
import { Toggle } from "@/components/ui/toggle";
import { ChevronRightIcon } from "@/components/ui/icons";
import { TagManager } from "@/components/app/tag-manager";
import { cn } from "@/lib/cn";

export const Route = createFileRoute("/settings")({ component: SettingsPage });

/** UTC−12:00 … UTC+14:00 in 30-minute steps. */
const OFFSETS = Array.from({ length: (14 + 12) * 2 + 1 }, (_, i) => -12 * 60 + i * 30);

/**
 * Settings — not drawn in the design. Each section is a row: what it is and what it
 * does on the left, its controls in a panel on the right (stacks below 1280px).
 * Every control saves itself; nothing to submit.
 */
function SettingsPage() {
  const { utcOffsetMinutes, showDone, showCancelled, calStartHour, set } = useUi();
  const now = useNow();
  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-20">
      <div className="mx-auto flex max-w-[680px] flex-col min-[1280px]:max-w-[960px]">
        <Label>Settings</Label>
        <h1 className="read mt-2 mb-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">Settings</h1>

        <Section
          id="time"
          title="Time zone"
          description="Moves “now”: the calendar's now line, which day is today, and when a task's time runs out. It never changes the times you gave your tasks."
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <label className="flex flex-col gap-2 font-ui text-[12px] text-fg-secondary">
              UTC offset
              <Select className="w-[200px]" value={utcOffsetMinutes} onChange={(e) => set({ utcOffsetMinutes: Number(e.target.value) })}>
                {OFFSETS.map((o) => (
                  <option key={o} value={o}>
                    {formatOffset(o)}
                  </option>
                ))}
              </Select>
            </label>
            {/* What the setting produces: the time it makes "now". */}
            <div className="flex flex-col items-end gap-1.5" aria-live="polite">
              <span className="font-ui text-[11px] text-fg-label">Now, with this zone</span>
              <span className="glyph text-[34px] leading-none tracking-[.04em] text-fg-white tabular-nums">{now.label}</span>
              <span className="font-ui text-[12px] text-fg-secondary uppercase">{now.dateLabel}</span>
            </div>
          </div>
        </Section>

        <Section id="calendar" title="Calendar" description="The week shows the whole day, 00:00 to 24:00, and scrolls. This is the hour at the top when you open it.">
          <label className="flex w-[200px] flex-col gap-2 font-ui text-[12px] text-fg-secondary">
            Opens at
            <Select className="w-[200px]" value={calStartHour} onChange={(e) => set({ calStartHour: Number(e.target.value) })}>
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {`${String(h).padStart(2, "0")}:00`}
                </option>
              ))}
            </Select>
          </label>
        </Section>

        <Section id="todo" title="Todo lists" description="Whether the Done and Cancelled lists start open when you open a day.">
          <div className="flex flex-col divide-y divide-ink-line">
            <Row label="Done list starts open" hint="Ticked tasks, in the order you did them." checked={showDone} onChange={(v) => set({ showDone: v })} />
            <Row label="Cancelled list starts open" hint="Tasks that won't happen; they still count as history." checked={showCancelled} onChange={(v) => set({ showCancelled: v })} />
          </div>
        </Section>

        <Section id="startup" title="Startup" description="Open the planner when you sign in to the computer. Off unless you turn it on.">
          <StartupRow />
        </Section>

        <Section
          id="tags"
          title="Tags"
          description="Rename a tag and every task with it follows. Give it a name another tag has and you can merge the two. Deleting a tag takes it off its tasks; the tasks stay."
        >
          <TagManager />
        </Section>

        <Section
          id="testing"
          title="For testing"
          description="Every component of the app on one page, clickable, for checking the design. It doesn't touch your tasks."
        >
          <Link
            to="/components"
            className="flex h-12 items-center justify-between rounded-card bg-ink-fill px-[14px] font-ui text-[13px] text-fg no-underline transition-colors duration-[120ms] hover:bg-ink-fill-hover"
          >
            Component sheet: every component, clickable
            <ChevronRightIcon size={10} className="text-fg-label" />
          </Link>
        </Section>
      </div>
    </main>
  );
}

/** One settings section: title + description beside a panel (stacked when narrow). */
function Section({ id, title, description, children }: { id: string; title: string; description: string; children: ReactNode }) {
  return (
    <section
      aria-labelledby={`set-${id}`}
      className="mt-8 grid gap-4 border-t border-ink-line-soft pt-8 min-[1280px]:grid-cols-[280px_minmax(0,1fr)] min-[1280px]:gap-10"
    >
      <div className="flex flex-col gap-2 pt-1">
        <h2 id={`set-${id}`} className="m-0 font-ui text-[14px] font-normal text-fg-white">
          {title}
        </h2>
        <p className="m-0 font-ui text-[12px] leading-[18px] text-fg-label">{description}</p>
      </div>
      <div className="rounded-tile bg-ink-raised p-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={cn("flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0", disabled ? "cursor-default" : "cursor-pointer")}>
      <span className="flex flex-col gap-1">
        <span className="font-ui text-[13px] text-fg">{label}</span>
        <span className="font-ui text-[12px] text-fg-label">{hint}</span>
      </span>
      <Toggle checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

/**
 * "Open when the computer starts". Windows keeps the on/off (its startup list), so the
 * switch reads it from there instead of from our settings. Off by default.
 * A dev build would register itself (an .exe that needs the dev server), so it's locked there.
 */
function StartupRow() {
  const available = isTauri();
  const dev = import.meta.env.DEV;
  const [on, setOn] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    isEnabled()
      .then(setOn)
      .catch(() => setOn(false));
  }, [available]);

  async function change(next: boolean) {
    setError(null);
    try {
      await (next ? enable() : disable());
      setOn(await isEnabled());
    } catch {
      setError("Windows didn't accept the change. Try again.");
    }
  }

  const hint = !available
    ? "Only in the desktop app."
    : dev
      ? "Only in the installed app: this dev build can't start on its own."
      : error ?? "Starts with Windows. You can also turn it off in Task Manager → Startup apps.";
  return <Row label="Open when the computer starts" hint={hint} checked={on ?? false} disabled={!available || dev || on === null} onChange={(v) => void change(v)} />;
}
