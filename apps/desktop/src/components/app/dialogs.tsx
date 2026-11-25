/**
 * Dialogs for routines, entries and protocols (the flows the design references but
 * doesn't draw), built only from the design's components: fields, choice cards, radio
 * rows, step headings, buttons. Every check is @planner/core's; every write goes
 * through @planner/data. The task dialogs are in task-dialogs.tsx.
 */
import { useEffect, useState, type FormEvent } from "react";
import {
  type EntryBlueprint,
  type Issue,
  type PerDay,
  type Routine,
  type Rule,
  type SlotTime,
  type Tag,
  addDays,
  createRoutine,
  diffDays,
  endTimeOf,
  formatDuration,
  isDraft,
  isoWeekday,
  maxDate,
  minutesBetween,
  parseDate,
  parseDuration,
  slotDuration,
  todayOf,
  validateBlueprint,
  validateRule,
} from "@planner/core";
import type { StoredEntry } from "@planner/data";
import { useRepos } from "@planner/data/react";
import { cn } from "@/lib/cn";
import { useClock } from "@/lib/clock";
import { act, actOk, useTagMap } from "@/lib/data-hooks";
import { MONTHS, WEEKDAY_SHORT, nextDays } from "@/lib/routine-view";
import { dayShort } from "@/lib/task-view";
import { isCustomTone, luminance, TONE_NAMES, toneHex, type Tone } from "@/lib/tones";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-picker";
import { ChoiceCard, ChoiceGroup, RadioRow, StepHeading } from "@/components/ui/choice";
import { CloseIcon, CopyIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { ProtocolPicker } from "./protocol-picker";
import { type FormTag, TagBox, toTagRefs } from "./tag-box";

type OpenProps = { open: boolean; onOpenChange: (o: boolean) => void };

/* ── Tone picker: preset swatches + a custom color ────────────────── */

const swatchBox = "size-7 rounded-btn border-2 transition-colors";

export function TonePicker({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  const custom = isCustomTone(value);
  // Remember the last custom color so switching to a preset and back keeps it.
  const [lastCustom, setLastCustom] = useState<string | null>(custom ? value : null);
  const [customOpen, setCustomOpen] = useState(false);
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

        {/* Custom: our own picker in a popover (never the browser's color dialog). */}
        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger
            aria-label="Custom color"
            title={lastCustom ? `Custom ${lastCustom}: click to change` : "Pick any color"}
            className={cn(swatchBox, "flex items-center justify-center", custom ? "border-fg-white" : "border-transparent hover:border-ink-line-dash")}
          >
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
          </PopoverTrigger>
          <PopoverContent align="start" className="p-2">
            <ColorPicker
              value={lastCustom ?? (custom ? value : toneHex(value))}
              onCancel={() => setCustomOpen(false)}
              onPick={(hex) => {
                setLastCustom(hex);
                onChange(hex as Tone);
                setCustomOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
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

/* ── Routine: new, edit, dates, duplicate ─────────────────────────── */

/** Issues → the first message for each form field. */
function byField(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[(i.field ?? "form").split(".")[0]!] ??= i.message;
  return out;
}

/** A new routine: always a draft (nothing shows until it's published). */
export function NewRoutineDialog({ open, onOpenChange, onCreated }: OpenProps & { onCreated: (id: string) => void }) {
  const repos = useRepos();
  const today = todayOf(useClock());
  const [title, setTitle] = useState("");
  const [purpose, setPurpose] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 83));
  const [tone, setTone] = useState<Tone>("lilac");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setPurpose("");
    setStart(today);
    setEnd(addDays(today, 83));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const fields = { title, purpose, startDate: start, endDate: end, color: tone };
    const check = createRoutine("preview", fields);
    if (!check.ok) return setErrors(byField(check.errors));
    const r = await act(repos.routines.create(fields));
    if (!r) return;
    onOpenChange(false);
    onCreated(r.id);
    toast("Draft created. Add entries, then publish it.");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="New routine" description="It starts as a draft: nothing shows in Todo or Calendar until you publish it. Every routine ends.">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="Title" error={errors.title}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Exercise plan" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Purpose" help="Just text: the why.">
            {(a) => <Input {...a} placeholder="Get stronger and have more energy" value={purpose} onChange={(e) => setPurpose(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts" error={errors.startDate}>
              {(a) => <DateField {...a} required value={start} onChange={setStart} placeholder="Pick a day" />}
            </Field>
            <Field label="Ends" error={errors.endDate}>
              {(a) => <DateField {...a} required value={end} onChange={setEnd} min={start || undefined} placeholder="Pick a day" />}
            </Field>
          </div>
          <Field label="Color">{() => <TonePicker value={tone} onChange={setTone} />}</Field>
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

/** Title, purpose, color — free at any time. */
export function EditRoutineDialog({ routine, ...p }: OpenProps & { routine: Routine }) {
  const repos = useRepos();
  const [title, setTitle] = useState(routine.title);
  const [purpose, setPurpose] = useState(routine.purpose ?? "");
  const [tone, setTone] = useState<Tone>((routine.color ?? "stone") as Tone);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (!p.open) return;
    setTitle(routine.title);
    setPurpose(routine.purpose ?? "");
    setTone((routine.color ?? "stone") as Tone);
    setError(undefined);
  }, [p.open, routine]);

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title="Edit routine">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return setError("The title can't be empty.");
            if (await act(repos.routines.edit(routine.id, { title, purpose, color: tone }), "Saved.")) p.onOpenChange(false);
          }}
        >
          <Field label="Title" error={error}>
            {(a) => <Input {...a} kind="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Purpose">{(a) => <Input {...a} value={purpose} onChange={(e) => setPurpose(e.target.value)} />}</Field>
          <Field label="Color">{() => <TonePicker value={tone} onChange={setTone} />}</Field>
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

/** Draft: both dates are free. Published: only the end (not before the last done task). */
export function DatesDialog({ routine, ...p }: OpenProps & { routine: Routine }) {
  const repos = useRepos();
  const draft = isDraft(routine);
  const [start, setStart] = useState(routine.startDate);
  const [end, setEnd] = useState(routine.endDate);
  useEffect(() => {
    if (!p.open) return;
    setStart(routine.startDate);
    setEnd(routine.endDate);
  }, [p.open, routine]);

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={draft ? "Change dates" : "Change end date"}
        description={
          draft
            ? "It's a draft, so both dates are free. Once published, the start is locked."
            : "Earlier: not before its last done task, and touched tasks after the new end go away. Later: it keeps going until then."
        }
        width={420}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const out = await act(repos.routines.edit(routine.id, draft ? { startDate: start, endDate: end } : { endDate: end }));
            if (!out) return;
            p.onOpenChange(false);
            toast(draft ? `${dayShort(out.startDate)} → ${dayShort(out.endDate)}.` : `Ends ${dayShort(out.endDate)}.`);
          }}
        >
          <div className={cn("grid gap-3", draft && "grid-cols-2")}>
            {draft && <Field label="Starts">{(a) => <DateField {...a} required value={start} onChange={setStart} />}</Field>}
            <Field label="Ends">{(a) => <DateField {...a} required value={end} onChange={setEnd} min={start} />}</Field>
          </div>
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

/** Restarting = duplicating into a new draft: same entries (as they are now), new dates. */
export function DuplicateDialog({ routine, onCreated, ...p }: OpenProps & { routine: Routine; onCreated: (id: string) => void }) {
  const repos = useRepos();
  const today = todayOf(useClock());
  const length = diffDays(routine.startDate, routine.endDate);
  const [title, setTitle] = useState(routine.title);
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, length));
  useEffect(() => {
    if (!p.open) return;
    const from = maxDate(today, addDays(routine.endDate, 1));
    setTitle(routine.title);
    setStart(from);
    setEnd(addDays(from, length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, routine]);

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={`Duplicate “${routine.title}”`}
        description="The copy is a new draft with the same entries (as they are now) and new dates. Adjust it, then publish. Each period keeps its own history."
        width={460}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const copy = await act(repos.routines.duplicate(routine.id, { title, startDate: start, endDate: end }));
            if (!copy) return;
            p.onOpenChange(false);
            onCreated(copy.id);
            toast("Duplicated as a draft. Check it, then publish.");
          }}
        >
          <Field label="Title">{(a) => <Input {...a} kind="title" value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Starts">{(a) => <DateField {...a} required value={start} onChange={setStart} />}</Field>
            <Field label="Ends">{(a) => <DateField {...a} required value={end} onChange={setEnd} min={start} />}</Field>
          </div>
          <DialogActions>
            <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              <CopyIcon />
              Duplicate
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── New protocol ─────────────────────────────────────────────────── */

export function NewProtocolDialog({ open, onOpenChange, onCreated }: OpenProps & { onCreated: (id: string) => void }) {
  const repos = useRepos();
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
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return setError("The title can't be empty.");
            const p = await act(repos.protocols.create(title));
            if (!p) return;
            onOpenChange(false);
            onCreated(p.id);
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
  { v: "daily", label: "Daily", sub: "Every N days", unit: "day" },
  { v: "weekly", label: "Weekly", sub: "On some days", unit: "week" },
  { v: "monthly", label: "Monthly", sub: "1st, last Fri…", unit: "month" },
  { v: "yearly", label: "Yearly", sub: "14 March", unit: "year" },
] as const;
type Freq = (typeof FREQS)[number]["v"];
/** A time row as typed: Start → End, or (no start) a Length; the deadline when it's open. */
type Slot = { startTime: string; endTime: string; length: string; dueTime: string };
const EMPTY_SLOT: Slot = { startTime: "", endTime: "", length: "", dueTime: "" };

/** A new start keeps the row's length: 18:00 → 19:00, start 18:30 → end 19:30; no start → "1h". */
function withStart(x: Slot, next: string): Slot {
  const len = x.startTime ? (x.endTime ? minutesBetween(x.startTime, x.endTime) : null) : x.length.trim() ? parseDuration(x.length) : null;
  if (next) return { ...x, startTime: next, endTime: len !== null ? endTimeOf(next, len) : x.endTime, length: "" };
  return { ...x, startTime: "", endTime: "", length: len !== null ? formatDuration(len) : "" };
}

/**
 * An entry: what (title, notes, tags, length, protocol) + when (the rule, then times or a
 * count). Checked by @planner/core's `validateBlueprint`; a draft just overwrites, a
 * published routine gets a new version from today on.
 */
export function EntryDialog({ routine, entry, ...p }: OpenProps & { routine: Routine; entry?: StoredEntry }) {
  const repos = useRepos();
  const today = todayOf(useClock());
  const tagMap = useTagMap();
  const draft = isDraft(routine);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<FormTag[]>([]);
  const [duration, setDuration] = useState("");
  const [protocolId, setProtocolId] = useState("");
  const [freq, setFreq] = useState<Freq>("weekly");
  const [interval, setInterval] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthBy, setMonthBy] = useState<"day" | "weekday">("day");
  const [monthDay, setMonthDay] = useState("1");
  const [nth, setNth] = useState<1 | 2 | 3 | 4 | -1>(1);
  const [nthWeekday, setNthWeekday] = useState(1);
  const [yMonth, setYMonth] = useState(1);
  const [yDay, setYDay] = useState("1");
  const [perKind, setPerKind] = useState<"times" | "count">("times");
  const [slots, setSlots] = useState<Slot[]>([EMPTY_SLOT]);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [count, setCount] = useState("4");
  const [countDue, setCountDue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!p.open) return;
    const v = entry?.versions[entry.versions.length - 1];
    const d = parseDate(today);
    setTitle(v?.title ?? "");
    setNotes(v?.notes ?? "");
    setTags((v?.tags ?? []).map((id) => tagMap.get(id)).filter((t): t is Tag => !!t));
    setDuration(v?.perDay.kind === "count" && v.duration !== undefined ? formatDuration(v.duration) : "");
    setProtocolId(v?.protocolId ?? "");
    const rule = v?.rule;
    setFreq(rule?.freq ?? "weekly");
    setInterval(String(rule?.interval ?? 1));
    setWeekdays(rule?.freq === "weekly" ? rule.weekdays : [isoWeekday(today)]);
    setMonthBy(rule?.freq === "monthly" ? rule.by : "day");
    setMonthDay(String(rule?.freq === "monthly" && rule.by === "day" ? rule.day : d.day));
    setNth(rule?.freq === "monthly" && rule.by === "weekday" ? rule.n : 1);
    setNthWeekday(rule?.freq === "monthly" && rule.by === "weekday" ? rule.weekday : isoWeekday(today));
    setYMonth(rule?.freq === "yearly" ? rule.month : d.month);
    setYDay(String(rule?.freq === "yearly" ? rule.day : d.day));
    const per = v?.perDay;
    setPerKind(per?.kind ?? "times");
    setSlots(
      v && per?.kind === "times"
        ? per.times.map((t) => {
            const len = slotDuration(v, t);
            return {
              startTime: t.startTime ?? "",
              endTime: t.startTime && len !== undefined ? endTimeOf(t.startTime, len) : "",
              length: !t.startTime && len !== undefined ? formatDuration(len) : "",
              dueTime: t.dueTime ?? "",
            };
          })
        : [EMPTY_SLOT],
    );
    setDeadlineOpen(per?.kind === "times" && per.times.some((t) => t.dueTime !== undefined));
    setCount(String(per?.kind === "count" ? per.count : 4));
    setCountDue(per?.kind === "count" ? (per.dueTime ?? "") : "");
    setErrors({});
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, entry]);

  function rule(): Rule {
    const n = Number(interval);
    if (freq === "daily") return { freq, interval: n };
    if (freq === "weekly") return { freq, interval: n, weekdays: [...weekdays].sort() };
    if (freq === "monthly")
      return monthBy === "day" ? { freq, interval: n, by: "day", day: Number(monthDay) } : { freq, interval: n, by: "weekday", n: nth, weekday: nthWeekday };
    return { freq, interval: n, month: yMonth, day: Number(yDay) };
  }

  /** The form as a blueprint, or the first thing core can't read yet (a length, an end). */
  function build(): { b: EntryBlueprint } | { error: Record<string, string> } {
    let perDay: PerDay;
    let minutes: number | undefined;
    if (perKind === "count") {
      const m = duration.trim() === "" ? undefined : parseDuration(duration);
      if (m === null) return { error: { duration: "Use minutes or hours, like 20m, 1h or 1h 30m." } };
      minutes = m;
      perDay = { kind: "count", count: Number(count), ...(countDue ? { dueTime: countDue } : {}) };
    } else {
      const times: SlotTime[] = [];
      for (const [i, s] of slots.entries()) {
        let len: number | null | undefined;
        if (s.startTime && s.endTime) {
          len = minutesBetween(s.startTime, s.endTime);
          if (len === null) return { error: { times: `Time ${i + 1}: the end has to be after the start.` } };
        } else if (!s.startTime && s.length.trim()) {
          len = parseDuration(s.length);
          if (len === null) return { error: { times: `Time ${i + 1}: use minutes or hours for the length, like 20m or 1h.` } };
        }
        times.push({
          ...(s.startTime ? { startTime: s.startTime } : {}),
          ...(deadlineOpen && s.dueTime ? { dueTime: s.dueTime } : {}),
          ...(len ? { duration: len } : {}),
        });
      }
      perDay = { kind: "times", times };
    }
    return {
      b: {
        title,
        ...(notes.trim() ? { notes } : {}),
        tags: [],
        ...(minutes !== undefined ? { duration: minutes } : {}),
        ...(protocolId ? { protocolId } : {}),
        rule: rule(),
        perDay,
      },
    };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const built = build();
    if ("error" in built) return setErrors(built.error);
    const b = built.b;
    const check = validateBlueprint(b);
    if (check.errors.length) return setErrors(byField(check.errors));
    const refs = toTagRefs(tags);
    const saved = await act(entry ? repos.routines.changeEntry(entry.id, b, refs) : repos.routines.addEntry(routine.id, b, refs));
    if (!saved) return;
    p.onOpenChange(false);
    toast(entry && !draft ? "Entry saved. Changes apply from today on; the past keeps what it was." : entry ? "Entry saved." : "Entry added.");
  }

  async function remove() {
    if (!entry) return;
    if (!(await actOk(repos.routines.removeEntry(entry.id)))) return;
    p.onOpenChange(false);
    toast(draft ? "Entry removed." : "Entry removed. Its tasks stop from today on; the past stays.");
  }

  const unit = FREQS.find((f) => f.v === freq)!.unit;
  // Live, like the task form: "Time 1: the deadline (09:30) is before it ends (10:00)."
  const warnings = (() => {
    try {
      const built = build();
      return "b" in built ? validateBlueprint(built.b).warnings.map((w) => w.message) : [];
    } catch {
      return [];
    }
  })();
  const withStartCount = slots.filter((s) => s.startTime).length;
  const endLabel = withStartCount === slots.length ? "End" : withStartCount === 0 ? "Length" : "End / length";
  const rowCols = deadlineOpen ? "grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)_minmax(0,1fr)_32px]" : "grid-cols-[minmax(0,1fr)_12px_minmax(0,1fr)_32px]";
  const setSlot = (i: number, change: (x: Slot) => Slot) => setSlots((xs) => xs.map((x, j) => (j === i ? change(x) : x)));
  const preview = (() => {
    try {
      const r = rule();
      return validateRule(r).length ? [] : nextDays(r, routine, today);
    } catch {
      return [];
    }
  })();

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={entry ? "Edit entry" : "Add entry"}
        description={
          draft
            ? `In ${routine.title} (draft). Change anything: there's no history yet.`
            : entry
              ? `In ${routine.title}. Changes apply from today on; past tasks keep what they were.`
              : `In ${routine.title}. It starts producing tasks from today.`
        }
        width={580}
      >
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Field label="What" error={errors.title}>
            {(a) => <Input {...a} kind="title" autoFocus placeholder="Gym" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>

          <StepHeading n={1}>How often</StepHeading>
          <ChoiceGroup label="How often" columns={4}>
            {FREQS.map((f) => (
              <ChoiceCard key={f.v} label={f.label} sub={f.sub} selected={freq === f.v} onClick={() => setFreq(f.v)} />
            ))}
          </ChoiceGroup>
          <div className="flex flex-wrap items-center gap-2 font-ui text-[13px] text-fg-secondary">
            Every
            <Input aria-label="Interval" inputMode="numeric" className="w-14 text-center" value={interval} onChange={(e) => setInterval(e.target.value.replace(/\D/g, ""))} />
            {Number(interval) === 1 ? unit : `${unit}s`}
            {errors.interval && <span className="text-error">{errors.interval}</span>}
          </div>
          {freq === "weekly" && (
            <div className="flex flex-col gap-1.5">
              <div role="group" aria-label="Days" className="flex flex-wrap gap-1.5">
                {WEEKDAY_SHORT.map((label, i) => {
                  const d = i + 1;
                  const on = weekdays.includes(d);
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setWeekdays((xs) => (on ? xs.filter((x) => x !== d) : [...xs, d]))}
                      className={cn(
                        "h-7 min-w-11 rounded-btn px-2 font-ui text-[12px] transition-colors",
                        on ? "bg-fg-white font-semibold text-black" : "bg-ink-fill text-fg hover:bg-ink-fill-hover",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {errors.weekdays && <span className="font-ui text-[12px] text-error">{errors.weekdays}</span>}
            </div>
          )}
          {freq === "monthly" && (
            <ChoiceGroup label="Which day of the month">
              <RadioRow
                label={
                  <span className="flex items-center gap-2">
                    On the
                    <Input
                      aria-label="Day of the month"
                      inputMode="numeric"
                      className="h-7 w-12 text-center"
                      value={monthDay}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => setMonthDay(e.target.value.replace(/\D/g, ""))}
                    />
                  </span>
                }
                example="The 31st falls on the last day in shorter months"
                selected={monthBy === "day"}
                onClick={() => setMonthBy("day")}
              />
              <RadioRow
                label={
                  <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    On the
                    <Select aria-label="Which one" className="h-7 w-[84px]" value={nth} onChange={(e) => (setNth(Number(e.target.value) as 1), setMonthBy("weekday"))}>
                      {[1, 2, 3, 4, -1].map((n) => (
                        <option key={n} value={n}>
                          {n === -1 ? "last" : ordinalShort(n)}
                        </option>
                      ))}
                    </Select>
                    <Select aria-label="Weekday" className="h-7 w-[84px]" value={nthWeekday} onChange={(e) => (setNthWeekday(Number(e.target.value)), setMonthBy("weekday"))}>
                      {WEEKDAY_SHORT.map((w, i) => (
                        <option key={w} value={i + 1}>
                          {w}
                        </option>
                      ))}
                    </Select>
                  </span>
                }
                example="e.g. the last Friday"
                selected={monthBy === "weekday"}
                onClick={() => setMonthBy("weekday")}
              />
            </ChoiceGroup>
          )}
          {freq === "yearly" && (
            <div className="flex items-center gap-2 font-ui text-[13px] text-fg-secondary">
              On
              <Input aria-label="Day" inputMode="numeric" className="w-14 text-center" value={yDay} onChange={(e) => setYDay(e.target.value.replace(/\D/g, ""))} />
              <Select aria-label="Month" className="w-[150px]" value={yMonth} onChange={(e) => setYMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
              {(errors.day || errors.month) && <span className="text-error">{errors.day ?? errors.month}</span>}
            </div>
          )}
          {freq === "monthly" && errors.day && <span className="font-ui text-[12px] text-error">{errors.day}</span>}

          <StepHeading n={2}>Each day gets</StepHeading>
          <ChoiceGroup label="Each day gets">
            <RadioRow label="Fixed times" example="18:00, or 08:00 / 14:00 / 20:00, or just “sometime that day”" selected={perKind === "times"} onClick={() => setPerKind("times")} />
            <RadioRow label="A count" example="Water 4 times a day" selected={perKind === "count"} onClick={() => setPerKind("count")} />
          </ChoiceGroup>
          {perKind === "times" ? (
            <div className="flex flex-col gap-2">
              {slots.map((s, i) => (
                <div key={i} className={cn("grid items-end gap-2", rowCols)}>
                  <Field label={i === 0 ? "Start" : ""}>
                    {(a) => (
                      <TimeField
                        {...a}
                        aria-label={`Time ${i + 1} start`}
                        placeholder="Any time"
                        value={s.startTime}
                        onChange={(v) => setSlot(i, (x) => withStart(x, v))}
                      />
                    )}
                  </Field>
                  <span aria-hidden className="flex h-9 items-center justify-center font-ui text-[13px] text-fg-label">
                    {s.startTime ? "→" : ""}
                  </span>
                  <Field label={i === 0 ? endLabel : ""}>
                    {(a) =>
                      s.startTime ? (
                        <TimeField
                          {...a}
                          aria-label={`Time ${i + 1} end`}
                          placeholder="No end"
                          aria-invalid={!!errors.times}
                          value={s.endTime}
                          onChange={(v) => setSlot(i, (x) => ({ ...x, endTime: v }))}
                        />
                      ) : (
                        <Input
                          {...a}
                          aria-label={`Time ${i + 1} length`}
                          placeholder="e.g. 20m"
                          value={s.length}
                          onChange={(e) => setSlot(i, (x) => ({ ...x, length: e.target.value }))}
                        />
                      )
                    }
                  </Field>
                  {deadlineOpen && (
                    <Field label={i === 0 ? "Deadline" : ""}>
                      {(a) => (
                        <TimeField
                          {...a}
                          aria-label={`Time ${i + 1} deadline`}
                          placeholder="No deadline"
                          value={s.dueTime}
                          onChange={(v) => setSlot(i, (x) => ({ ...x, dueTime: v }))}
                        />
                      )}
                    </Field>
                  )}
                  {slots.length > 1 ? (
                    <IconButton label={`Remove time ${i + 1}`} tone="muted" onClick={() => setSlots((xs) => xs.filter((_, j) => j !== i))}>
                      <CloseIcon size={10} />
                    </IconButton>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
              {errors.times && <span className="font-ui text-[12px] text-error">{errors.times}</span>}
              <div className="flex flex-wrap items-center gap-x-1">
                <Button size="sm" variant="ghost" className="-ml-3" onClick={() => setSlots((xs) => [...xs, EMPTY_SLOT])}>
                  <PlusIcon size={10} />
                  Add a time
                </Button>
                {deadlineOpen ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeadlineOpen(false);
                      setSlots((xs) => xs.map((x) => ({ ...x, dueTime: "" })));
                    }}
                  >
                    <CloseIcon size={10} />
                    {slots.length > 1 ? "Remove deadlines" : "Remove deadline"}
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setDeadlineOpen(true)}>
                    <PlusIcon size={10} />
                    Add a deadline
                  </Button>
                )}
              </div>
              <span className="font-ui text-[11px] leading-[15px] text-fg-label">
                {deadlineOpen
                  ? "No start = sometime that day. A deadline is the latest it can be done; without one, the end is."
                  : "No start = sometime that day. It's missed once its end passes (no end: at midnight)."}
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Field label="How many times a day" error={errors.count}>
                {(a) => <Input {...a} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ""))} />}
              </Field>
              <Field label="All by (optional)">{(a) => <TimeField {...a} placeholder="No deadline" value={countDue} onChange={setCountDue} />}</Field>
              <Field label="Length" help="How long each one takes, e.g. 5m" error={errors.duration}>
                {(a) => <Input {...a} placeholder="—" value={duration} onChange={(e) => setDuration(e.target.value)} />}
              </Field>
            </div>
          )}

          <div className="flex flex-col gap-4 border-t border-ink-line-soft pt-4">
            <Field label="Tags">{(a) => <TagBox {...a} value={tags} onChange={setTags} known={[...tagMap.values()]} />}</Field>
            <Field label="Notes">{(a) => <Textarea {...a} className="min-h-[64px]" value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
            <Field label="Protocol">{() => <ProtocolPicker value={protocolId} onChange={setProtocolId} />}</Field>
          </div>

          {(preview.length > 0 || warnings.length > 0) && (
            <div aria-live="polite" className="flex flex-col gap-1 rounded-card bg-ink-well px-3 py-2.5">
              {preview.length > 0 && (
                <span className="font-ui text-[12px] leading-[18px] text-fg-secondary">
                  Next: {preview.map((d) => dayShort(d)).join(" · ")}
                  {draft && " (once published)"}
                </span>
              )}
              {warnings.map((w) => (
                <span key={w} className="font-ui text-[12px] leading-[18px] text-error">
                  {w}
                </span>
              ))}
            </div>
          )}
          {errors.form && <p className="m-0 font-ui text-[12px] text-error">{errors.form}</p>}

          <DialogActions>
            {entry && (
              <Button variant="danger" className="mr-auto" onClick={() => (draft ? void remove() : setConfirmRemove(true))}>
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
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={`Remove “${title || "this entry"}”?`}
          body="Its tasks stop from today on. Everything before today stays as history, and anything you've done is kept."
          confirmLabel="Remove entry"
          onConfirm={() => void remove()}
        />
      </DialogContent>
    </Dialog>
  );
}

const ordinalShort = (n: number) => ({ 1: "1st", 2: "2nd", 3: "3rd", 4: "4th" })[n] ?? `${n}th`;

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
