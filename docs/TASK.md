# The Task

The **Task** is the basic unit of the whole planner. Everything the app shows — the todo list, the calendar, the history, routine stats — is made of tasks.

> Routines, routine entries and protocols are described in [SYSTEMS.md](SYSTEMS.md).

## What is a task?

**A task is a single action in real life that can be done or not done.**

"Go to the dentist", "finish the essay", "buy milk", "Gym on Monday 3rd" — all tasks. There are no separate "events", "appointments", "habits" or "chores". Those are just tasks with different fields filled in.

- **A task never repeats.** It's always one action at one point.
- **Repetition only exists inside routines.** A routine entry ("Gym, Mon/Wed/Fri 18:00") produces one task per occurrence — see [SYSTEMS.md](SYSTEMS.md).
- **Every task works the same way**, whether you created it yourself or a routine produced it: same fields, same states, same rules, on every platform.

## Where tasks come from

| Origin | Example | Belongs to a routine? |
|---|---|---|
| **One-off** — you create it | "Dentist Thu 15:00", "Buy milk" | **No, never** |
| **Routine copy** — produced by a routine entry | "Gym — Mon 3 Nov 18:00" | Yes, through its entry |

## Fields

| Field | Required | Type | Meaning |
|---|---|---|---|
| `title` | **yes** | text | What to do. The only thing you must write |
| `notes` | no | text | Extra details |
| `tags` | no | list of tags | Labels for grouping/filtering. **Several** allowed |
| `duration` | no | minutes | How long it takes (5 min, 1 h, …) |
| `start_date` | no | date | The day it's on / when its range opens |
| `start_time` | no | time | When it happens → makes it **timed** |
| `due_date` | no | date | Last day it can be done |
| `due_time` | no | time | Time it must be done by |
| `protocol` | no | protocol | Steps to follow — **one or none** |
| `done_at` | no | moment | **When it was really done.** Set when ticked; editable |
| `logged_at` | no | moment | When it was ticked in the app. Automatic |
| `cancelled_at` | no | moment | When you cancelled it |

**Only for routine copies:**

| Field | Meaning |
|---|---|
| `routine_entry` | The entry that produced it |
| `occurrence_date` | The day the entry originally placed it on |
| `occurrence_slot` | Which copy of that day (1st time, 2nd time… or 1st of 4 for a count) |

A routine copy takes its title, notes, tags, duration, protocol and times from its entry. You can change any of them on a single copy (e.g. add a note to one gym session, or move one class).

Dates and times are **local** (what your clock shows). `done_at`, `logged_at` and `cancelled_at` are exact moments.

### Start vs due — not the same thing
- **Start** = when it happens. *Dentist at 15:00.*
- **Due** = the latest moment it can be done. *Essay by Friday 23:59.*

A task can have one, both, or neither.
- Due before start → allowed, with a warning.
- Due already in the past → allowed, no warning. The task is simply **missed** from the start, and you can still tick it (for things you forgot to log).

### Duration
How much time the task takes. Used to:
- size the task's block in the Calendar
- decide when a timed task's time runs out (end of its block)
- show the day's planned time in the Todo list
- later: suggest free slots for undated tasks

## Kinds of task (by time)

The kind is **never stored** — it comes from which fields are filled.

| Kind | Rule | Example |
|---|---|---|
| **Anytime** | no date at all | "Buy milk" |
| **Floating** | has a date, no start time — done *sometime* that day / range | "Reply to email today", "Call mom this week" |
| **Timed** | has a start time | "Dentist Thu 15:00, 1 h" |

### Floating tasks
A floating task belongs to a day (or a range of days) but not to a time — quick things, or things that just happen during the day.

- Can have a **due time** ("today, by 18:00")
- Can have a **duration** (counts toward the day's total)
- A **multi-day** floating task (`start_date` Mon, `due_date` Sun) shows **every day** of its range with a "by Sun" label until it's done
- Adding a start time makes it timed; removing it makes it floating again
- Time windows ("between 14:00 and 18:00") — **not for now**

## States

Every task is in exactly one of four states. The state is **worked out** from the task's fields and the current time — never set by hand, except by ticking or cancelling.

| State | When |
|---|---|
| **not done** | Not done, not cancelled, and its time hasn't run out (or it has no time limit) |
| **done** | It has a `done_at` |
| **missed** | Not done, not cancelled, and its time has run out |
| **cancelled** | It has a `cancelled_at` — it won't happen, and it's not your fault |

```
not done ──tick──────────▶ done
   │  │                     ▲  │
   │  └──cancel──▶ cancelled   │ untick
   │                │          ▼
time runs out    uncancel   (back to not done / missed)
   ▼                │
 missed ──tick──────┘──▶ done
```

- **Missed is just a fact**, not a to-do: it wasn't done in time. A missed class stays missed.
- **A missed task can still be ticked** — "I did it but forgot to log it" or "I did it late". Set `done_at` to when it really happened.
- **Cancelled** is your decision ("holiday — no class", "dentist cancelled"). It never counts for or against you, and it stays in the history.
- **Done and cancelled exclude each other.** To cancel a done task, untick it first.
- Untick / uncancel return the task to whatever its time says: not done or missed.
- There is **no "late" state.** History can show "done 09:12 · due 09:00" as information only.

### When the time runs out
The first rule that applies:

| # | If the task has… | Its time runs out at… | Example |
|---|---|---|---|
| 1 | a due date (± due time) | its due moment — or the end of the due day if there's no time | Essay due Fri 23:59 · Exercise due 09:00 |
| 2 | a start time and a duration | the end of its block | Class 09:00 + 2 h → 11:00 |
| 3 | only a start date (± start time) | the end of that day | "Reply to email today" → midnight |
| 4 | no date at all | never | "Buy milk" |

## Ticking (done)

- Ticking sets `done_at` (defaults to now, editable) and `logged_at` (automatic).
- **After its time ran out**, ticking offers quick options:
  ```
  ☑ Exercise (due 09:00)
     → Done now (09:40)
     → Done on time (09:00)
     → Pick a time…
  ```
- Ticking a task from a past day is allowed — it stays on **its** day, `done_at` says when it really happened.
- Unticking clears `done_at` / `logged_at`.
- **History** = done tasks by the day of their `done_at`.

## Moving & cancelling

- **Moving** = changing a task's date/time. No new state. For a routine copy, it keeps its `occurrence_date`, so the calendar can show "moved from Mon". A moved task's time runs out by its **new** date/time.
- **Cancelling** = setting `cancelled_at`. The task stays visible (struck through) and in history. Uncancel to undo.

## Tags
- A tag has a `name` and a `color`.
- A task can have **zero, one or many** tags.
- Created on the fly: type a new name in the task form and it's made.
- Used to filter the Todo list and color/filter the Calendar.

## Rules / validation
- `title` must not be empty (trimmed).
- `duration`, if set, must be > 0.
- A time (start or due) always goes with its date.
- `due_date` before `start_date` → allowed, with a warning.
- A task can't be both done and cancelled.
- A one-off task never has a routine entry.
- Deleting a task removes it from views; for a routine copy, deleting = cancelling (the entry would just produce it again otherwise).

## Examples

```jsonc
// Anytime
{ "title": "Buy milk", "tags": ["home"] }

// Floating, sometime today
{ "title": "Reply to email", "start_date": "2026-11-06", "duration": 5 }

// Floating over a week
{ "title": "Call mom", "start_date": "2026-11-09", "due_date": "2026-11-15" }

// Deadline
{ "title": "Finish essay", "due_date": "2026-11-13", "due_time": "23:59", "tags": ["uni"] }

// Appointment
{ "title": "Dentist", "start_date": "2026-11-12", "start_time": "15:00", "duration": 60 }

// Forgot to log it — created already missed, then ticked
{ "title": "Pay phone bill", "due_date": "2026-11-01", "done_at": "2026-11-01T19:30" }

// A routine copy (produced by the entry "Calculus (Mon)")
{
  "title": "Calculus (Mon)",
  "routine_entry": "Calculus (Mon)",
  "occurrence_date": "2026-11-09", "occurrence_slot": 1,
  "start_date": "2026-11-09", "start_time": "09:00", "duration": 120
}

// A cancelled routine copy (holiday)
{ "title": "Calculus (Mon)", "routine_entry": "Calculus (Mon)", "occurrence_date": "2026-12-08", "cancelled_at": "2026-12-01T10:00" }
```

## Not part of a task (for now)
Priority, subtasks, reminders, time windows for floating tasks, crossing midnight.
