/**
 * Dialogs for the flows the design references but doesn't draw
 * (new routine, edit task, routine entry…). Built only from the design's
 * components: fields, choice cards, radio rows, step headings, buttons.
 * They write to the MOCK store — no validation rules beyond "title required".
 */
import { useEffect, useState, type FormEvent } from "react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/cn";
import { isCustomTone, luminance, TONE_NAMES, toneHex, type Tone } from "@/lib/tones";
import { glyphOf, useMock } from "@/mock/store";
import type { MockEntry, MockRoutine, MockTask } from "@/mock/data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ChoiceCard, ChoiceGroup, RadioRow, StepHeading } from "@/components/ui/choice";
import { TrashIcon } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";

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
    toast("Routine created.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New routine" description="Every routine ends. You can start it empty and add entries after.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" error={error}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Exercise plan" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Purpose" help="Just text: the why.">
            {(a) => <Input {...a} placeholder="Get stronger and have more energy" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">{(a) => <Input {...a} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="Ends">{(a) => <Input {...a} type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
          </div>
          <Field label="Tone">{() => <TonePicker value={tone} onChange={setTone} />}</Field>
          <DialogActions>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create routine
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

/* ── Edit task (task form: title, notes, duration, start, due, protocol) ── */

export function EditTaskDialog({ task, ...p }: OpenProps & { task: MockTask }) {
  const update = useMock((s) => s.updateTask);
  const del = useMock((s) => s.deleteTask);
  const protocols = useMock((s) => s.protocols);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [duration, setDuration] = useState(task.duration ?? "");
  const [protocolId, setProtocolId] = useState(task.protocolId ?? "");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (p.open) {
      setTitle(task.title);
      setNotes(task.notes ?? "");
      setDuration(task.duration ?? "");
      setProtocolId(task.protocolId ?? "");
      setError(undefined);
    }
  }, [p.open, task]);

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title="Edit task" width={480}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return setError("A title is required.");
            update(task.id, {
              title: title.trim(),
              glyph: glyphOf(title),
              notes: notes.trim() || undefined,
              duration: duration.trim() || undefined,
              protocolId: protocolId || undefined,
            });
            p.onOpenChange(false);
            toast("Saved.");
          }}
        >
          <Field label="Title" error={error}>
            {(a) => <Input {...a} kind="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Notes">{(a) => <Textarea {...a} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">{(a) => <Input {...a} type="datetime-local" defaultValue="2026-11-10T18:00" />}</Field>
            <Field label="Due">{(a) => <Input {...a} type="datetime-local" />}</Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Duration" help="e.g. 20m, 1h">
              {(a) => <Input {...a} placeholder="—" value={duration} onChange={(e) => setDuration(e.target.value)} />}
            </Field>
            <Field label="Protocol">
              {(a) => (
                <Select {...a} value={protocolId} onChange={(e) => setProtocolId(e.target.value)}>
                  <option value="">None</option>
                  {protocols.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <DialogActions className="justify-between">
            <Button
              variant="danger"
              onClick={() => {
                del(task.id);
                p.onOpenChange(false);
                toast("Task deleted.");
              }}
            >
              <TrashIcon />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save
              </Button>
            </div>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Move task ────────────────────────────────────────────────────── */

export function MoveTaskDialog({ task, ...p }: OpenProps & { task: MockTask }) {
  const update = useMock((s) => s.updateTask);
  const [date, setDate] = useState("2026-11-10");
  const [time, setTime] = useState("");
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title={`Move “${task.title}”`} description="Pick a new day, and a time if it has one." width={420}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const day = format(parseISO(date), "EEE d MMM");
            update(task.id, { meta: time ? `${day} · ${time}` : day, section: time ? "scheduled" : "day" });
            p.onOpenChange(false);
            toast(`Moved to ${day}${time ? ` ${time}` : ""}.`);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day">{(a) => <Input {...a} type="date" required value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
            <Field label="Time (optional)">{(a) => <Input {...a} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
          </div>
          <DialogActions>
            <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Move
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
  const protocols = useMock((s) => s.protocols);
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
    saveEntry(routine.id, { id: entry?.id, title: title.trim(), glyph: glyphOf(title), rule });
    p.onOpenChange(false);
    toast(entry ? "Entry saved. Changes apply from today on." : "Entry added.");
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title={entry ? "Edit entry" : "Add entry"} description={`In ${routine.name}`} width={500}>
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
            <Field label="Protocol">
              {(a) => (
                <Select {...a} value={protocol} onChange={(e) => setProtocol(e.target.value)}>
                  <option value="">None</option>
                  {protocols.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.title}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>

          <DialogActions>
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

export function EndDateDialog({ routine, ...p }: OpenProps & { routine: MockRoutine }) {
  const update = useMock((s) => s.updateRoutine);
  const [end, setEnd] = useState("2026-11-30");
  const startLabel = routine.period.split("→")[0]?.trim() ?? "";
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title="Change end date"
        description="It can't move earlier than the last done task. Ending isn't cancelling: what's done stays done."
        width={420}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update(routine.id, { period: `${startLabel} → ${fmtDay(end)}` });
            p.onOpenChange(false);
            toast(`Ends ${fmtDay(end)}.`);
          }}
        >
          <Field label="Ends">{(a) => <Input {...a} type="date" required value={end} onChange={(e) => setEnd(e.target.value)} />}</Field>
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

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onConfirm,
  ...p
}: OpenProps & { title: string; body: string; confirmLabel: string; onConfirm: () => void }) {
  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title={title} width={420}>
        <p className="read m-0 text-[15px] leading-[21px] text-fg-secondary">{body}</p>
        <DialogActions>
          <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              p.onOpenChange(false);
            }}
          >
            <TrashIcon />
            {confirmLabel}
          </Button>
        </DialogActions>
      </DialogContent>
    </Dialog>
  );
}
