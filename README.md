# neos-own-planner

An easy-to-use planner where everything you do is a **task**, and anything in your life that repeats can be set up once and left to run.

It's an extended todo app. On top of a plain todo list it adds **routines** (the repeating parts of life: classes, exercise, daily habits) and **protocols** (the steps for doing something). Journaling is planned.

> **Status:** early. The desktop UI is built and clickable, but it runs on mock data: nothing is saved yet and the product rules aren't implemented. See [Roadmap](#roadmap).

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

- You **end** a routine to stop it, which keeps its history. You **duplicate** it to start again.
- It tracks one number, **consistency** = done ÷ (done + missed).

### Routine entry: the blueprint
A recipe inside a routine: what to do and when it repeats. Examples:
- "Gym, Mon/Wed/Fri at 18:00, 1 h"
- "Water, 4 times a day"

An entry produces **one task per occurrence**. Changes to an entry apply from today on, so history stays true.

→ [`docs/SYSTEMS.md`](docs/SYSTEMS.md)

### Protocol: how to do it
An ordered list of plain-text steps ("Shower": 16 steps). One protocol can be shared by many tasks and entries. It's just a reminder: the app doesn't time it or check steps off.

### Time zone
A setting that moves "now": the calendar's now line, which day is today, and when time runs out. It never changes the times you gave your tasks.

## Views

- **Todo**: today by default, day by day. Its sections are Missed, Scheduled, During the day and Anytime, plus collapsible Done and Cancelled lists.
- **Calendar**: week and month. Timed tasks show as blocks, with a "now" line and deadlines marked.
- **Routines**: purpose, period, entries and consistency.
- **Protocols**: the steps, and where each protocol is used.
- **Settings**: the time zone.

## Run it locally

This is a **pnpm monorepo**, built so that desktop, web and mobile can share the same rules (`packages/core`). **Right now only the desktop app exists**, and it targets **Windows**.

### Prerequisites
- [Node.js](https://nodejs.org) LTS and [pnpm](https://pnpm.io) 10 (`npm i -g pnpm`)
- [Rust](https://rustup.rs) (stable, via rustup)
- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), with the "Desktop development with C++" workload
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
| `pnpm check` | Build every app and type-check every package |

Commands are named `<task>:<app>`, one pair per platform. When web and mobile exist they'll get `dev:web` / `build:web` and `dev:mobile` / `build:mobile`.

### What to try (all mock data)

| Screen | Try |
|---|---|
| **Todo** | tick / untick · Water ticks one copy at a time (2/4 → 3/4 → done) · tick the missed task → *Done now / on time / Pick a time* · click a title → task panel (Done/Undo, Move, Edit, Cancel, protocol steps, routine link) · quick-add (Enter) · ‹ Today › (other days are empty) |
| **Calendar** | ‹ Today › weeks · click blocks to select · now line · Week / Month (click a day in Month → its week) |
| **Routines** | pick routines in the sidebar · add or click an entry · Edit · Change end date · Duplicate · Delete (with warning) · New routine |
| **Protocols** | pick in the sidebar · add a step (Enter) · hover a step → remove (Undo in the toast) · New protocol |
| **Settings** | time zone (moves the sidebar clock and the calendar now line) · list defaults · link to the component sheet |
| **/components** | every base component, clickable |

Restarting resets everything; there is no storage yet.

## Project structure

```
neos-own-planner/
  docs/                PLAN.md (architecture), TASK.md, SYSTEMS.md (product rules)
  design/              the design handoff (DESIGN.md, tokens.css, screens/), brand/ (logo)
  PRODUCT.md           product summary for design reviews
  DESIGN.md            the design system as built
  packages/
    core/              the business rules, shared by every app (empty for now)
  apps/
    desktop/           Tauri 2 + React + TypeScript + Vite
      src/
        routes/        TanStack Router pages: todo, calendar, routines, protocols, settings
        components/    ui/ (base components) and app/ (sidebar, task row and panel, dialogs)
        stores/        UI state (Zustand)
        mock/          TEMPORARY demo data and in-memory store
        styles/        design tokens + Tailwind CSS 4
      src-tauri/       Rust side (window, icons, permissions; no commands yet)
```

**Stack:** Tauri 2 (Rust + WebView2), React 19, TypeScript, Vite, TanStack Router, Tailwind CSS 4, Radix UI, Zustand, date-fns. Later: SQLite through SeaORM.

## Roadmap

Desktop first (from [`docs/PLAN.md`](docs/PLAN.md) §13):

1. **UI on mock data**: the whole desktop UI, clickable (← we are here)
2. **Core rules**: everything in TASK.md and SYSTEMS.md as tested TypeScript in `packages/core`
3. **Data layer**: SQLite + SeaORM in Rust, so tasks survive a restart
4. **Todo**, then **Calendar**, then **Routines & Protocols** on real data
5. **Desktop extras**: tray icon, global quick-add shortcut, remembered window position

Later: journaling, sync and login, then Android and web.
