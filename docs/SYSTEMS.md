# Systems — Routines, Routine Entries & Protocols

Tasks are the only thing that gets done (see [TASK.md](TASK.md)). Systems give tasks **repetition** and **context**:

- a **Routine** — a group of repeating things, with a purpose and a fixed period
- a **Routine entry** — a recipe inside a routine that produces tasks on a schedule
- a **Protocol** — a list of steps for doing a task

```
Routine "Exercise plan"   Sep 1 → Nov 30   (end required)
  │  purpose: "get stronger and have more energy"
  │
  ├─ Entry "Gym"        weekly Mon/Wed/Fri 18:00, 1 h, protocol "Gym warm-up"
  │     └─▶ tasks: Gym Mon 3 · Gym Wed 5 · Gym Fri 7 · …
  │
  └─ Entry "Water"      daily, 4 times
        └─▶ tasks: Water ×4 every day
```

**The only way for something to repeat is a routine.** Anything else is a one-off task.

---

## Routine

**A routine is a container of routine entries with a purpose and a fixed period.** "Exercise plan", "Morning routine", "Uni — Term 1".

### Fields

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Name of the routine |
| `purpose` | no | Text: the *why*. "Get stronger and have more energy" |
| `start_date` | yes | When it starts |
| `end_date` | **yes** | When it ends. **Every routine ends** — life changes too much to keep one forever |
| `entries` | no | Its routine entries. A routine can be empty (e.g. while you're setting it up) |
| `cloned_from` | no | The routine it was duplicated from |
| `lineage` | yes | Shared by a routine and all its copies, so they can be seen together |

A routine contains **only entries** — never one-off tasks.

### Status (worked out from the dates)
| Status | When |
|---|---|
| **upcoming** | today is before `start_date` |
| **active** | today is between `start_date` and `end_date` |
| **ended** | today is after `end_date` |

### Ending early / extending
Change the `end_date`.
- **Moved earlier** → allowed only down to the day of the routine's **last done task**. A done task always stays inside its routine's period, so nothing you did is ever lost or turned into something else. Tasks after the new end simply stop existing.
- **Moved later** → its entries keep producing tasks until the new end.

**Ending is not cancelling.**

| | Cancel a task | End the routine |
|---|---|---|
| Affects | **one** task | everything **after** the end date |
| The routine | keeps running | is over |
| What you see | that task struck through | after the end, those tasks simply don't exist |

Example — "Uni — Term 1" (Sep 8 → Jan 23), you drop the class and end it on **Nov 20**:

```
Sep 8 ─────────────────── Nov 20 │ Nov 21 ──────────── Jan 23
 ☑ done  ✗ missed  ⊘ cancelled   │   (nothing — routine is over)
 └── all stays exactly as it was ┘
```

- Before the end: done stays done, missed stays missed, cancelled stays cancelled.
- After the end: no tasks. Tasks you had touched there (moved, noted) go away too.
- Consistency counts only up to the end.

### Restarting — duplicate
To come back to something (e.g. exercise after a 2-month break), **duplicate the old routine** into a new one:
- copies the title, purpose and entries, with new dates
- sets `cloned_from` and keeps the same `lineage`
- entries keep pointing to the **same protocols**

Each period gets its own clean history ("Exercise — autumn" vs "Exercise — spring"); `lineage` lets you compare them. Every routine is its own separate thing — the copy is a new routine that only remembers which one it came from.

### Deleting a routine
- **Ending** is the normal way to stop a routine — it keeps everything.
- **Deleting** is for mistakes (a routine made by accident). It **deletes the routine's whole history** — all its done, missed and cancelled tasks — so the app warns you first.
- If a routine that others were duplicated from is deleted, the copies stay as they are and just lose the "came from" link.

### Tracking — consistency only
A routine tracks **how consistent you were**, worked out from its tasks:

```
Exercise plan — November
  23 / 28 done  ·  82%
  Gym             11/12
  Water           12/16   (count copies)
```

- **consistency = done ÷ (done + missed)**
- **cancelled** tasks don't count at all
- **not done** tasks (still in time, or in the future) don't count yet
- Nothing to log by hand — the purpose is just text, no goals or numbers (weight, grades…)

### Examples

| Routine | Period | Purpose | Entries |
|---|---|---|---|
| Uni — Term 1 | Sep 8 → Jan 23 | Pass the term | Calculus (Mon) 09:00 2 h · Calculus (Thu) 16:00 2 h · Physics (Tue) 11:00 2 h |
| Exercise plan | Sep 1 → Nov 30 | Get stronger, more energy | Morning exercise daily 08:00 due 09:00 · Gym Mon/Wed/Fri 18:00 1 h |
| Morning routine | Nov 1 → Jan 31 | Start the day ready | Shower daily · Vitamins daily by 12:00 · Water daily ×4 |

A uni term is just a routine whose period is the term. Next term → a new routine.

---

## Routine entry

**A routine entry is a recipe: what to do + when it repeats.** It's not a task itself — it produces one task per occurrence.

### Fields

**What** — copied into each task it produces:

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | e.g. "Gym", "Calculus (Mon)" |
| `notes` | no | |
| `tags` | no | Several allowed |
| `duration` | no | Minutes |
| `protocol` | no | One or none |

**When** — the repetition rule:

| Field | Meaning |
|---|---|
| `freq` | `daily` / `weekly` / `monthly` / `yearly` |
| `interval` | every N (days / weeks / months / years), **counted from the routine's start date**. Default 1 |
| `weekdays` | weekly: which days, **1 = Mon … 7 = Sun** |
| `month_day` / `nth_weekday` | monthly: "the 1st", or "last Friday" |
| `month` + `day` | yearly: e.g. 14 March |
| `times` **or** `count` | what each matching day gets (see below) |

**Times** — one or more fixed copies per day, each with:
- `start_time?` — when it happens (→ timed)
- `due_time?` — when it must be done by
- neither → a floating copy for that day

**Count** — N floating copies per day ("water 4 times"), with an optional shared `due_time`. "2/4" = 2 of the 4 copies done.

An entry uses `times` **or** `count`, never both.

### What one entry can and can't do

| ✅ One entry | Example |
|---|---|
| Several days, same time | Gym Mon/Wed/Fri at 18:00 |
| Several times, same days | Pills daily at 08:00 / 14:00 / 20:00 |
| A count per day | Water 4 times a day |
| Every N days/weeks, monthly, yearly | Every other day, rent on the 1st |

| ❌ Needs two entries | Why |
|---|---|
| Calculus Mon 09:00 **and** Thu 16:00 | Different times on different days → two entries in the same routine |

**Rule of thumb:** same times on every matching day → one entry. Different times per day → separate entries, grouped by the routine.

### How tasks are produced
**An entry is a blueprint — never a task itself.** Like a stamp: every time you look at a day, the app checks every entry and stamps that day where it fits.

| | Entry | Task |
|---|---|---|
| What it is | The rule: "on these days, do this" | One actual time you do it |
| Shows in Todo / Calendar | never | yes |
| Ticked / missed / cancelled | no | yes |
| Changing it | affects all its tasks from today on | affects only that task |

#### The 4 questions, for any day
A day gets an entry's tasks only if all four pass:

| # | Question | Example — "Gym" (Mon/Wed/Fri 18:00) on Wed 5 Nov |
|---|---|---|
| 1 | Is the **routine active** that day? | Exercise plan, Sep 1 → Nov 30 ✅ |
| 2 | Does **this version of the entry** apply that day? (changes apply from their date on) | no changes yet ✅ |
| 3 | Does the day **match the rule**? | weekly, Wed is one of its days ✅ |
| 4 | **How many** tasks does it get? | 1 time (18:00) → 1 task |

Tue 4 Nov fails question 3 → no Gym task. Dec 1 fails question 1 → no Gym task.

#### Question 3 — matching the rule
"Every N" counts from the **routine's start date**. Example routine starting Mon Sep 1:

| Rule | Matches |
|---|---|
| Daily | Sep 1, 2, 3, … |
| Every 2 days | Sep 1, 3, 5, … |
| Weekly Mon/Wed/Fri | Sep 1, 3, 5, 8, … |
| Every 2 weeks, Mon | Sep 1, 15, 29, … |
| Monthly, the 1st | Sep 1, Oct 1, Nov 1 |
| Monthly, last Friday | Sep 26, Oct 31, Nov 28 |
| Yearly, 14 March | 14 Mar |

**Edge rules**
- **"The 31st"** (or 29th/30th) in a month that doesn't have it → the **last day** of that month.
- **"29 Feb" yearly** in a non-leap year → **28 Feb**.

#### Question 4 — how many tasks
| The entry has | The day gets | Example |
|---|---|---|
| 1 time | 1 task | Gym 18:00 |
| several times | 1 task per time | Pills 08:00 / 14:00 / 20:00 → 3 tasks |
| a count | N floating tasks | Water ×4 → 4 tasks |
| no times | 1 floating task | Shower → 1 task "sometime today" |

#### What each task gets
```
ENTRY (blueprint)                      TASK for Wed 5 Nov
─────────────────                      ──────────────────
title     "Gym"              ───────▶  title            "Gym"
notes     "Leg day on Fri"   ───────▶  notes            "Leg day on Fri"
tags      health             ───────▶  tags             health
duration  60 min             ───────▶  duration         60 min
protocol  "Gym warm-up"      ───────▶  protocol         "Gym warm-up"
time      18:00              ───────▶  start            Wed 5 Nov 18:00
                                       occurrence_date  Wed 5 Nov   ← its original day
                                       occurrence_slot  1           ← 1st copy of the day
                                       state            not done
```

**Entry + occurrence date + slot = the task's identity.** "Gym, Wed 5 Nov, copy 1" can only ever exist once.

#### Saved or not
- **Looking** at a day produces its tasks fresh from the blueprints — nothing is stored in advance, no background jobs. That's how the calendar shows the whole routine period instantly, as far as you scroll.
- **Touching** a task (tick, cancel, move, edit) saves it. From then on, that saved version is shown instead of the fresh one.
- **Never touched** → never saved; once its time runs out it shows as **missed**.

```
Routine active? → Entry version applies? → Day matches rule? → N tasks
   → copy fields from the blueprint + date + time
   → already saved? show the saved one : show the fresh one
```

### Changing an entry mid-routine
Changes apply **from today on**. Past tasks keep what they were (time, duration, title…), so history stays true.
- e.g. Gym moves from 18:00 to 19:00 on Nov 10 → every Gym task from Nov 10 is at 19:00; before Nov 10 they stay at 18:00.
- Tasks after today that you already touched (moved, noted, cancelled) keep your changes.

### Removing an entry
Its tasks stop from today on. Past tasks stay as history.

### Rules / validation
- `title` required.
- `interval` ≥ 1.
- Weekly needs at least one weekday (1–7, no duplicates).
- `times` **or** `count`, not both. `count` ≥ 1.
- A time's `due_time` can't be before its `start_time` (no crossing midnight).

---

## Protocol

**A protocol is a list of steps — the way to do a task.** It's just there so you remember things. You read it and follow it yourself; the app doesn't run it, time it, or check steps off. **The task is what gets done.**

### Fields

| Field | Required | Meaning |
|---|---|---|
| `title` | yes | Name, e.g. "Shower" |
| `steps` | yes | Ordered list of strings |

- A step is **just a string**.
- **Shared**: one protocol can be used by several tasks and entries ("Morning shower" and "Shower after gym"). Editing it updates it everywhere.
- Used by one-off tasks and by routine entries (their tasks inherit it).
- Shown when you open a task.

### Example — Shower

1. Get the drier and clothes, go to the bathroom
2. Turn on the warm water, wait 2 min
3. Open the shower, make sure the temperature is right
4. Pick a playlist (≈ 4 songs) or a video if washing hair
5. Wet hair
6. Shampoo if needed
7. Rinse head again
8. Soap body, rinse body
9. Wash genitals, butt, ears and neck
10. Face cleanser for 2 min
11. Rinse full body again
12. Close the shower, apply leave-in conditioner
13. Dry body with the towel, then dry ears
14. Put on headphones, pick a 10 min video, dry hair
15. Get dressed
16. Dirty clothes in the bin, drier back in its place

---

## Not included (on purpose)
- Repeating tasks outside a routine
- Routines without an end date
- One-off tasks inside a routine
- Running/timing a protocol, ticking individual steps, step types (wait / choice / optional — just written in the step text)
- Objectives as their own thing, measured goals
- "X days after I last did it", crossing midnight
