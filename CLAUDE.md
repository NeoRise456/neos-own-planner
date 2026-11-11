# Planner

Product docs live in `docs/`: `docs/PLAN.md` (architecture), `docs/TASK.md`, `docs/SYSTEMS.md` (rules).

## Design
- The UI follows design/DESIGN.md (dark only, no light mode). Use the tokens in tokens.css; don't invent colors, radii or fonts.
- design/screens/*.dc.html are visual references from the design canvas, not runnable code. Rebuild them in React + Tailwind + shadcn/ui.
- Fonts are bundled locally: Figtree and Doto via Fontsource; the UI font is **Departure Mono** (woff2 in `apps/desktop/src/assets/fonts`).
- Approved change from the design: Departure Mono replaces Pixelify Sans (tokens.css called Pixelify a stand-in for it). Pixelify drew 5/S, 0/O, 2/Z, G/B and C/O identically. Departure Mono has one weight — don't rely on bold for state; `font-synthesis: none` stops fake bold.

- Approved: **custom title bar** (`components/app/title-bar.tsx`, `"decorations": false`). Transparent, laid over the view and any right-hand panel (the shell keeps a 36px strip free under it); just a drag area + 46×36 buttons, close hovers in danger colors. Window permissions are in `src-tauri/capabilities/default.json`.
- Logo: `design/brand/planner-logo.png` (original) and `planner-logo.svg` (vector copy: 5×7 dot "P", 4px squares, 1px gaps, on black). App icons in `src-tauri/icons` are generated from the SVG with `pnpm tauri icon ../../design/brand/planner-logo.svg` (delete the android/ios sets it also makes); `public/favicon.svg` is the same SVG. The sidebar draws the same mark in code (`DotLogo` in `components/ui/bits.tsx`).
- The one clock is in the sidebar footer (`SidebarClock` in `components/app/sidebar.tsx`): time in Doto 34px, date, UTC offset; click → Settings.
- Right-hand panels render through `<SidePanel>` (`components/app/side-panel.tsx`) into a slot in the shell, so they run the full window height and their color reaches the top edge. Give them a 36px top spacer and scroll their own content.
- Scrollbars: square, no arrows, #3A3A3A thumb (#6B6B6B on hover). Only `::-webkit-scrollbar` rules — never `scrollbar-width`/`scrollbar-color`.
- Approved: **empty states have no dashed box** (it read as a drop zone). Use `EmptyState` from `components/ui/bits.tsx`: dim glyph tile, heading, one line of help, actions. Dashed borders are only for real drop zones.

- Approved: **16 tones + custom colors.** The design's 8 tones plus 8 extra pastel presets (`lib/tones.ts`, `tokens.css`), and a routine can use any custom hex from the picker. A `Tone` is a preset name or `"#RRGGBB"`; always go through `toneHex()` / `tint()`. Custom colors darker than luminance 0.3 get a readability warning (dark text sits on filled tiles).

## Design audits
- **impeccable** reads `PRODUCT.md` (product truth) and `DESIGN.md` (the system as built, with `.impeccable/design.json`) at the planner root. `design/DESIGN.md` stays as the original handoff. When the design changes, update root `DESIGN.md` (re-run `/impeccable document`).
- **design-taste-frontend** setup, audit command, the rules this project overrides, and the baseline findings: `.taste-skill/README.md` (baseline screenshots in `.taste-skill/before/`).

## Current state
- `apps/desktop` shows the dashboard on **mock data** (`src/mock/`): interactive, nothing saved, no rules.
- `packages/core` is empty on purpose — all business rules go there (phase 1).
- `src-tauri` has no commands yet — the SeaORM data layer comes in phase 2.
- Don't put business rules in components or in `src/mock/`; they belong in `@planner/core`.
