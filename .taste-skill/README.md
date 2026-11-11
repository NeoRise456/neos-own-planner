# design-taste-frontend — project setup

Working folder for the `design-taste-frontend` skill. Every planner view is an **app screen**, so audits use the skill's app run (`references/app-screens.md`), never the landing-page run, and never redraw a direction: the brand is fixed.

## Sources of truth (read these first)
- `../PRODUCT.md`: who it's for, what a task is, product principles.
- `../DESIGN.md`: the design system as built (north star "Lights on a black board", chunky and tactile components).
- `../design/DESIGN.md`, `../design/tokens.css`, `../design/screens/`: the original handoff.
- If a dealt style is ever needed for a new screen: `draw.mjs --app --theme dark --keep palette,type`.

## Running an audit
From the repo root, with the dev server on `http://localhost:1420` (`pnpm dev:desktop:browser` or `pnpm dev`):

```bash
S=~/.claude/skills/design-taste-frontend/scripts
node $S/lint.mjs --app apps/desktop/src
for r in todo calendar routines/exercise protocols/shower settings; do
  node $S/inspect.mjs http://localhost:1420/$r --app --widths 1440,1100,900 \
    --allow micro-label,font-count --out .taste-skill/after/${r%%/*}
done
```

- Widths are **1440 / 1100 / 900**: it's a desktop app with a 900×600 minimum window, so phone widths (390) don't apply.
- Compare against `before/` (baseline taken 2026-11-11).

## Decided: the design system wins (not findings)
The user decided these are deliberate. Audits must not report them as defects:

| Skill rule | Why it stays |
|---|---|
| `micro-label` (inspector) | Small caps section labels ("MISSED", "SCHEDULED") are the design's label voice. |
| `font-count` (inspector) | Three voices on purpose: Departure Mono (UI), Figtree (reading), Doto (glyphs). |
| `mono` (lint) | Departure Mono, a pixel monospace, is the UI font. |
| `numbering` (lint) | Zero-padded times/dates, and numbered protocol steps (`01…`). |
| thin rules / hairlines | 1px row hairlines and input/tile borders are part of the system. |

## Known, accepted for now (judgment calls; revisit if the user disagrees)
- `gradient` (lint): `routes/calendar.tsx` draws the hour lines with a `repeating-linear-gradient`. It renders as flat 1px lines, not a gradient.
- `gradient` (lint): `components/app/dialogs.tsx` uses a `conic-gradient` color wheel on the "custom color" swatch, so it reads as "pick any color".
- `shadow` (lint): `components/ui/choice.tsx` uses inset shadows to draw radio rings, not elevation.

## Baseline findings (2026-11-11) — fixed the same day
Re-inspected into `after/`: Settings and Protocols 0 FAIL / 0 WARN; Todo and Routines 0 FAIL.
- **Contrast**: essential text moved from `#6B6B6B` (3.9:1) to fg-label `#9A9A9A` (7.4:1); the disabled "Today" button uses `#8C8C8C` on `#1A1A1A` (5.2:1). `#6B6B6B` is left only on input placeholders and decorative icons.
- **Tiny text**: nothing under 11px anywhere (calendar hours, day labels, "All day", block times, chips, tile footers, sidebar "Ended").
- **Edge text at 900px**: the week and month grids fit a 900px window (min width 840 → 600) instead of scrolling sideways.
- **Empty space**: Settings is now rows (title + description beside a panel, a live "now" preview for the time zone); Protocol steps run down two columns at ≥1280px windows.

## Known measurement quirk
- `edge-text` on Calendar at 1100px ("Morning exercise" 12px from the right): the title is truncated ("Morni…") inside its block. The visible block ends 70px from the edge; the inspector measures the hidden rest of the text. Not a layout problem.

## Still open (not fixed, WARN only)
- `tiny-text` share: 55–87% of text is under 13px. That's the design's 11–12px label/meta voice; revisit only if it reads too small in use.
- `heavy-borders` on Calendar: the white deadline chip and selected block outlines are white by design.
- `kpi-size` on Routines: the 56px consistency figure is the design's "big stat".
