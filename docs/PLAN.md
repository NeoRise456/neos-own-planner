# Planner — Full Plan (v8)

> **Definitions (what we need, no technology):**
> - [TASK.md](TASK.md) — the Task: fields, kinds, states, time-runs-out rules, ticking, moving, cancelling
> - [SYSTEMS.md](SYSTEMS.md) — Routines, Routine entries, Protocols

> **v8 (2026-11-11):** the data layer is now **PowerSync** (SQLite on every device, synced later through a self-hosted server), not Rust + SeaORM. Local only first; sync is designed in but switched off (section 7).

## 1. Core idea
**One kind of thing — the Task: a single real-life action that's done, not done, missed or cancelled.**

- **Tasks never repeat.** Repetition only exists inside **routines**, whose **routine entries** produce one task per occurrence.
- **Every task works the same way**, whatever its origin, on every platform.

Views: **Todo**, **Calendar**, **Routines**, **Protocols**, **Settings** (see section 12).

## 2. Current phase
**Desktop only (Windows), one device, local only.** The UI is built on mock data; next come the core rules, then the local data layer.

The data layer is built **sync-ready** (section 7) so turning sync on later needs no data migration.

Not now: sync switched on, login, reminders & notifications, backup & export.

---

# Architectural decisions

## 3. Platforms

| When | Platform | Tech |
|---|---|---|
| **Now** | **Desktop (Windows)** | **Tauri 2** + React + TypeScript (+ a thin Rust shell) |
| Later | Sync + login | **Self-hosted PowerSync** + Postgres + own write API + Better Auth (section 7) |
| Later | Android | React Native (Expo), APK — same `core` and `data` packages |
| Later | Web | React — same `core` and `data` packages |

## 4. Desktop shell — Tauri 2

| Decision | Why |
|---|---|
| **Tauri 2.x stable** (2.12 as of 2026-11), not the 3.0 alpha | Production-ready |
| Window = Windows' **WebView2** | Small, light app; same engine as Edge (Chromium) |
| Rust = **the shell only** | Window, tray, global shortcut, window state, OS features. **Not** the data layer (it moved to TypeScript, section 6) |
| Bridge = **commands** (`#[tauri::command]`) called with `invoke` | Only for desktop features; data never goes through custom commands |
| Security = **capabilities** (JSON, deny by default) | The UI can only call what's allowed |

> Electron was the previous choice (one language, Node backend). Kept as the fallback if Tauri gets in the way.

## 5. Who does what — the layers

```
┌──────────────────────────────────────────────────────────┐
│ WEBVIEW — TypeScript                                     │
│   React UI            screens & components (apps/…)      │
│   core                ALL the rules (packages/core)      │
│   data                repositories + PowerSync schema    │
│                       (packages/data) — the only way     │
│                       to reach data                      │
│   PowerSync client    local SQLite, upload queue,        │
│                       (later) sync                       │
└────────┼─────────────────────────────────────────────────┘
         ▼
     SQLite on the device (app data folder)
         ┊  later, when sync is on (section 7)
         ▼
   PowerSync Service ◀── Postgres ◀── write API (+ Better Auth)
```

| Layer | Where | Responsible for | Not responsible for |
|---|---|---|---|
| **UI** | `apps/*` | Showing things, user input | Rules, data access |
| **core** | `packages/core` | **Business rules:** validation, kinds, states, time-runs-out, routine expansion, consistency, view queries | Storage |
| **data** | `packages/data` | Repositories (`tasks.listBetween`, `tasks.tick`…), the PowerSync schema, (later) the connector that uploads writes | Rules |
| **PowerSync client** | SDK | Local SQLite, live queries, the upload queue, sync | Rules |
| **Rust shell** | `src-tauri` | Window, tray, shortcuts, OS access; hosts the PowerSync plugin (native SQLite) and, later, the sync connector | Rules |

**Principles**
- **Rules live only in `core`** — one copy, shared by desktop, Android and web.
- **`data` is shared too.** Every app uses the same repositories and schema; only the PowerSync SDK package differs per platform (Tauri/web, React Native).
- **Repositories are the only writers.** They call `core` to validate before every write.
- **Integrity without local constraints.** PowerSync's local tables don't carry foreign keys, unique or check constraints, so: `core` validates every write, routine copies get ids that make duplicates impossible (section 6), and **Postgres enforces the constraints on the server** once sync is on.
- **No date logic outside `core`.** Dates/times are stored as text (`2026-11-09`, `18:00`) and only compared/sorted; all date math is in `core`.
- **Repositories are use-cases**, not generic SQL: `createTask`, `tickTask`, `cancelTask`, `listTasksBetween`, `saveRoutineCopy`…

## 6. Data layer — PowerSync client, local only first

| Decision | Detail |
|---|---|
| Database | **SQLite on the device**, owned by the **PowerSync client SDK** |
| Tauri client | **The official PowerSync Tauri plugin** (`@powersync/tauri-plugin` + `tauri-plugin-powersync`, **alpha**), decided by the phase 1b spike (below). A real SQLite file in the app data folder. Fallback: `@powersync/web` in WebView2 — same JS API, so only the open call would change |
| Versions | **Pinned exactly**, npm and crate together (`0.0.6` + `=0.0.6`, released the same day). They're versioned separately (the crate is ahead), and the JS↔Rust protocol may change while alpha — upgrade both on purpose, never automatically |
| File | `planner.db` in `%APPDATA%\com.neo.planner\` for the installed app; the dev build uses `planner-dev.db` there, so testing never touches real data (both builds share the folder). Rust creates the folder at startup — the plugin doesn't |
| Schema | Declared in TypeScript (`packages/data/schema.ts`). Default PowerSync tables (JSON-backed views): **no client migrations** — adding a column = changing the schema. Raw tables only if a real need appears |
| Queries | **Plain SQL with typed mappers** (decided in phase 2): each repository read is a `LiveQuery` = SQL + parameters + a mapper from rows to `@planner/core` objects. No ORM: the Drizzle/Kysely drivers need a newer `@powersync/common` than the plugin pins (2.0.0), and plain SQL keeps the tests on plain SQLite. Writes are plain INSERT / UPDATE / DELETE (PowerSync tables are views: no upserts, no RETURNING), and an update sets **only the columns that changed** |
| Live data | PowerSync **watched queries** through our own hook, **`useLive`** (`@planner/data/react`): a trimmed rewrite of `@powersync/react`'s `useQuery` (Apache-2.0), which we can't install because it needs `@powersync/common` ≥ 2.5. Same design — one store per hook through `useSyncExternalStore`, starts after commit, differential watch so unchanged rows keep their object — without sync streams/suspense; keeps the previous rows while a changed query loads. Views update by themselves when data changes — including, later, changes from other devices. Swap for the official hook once the plugin catches up |
| Local-only mode | Tables are normal synced tables from day one; the app simply never calls `connect()`. Every change waits in the upload queue and is uploaded on the first sign-in. Planner data is small, so the queue's growth is fine. (PowerSync's alternative — local-only tables copied over at sign-in — only if the queue ever gets big) |
| IDs | **UUID** text. Routine copies get an id **derived from entry + date + slot** (UUIDv5), so the same occurrence always has the same id — two offline devices create the *same* row, never a duplicate |
| Dates & times | **TEXT**, ISO format — sorts correctly, no timezone conversion in the database |
| Moments (`done_at`…) | TEXT, ISO with the UTC offset in use at that moment |
| `updated_at` | On every row, UTC, set by the repositories |
| Deletes | Real deletes. PowerSync uploads them as delete operations, so no "deleted" markers are needed |
| Owner | No user column on the device. The server stamps `owner_id` from the login token (section 7) |
| Tags on tasks | A JSON array of tag ids in `tasks.tag_ids` (no join table): last write wins on the whole list, which is fine for one person's tags |
| Errors | Repositories throw one typed `DataError` (`not_found`, `invalid` with the `@planner/core` issues); the UI shows its message in a toast |

**Phase 1b spike — plugin (A) vs web SDK in WebView2 (B), 2026-11-11, Windows 10:**

| | A · Tauri plugin | B · Web SDK |
|---|---|---|
| Survives a hard kill + restart; reopening writes nothing | ✅ | ✅ |
| **Installed (release) build sees the same data** | ✅ same file | ❌ starts empty — data belongs to the WebView origin (`tauri.localhost` vs dev's `localhost:1420`); a changed origin would silently lose everything |
| Where | real `.db` file (opened fine with Python's sqlite3, integrity ok) | LevelDB inside the WebView profile |
| Open | 51–234 ms | 137–459 ms |
| 1 write / read 1,001 rows | 8 ms / 9 ms | 8 ms / 10 ms |
| 1,000 writes, one call each (release) | 1,167 ms (~1 ms per bridge call — use batches for bulk) | 270 ms |
| Needs | LLVM to build | — |
| Gotchas found | npm/crate versions out of step; doesn't create its folder | a SharedWorker hung after reload → must use `enableMultiTabs: false` |

**Why it changed from Rust + SeaORM:** PowerSync owns the local SQLite database, so a Rust data layer would have been rewritten when sync arrived. Doing it in TypeScript now also means Android and web reuse it instead of rewriting the queries.

## 7. Sync & accounts (later — designed now, switched off)

```
 Device: SQLite (PowerSync client) ──── reads: streamed rows ◀── PowerSync Service ◀─ logical replication ─┐
        │ upload queue                                                                                   │
        └──── writes: uploadData() ──▶ write API (TS, + Better Auth) ──▶ Postgres ─────────────────────────┘
```

| Piece | Tech | Job |
|---|---|---|
| **PowerSync Service** | Open Edition, **Apache-2.0** (since 2026-11-03), Docker image `journeyapps/powersync-service` | Reads changes from Postgres, streams each user's rows to their devices |
| **Postgres** | One instance, logical replication on | Source of truth; also PowerSync's own storage (a second database) |
| **Write API** | TypeScript (e.g. Hono), `apps/server` | Receives uploads, checks ownership, applies the conflict rules, writes Postgres. Must reply only after the commit, and handle the same upload twice safely |
| **Desktop connector** | Rust, in `src-tauri` | The Tauri plugin only allows `connect()` from Rust, so on desktop the small piece that fetches the token and uploads the queue to the write API is Rust (the plugin's `BackendConnector`). Android/web use the same API in TS |
| **Auth** | **Better Auth** inside the write API, with its JWT plugin | Accounts and sessions in our Postgres. PowerSync verifies its tokens through the JWKS endpoint. Clerk or Supabase Auth could replace it — PowerSync only needs a JWKS |
| **Hosting** | One VPS (2–4 GB RAM), Docker Compose | Software is free; the only cost is the VPS (~10–20/month) |
| **Desktop login** | System browser + deep link back to the app (OAuth with PKCE) | Google blocks sign-in inside embedded webviews. Tokens in the OS credential store, never in the database |

**Read policy — Sync Streams** (config, not code; the user id comes from the token's `sub`):
```yaml
streams:
  auto_subscribe: true
  my_tasks:
    query: SELECT * FROM tasks WHERE owner_id = auth.user_id()
  my_routines:
    query: SELECT * FROM routines WHERE owner_id = auth.user_id()
  # … one line per table
```
A device never chooses its own filter, so it can't receive someone else's rows.

**Write policy — the write API:**
- **`owner_id` comes from the token**, never from the device. A write to a row owned by someone else is rejected.
- **Last write wins per field** — devices upload only the changed columns (PATCH).
- **Deletes win** — an edit to a row that was deleted elsewhere is dropped.
- Count entries ("Water, 4 times a day") already make one task per slot, so ticks on different slots never collide.
- **Rejected writes** are dropped; once the queue is empty, the device goes back to the server's version by itself. Nothing gets stuck.
- PowerSync never overwrites a device's changes while they're still waiting to upload.

**Accounts:** one local database file per signed-in account; signing up uploads what the device already holds. The app stays fully usable without an account.

**Before switching sync on:** decide the conflict rule for *done on one device, cancelled on another* (TASK.md); let the write API accept a task coming back with the same id right after its delete (that's how Undo-delete works); mirror the constraints in Postgres (foreign keys, done/cancelled exclusive, required fields); write multi-device tests.

**Considered and rejected (research, 2026-11-11):**
- **ElectricSQL + TanStack DB** — reads only; a proxy route per table for auth; offline outbox and on-device persistence are new (data-loss bugs fixed in 2026); Electric was acquired by Databricks and Electric Cloud is winding down.
- **Own push/pull sync** — no dependency, but ~2–4 weeks plus all the edge cases (clock drift, cursor gaps, retries, migrations) are ours. The fallback if PowerSync ever fails us.
- **Evolu** — good offline/E2E design, but its own key-based identity instead of accounts; small team.
- **Turso Sync** — pre-1.0; the self-hosted sync server is for development only and has no auth.
- **Zero** — no offline writes. **sqlite.ai** — needs their cloud. **cr-sqlite, Replicache, Triplit** — unmaintained or absorbed. **CRDTs (Automerge, Yjs, Loro)** — built for documents/text; maybe later for the journal editor.

**Risks:** the Tauri plugin is alpha (fallback: the web SDK in WebView2); the free edition gets security-patched images later than the paid one; we depend on one company's service — mitigated by the Apache-2.0 licence.

## 8. Frontend

| Layer | Tech |
|---|---|
| UI | **React** |
| Build + hot reload | **Vite** (via Tauri CLI) — not Next.js (static export only in Tauri; its server features would be lost) |
| Routing | **TanStack Router** (file-based routes, typed links, layouts) |
| Styling | **Tailwind CSS** |
| Components | **shadcn/ui** (Radix) |
| Icons | **lucide-react** |
| Forms | **React Hook Form** + **Zod** |
| Data loading | **PowerSync watched queries** through the repositories (`useLive`, section 6). The database opens before the first screen; the plain-browser preview has none and says so |
| UI state | **Zustand** (selected day, current view, open panels) |
| Drag & drop | **dnd-kit** |
| Dates | **Own small helpers in `core`** (`dates.ts`): plain `2026-11-09` / `18:00` text and day numbers, so no time zone or DST can leak into the rules. **date-fns** only for display formatting in the apps |
| Repetition | **Our own code in `core`** — custom rules, no RRULE library |
| Calendar view | Decide when designing that screen |

## 9. Code structure

```
neos-own-planner/                 pnpm monorepo
  docs/                           PLAN.md, TASK.md, SYSTEMS.md
  packages/
    core/                         TypeScript rules (+ Vitest)
    data/                         PowerSync schema, repositories, (later) connector
  apps/
    desktop/
      src/                        React UI
        routes/                   TanStack Router pages (todo, calendar, routines…)
        components/
      src-tauri/                  Rust shell: window, tray, shortcuts, capabilities,
                                  the PowerSync plugin (+ the sync connector in phase 7)
    server/                       (later) write API + Better Auth
  infra/                          (later) docker-compose: postgres, powersync-service, server;
                                  sync streams config
```

## 10. Quality & tooling

| | |
|---|---|
| Rule tests | **Vitest** on `core` — every rule and example in the docs |
| Data tests | **Vitest** on `data` — repositories against an in-memory **plain SQLite** (`node:sqlite`) with the same tables and columns as the PowerSync schema, behind the same `Db` interface the repositories use |
| Rust style | **`cargo fmt`** + **`clippy`** (shell only) |
| TS style | **ESLint** + **Prettier** |
| E2E (later) | WebDriver via `tauri-driver` |
| Sync tests (later) | Two clients against a local Docker stack: offline edits, conflicts, rejected writes |

**Tools to install:** Node.js (LTS), pnpm, **Rust (rustup)**, **Microsoft C++ Build Tools**, **LLVM** (`winget install LLVM.LLVM` — the PowerSync plugin needs its libclang to build), Git, VS Code + rust-analyzer + Tauri extension. WebView2 is already on Windows. Later, for sync: **Docker**.

**Confirm exact versions right before setup** (Tauri, PowerSync SDKs and the frontend libraries move fast).

---

# Product

## 11. Logical data model

```
Routine ──< Routine entry ──< Task (routine copies, saved only when touched)
                 │
Protocol ────────┴──────────< Task (one-off or copy)
Tag >──────────────────────< Task, Routine entry   (many-to-many)
```

| Entity | Holds |
|---|---|
| **Task** | title, notes, tags, duration, start date/time, due date/time, protocol, done_at, logged_at, cancelled_at · copies also: routine entry, occurrence date, occurrence slot |
| **Routine** | title, purpose, start date, **end date (required)**, cloned from, lineage, published at (empty = draft) |
| **Routine entry** | routine, title, notes, tags, duration, protocol, repetition rule (freq, interval, weekdays / month day / nth weekday / yearly date), times *or* count, the date it applies from |
| **Protocol** | title, steps (ordered strings) |
| **Tag** | name, color |
| **Settings** | time zone (UTC offset) |

**Worked out, never stored:** task kind, task state, time-runs-out moment, untouched routine tasks, routine status, consistency.

**Sync-ready (section 7):** UUID ids; routine copies' ids derived from entry + date + slot; `updated_at` (UTC) on every row; `owner_id` only on the server.

## 12. Views

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

**Routines** — list (drafts / upcoming / active / ended); purpose, period, entries, consistency; create (starts as an empty draft), **publish**, edit, entries (free in a draft; from today on once published), change end date, **End** (ends today), duplicate (→ a draft), back to draft or delete (drafts, or published with nothing done yet — with warning)

**Protocols** — list grouped active / unused / past; edit steps; shows where each is used; search (past ones included) to reuse one; delete only unused ones

**Settings** — time zone

## 13. Creating & editing
- **Quick-add bar** — title + Enter → one-off task in Anytime
- **Task form** — title, notes, tags, duration, start, due, protocol
- **Routine entry form** — what (title, notes, tags, duration, protocol) + when (freq, interval, days, times or count)
- Ticking after the time ran out: *Done now / Done on time / Pick a time*
- Any task: move, cancel / uncancel, tick / untick, edit, delete

## 14. Build phases (desktop)

| Phase | What | Done when |
|---|---|---|
| **0. Setup + UI** ✅ | Monorepo; Tauri 2 + React + TS + Vite + TanStack Router; Tailwind + shadcn; the whole UI on mock data | Window opens, every screen clickable |
| **1. Core rules** ✅ | Everything in TASK.md / SYSTEMS.md as tested TS logic | Tests cover every rule and example |
| **1b. Storage spike** ✅ | PowerSync in Tauri: the plugin vs the web SDK in WebView2 | A row survives restart and an app update; choice written in section 6 → **the plugin** |
| **2. Data layer + one-off tasks** ✅ | `packages/data`: schema, repositories, local-only PowerSync; create/edit/delete/tick/cancel/move one-off tasks; tags; quick-add | Tasks survive restarting the app |
| **3. Todo view** ✅ | Sections, ticking with done_at options, day navigation (‹ › and a calendar on the date), history (past days; editable done time), tag filter (no routine filter: routine copies carry the routine's tags, so the tag filter covers them) · tags managed in Settings, searchable tag box | Usable as your daily todo |
| **4. Calendar view** | Month/week, blocks, during-the-day strip, now line, deadlines, click-to-create | Usable for planning a week |
| **5. Routines & protocols** | Routines, entries, routine tasks in views, touch-to-save, from-today changes, duplicate, consistency; protocols | Your uni & exercise routines live in the app |
| **6. Desktop extras** | Tray, global quick-add shortcut, window-state, desktop-access features | Feels like a real desktop app |
| **7. Sync & login** | `apps/server` (write API + Better Auth), `infra/` (Postgres + PowerSync Service), sync streams, desktop login | A task ticked on one device shows on another; offline edits upload on reconnect |

Later: Android → web (both reuse `core` and `data`).

## 15. Product decisions
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
- **Draft → publish**: a routine produces no tasks until published; tasks start from the publish day (or its start), never backfilled
- End date can't move earlier than the last done task; ending ≠ cancelling; **End** = ends today
- Restart = duplicate (→ a draft); delete = drafts, or published with nothing done (wipes it, with warning) — otherwise end it; consistency = done ÷ (done + missed)
- Protocol = shared list of strings, just a reminder; status **active / past / unused** from published routines only (drafts and one-offs don't count); only unused ones can be deleted; past ones can be found and reused
- Purpose = text only

**Still open:**
- Calendar component (decide when designing that screen)
- Conflict rule: done on one device, cancelled on another (before phase 7)
