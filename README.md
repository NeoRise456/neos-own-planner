# neos-own-planner

A personal planner where everything is a task: one-off tasks, routines that repeat them, and protocols that say how to do them. Desktop (Windows, Tauri 2) first.

pnpm monorepo, laid out as in `docs/PLAN.md` §8.

```
neos-own-planner/
  docs/                PLAN.md (architecture), TASK.md, SYSTEMS.md (product rules)
  design/              the design handoff (DESIGN.md, tokens.css, screens/*.dc.html)
  packages/core/       business rules — empty for now (phase 1)
  apps/desktop/        Tauri 2 + React + TypeScript + Vite
    src/
      routes/          TanStack Router file routes: todo, calendar, routines/$id, protocols/$id, settings, components
      components/ui/   base components from design/screens/00-components + 02-tiles
      components/app/  screen pieces: sidebar, task row + panel, dialogs
      stores/ui.ts     Zustand UI state (open panel, selected day/week, time zone)
      mock/            TEMPORARY demo data + in-memory store (no rules, nothing saved)
      styles/          tokens.css (from design/) + Tailwind
    src-tauri/         Rust shell, no commands yet
```

## Run

```
pnpm install
pnpm dev          # desktop window (pnpm tauri dev in apps/desktop)
pnpm dev:web      # same UI in the browser: http://localhost:1420
pnpm build        # vite build + type-check
```

## What's interactive (all on mock data)

| Screen | Try |
|---|---|
| **Todo** | tick / untick · Water ticks one copy at a time (2/4 → 3/4 → done) · tick the missed task → *Done now / on time / Pick a time* · click a title → task panel (Done/Undo, Move, Edit, Cancel/Uncancel, protocol steps, routine link) · Done and Cancelled sections fold · quick-add (Enter) · ‹ Today › (other days are empty) |
| **Calendar** | ‹ Today › weeks · click blocks to select · now line · Week / Month (click a day in Month → its week) |
| **Routines** | pick routines in the sidebar · Add entry / click an entry (form dialog) · Edit · Change end date · Duplicate · Delete (with warning) · New routine |
| **Protocols** | pick in the sidebar · add a step (Enter) · hover a step → remove (Undo in the toast) · New protocol |
| **Settings** | time zone (moves the sidebar clock and the calendar now line) · fold defaults · link to the component sheet |
| **/components** | every base component, clickable |

**Not in the design, built from its parts** (check these with an eye for whether they feel right):
dialogs, the tile "…" menu, the late-tick options, the Month view, Settings.

Restarting resets everything — there is no storage yet.
