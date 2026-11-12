/**
 * Dialogs for the flows the design references but doesn't draw (new routine,
 * routine entry…). Built only from the design's components: fields, choice cards,
 * radio rows, step headings, buttons. They write to the MOCK store (routines and
 * protocols until phase 5). The task dialogs are on real data: task-dialogs.tsx.
 */
import { useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/cn";
import { isCustomTone, luminance, TONE_NAMES, toneHex, type Tone } from "@/lib/tones";
import { glyphOf } from "@/lib/glyph";
import { useMock } from "@/mock/store";
import type { MockEntry, MockRoutine } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-picker";
import { ChoiceCard, ChoiceGroup, RadioRow, StepHeading } from "@/components/ui/choice";
import { TrashIcon } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { ProtocolPicker } from "./protocol-picker";

type OpenProps = { open: boolean; onOpenChange: (o: boolean) => void };

const fmtDay = (iso: string) => format(parseISO(iso), "MMM d");

/* ── Tone picker: preset swatches + a custom color ────────────────── */

const swatchBox = "size-7 rounded-btn border-2 transition-colors";

export function TonePicker({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  const custom = isCustomTone(value);
  // Remember the last custom color so switching to a preset and back keeps it.
  const [lastCustom, setLastCustom] = useState<string | null>(custom ? value : null);
  const tooDark = custom && luminance(value) < 0.3;

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Tone" className="flex flex-wrap gap-1.5">
        {TONE_NAMES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={value === t}
            aria-label={t}
            title={t}
            onClick={() => onChange(t)}
            className={cn(swatchBox, value === t ? "border-fg-white" : "border-transparent hover:border-ink-line-dash")}
          >
            <span className="m-auto block size-4 rounded-chip" style={{ background: toneHex(t) }} />
          </button>
        ))}

        {/* Custom: a native color input hidden inside the swatch. */}
        <label
          title={lastCustom ? `Custom ${lastCustom} — click to change` : "Pick any color"}
          className={cn(
            swatchBox,
            "relative flex cursor-pointer items-center justify-center focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-fg-white",
            custom ? "border-fg-white" : "border-transparent hover:border-ink-line-dash",
          )}
        >
          <input
            type="color"
            aria-label="Custom color"
            value={lastCustom ?? "#b9a6f0"}
            onChange={(e) => {
              setLastCustom(e.target.value);
              onChange(e.target.value as Tone);
            }}
            className="sr-only"
          />
          {lastCustom ? (
            <span className="block size-4 rounded-chip" style={{ background: lastCustom }} />
          ) : (
            <span
              aria-hidden
              className="flex size-4 items-center justify-center rounded-chip text-[11px] leading-none font-bold text-black"
              style={{ background: "conic-gradient(#F09C9C, #EDE08C, #96DCC0, #8EC8F8, #D8A4E8, #F09C9C)" }}
            >
              +
            </span>
          )}
        </label>
        {lastCustom && !custom && (
          <button
            type="button"
            onClick={() => onChange(lastCustom as Tone)}
            className="h-7 rounded-btn px-2 font-ui text-[11px] text-fg-label hover:bg-ink-line-faint hover:text-fg"
          >
            Use custom
          </button>
        )}
      </div>
      {custom && (
        <span className={cn("font-ui text-[11px]", tooDark ? "text-error" : "text-fg-label")}>
          {tooDark
            ? `${value.toUpperCase()} is quite dark. Done tiles put dark text on it, so it may be hard to read.`
            : `Custom ${value.toUpperCase()}`}
        </span>
      )}
    </div>
  );
}

/* ── New routine ──────────────────────────────────────────────────── */

export function NewRoutineDialog({ open, onOpenChange, onCreated }: OpenProps & { onCreated: (id: string) => void }) {
  const addRoutine = useMock((s) => s.addRoutine);
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [start, setStart] = useState("2026-11-10");
  const [end, setEnd] = useState("2027-01-31");
  const [tone, setTone] = useState<Tone>("lilac");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setName("");
      setPurpose("");
      setError(undefined);
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setError("A title is required.");
    const id = addRoutine({ name: name.trim(), purpose: purpose.trim(), period: `${fmtDay(start)} → ${fmtDay(end)}`, tone });
    onOpenChange(false);
    onCreated(id);
    toast("Draft created. Add entries, then publish it.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New routine"
        description="It starts as a draft: nothing shows in Todo or Calendar until you publish it. Every routine ends."
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" error={error}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Exercise plan" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Purpose" help="Just text: the why.">
            {(a) => <Input {...a} placeholder="Get stronger and have more energy" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">{(a) => <DateField {...a} value={start} onChange={setStart} placeholder="Pick a day" />}</Field>
            <Field label="Ends">{(a) => <DateField {...a} required value={end} onChange={setEnd} min={start || undefined} placeholder="Pick a day" />}</Field>
          </div>
          <Field label="Tone">{() => <TonePicker value={tone} onChange={setTone} />}</Field>
          <DialogActions>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create draft
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── New protocol ─────────────────────────────────────────────────── */

export function NewProtocolDialog({ open, onOpenChange, onCreated }: OpenProps & { onCreated: (id: string) => void }) {
  const addProtocol = useMock((s) => s.addProtocol);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (open) {
      setTitle("");
      setError(undefined);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New protocol" description="A list of steps to remember. Add the steps on the next screen." width={420}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return setError("A title is required.");
            const id = addProtocol(title.trim());
            onOpenChange(false);
            onCreated(id);
          }}
          className="flex flex-col gap-4"
        >
          <Field label="Title" error={error}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Shower" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <DialogActions>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create protocol
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Routine entry (what + when) ──────────────────────────────────── */

const FREQS = [
  { v: "daily", label: "Daily", sub: "Every day" },
  { v: "weekly", label: "Weekly", sub: "On some days" },
  { v: "monthly", label: "Monthly", sub: "1st, last Fri…" },
  { v: "yearly", label: "Yearly", sub: "14 March" },
] as const;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function EntryDialog({
  routine,
  entry,
  ...p
}: OpenProps & { routine: MockRoutine; entry?: MockEntry }) {
  const saveEntry = useMock((s) => s.saveEntry);
  const removeEntry = useMock((s) => s.removeEntry);
  const protocols = useMock((s) => s.protocols);
  const draft = !!routine.draft;
  const [title, setTitle] = useState("");
  const [freq, setFreq] = useState<(typeof FREQS)[number]["v"]>("weekly");
  const [days, setDays] = useState<string[]>(["Mon", "Wed", "Fri"]);
  const [gets, setGets] = useState<"times" | "count">("times");
  const [times, setTimes] = useState("18:00");
  const [count, setCount] = useState("4");
  const [duration, setDuration] = useState("");
  const [protocol, setProtocol] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (p.open) {
      setTitle(entry?.title ?? "");
      setProtocol(entry?.protocolId ?? "");
      setError(undefined);
    }
  }, [p.open, entry]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("A title is required.");
    // Display label only — the real rule lives in @planner/core later.
    const when =
      freq === "daily" ? "Daily" : freq === "weekly" ? days.join(", ") || "Weekly" : freq === "monthly" ? "Monthly" : "Yearly";
    const each = gets === "times" ? times : `${count} times`;
    const proto = protocols.find((x) => x.id === protocol)?.title;
    const rule = [when, each, duration, proto].filter(Boolean).join(" · ");
    saveEntry(routine.id, { id: entry?.id, title: title.trim(), glyph: glyphOf(title), rule, protocolId: protocol || undefined });
    p.onOpenChange(false);
    toast(entry && !draft ? "Entry saved. Changes apply from today on." : entry ? "Entry saved." : "Entry added.");
  }

  function remove() {
    if (!entry) return;
    removeEntry(routine.id, entry.id);
    p.onOpenChange(false);
    toast(draft ? "Entry removed." : "Entry removed. Its tasks stop from today on; the past stays.");
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={entry ? "Edit entry" : "Add entry"}
        description={
          draft
            ? `In ${routine.name} (draft). Change anything — there's no history yet.`
            : entry
              ? `In ${routine.name}. Changes apply from today on; past tasks keep what they were.`
              : `In ${routine.name}. It starts producing tasks from today.`
        }
        width={500}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="What" error={error}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Gym" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <StepHeading n={1}>How often</StepHeading>
          <ChoiceGroup label="How often" columns={4}>
            {FREQS.map((f) => (
              <ChoiceCard key={f.v} label={f.label} sub={f.sub} selected={freq === f.v} onClick={() => setFreq(f.v)} />
            ))}
          </ChoiceGroup>
          {freq === "weekly" && (
            <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
              {WEEKDAYS.map((d) => {
                const on = days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays((xs) => (on ? xs.filter((x) => x !== d) : WEEKDAYS.filter((w) => xs.includes(w) || w === d)))}
                    className={cn(
                      "h-7 min-w-11 rounded-btn px-2 font-ui text-[12px] transition-colors",
                      on ? "bg-fg-white font-semibold text-black" : "bg-ink-fill text-fg hover:bg-ink-fill-hover",
                    )}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          <StepHeading n={2}>Each day gets</StepHeading>
          <ChoiceGroup label="Each day gets">
            <RadioRow label="Fixed times" example="18:00, or 08:00 / 14:00 / 20:00" selected={gets === "times"} onClick={() => setGets("times")} />
            <RadioRow label="A count" example="Water 4 times a day" selected={gets === "count"} onClick={() => setGets("count")} />
          </ChoiceGroup>
          {gets === "times" ? (
            <Field label="Times" help="One or more, separated by /">
              {(a) => <Input {...a} value={times} onChange={(e) => setTimes(e.target.value)} />}
            </Field>
          ) : (
            <Field label="How many times a day">
              {(a) => <Input {...a} type="number" min={1} value={count} onChange={(e) => setCount(e.target.value)} />}
            </Field>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration">{(a) => <Input {...a} placeholder="1h" value={duration} onChange={(e) => setDuration(e.target.value)} />}</Field>
          </div>
          <Field label="Protocol">{() => <ProtocolPicker value={protocol} onChange={setProtocol} />}</Field>

          <DialogActions>
            {entry && (
              <Button variant="danger" className="mr-auto" onClick={remove}>
                <TrashIcon />
                Remove entry
              </Button>
            )}
            <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {entry ? "Save entry" : "Add entry"}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Edit routine / change end date ───────────────────────────────── */

export function EditRoutineDialog({ routine, ...p }: OpenProps & { routine: MockRoutine }) {
  const update = useMock((s) => s.updateRoutine);
  const [name, setName] = useState(routine.name);
  const [purpose, setPurpose] = useState(routine.purpose);
  const [tone, setTone] = useState<Tone>(routine.tone);
  useEffect(() => {
    if (p.open) {
      setName(routine.name);
      setPurpose(routine.purpose);
      setTone(routine.tone);
    }
  }, [p.open, routine]);
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title="Edit routine">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            update(routine.id, { name: name.trim(), purpose: purpose.trim(), tone, glyph: glyphOf(name) });
            p.onOpenChange(false);
            toast("Saved.");
          }}
        >
          <Field label="Title">{(a) => <Input {...a} kind="title" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
          <Field label="Purpose">{(a) => <Input {...a} value={purpose} onChange={(e) => setPurpose(e.target.value)} />}</Field>
          <Field label="Tone">{() => <TonePicker value={tone} onChange={setTone} />}</Field>
          <DialogActions>
            <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Published: only the end date (the start is locked). Draft: both dates are free. */
export function EndDateDialog({ routine, ...p }: OpenProps & { routine: MockRoutine }) {
  const update = useMock((s) => s.updateRoutine);
  const draft = !!routine.draft;
  const [start, setStart] = useState("2026-12-01");
  const [end, setEnd] = useState("2026-11-30");
  const startLabel = routine.period.split("→")[0]?.trim() ?? "";
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={draft ? "Change dates" : "Change end date"}
        description={
          draft
            ? "It's a draft, so both dates are free. Once published, the start is locked."
            : "It can't move earlier than the last done task. Ending isn't cancelling: what's done stays done."
        }
        width={420}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update(routine.id, { period: `${draft ? fmtDay(start) : startLabel} → ${fmtDay(end)}` });
            p.onOpenChange(false);
            toast(draft ? `${fmtDay(start)} → ${fmtDay(end)}.` : `Ends ${fmtDay(end)}.`);
          }}
        >
          {draft ? (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts">{(a) => <DateField {...a} required value={start} onChange={setStart} placeholder="Pick a day" />}</Field>
              <Field label="Ends">{(a) => <DateField {...a} required value={end} onChange={setEnd} min={start || undefined} placeholder="Pick a day" />}</Field>
            </div>
          ) : (
            <Field label="Ends">{(a) => <DateField {...a} required value={end} onChange={setEnd} min={start || undefined} placeholder="Pick a day" />}</Field>
          )}
          <DialogActions>
            <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Change
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Confirm (destructive) ────────────────────────────────────────── */

/** A yes/no question. `danger` (default) for deleting; `primary` for big but safe steps (publish, end). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Keep it",
  variant = "danger",
  onConfirm,
  ...p
}: OpenProps & {
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => void;
}) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title={title} width={420}>
        <p className="read m-0 text-[15px] leading-[21px] text-fg-secondary">{body}</p>
        <DialogActions>
          <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={() => {
              onConfirm();
              p.onOpenChange(false);
            }}
          >
            {variant === "danger" && <TrashIcon />}
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
