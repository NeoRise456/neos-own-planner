# Planner — desktop (Windows)

The desktop app, v0.1: Tauri 2 (Rust + WebView2) with a React 19 + TypeScript + Vite UI. The business rules come from `@planner/core` and the database code from `@planner/data`; this app only shows them. See the [main README](../../README.md) for what it does and how to run it.

```bash
pnpm dev:desktop            # from the repo root: the app in its own window
pnpm dev:desktop:browser    # the same UI in a browser, without Tauri
pnpm build:desktop          # Windows installer (.msi / .exe)
```

- `src/routes/`: the pages (todo, calendar, routines, protocols, settings, a component sheet)
- `src/components/`: `ui/` base components, `app/` the app's own pieces (sidebar, title bar, task row and panel, dialogs)
- `src/lib/`: opening the database, the clock, data hooks, how a task is shown
- `src-tauri/`: the window, icons, permissions, autostart and the PowerSync plugin

The UI follows the design system in [`DESIGN.md`](../../DESIGN.md).

**Recommended IDE:** [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
