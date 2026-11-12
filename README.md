# neos-own-planner

An easy-to-use planner where everything you do is a **task**, and anything in your life that repeats can be set up once and left to run.

It's an extended todo app. On top of a plain todo list it adds **routines** (the repeating parts of life: classes, exercise, daily habits) and **protocols** (the steps for doing something). Journaling is planned.

> **Status:** early. **Todo works on real data**: one-off tasks are saved on your computer and survive restarts. Calendar, Routines and Protocols are still clickable mock-ups. See [Roadmap](#roadmap).

## Why

Most planners split your life into separate kinds of things (events, habits, chores, reminders), each with its own rules. This one has **one unit**, the task, and every task works the same way wherever it comes from. Repetition is deliberate: things only repeat inside a routine, and every routine has an end date, because life changes too much to keep one forever. Missing something is shown as a plain fact, never as a guilt trip.

## Core concepts

The full definitions live in [`docs/`](docs). This is the short version.

### Task: the only thing that gets done
A single real-life action: "Buy milk", "Dentist Thu 15:00", "Gym on Monday". Only the title is required; it can also have notes, tags, a duration, a start and a due date/time, and one protocol.

- **Kind**, worked out from its dates, never chosen:
  - **anytime**: no date ("Buy milk")
  - **floating**: a day but no time ("Reply to email today")
  - **timed**: a start time ("Dentist 15:00")
- **State**: always one of four.
  - **not done**
  - **done**
  - **missed**: its time ran out; you can still tick it later
  - **cancelled**: it won't happen, and it isn't your fault

  There is no "overdue" or "late".
- **A task never repeats.** It is always one action at one point in time.

→ [`docs/TASK.md`](docs/TASK.md)

### Routine: where repetition lives
A container with a **purpose** ("Get stronger and have more energy") and a fixed **period** (start and end date, both required).

Examples: "Exercise plan", "Morning routine", "Uni — Term 1".

- A new routine is a **draft**: set it up freely, nothing shows yet. **Publish** it and its tasks start from that day.
- You **end** a routine to stop it, which keeps its history. You **duplicate** it (into a new draft) to start again.
- It tracks one number, **consistency** = done ÷ (done + missed).

### Routine entry: the blueprint
A recipe inside a routine: what to do and when it repeats. Examples:
- "Gym, Mon/Wed/Fri at 18:00, 1 h"
- "Water, 4 times a day"

An entry produces **one task per occurrence**. Changes to an entry apply from today on, so history stays true.

→ [`docs/SYSTEMS.md`](docs/SYSTEMS.md)

### Protocol: how to do it
An ordered list of plain-text steps ("Shower": 16 steps). One protocol can be shared by many tasks and entries. It's just a reminder: the app doesn't time it or check steps off. It's **active** while a running routine uses it, **past** once only finished routines did, and **unused** otherwise. Past ones can be searched and used again; only unused ones can be deleted.

### Time zone
A setting that moves "now": the calendar's now line, which day is today, and when time runs out. It never changes the times you gave your tasks.

## Views

- **Todo**: today by default, day by day. Its sections are Missed, Scheduled, During the day and Anytime, plus collapsible Done and Cancelled lists.
- **Calendar**: week and month. Timed tasks show as blocks, with a "now" line and deadlines marked.
- **Routines**: purpose, period, entries and consistency.
- **Protocols**: the steps, and where each protocol is used.
- **Settings**: the time zone, list defaults, and your tags (rename, recolor, merge, delete).

## Run it locally

This is a **pnpm monorepo**, built so that desktop, web and mobile can share the same rules (`packages/core`). **Right now only the desktop app exists**, and it targets **Windows**.

### Prerequisites
- [Node.js](https://nodejs.org) LTS and [pnpm](https://pnpm.io) 10 (`npm i -g pnpm`)
- [Rust](https://rustup.rs) (stable, via rustup)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), with the "Desktop development with C++" workload
- [LLVM](https://github.com/llvm/llvm-project/releases) (`winget install LLVM.LLVM`): the PowerSync plugin needs its `libclang` to build
- WebView2 (already part of Windows 10/11)

See Tauri's [prerequisites guide](https://v2.tauri.app/start/prerequisites/) if anything is missing.

### Commands
From the repo root:

```bash
pnpm install
pnpm dev                   # the desktop app (same as dev:desktop)
```

The first `pnpm dev` compiles the Rust side and takes a few minutes; after that it starts in seconds with hot reload.

| Command | What it does |
|---|---|
| `pnpm dev:desktop` | The desktop app in its own window (Tauri) |
| `pnpm dev:desktop:browser` | The same UI in a browser, without Tauri: http://localhost:1420 (no window buttons) |
| `pnpm build:desktop` | Windows installer (`.msi` / `.exe`) in `apps/desktop/src-tauri/target/release/bundle` |
| `pnpm test` | Run every package's tests (the rules in `packages/core`, the repositories in `packages/data`) |
| `pnpm check` | Build every app, type-check every package and run the tests |

Commands are named `<task>:<app>`, one pair per platform. When web and mobile exist they'll get `dev:web` / `build:web` and `dev:mobile` / `build:mobile`.

### What to try

| Screen | Try |
|---|---|
| **Todo** (real) | quick-add (Enter; on a later day it lands on that day) · tick / untick · click a title → task panel: Done/Undo, Move, Edit (notes, tags, start, due, duration), Cancel (Undo in the toast) · on a done task: **Done → Change** its time · Edit → Delete (Undo in the toast) · tag chips → only that tag's tasks · in the panel or Edit, type in **Tags**: it searches your tags (↑ ↓ + Enter), or ends with *Create “…”* · move a task to yesterday → it shows in **Missed** → tick it → *Done now / on time / Pick a time* · ‹ Today › or click the date to jump to any day · restart the app: everything is still there |
| **Calendar** (mock) | ‹ Today › weeks · click blocks to select · now line · Week / Month (click a day in Month → its week) |
| **Routines** (mock) | pick routines in the sidebar · open the draft "Reading habit" → **Publish** · then *Back to draft* or *Delete* (only while nothing is done) · on a running routine: **End today**, Change end date, Duplicate (→ a new draft) · add, edit or remove an entry · New routine (starts as a draft) |
| **Protocols** (mock) | sidebar groups active / unused / past · add a step (Enter) · hover a step → remove (Undo in the toast) · New protocol · Delete (only unused ones) · in an entry's dialog, search protocols (past ones too) and pick one → it becomes active |
| **Settings** | time zone (moves the sidebar clock and the calendar now line) · list defaults · **Tags**: rename, recolor, merge (rename to an existing name), delete (Undo), add · link to the component sheet |
| **/components** | every base component, clickable |

Tasks and tags are saved in a SQLite file: `%APPDATA%\com.neo.planner\planner-dev.db` while developing, `planner.db` in the installed app (separate, so testing never touches your real tasks). Nothing leaves your computer. The mock screens reset when you restart.

## Project structure

```
neos-own-planner/
  docs/                PLAN.md (architecture), TASK.md, SYSTEMS.md (product rules)
  design/              the design handoff (DESIGN.md, tokens.css, screens/), brand/ (logo)
  PRODUCT.md           product summary for design reviews
  DESIGN.md            the design system as built
  packages/
    core/              the business rules, shared by every app (tested with Vitest)
    data/              the database schema and repositories (PowerSync), shared by every app
  apps/
    desktop/           Tauri 2 + React + TypeScript + Vite
      src/
        routes/        TanStack Router pages: todo, calendar, routines, protocols, settings
        components/    ui/ (base components) and app/ (sidebar, task row and panel, dialogs)
        stores/        UI state (Zustand)
        lib/           opening the database, the clock, how a task is shown
        mock/          TEMPORARY demo data for routines, protocols, calendar
        styles/        design tokens + Tailwind CSS 4
      src-tauri/       Rust side (window, icons, permissions, the PowerSync plugin)
```

**Stack:** Tauri 2 (Rust + WebView2), React 19, TypeScript, Vite, TanStack Router, Tailwind CSS 4, Radix UI, Zustand, date-fns. Next: SQLite on the device through the PowerSync Tauri plugin; later, sync through a self-hosted PowerSync server with Postgres and Better Auth ([`docs/PLAN.md`](docs/PLAN.md) §6–7).

## Roadmap

Desktop first (from [`docs/PLAN.md`](docs/PLAN.md) §14):

1. **UI on mock data**: the whole desktop UI, clickable ✅
2. **Core rules**: everything in TASK.md and SYSTEMS.md as tested TypeScript in `packages/core` ✅
3. **Data layer**: SQLite on the device through the PowerSync Tauri plugin (picked in a storage test, phase 1b), local only; one-off tasks and tags are real ✅
4. **Todo** on real data, usable day to day ✅ (← we are here), then **Calendar**, then **Routines & Protocols**
5. **Desktop extras**: tray icon, global quick-add shortcut, remembered window position
6. **Sync & login**: a self-hosted PowerSync server with Postgres and Better Auth

Later: journaling, then Android and web (sharing the same rules and data code).
