/**
 * The task form (new + edit) and Move — on the real database. Fields are checked by
 * @planner/core (`createTask` / `editTask`) before saving, so its messages show under the right field; the
 * repository checks again when it writes.
 */
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  type Issue,
  type Tag,
  type Task,
  type TaskFields,
  createTask,
  editTask,
  endTimeOf,
  formatDuration,
  minutesBetween,
  parseDuration,
  scheduleForMove,
  todayOf,
  validateTask,
} from "@planner/core";
import { useRepos } from "@planner/data/react";
import { currentClock } from "@/lib/clock";
import { act, useTagMap } from "@/lib/data-hooks";
import { useUi } from "@/stores/ui";
import { Button } from "@/components/ui/button";
import { Dialog, DialogActions, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { DateField } from "@/components/ui/date-picker";
import { TimeField } from "@/components/ui/time-picker";
import { CloseIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formSummary } from "@/lib/task-view";
import { toast } from "@/components/ui/toast";
import { ProtocolPicker } from "./protocol-picker";
import { type FormTag, TagBox, toTagRefs } from "./tag-box";

type OpenProps = { open: boolean; onOpenChange: (o: boolean) => void };

/** Issues → the first message for each form field. */
function byField(issues: Issue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) out[i.field ?? "form"] ??= i.message;
  return out;
}

/* ── Task form (title, notes, tags, start, end, deadline) ─────────── */

export function EditTaskDialog({ task, ...p }: OpenProps & { task: Task }) {
  return <TaskForm {...p} task={task} />;
}

/** A new one-off task, starting from `initial` (e.g. the calendar slot that was clicked). */
export function NewTaskDialog({ initial, onCreated, ...p }: OpenProps & { initial: Partial<TaskFields>; onCreated?: (task: Task) => void }) {
  return <TaskForm {...p} initial={initial} onCreated={onCreated} />;
}

function TaskForm({
  task,
  initial,
  onCreated,
  ...p
}: OpenProps & { task?: Task; initial?: Partial<TaskFields>; onCreated?: (task: Task) => void }) {
  const repos = useRepos();
  const tagMap = useTagMap();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<FormTag[]>([]);
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  /** With a start time the length is set as an end time; without one, as a duration. */
  const [endTime, setEndTime] = useState("");
  const [duration, setDuration] = useState("");
  /** The deadline row shows once asked for (or when the task has one). */
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [protocolId, setProtocolId] = useState("");
  const [protocolOpen, setProtocolOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!p.open) return;
    const f: Partial<TaskFields> = task ?? initial ?? {};
    setTitle(f.title ?? "");
    setNotes(f.notes ?? "");
    setTags((f.tags ?? []).map((id) => tagMap.get(id)).filter((t): t is Tag => !!t));
    setStartDate(f.startDate ?? "");
    setStartTime(f.startTime ?? "");
    setDueDate(f.dueDate ?? "");
    setDueTime(f.dueTime ?? "");
    const timed = f.startTime !== undefined && f.duration !== undefined;
    setEndTime(timed ? endTimeOf(f.startTime!, f.duration!) : "");
    setDuration(!timed && f.duration !== undefined ? formatDuration(f.duration) : "");
    setDeadlineOpen(f.dueDate !== undefined);
    setProtocolId(f.protocolId ?? "");
    setProtocolOpen(f.protocolId !== undefined);
    setErrors({});
    // Only when the dialog opens — not when tags change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.open, task]);

  const length = startTime && endTime ? minutesBetween(startTime, endTime) : null;

  /** Changing the start keeps the length: the end moves along. Adding or removing the time switches end ↔ duration. */
  function changeStartTime(next: string) {
    if (next && startTime && length !== null) setEndTime(endTimeOf(next, length));
    else if (next && !startTime) {
      const typed = parseDuration(duration);
      if (typed !== null) setEndTime(endTimeOf(next, typed));
    } else if (!next && startTime) {
      setDuration(length !== null ? formatDuration(length) : "");
      setEndTime("");
    }
    setStartTime(next);
  }

  /** A day cleared takes its time with it (a time always goes with its date). */
  function changeStartDate(next: string) {
    if (!next) changeStartTime("");
    setStartDate(next);
  }
  function changeDueDate(next: string) {
    if (!next) setDueTime("");
    setDueDate(next);
  }

  /** The length in minutes: from the end time with a start time, else the typed duration. */
  function readLength(): { minutes?: number; error?: Record<string, string> } {
    if (startTime) {
      if (!endTime) return {};
      return length !== null ? { minutes: length } : { error: { endTime: "The end has to be after the start." } };
    }
    if (duration.trim() === "") return {};
    const m = parseDuration(duration);
    return m !== null ? { minutes: m } : { error: { duration: "Use minutes or hours, like 20m, 1h or 1h 30m." } };
  }

  function fields(minutes: number | undefined): Partial<TaskFields> {
    return {
      title,
      notes,
      duration: minutes,
      startDate: startDate || undefined,
      startTime: startTime || undefined,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      protocolId: protocolId || undefined,
    };
  }

  function changes(): Partial<TaskFields> | null {
    const { minutes, error } = readLength();
    if (error) {
      setErrors(error);
      return null;
    }
    return fields(minutes);
  }

  // What the task will do, as it's filled in.
  const summary = (() => {
    const { minutes, error } = readLength();
    if (error) return null;
    const f = fields(minutes);
    return formSummary(
      Object.fromEntries(Object.entries({ ...f, id: "preview", title: title.trim() || "Untitled", notes: undefined, tags: [] }).filter(([, v]) => v !== undefined)) as unknown as Task,
    );
  })();

  async function save() {
    const c = changes();
    if (!c) return;
    // Ask the rules first (tags can't make it invalid, so they're left out here).
    const preview = task ? editTask(task, c) : createTask("preview", { ...c, title: c.title ?? "", tags: [] });
    if (!preview.ok) {
      setErrors(byField(preview.errors));
      return;
    }
    // New tag names are created in the same write as the task: all or nothing.
    const saved = await act(
      task ? repos.tasks.edit(task, c, toTagRefs(tags)) : repos.tasks.create({ ...c, title: c.title ?? "", tags: [] }, toTagRefs(tags)),
    );
    if (!saved) return;
    p.onOpenChange(false);
    const w = validateTask(saved).warnings[0];
    toast(`${task ? "Saved." : `Added “${saved.title}”.`}${w ? ` ${w.message}` : ""}`);
    if (!task) onCreated?.(saved);
  }

  async function remove() {
    if (!task) return;
    const out = await act(repos.tasks.remove(task));
    if (!out) return;
    p.onOpenChange(false);
    useUi.getState().set({ openTaskId: null });
    if (out.action === "deleted") {
      toast("Task deleted.", { action: { label: "Undo", onClick: () => void act(repos.tasks.restore(out.task, out.createdAt)) } });
    } else {
      toast("Routine tasks can't be deleted, so it was cancelled.");
    }
  }

  return (
    <Dialog open={p.open} onOpenChange={p.onOpenChange}>
      <DialogContent title={task ? "Edit task" : "New task"} width={520}>
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
          <Field label="Tags" help="Type to search your tags. Enter adds the highlighted one; a new name is created when you save.">
            {(a) => <TagBox {...a} value={tags} onChange={setTags} known={[...tagMap.values()]} />}
          </Field>
          {/* Fields show up as they become relevant: a start time once there's a day, an end once there's a time. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Day" help={startDate ? undefined : "Optional. Without a day it's an anytime task."} error={errors.startDate}>
              {(a) => <DateField {...a} value={startDate} onChange={changeStartDate} />}
            </Field>
            {startDate ? (
              <Field label="Start time" error={errors.startTime}>
                {(a) => <TimeField {...a} value={startTime} onChange={changeStartTime} />}
              </Field>
            ) : (
              <span />
            )}
            {startTime ? (
              <Field
                label="End time"
                help={length !== null ? `Length ${formatDuration(length)}` : "Optional: how long it takes"}
                error={errors.endTime ?? errors.duration}
              >
                {(a) => <TimeField {...a} placeholder="No end" value={endTime} onChange={setEndTime} />}
              </Field>
            ) : (
              <Field label="Duration" help="Planned time, e.g. 20m, 1h 30m" error={errors.duration}>
                {(a) => <Input {...a} placeholder="—" value={duration} onChange={(e) => setDuration(e.target.value)} />}
              </Field>
            )}
          </div>
          {deadlineOpen ? (
            <div className="flex flex-col gap-2 border-t border-ink-line-soft pt-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Deadline" help="The latest it can be done." error={errors.dueDate}>
                  {(a) => <DateField {...a} value={dueDate} onChange={changeDueDate} />}
                </Field>
                {dueDate ? (
                  <Field label="Deadline time" help="Optional. Without one: the end of that day." error={errors.dueTime}>
                    {(a) => <TimeField {...a} value={dueTime} onChange={setDueTime} />}
                  </Field>
                ) : (
                  <span />
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-3 self-start"
                onClick={() => {
                  setDeadlineOpen(false);
                  setDueDate("");
                  setDueTime("");
                }}
              >
                <CloseIcon size={10} />
                Remove deadline
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="-ml-3 self-start" onClick={() => setDeadlineOpen(true)}>
              <PlusIcon />
              Add a deadline
            </Button>
          )}

          {protocolOpen ? (
            <Field label="Protocol" help="Its steps show when you open the task.">
              {() => <ProtocolPicker value={protocolId} onChange={setProtocolId} />}
            </Field>
          ) : (
            <Button variant="ghost" size="sm" className="-mt-2 -ml-3 self-start" onClick={() => setProtocolOpen(true)}>
              <PlusIcon />
              Add a protocol
            </Button>
          )}

          {summary && (
            <div aria-live="polite" className="flex flex-col gap-1 rounded-card bg-ink-well px-3 py-2.5">
              <span className="font-ui text-[12px] leading-[18px] text-fg-secondary">{summary.text}</span>
              {summary.warnings.map((w) => (
                <span key={w} className="font-ui text-[12px] leading-[18px] text-error">
                  {w}
                </span>
              ))}
            </div>
          )}
          {errors.form && <p className="m-0 font-ui text-[12px] text-danger">{errors.form}</p>}
          <DialogActions className="justify-between">
            {task ? (
              <Button variant="danger" onClick={() => void remove()}>
                <TrashIcon />
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => p.onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                {task ? "Save" : "Add task"}
              </Button>
            </div>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
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
        description={onlyDue ? "Pick a new deadline, and a time if it has one." : "Pick a new day, and a time if it has one. A deadline moves along."}
        width={420}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const moved = await act(repos.tasks.move(task, scheduleForMove(task, date, time || undefined)));
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
