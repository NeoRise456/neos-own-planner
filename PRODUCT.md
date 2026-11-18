# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

Desktop app for Windows built with Tauri 2: the UI is a React web app in WebView2 (Chromium), in a custom frameless window. Version 0.1 (the first working desktop version) is done. An Android app (React Native) with sync between devices comes next, a web version later; this record covers the product on every platform.

## Users

Built for its author first, for daily personal planning on a Windows PC, and meant to become a product other people use later (Android with sync is next, web after it). Design for a stranger opening it for the first time, not only for the author.

The example routines in the docs and mock data ("Uni — Term 1", "Exercise plan", "Morning routine", the Shower protocol) are illustrations of what the product can hold, not the author's real content.

## Product Purpose

An extended todo app that is easy to use and lets you set up recurring tasks for everything in your life. Success: someone runs their day from the Todo view, plans their week in the Calendar, and keeps the repeating parts of life (classes, exercise, daily habits) in routines without the app getting in the way.

## Positioning

**The Task is the minimal unit.** Everything the app shows is made of tasks: a single real-life action that is done, not done, missed or cancelled. There are no separate events, habits or chores; they are tasks with different fields filled in. A task never repeats; repetition exists only inside routines, whose entries produce one task per occurrence.

## Operating Context

- Views: Todo (today by default, day by day), Calendar (week and month), Routines, Protocols, Settings.
- Daily loop: open Todo, tick tasks, add quick one-offs, open a task to see its protocol and routine.
- Planning loop: Calendar for the week; Routines to set up or end the repeating parts of life.
- Desktop-first, one device for now. Phase 6 fixes what daily use of v0.1 turned up and adds tray, global quick-add shortcut and window state; phase 7 adds the Android app and sync.

## Capabilities and Constraints

- **Task**: title (only required field), notes, tags (several), duration, start date/time, due date/time, one protocol. Kind (anytime / floating / timed) and state are worked out, never stored.
- **States**: not done, done, missed, cancelled. No "overdue" or "late" state. A missed task can still be ticked ("Done now / Done on time / Pick a time").
- **Routine**: entries + purpose (text only) + required start and end date. Every routine ends. Ending is not cancelling. Restart = duplicate. Consistency = done ÷ (done + missed).
- **Routine entry**: a blueprint (daily / weekly / monthly / yearly, every N, times or a count per day); changes apply from today on.
- **Protocol**: a shared, ordered list of plain-text steps; a reminder, never run, timed or checked off.
- **Settings**: time zone (UTC offset), which moves "now", never the tasks' times.
- Definitions live in `docs/PLAN.md`, `docs/TASK.md` and `docs/SYSTEMS.md`; they win over anything here.
- Current state: v0.1, the desktop app on real data (tasks, tags, routines, protocols). Rules live in `packages/core`, data in SQLite on the device through PowerSync, synced later through a self-hosted server (phase 7).
- **Planned, undecided:** journaling. Its shape and how it relates to tasks are not designed yet; do not invent it.
- Not now: reminders/notifications, backup/export, priority, subtasks.

## Brand Commitments

- Name: **planner** (lowercase in the sidebar wordmark).
- Logo: a dot-matrix "P" (5×7 grid of square dots) on black. Files: `design/brand/planner-logo.png` (original), `design/brand/planner-logo.svg` (vector). App icons are generated from the SVG.
- Voice (from `design/DESIGN.md` §4): plain sentence case, short. No exclamation marks or emoji. **Missed is a fact, never a guilt trip.**

## Evidence on Hand

- Product definitions: `docs/PLAN.md`, `docs/TASK.md`, `docs/SYSTEMS.md`.
- Design handoff: `design/DESIGN.md`, `design/tokens.css`, reference screens `design/screens/*.dc.html` (visual reference, not runnable code). The original handoff zip is kept outside the repo.
- No real users, testimonials, usage numbers or press exist. Never fabricate them.

## Product Principles

1. **One unit.** Everything is a task and every task works the same way, whatever its origin.
2. **Easy first.** Adding and ticking a task must stay fast; power (routines, protocols) never slows the basic todo loop.
3. **Repetition is deliberate.** Things repeat only through routines, and every routine has an end.
4. **Facts, not guilt.** Missed and cancelled are shown plainly and never punished.
5. **History stays true.** Changes apply from today on; what happened stays as it happened.

## Accessibility & Inclusion

Target WCAG 2.2 AA (from `design/DESIGN.md` §5): text contrast at least 4.5:1 on black (`#6B6B6B` only for faint meta and placeholders), real buttons/links/inputs with labels, `aria-label` on icon-only buttons, decorative glyphs `aria-hidden`, a 2px white focus ring on everything focusable, and `prefers-reduced-motion` respected.
