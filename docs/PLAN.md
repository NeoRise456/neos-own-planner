# Planner — Full Plan (v7)

> **Definitions (what we need, no technology):**
> - [TASK.md](TASK.md) — the Task: fields, kinds, states, time-runs-out rules, ticking, moving, cancelling
> - [SYSTEMS.md](SYSTEMS.md) — Routines, Routine entries, Protocols

## 1. Core idea
**One kind of thing — the Task: a single real-life action that's done, not done, missed or cancelled.**

- **Tasks never repeat.** Repetition only exists inside **routines**, whose **routine entries** produce one task per occurrence.
- **Every task works the same way**, whatever its origin, on every platform.

Views: **Todo**, **Calendar**, **Routines**, **Protocols**, **Settings** (see section 9).

## 2. Current phase
**Desktop only (Windows), one device.** Defining the desktop app — windows, screens, components, interactions — explanation first, no building yet.

Not now: sync / conflicts, reminders & notifications, backup & export.

---

# Architectural decisions

## 3. Platforms

| When | Platform | Tech |
|---|---|---|
| **Now** | **Desktop (Windows)** | **Tauri 2** + React + TypeScript + Rust |
| Later | Android | React Native (Expo), APK |
| Later | Web | React + a server |
| Later | Sync + login | Own server (decide later) |

## 4. Desktop shell — Tauri 2

| Decision | Why |
|---|---|
| **Tauri 2.x stable** (2.12 as of 2026-11), not the 3.0 alpha | Production-ready |
| Window = Windows' **WebView2** | Small, light app; same engine as Edge (Chromium) |
| Backend = **Rust** | Tauri's core process — and the data layer (section 6) |
| Bridge = **commands** (`#[tauri::command]`) called with `invoke` | The UI calls named Rust functions |
| Types shared Rust → TS with **tauri-specta** | TypeScript bindings generated from the Rust commands and structs — no hand-written duplicates |
| Security = **capabilities** (JSON, deny by default) | The UI can only call what's allowed |

> Electron was the previous choice (one language, Node backend). Kept as the fallback if Tauri gets in the way.

## 5. Who does what — the three layers

```
┌──────────────────────────────────────────────────────────┐
│ WEBVIEW — TypeScript                                     │
│   React UI            screens & components               │
│   core                ALL the rules (TASK.md, SYSTEMS.md)│
│   repositories        the only way to reach data         │
│        │  generated bindings (tauri-specta)              │
└────────┼─────────────────────────────────────────────────┘
         │ invoke("list_tasks_between", …)
┌────────┼─────────────────────────────────────────────────┐
│ RUST — Tauri core process                                │
│   commands            one per use-case, thin             │
│   services            SeaORM queries & writes            │
│   entity              SeaORM entities (= tables)         │
│   dto                 API structs sent to TS (specta)    │
│   migration           sea-orm-migration, run at startup  │
│   state               DatabaseConnection                 │
└────────┼─────────────────────────────────────────────────┘
         ▼
     SQLite file (app data folder)
```

| Layer | Language | Responsible for | Not responsible for |
|---|---|---|---|
| **UI** | TS + React | Showing things, user input | Rules, data access |
| **core** | TS | **Business rules:** validation, kinds, states, time-runs-out, routine expansion, consistency, view queries | Storage |
| **Repositories** | TS | One interface for data (`tasks.listBetween`, `tasks.tick`…), calls the generated commands | Rules |
| **Commands** | Rust | Receive a request, call a service, return a DTO or a typed error | Business rules |
| **Services** | Rust + SeaORM | Reading/writing SQLite through entities, transactions | Business rules |
| **SQLite schema** | SQL | **Data integrity:** foreign keys, unique occurrence, done/cancelled exclusive, required fields | Business rules |

**Principles**
- **Rules live only in `core` (TypeScript)** — one copy, reused later by Android and web.
- **Rust is the data layer** — typed, checked, no business rules. When a rule needs data (e.g. "end date ≥ last done task"), Rust provides the query (`last_done_date(routine)`), `core` makes the decision.
- **The database protects itself** with constraints, so even a bug can't store impossible data.
- **No date logic in Rust.** Dates/times are stored as text (`2026-11-09`, `18:00`) and only compared/sorted; all date math is in `core`.
- **Commands are use-cases**, not generic SQL: `create_task`, `tick_task`, `cancel_task`, `list_tasks_between`, `save_routine_copy`…

## 6. Data layer — Rust + SeaORM

| Decision | Detail |
|---|---|
| Database | **SQLite**, one file in the app data folder |
| ORM | **SeaORM** (async, built on sqlx) — entities, `find()`, ActiveModel inserts/updates. Feels like Prisma/TypeORM |
| Version | **SeaORM 2.x** (new entity format) if stable at setup, otherwise 1.1 |
| Entities | One Rust struct per table (`#[sea_orm::model]`, `DeriveEntityModel`) in `entity/` |
| Reading | `Task::find().filter(task::Column::StartDate.between(from, to)).all(&db)` |
| Writing | ActiveModel: `t.done_at = Set(Some(..)); t.update(&db)` |
| Type safety | Columns are Rust values → typos fail at **compile time**. Entities must match migrations (not checked against the live DB) |
| Migrations | **sea-orm-migration** crate (`migration/`), run at app start with `Migrator::up` |
| Connection | One **DatabaseConnection** created at startup, stored in Tauri's managed **state**, injected into commands |
| SQLite settings | foreign keys **on**, WAL journal mode, create-if-missing |
| DTOs | Commands return **DTO structs** (`TaskDto`…) with `serde` + `specta` — not entities. Entities hold ORM details the UI shouldn't see |
| Dates & times | **TEXT**, ISO format — sorts correctly, no timezone conversion in the database |
| Moments (`done_at`…) | TEXT, ISO with the UTC offset in use at that moment |
| IDs | **UUID** (`uuid` crate). Routine copies get an id derived from *entry + date + slot*, so the same occurrence always has the same id |
| Errors | One `AppError` enum (`thiserror` + `serde`) → arrives in TypeScript as a typed error |
| Why SeaORM | Familiar ORM style, async (fits Tauri commands), readable compiler errors. Diesel rejected (sync, very hard errors for a Rust beginner); sqlx alone rejected (raw SQL, wanted an ORM) |

**Rust crates:** `tauri`, `sea-orm` (sqlx-sqlite, runtime-tokio), `sea-orm-migration`, `serde`, `specta` + `tauri-specta`, `uuid`, `thiserror`.

**Trade-off accepted:** the Rust data layer is desktop-only. Android/web will implement the same repository interface in TS; the queries get rewritten there.

## 7. Frontend

| Layer | Tech |
|---|---|
| UI | **React** |
| Build + hot reload | **Vite** (via Tauri CLI) — not Next.js (static export only in Tauri; its server features would be lost) |
| Routing | **TanStack Router** (file-based routes, typed links, layouts) |
| Styling | **Tailwind CSS** |
| Components | **shadcn/ui** (Radix) |
| Icons | **lucide-react** |
| Forms | **React Hook Form** + **Zod** |
| Data loading | **TanStack Query** (calls repositories, refreshes after changes) |
| UI state | **Zustand** (selected day, current view, open panels) |
| Drag & drop | **dnd-kit** |
| Dates | **date-fns** (in `core`) |
| Repetition | **Our own code in `core`** — custom rules, no RRULE library |
| Calendar view | Decide when designing that screen |

## 8. Code structure

```
neos-own-planner/                 pnpm monorepo
  docs/                           PLAN.md, TASK.md, SYSTEMS.md
  packages/
    core/                         TypeScript rules (+ Vitest)
  apps/
    desktop/
      src/                        React UI
        routes/                   TanStack Router pages (todo, calendar, routines…)
        repositories/             data interface → generated bindings
        bindings.ts               generated by tauri-specta (don't edit)
      src-tauri/                  Rust
        src/
          main.rs / lib.rs        app setup: connection, migrations, commands
          commands/               #[tauri::command] functions
          services/               SeaORM reads & writes
          entity/                 SeaORM entities (tables)
          dto/                    structs sent to TS (serde + specta)
          error.rs                AppError
        migration/                sea-orm-migration crate
        capabilities/             permissions (JSON)
        Cargo.toml
        tauri.conf.json
```

## 9. Quality & tooling

| | |
|---|---|
| Rule tests | **Vitest** on `core` — every rule and example in the docs |
| Rust tests | **`cargo test`** on `services` (against a temporary SQLite database) |
| Rust style | **`cargo fmt`** + **`clippy`** |
| TS style | **ESLint** + **Prettier** |
| E2E (later) | WebDriver via `tauri-driver` |

**Tools to install:** Node.js (LTS), pnpm, **Rust (rustup)**, **Microsoft C++ Build Tools**, **sea-orm-cli** (`cargo install sea-orm-cli`), Git, VS Code + rust-analyzer + Tauri extension. WebView2 is already on Windows.

**Confirm exact versions right before setup** (Tauri, SeaORM, tauri-specta and the frontend libraries move fast).

---

# Product

## 10. Logical data model

```
Routine ──< Routine entry ──< Task (routine copies, saved only when touched)
                 │
Protocol ────────┴──────────< Task (one-off or copy)
Tag >──────────────────────< Task, Routine entry   (many-to-many)
```

| Entity | Holds |
|---|---|
| **Task** | title, notes, tags, duration, start date/time, due date/time, protocol, done_at, logged_at, cancelled_at · copies also: routine entry, occurrence date, occurrence slot |
| **Routine** | title, purpose, start date, **end date (required)**, cloned from, lineage |
| **Routine entry** | routine, title, notes, tags, duration, protocol, repetition rule (freq, interval, weekdays / month day / nth weekday / yearly date), times *or* count, the date it applies from |
| **Protocol** | title, steps (ordered strings) |
| **Tag** | name, color |
| **Settings** | time zone (UTC offset) |

**Worked out, never stored:** task kind, task state, time-runs-out moment, untouched routine tasks, routine status, consistency.

**Kept in mind for later sync:** ids two devices can create; each routine occurrence = exactly one task; "last changed" on everything; deletions kept as markers.

## 11. Views

**Todo** (today by default, ← → to move between days)
- **Missed** — one-off tasks whose time ran out, until you tick, cancel or delete them
- **Scheduled** — timed tasks of the day, by time
- **During the day** — floating tasks of the day, by due time ("by 12:00", "by Sun")
- **Anytime** — tasks with no date
- **Done** / **Cancelled** — collapsible
- Missed routine tasks show only on **their** day; past days act as history
- Day total: `Scheduled 3h · Floating 45m` + "+N untimed"; count entries show "Water 2/4"
- Filter by tag / routine; opening a task shows its protocol and routine purpose

**Calendar** (month + week)
- Timed tasks = blocks; **"during the day" strip** for floating tasks; deadlines = markers; **"now" line** (from the time zone setting)
- Routine tasks through the whole routine period
- Done ticked, missed greyed, cancelled struck through, moved show "moved from …"
- Click an empty slot to create a task

**Routines** — list (upcoming / active / ended); purpose, period, entries, consistency; create (can start empty), edit, entries (changes from today on), change end date, duplicate, delete (with warning)

**Protocols** — list, edit steps, shows where each is used

**Settings** — time zone

## 12. Creating & editing
- **Quick-add bar** — title + Enter → one-off task in Anytime
- **Task form** — title, notes, tags, duration, start, due, protocol
- **Routine entry form** — what (title, notes, tags, duration, protocol) + when (freq, interval, days, times or count)
- Ticking after the time ran out: *Done now / Done on time / Pick a time*
- Any task: move, cancel / uncancel, tick / untick, edit, delete

## 13. Build phases (desktop)

| Phase | What | Done when |
|---|---|---|
| **0. Setup** | Install tools; monorepo; Tauri 2 + React + TS + Vite + TanStack Router; Tailwind + shadcn; SeaORM + first migration; tauri-specta bindings; Vitest | Window opens, UI hot reloads, a test command returns data from SQLite |
| **1. Core rules** | Everything in TASK.md / SYSTEMS.md as tested TS logic | Tests cover every rule and example |
| **2. Data layer + one-off tasks** | Entities, migrations, services, commands, DTOs, repositories; create/edit/delete/tick/cancel/move one-off tasks; tags; quick-add | Tasks survive restarting the app |
| **3. Todo view** | Sections, ticking with done_at options, day navigation, history, filters | Usable as your daily todo |
| **4. Calendar view** | Month/week, blocks, during-the-day strip, now line, deadlines, click-to-create | Usable for planning a week |
| **5. Routines & protocols** | Routines, entries, routine tasks in views, touch-to-save, from-today changes, duplicate, consistency; protocols | Your uni & exercise routines live in the app |
| **6. Desktop extras** | Tray, global quick-add shortcut, window-state, desktop-access features | Feels like a real desktop app |

Later: sync + login → Android → web.

## 14. Product decisions
- Task = single action; **never repeats**; same unit everywhere
- States: **not done / done / missed / cancelled** (no overdue, no late)
- Time runs out: due → end of block → end of day (23:59) → never
- Missed tasks can still be ticked; `done_at` editable, `logged_at` automatic
- Dates and times separate → anytime / floating / timed
- **Time zone setting** moves "now", never the tasks' times
- Multiple tags per task (and per routine entry, inherited by its tasks)
- **Repetition only through routines**; routine = entries + purpose + **required end date**; contains only entries
- Routine entry = blueprint; one rule per entry; daily / weekly / monthly / yearly, every N from routine start; "31st" → last day, "29 Feb" → 28 Feb; times or count; changes apply from today on
- Routine tasks worked out on the fly, saved when touched; move / cancel single copies; deleting a copy = cancelling it
- End date can't move earlier than the last done task; ending ≠ cancelling
- Restart = duplicate; delete = wipes history (with warning); consistency = done ÷ (done + missed)
- Protocol = shared list of strings, just a reminder
- Purpose = text only

**Still open:** calendar component (decide when designing that screen)
