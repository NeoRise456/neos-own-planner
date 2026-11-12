/**
 * The task form and Move — on the real database. Fields are checked by @planner/core
 * (`editTask`) before saving, so its messages show under the right field; the
 * repository checks again when it writes.
 */
import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { format, parseISO } from "date-fns";
import {
  type Issue,
  type Tag,
  type Task,
  type TaskFields,
  editTask,
  findTag,
  formatDuration,
  normalizeTagName,
  parseDuration,
  scheduleForMove,
  todayOf,
  validateTask,
} from "@planner/core";
import { useRepos } from "@planner/data/react";
import { currentClock } from "@/lib/clock";
import { act, useTagMap } from "@/lib/data-hooks";
import { TONE_NAMES } from "@/lib/tones";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-picker";
import { TrashIcon } from "@/components/ui/icons";
import { toast } from "@/components/ui/toast";
import { TagChip } from "./todo";

type OpenProps = { open: boolean; onOpenChange: (o: boolean) => void };

/** New tags get the next color in turn (stone stays the "no tag" color). */
const TAG_TONES = TONE_NAMES.filter((t) => t !== "stone");

/** A tag in the form: an existing one (id) or a name to create on save. */
type FormTag = { id?: string; name: string; color: string };

/** Issues → the first message for each form field. */
function byField(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.field ?? "form"] ??= i.message;
  return out;
}

/* ── Edit task (title, notes, tags, start, due, duration) ─────────── */

export function EditTaskDialog({ task, ...p }: OpenProps & { task: Task }) {
  const repos = useRepos();
  const tagMap = useTagMap();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<FormTag[]>([]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [duration, setDuration] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!p.open) return;
    setTitle(task.title);
    setNotes(task.notes ?? "");
    setTags(task.tags.map((id) => tagMap.get(id)).filter((t): t is Tag => !!t));
    setStartDate(task.startDate ?? "");
    setStartTime(task.startTime ?? "");
    setDueDate(task.dueDate ?? "");
    setDueTime(task.dueTime ?? "");
    setDuration(task.duration !== undefined ? formatDuration(task.duration) : "");
    setErrors({});
    // Only when the dialog opens — not when tags change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, task]);

  function changes(): Partial<TaskFields> | null {
    const minutes = duration.trim() === "" ? undefined : parseDuration(duration);
    if (minutes === null) {
      setErrors({ duration: "Use minutes or hours, like 20m, 1h or 1h 30m." });
      return null;
    }
    return {
      title,
      notes,
      duration: minutes,
      startDate: startDate || undefined,
      startTime: startTime || undefined,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
    };
  }

  async function save() {
    const c = changes();
    if (!c) return;
    // Ask the rules first (tags can't make it invalid, so the current ones stand in).
    const preview = editTask(task, c);
    if (!preview.ok) {
      setErrors(byField(preview.errors));
      return;
    }
    const ids: string[] = [];
    for (const t of tags) {
      const tag = t.id ? t : await act(repos.tags.ensure(t.name, t.color));
      if (!tag?.id) return;
      ids.push(tag.id);
    }
    const saved = await act(repos.tasks.edit(task.id, { ...c, tags: ids }));
    if (!saved) return;
    p.onOpenChange(false);
    const w = validateTask(saved).warnings[0];
    toast(w ? `Saved. ${w.message}` : "Saved.");
  }

  async function remove() {
    const out = await act(repos.tasks.remove(task.id));
    if (!out) return;
    p.onOpenChange(false);
    useUi.getState().set({ openTaskId: null });
    if (out.action === "deleted") {
      toast("Task deleted.", { action: { label: "Undo", onClick: () => void act(repos.tasks.restore(out.task, out.createdAt)) } });
    } else {
      toast("Routine tasks can't be deleted, so it was cancelled.");
    }
  }

  const nextColor = TAG_TONES[(tagMap.size + tags.filter((t) => !t.id).length) % TAG_TONES.length];

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title="Edit task" width={520}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Title" error={errors.title}>
            {(a) => <Input {...a} kind="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <Field label="Notes">{(a) => <Textarea {...a} value={notes} onChange={(e) => setNotes(e.target.value)} />}</Field>
          <Field label="Tags" help="Type a name and press Enter. New names make a new tag.">
            {(a) => <TagInput {...a} value={tags} onChange={setTags} known={[...tagMap.values()]} nextColor={nextColor} />}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start day" error={errors.startDate}>
              {(a) => <DateField {...a} value={startDate} onChange={setStartDate} />}
            </Field>
            <Field label="Start time" error={errors.startTime}>
              {(a) => <TimeField {...a} value={startTime} onChange={setStartTime} />}
            </Field>
            <Field label="Due day" error={errors.dueDate}>
              {(a) => <DateField {...a} value={dueDate} onChange={setDueDate} />}
            </Field>
            <Field label="Due time" error={errors.dueTime}>
              {(a) => <TimeField {...a} value={dueTime} onChange={setDueTime} />}
            </Field>
            <Field label="Duration" help="e.g. 20m, 1h 30m" error={errors.duration}>
              {(a) => <Input {...a} placeholder="—" value={duration} onChange={(e) => setDuration(e.target.value)} />}
            </Field>
          </div>
          {errors.form && <p className="m-0 font-ui text-[12px] text-danger">{errors.form}</p>}
          <DialogActions className="justify-between">
            <Button variant="danger" onClick={() => void remove()}>
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

/** Chips + a text box. Enter (or a comma) adds the typed name; existing names are suggested. */
function TagInput({
  value,
  onChange,
  known,
  nextColor,
  ...a
}: {
  value: FormTag[];
  onChange: (tags: FormTag[]) => void;
  known: Tag[];
  nextColor: string;
  id: string;
  "aria-describedby"?: string;
}) {
  const [text, setText] = useState("");
  const listId = useId();

  function add() {
    const name = normalizeTagName(text);
    setText("");
    if (!name || findTag(value.map((t) => ({ id: t.id ?? "", name: t.name, color: t.color })), name)) return;
    const existing = findTag(known, name);
    onChange([...value, existing ?? { name, color: nextColor }]);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add();
    } else if (e.key === "Backspace" && text === "" && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <TagChip key={t.id ?? `new:${t.name}`} tag={t} onRemove={() => onChange(value.filter((x) => x !== t))} />
          ))}
        </div>
      )}
      <Input {...a} list={listId} placeholder="Add a tag" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} onBlur={add} />
      <datalist id={listId}>
        {known
          .filter((k) => !value.some((t) => t.id === k.id))
          .map((k) => (
            <option key={k.id} value={k.name} />
          ))}
      </datalist>
    </div>
  );
}

/* ── Move task ────────────────────────────────────────────────────── */

export function MoveTaskDialog({ task, ...p }: OpenProps & { task: Task }) {
  const repos = useRepos();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const onlyDue = task.startDate === undefined && task.dueDate !== undefined;

  useEffect(() => {
    if (!p.open) return;
    setDate((onlyDue ? task.dueDate : task.startDate) ?? todayOf(currentClock()));
    setTime((onlyDue ? task.dueTime : task.startTime) ?? "");
  }, [p.open, task, onlyDue]);

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent
        title={`Move “${task.title}”`}
        description={onlyDue ? "Pick a new due day, and a time if it has one." : "Pick a new day, and a time if it has one. A due date moves along."}
        width={420}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const moved = await act(repos.tasks.move(task.id, scheduleForMove(task, date, time || undefined)));
            if (!moved) return;
            p.onOpenChange(false);
            toast(`Moved to ${format(parseISO(date), "EEE d MMM")}${time ? ` ${time}` : ""}.`);
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day">{(a) => <DateField {...a} required value={date} onChange={setDate} />}</Field>
            <Field label="Time (optional)">{(a) => <TimeField {...a} value={time} onChange={setTime} />}</Field>
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
