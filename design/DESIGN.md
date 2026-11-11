# Planner — Design System (v0.4)

Dark only, with no light theme. Minimal, with personality from three places: a pixel UI font, dot-matrix glyphs, and pastel tile colors.
Tokens live in [`tokens.css`](tokens.css). The `screens/` folder holds the reference designs (see "Reference screens" at the bottom).

## 1. Principles

1. **Pure black canvas.** The page is `#000`. Surfaces lift by grey fills (`#0A0A0A` → `#1A1A1A`), never shadows.
2. **White is the action.** One white primary button per area, the active nav item, the selected item, the "now" line, and deadlines.
3. **Color only through tones.** Every routine (and every one-off task, via its tag) has one of 8 pastel tones. Tones appear on glyphs, tiles, checks and calendar blocks, never on chrome.
4. **Three type voices.**
   - **UI** (pixel font): labels, buttons, times, counts, meta.
   - **Reading** (Figtree): anything the user wrote, such as task titles, notes, protocol steps, routine names, and headings.
   - **Glyph** (Doto, square dots): the two-letter task glyph ("Gy", "Ca").
5. **State is visible without a legend.** Done, missed and cancelled read from the element itself.

## 2. Tokens

### Color
| Token | Hex | Use |
|---|---|---|
| ink-bg | `#000000` | page |
| ink-raised | `#0A0A0A` | done row, side panel (`#050505` for the task panel) |
| ink-well | `#111111` | segmented track, info box |
| ink-fill | `#1A1A1A` | quiet button, choice card, chip |
| ink-fill-hover | `#262626` | hover on fills |
| ink-line | `#2A2A2A` | input / tile / outline borders |
| ink-line-soft | `#1A1A1A` | section dividers, sidebar edge |
| ink-line-faint | `#141414` | row hairlines |
| ink-line-dash | `#3A3A3A` | dashed borders, disabled bg, missed check |
| fg-white | `#FFFFFF` | headings, primary |
| fg | `#F5F5F5` | body |
| fg-secondary | `#BDBDBD` | field labels, row meta |
| fg-label | `#9A9A9A` | section labels, help |
| fg-placeholder | `#6B6B6B` | placeholders, faint counts |
| fg-on-tone | `#0D0D0D` | text on filled tone |
| danger / danger-fill | `#FF4D4D` / `#3A1111` | Delete |
| error | `#FF3B3B` | field errors |

**Tones:** moss `#A8CC8C`, sea `#7EC8C8`, rose `#E59AC2`, sky `#8EC8F8`, sage `#B7DFA0`, stone `#B5B5B5`, sand `#E6CF8F`, lilac `#B9A6F0`.
Current mapping: Exercise plan = moss, Uni — Term 1 = sky (Calculus uses stone), Morning routine = sand (Water uses rose), one-offs use their tag's tone.

Tone usage:
- **Glyph on black:** the tone as the text color.
- **Filled (done / active):** the tone as background, `#0D0D0D` text, `rgba(0,0,0,.55)` meta.
- **Tinted (calendar, not done):** `rgba(tone, .20)` background, `rgba(tone, .55)` border, white title.

### Type
| Role | Font | Size / weight |
|---|---|---|
| Page title | Figtree | 34/38 · 800 · −2% |
| Big stat | Figtree | 56 · 800 · −3% |
| Panel title | Figtree | 28/30 · 800 |
| Section heading | Figtree | 23 · 800 |
| Task title (row) | Figtree | 15 · 600 |
| Body / step | Figtree | 14–15 · 500 |
| Section label | UI | 11/14 · caps · +8% tracking · `#9A9A9A` |
| UI text / buttons | UI | 13 · 400/600 |
| Meta (times, counts) | UI | 11 · caps · tabular |
| Glyph (row) | Doto 900 | 18 |
| Glyph (tile) | Doto 900 | 30–46 |

Fonts must be bundled locally (Tauri app, offline). Use Fontsource, checking the exact package names: Figtree, Pixelify Sans, and Doto (with variable axes ROND + wght; set `font-variation-settings: "ROND" 0`).

### Shape and spacing
- Radius: 3 step badge · 4 chip · 6 button/input · 8 card/row/block · 10 drop zone · 12 tile · full for toggles, radios, round icon buttons.
- Control heights: toggle 20 · segment 26 · small 28 · button 32–36 · input 36–48 · large 40. On touch, every control grows to at least 44.
- Spacing: 2 · 4 · 6 · 8 · 12 · 14 · 24 · 30 · 56. A section label sits 14 above its content, and sections sit about 30 apart.
- Content widths: Todo 720 · Routines/Protocols 680 · Calendar 1200 · Sidebar 220.

### Motion
- Ease `cubic-bezier(.2,.8,.2,1)`. Hover 120ms, state change 200–350ms (tile fill, progress bar, toggle knob).
- No bounces. Respect `prefers-reduced-motion`.

## 3. Components

**Buttons** (radius 6, UI font, 600):
- **primary:** white bg, black text.
- **quiet:** `#1A1A1A` bg.
- **ghost:** text `#A3A3A3`, hover `#141414` bg.
- **danger:** `#3A1111` bg, `#FF4D4D` text, with a trash icon.
- **disabled:** `#3A3A3A` bg, `#7A7A7A` text.
- **small:** 28px tall.
- **large:** 40px tall, radius 8.

**Icon button:** 32 square (radius 6) or round arrows (32, 1px `#2A2A2A` border).

**Segmented control:** a `#111` track with a `#262626` border, radius 8, padding 2.
- Selected: black with a `#333` border and white bold text.
- Big variant: the selected segment is white with black text.

**Underline tabs:** `#8C8C8C`. Active is white, bold, with a 2px white underline.

**Inputs:** black, 1px `#2A2A2A`, radius 6 (8 for quick-add).
- Title fields use Figtree 16–18. Focus border is `#8C8C8C`.
- Quick-add has a `+` icon and an `Enter` key hint.
- Error: red text under the field plus `aria-invalid`.

**Toggle:** 32×20.
- On: white track, black knob.
- Off: `#1A1A1A` track, `#333` knob.

**Choice card / radio row:** `#1A1A1A` bg. When selected: black bg, 2px white border, and a filled white radio with a black center.

**Check (task):** 20px circle.
- Not done: 1.5px `#6B6B6B` ring.
- Done: filled with the task's tone and a black tick.
- Missed: `#3A3A3A` ring on `#1A1A1A`.
- Cancelled: dashed `#3A3A3A`.

**Task row** (48px, radius 8, hover `#0F0F0F`): check · glyph (Doto 18, tone) · title (Figtree 15/600) · meta (UI 11 caps, right-aligned).
- Count tasks ("Water") show 4 mini squares (8px, radius 2): filled with the tone when done, outlined `#3A3A3A` when not.
- Done rows move into a collapsible **Done** section and get a `#0A0A0A` background and a grey title.
- Missed rows: grey glyph and title, meta reads "Missed · Fri 6 Nov", still tickable.

**Tile** (136×188, radius 12): group label (caps 10) · "…" menu · glyph 46 · title (Figtree 800 19, bottom-aligned) · hairline · footer (when · count).
- Outline = not done; filled with the tone = done.
- Missed: grey glyph and a MISSED chip.
- Cancelled: dashed border and struck-through title.
- Count tasks: stacked edges, one for each copy still to do.

**Calendar block** (radius 8, 48px per hour):
- Not done: tinted tone with a white title.
- Done: solid tone, dark text, and "· done" next to the time.
- Selected: white.
- Every block has a 13px status circle on the right: a ring when not done, a dark disc with a tone tick when done. No legend.
- **All-day row:** the text "4 during the day" plus deadline chips (1px white border, flag icon, time).
- **Now line:** 2px white with a dot, plus a white time pill in the gutter.

**Sidebar** (220, black, right border `#1A1A1A`):
- Dot-matrix "P" logo plus "planner".
- Nav items are 36 tall with icons; the active one is a white pill with black text.
- Under Routines and Protocols, the active item opens a sub-list with a left rail. Each sub-item has a tone square, the current one gets a `#1A1A1A` background, and an "Ended" caps heading and a "+ New …" item close the list.
- Settings (gear icon) sits at the bottom with the time zone.

**Routine header:** a 76 tile (filled tone when active, outlined grey when ended) · title · purpose (Figtree 17) · chips (period, status; the active status chip is white).

**Stat card:** radius 12, `#1A1A1A` border: a big % · "x of y done in November" · a 6px white progress bar · the note "Done ÷ (done + missed)".

**Entry row:** glyph tile 38 · title · rule (UI 11) · one mini square per day (tone = done, `#2A2A2A` = missed) · score.

**Protocol steps:** numbered `01…` (UI 11, `#6B6B6B`) with Figtree 15 text and `#141414` hairlines. Hovering a step shows a remove button.

## 4. Voice
Plain sentence case and short. "Add a task", "A title is required.", "Six letters, from your other device." No exclamation marks or emoji. Missed is a fact, never a guilt trip.

## 5. Accessibility
- Real `<button>`, `<a>`, and `<input>` with `<label>`; icon-only buttons get an `aria-label`.
- Glyphs are decorative (`aria-hidden`), since the title carries the meaning.
- Every focusable element gets a 2px white focus ring with offset 2.
- Text contrast is at least 4.5:1 on black: `#6B6B6B` is only for faint meta and placeholders, never for essential text.

## Reference screens (`screens/`)
These are `.dc.html` files from the design canvas. Their markup uses a small template syntax (`{{value}}`, `<sc-for>`, `<sc-if>`, and a `class Component extends DCLogic` block with demo data), so **they are a visual and behavior reference, not code to run**. Read exact values, layout and interactions from them, then rebuild in React + Tailwind + shadcn/ui.

| File | What |
|---|---|
| 00-components | Every base component, interactive |
| 01-foundations | Color, tones, type, radius, heights |
| 02-tiles | Tile anatomy and states, task row, routine tile |
| 03-sidebar | Shared sidebar (props: active, sub) |
| 10-todo | Todo: sections, tick → Done, count tasks, quick-add |
| 11-todo-task-open | Todo with the task panel and protocol |
| 20-calendar-week | Week grid, all-day row, now line, blocks |
| 30-routines | Routine detail, stat card, entries, actions |
| 40-protocols | Protocol steps, add/remove step |
