---
name: planner
description: A dark, pixel-voiced personal planner where color only lights up where your tasks are.
colors:
  ink-bg: "#000000"
  ink-panel: "#050505"
  ink-raised: "#0A0A0A"
  ink-hover: "#0F0F0F"
  ink-well: "#111111"
  ink-line-faint: "#141414"
  ink-fill: "#1A1A1A"
  ink-line-soft: "#1A1A1A"
  ink-line-mid: "#1F1F1F"
  ink-fill-hover: "#262626"
  ink-line: "#2A2A2A"
  ink-line-dash: "#3A3A3A"
  fg-white: "#FFFFFF"
  fg: "#F5F5F5"
  fg-secondary: "#BDBDBD"
  fg-ghost: "#A3A3A3"
  fg-label: "#9A9A9A"
  fg-muted: "#8C8C8C"
  fg-disabled: "#7A7A7A"
  fg-placeholder: "#6B6B6B"
  fg-on-tone: "#0D0D0D"
  primary-hover: "#DCDCDC"
  danger: "#FF4D4D"
  danger-fill: "#3A1111"
  danger-fill-hover: "#4A1515"
  error: "#FF3B3B"
  tone-moss: "#A8CC8C"
  tone-sea: "#7EC8C8"
  tone-rose: "#E59AC2"
  tone-sky: "#8EC8F8"
  tone-sage: "#B7DFA0"
  tone-stone: "#B5B5B5"
  tone-sand: "#E6CF8F"
  tone-lilac: "#B9A6F0"
  tone-peach: "#F4B48E"
  tone-coral: "#F09C9C"
  tone-butter: "#EDE08C"
  tone-mint: "#96DCC0"
  tone-periwinkle: "#A6B6F6"
  tone-orchid: "#D8A4E8"
  tone-lime: "#CBE39A"
  tone-slate: "#A4B6C4"
typography:
  display:
    fontFamily: "Figtree Variable, Figtree, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Figtree Variable, Figtree, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Figtree Variable, Figtree, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: "30px"
  body:
    fontFamily: "Figtree Variable, Figtree, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
  ui:
    fontFamily: "Departure Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
  label:
    fontFamily: "Departure Mono, ui-monospace, monospace"
    fontSize: "11px"
    lineHeight: "14px"
    letterSpacing: "0.08em"
  glyph:
    fontFamily: "Doto Variable, Doto, ui-monospace, monospace"
    fontSize: "18px"
    fontWeight: 900
    fontVariation: "\"ROND\" 0"
rounded:
  step: "3px"
  chip: "4px"
  btn: "6px"
  card: "8px"
  drop: "10px"
  tile: "12px"
  full: "9999px"
spacing:
  "2": "2px"
  "4": "4px"
  "6": "6px"
  "8": "8px"
  "12": "12px"
  "14": "14px"
  "24": "24px"
  "30": "30px"
  "56": "56px"
components:
  button-primary:
    backgroundColor: "{colors.fg-white}"
    textColor: "{colors.ink-bg}"
    typography: "{typography.ui}"
    rounded: "{rounded.btn}"
    height: "32px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-quiet:
    backgroundColor: "{colors.ink-fill}"
    textColor: "{colors.fg}"
    typography: "{typography.ui}"
    rounded: "{rounded.btn}"
    height: "32px"
    padding: "0 14px"
  button-quiet-hover:
    backgroundColor: "{colors.ink-fill-hover}"
  button-ghost:
    textColor: "{colors.fg-ghost}"
    typography: "{typography.ui}"
    rounded: "{rounded.btn}"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.ink-line-faint}"
    textColor: "{colors.fg-white}"
  button-danger:
    backgroundColor: "{colors.danger-fill}"
    textColor: "{colors.danger}"
    rounded: "{rounded.btn}"
    height: "32px"
  button-danger-hover:
    backgroundColor: "{colors.danger-fill-hover}"
  input:
    backgroundColor: "{colors.ink-bg}"
    textColor: "{colors.fg}"
    rounded: "{rounded.btn}"
    height: "36px"
  chip:
    backgroundColor: "{colors.ink-fill}"
    textColor: "{colors.fg-secondary}"
    typography: "{typography.label}"
    rounded: "{rounded.chip}"
  nav-item-active:
    backgroundColor: "{colors.fg-white}"
    textColor: "{colors.ink-bg}"
    rounded: "{rounded.card}"
    height: "36px"
  task-row:
    rounded: "{rounded.card}"
    height: "48px"
  task-row-hover:
    backgroundColor: "{colors.ink-hover}"
  tile:
    rounded: "{rounded.tile}"
    width: "136px"
    height: "188px"
---

# Design System: planner

The handoff this was built from is `design/DESIGN.md` (+ `design/tokens.css`, `design/screens/`). This file records the system **as implemented**, including the changes approved since (listed under Do's and Don'ts). Code tokens: `apps/desktop/src/styles/tokens.css` and `index.css`; tone helpers: `apps/desktop/src/lib/tones.ts`.

## Overview

**Creative North Star: "Lights on a black board"**

The app is a dark board. Chrome stays black and grey; color only lights up where the user's tasks and routines are. A routine's tone is a small light: it marks the glyph, the check, the tile and the calendar block, and nothing else. When a task is done, its light turns fully on (the tile fills with the tone). The board itself never competes with the lights.

Personality comes from three voices, not from decoration: a pixel UI font (Departure Mono) for labels, buttons, times and counts; a dot-matrix glyph font (Doto, square dots) for the two-letter task glyphs, the clock and the logo; and Figtree for anything the user wrote and for headings. Surfaces lift by grey steps, never by shadow. Components are **chunky and tactile**: generous hit areas, solid flat fills and clear hover and pressed states, like keys on a device; still flat, still no shadows.

States read from the element itself, with no legend: done is filled with the tone, missed is grey, cancelled is dashed or struck through. Missed is a fact, never a guilt trip, so it is never red.

**Key Characteristics:**
- Pure black canvas; depth by grey steps (`#050505` → `#262626`), no shadows on anything at rest.
- White is the action: one white primary per area, the active nav pill, the selected item, deadlines.
- Color only through tones (16 pastel presets + custom), only on task-related marks.
- Three type voices: pixel UI, dot-matrix glyph, Figtree for reading.
- State visible without a legend.
- Chunky, tactile, flat controls.

## Colors

A monochrome black board with sixteen soft pastel lights.

### Primary
- **Board White** (fg-white): the action color. Primary buttons, the active nav pill, selected rows and blocks, deadlines, the calendar "now" line, page headings. One white primary per area.

### Tones (the only color)
- **Moss, Sea, Rose, Sky, Sage, Stone, Sand, Lilac** (the design's 8) and **Peach, Coral, Butter, Mint, Periwinkle, Orchid, Lime, Slate** (8 approved extras at the same pastel lightness). Each routine, and each one-off via its tag, owns one tone. A routine can also use a custom hex from the color picker.
- Uses: glyph on black (tone as text color); filled when done or active (tone background, fg-on-tone text, `rgba(0,0,0,.55)` meta); tinted calendar blocks when not done (`rgba(tone,.20)` fill, `rgba(tone,.55)` border, white title).

### Neutral
- **Board Black** (ink-bg): the page, always.
- **Panel Black** (ink-panel): the task side panel.
- **Raised Black** (ink-raised): done rows, raised areas.
- **Hover Black** (ink-hover): row hover.
- **Well Grey** (ink-well): segmented track, info boxes.
- **Fill Grey** (ink-fill): quiet buttons, choice cards, chips; also the soft divider line.
- **Line Grey** (ink-line): input, tile and outline borders.
- **Dash Grey** (ink-line-dash): dashed drop-zone borders, disabled fill, the missed check, the scrollbar thumb.
- **Text ladder:** fg-white (headings) → fg (body) → fg-secondary (field labels, row meta) → fg-label (section labels, help) → fg-placeholder (placeholders and faint meta only).

### Signal
- **Danger Red** (danger on danger-fill): delete actions only. **Error Red** (error): field errors only.

### Named Rules
**The Lights Rule.** Tones appear only on task-related marks: glyphs, checks, tiles, mini squares, calendar blocks, routine tone squares. Never on chrome, buttons, headings or backgrounds.

**The One White Rule.** One white primary button per area. White also marks "active" and "selected"; it is never decoration.

**The Readable Light Rule.** Filled tiles put dark text (`#0D0D0D`) on the tone, so a tone must stay light. Custom colors below luminance 0.3 get a readability warning in the picker. Always resolve tones through `toneHex()` / `tint()`.

## Typography

**Display / Reading Font:** Figtree (variable, bundled via Fontsource)
**UI Font:** Departure Mono (one weight, bundled woff2)
**Glyph Font:** Doto (variable, square dots: `"ROND" 0`, weight 900)

**Character:** a pixel instrument panel (Departure Mono) and dot-matrix lights (Doto) framing warm, heavy human writing (Figtree 800 headings, 600 titles).

### Hierarchy
- **Display** (Figtree 800, 56px, −3%): the big stat (routine consistency %).
- **Headline** (Figtree 800, 34px max, −2%): page titles ("Wednesday 11 November"); on Todo it scales down with the column (to 20px, then truncates) so the day switch never wraps.
- **Title** (Figtree 800, 28/30px): panel titles; section headings 23px.
- **Body** (Figtree 600, 15px): task titles in rows; steps and notes Figtree 500, 14–15px.
- **UI** (Departure Mono, 13px): buttons, nav, form text.
- **Label** (Departure Mono, 11/14px, caps, +8% tracking, fg-label): section labels ("MISSED", "SCHEDULED") and meta (times, counts; tabular).
- **Glyph** (Doto 900): 18px in rows, 30–46px in tiles, 34px for the sidebar clock.

### Named Rules
**The Three Voices Rule.** UI text is Departure Mono, the user's own words and headings are Figtree, glyphs are Doto. Never mix the roles.

**The No Fake Bold Rule.** Departure Mono has one weight; `font-synthesis: none` stops faux bold. Never rely on weight for state in the UI voice; use color, fill or a white pill.

## Layout

A fixed 220px sidebar on the left (logo, nav with sub-lists, the clock and Settings at the foot) and a scrolling view beside it. A 36px strip at the top stays free for the transparent title bar (window buttons only), which lies over the view and any side panel. Right-hand panels (the 400px task panel) render into a shell slot and run the full window height, scrolling on their own.

Content columns are centered with fixed max widths: Todo 720 (540 with the panel open), Routines/Protocols 680, Calendar 1200. Horizontal gutters 32–40px. Spacing steps: 2 · 4 · 6 · 8 · 12 · 14 · 24 · 30 · 56; a section label sits 14 above its content, sections sit about 30 apart. The window has a 900×600 minimum; rows that hold a title and controls never wrap (titles truncate or scale first). Calendar grids fit a 900px window without sideways scrolling (min width 600). Settings sections are rows: a 280px title + description column beside a `#0A0A0A` panel (stacked below 1280px). Protocol steps run down two columns at windows ≥1280px.

## Elevation & Depth

Flat. Depth is tonal: surfaces lift by stepping up the grey ladder (`#000` → `#050505` → `#0A0A0A` → `#111` → `#1A1A1A` → `#262626`). No shadows on anything at rest. Dialogs and menus sit on `#0A0A0A` cards over a dimmed backdrop.

### Named Rules
**The Grey Step Rule.** To separate two surfaces, step the grey. Never add a shadow or a glow.

## Shapes

Small, consistent radii: 3 step badge · 4 chip and mini square · 6 button and input · 8 card, row, calendar block and large button · 10 drop zone · 12 tile, stat card · full for toggles, radios, checks and round icon buttons. Borders are 1px greys; 2px white marks a selected choice. Dashed borders are reserved for real drop zones and the cancelled state. Scrollbars are square, 6px, `#3A3A3A` thumb (`#6B6B6B` on hover), no arrows.

## Components

### Buttons
- **Shape:** gently rounded (6px; 8px for the 40px large size).
- **Primary:** white fill, black text, Departure Mono; one per area.
- **Quiet:** `#1A1A1A` fill, `#262626` on hover. **Ghost:** grey text, `#141414` fill on hover. **Danger:** dark red fill, red text, trash icon.
- **Sizes:** 28 / 32 / 36 / 40px. **Disabled:** `#3A3A3A` fill, `#7A7A7A` text, never hidden.
- **Feel:** chunky and tactile; hover 120ms on the snap ease `cubic-bezier(.2,.8,.2,1)`; a visible pressed state is wanted.

### Chips
- **Style:** `#1A1A1A` fill or 1px outline, 4px radius, label type. The active status chip is white.

### Cards / Containers
- **Tile** (136×188, 12px): outline when not done, filled with the tone when done; missed grey with a MISSED chip; cancelled dashed with a struck title.
- **Stat card** (12px, `#1A1A1A` border): big %, "x of y done", 6px white progress bar.
- **Dialog:** `#0A0A0A` card, 8–12px radius, no shadow.

### Inputs / Fields
- **Style:** black fill, 1px `#2A2A2A`, 6px radius (8px for quick-add with a `+` icon and an `Enter` hint). Title fields use Figtree 16–18.
- **Focus:** border `#8C8C8C` plus the global 2px white focus ring (offset 2).
- **Error:** red text under the field and `aria-invalid`.

### Date & time fields
Never the browser's native pickers: they ignore the system (light rounded popups, a 12-hour wheel, blue selection). Both fields look like an input (black, 1px `#2A2A2A`, 6px radius, 36px, UI 13, tabular numerals) with a 14px grey icon on the left and a small ✕ on the right to clear (left out when the field is required). Code: `components/ui/date-picker.tsx`, `time-picker.tsx`; both are on the component sheet.
- **Date field:** shows the day as "Wed 11 Nov" (the year only when it isn't this year); placeholder "No date" or "Pick a day". Opens a month calendar on a `#111` popover card: the month as a Figtree 800 15px heading with small round ‹ › buttons; weekday labels Mo…Su in label type, **weeks start on Monday**; 36px day keys in a 7-column grid with 2px gaps, days of other months left blank. The picked day is a **white key with black text** (the One White Rule); today has a 1px grey (`#9A9A9A`) ring; days outside the allowed range are greyed out (`#7A7A7A`). A hairline footer holds a ghost "Clear" and a quiet "Today". Keyboard: arrows move a day or a week, Home / End the week, Page Up / Down the month, Enter picks, Escape closes.
- **Time field:** 24-hour, always. A real text box: type "1830", "18:30", "6pm" or "9"; Enter or leaving the field reads it, and text that can't be read stays, with a red border, until it's fixed. ↑ / ↓ move it by 5 minutes. Focusing it opens two scrolling columns (HOUR 00–23, MIN in 5-minute steps, 32px keys) that open centered on the current value, with the same white key for the chosen one; footer "Clear" and "Now".
- Popovers sit above dialogs, so both work inside forms.

### Tag box
How a task gets tags (edit dialog and task panel). Code: `components/app/tag-box.tsx`.
- **Look:** the chosen tags as chips above a plain input (36px, UI 13). A tag that is only typed so far (made when the task is saved) has a small grey "new" after its name.
- **The list:** typing (or focusing) opens a `#111` popover as wide as the input, 32px rows: a 8px tone square + the name. Order: the exact name, then names that start with the text, then names that contain it. Tags already on the task aren't listed. When no tag has exactly the typed name, the last row is **+ Create “name”** with a grey "new tag" on the right. The highlighted row is `#262626`; a hairline footer says "↑ ↓ to choose · Enter to add".
- **Keys:** the first row starts highlighted, so Enter takes it; ↑ / ↓ move (and wrap); a comma works like Enter; Backspace in an empty box removes the last chip; Escape closes the list. Leaving the box with text in it adds that exact name, never a partial match.

### Settings → Tags
Each tag is a row: a 32px color swatch (opens the tone picker), the name as an input that only shows its border on hover/focus (Enter or leaving saves, Escape puts it back), "N tasks" in label grey, and a muted trash button. A name another tag has turns the field red and offers **Merge into “X”** (with a confirm) or **Keep**. Deleting asks first (danger confirm saying how many tasks lose the tag), then gives a toast with Undo.

### Navigation
- **Sidebar:** 36px items with icons; the active item is a white pill with black text; counts on the right. Routines and Protocols open a sub-list with a left rail, tone squares, an "Ended" heading and "+ New …".
- **Sidebar clock:** time in Doto 34px white, date (12px caps) and UTC offset below; the whole block links to Settings.
- **Title bar:** transparent, drag area plus 46×36 window buttons with thin 1.2-stroke icons (#9A9A9A → white); close hovers in danger colors; icons never change with the window state.

### Task Row (signature)
48px, 8px radius, hover `#0F0F0F`: check (20px circle) · Doto glyph in the tone · Figtree title · right-aligned label-type meta. Count tasks show mini squares (8px, filled with the tone when done). Done rows move to a collapsible Done section on `#0A0A0A`. Missed rows go grey ("Missed · Fri 6 Nov") and stay tickable.

### Check (signature)
20px circle: not done 1.5px `#6B6B6B` ring; done filled with the tone with a black tick; missed `#3A3A3A` ring on `#1A1A1A`; cancelled dashed `#3A3A3A`.

### Toasts
Sonner-style stack at bottom right (356px): older toasts tuck behind the front one and fan out on hover; each has a ✕; they leave by sliding up and fading.

## Do's and Don'ts

### Do:
- **Do** keep the page `#000000` and separate surfaces with grey steps.
- **Do** put color only on task marks, resolved through `toneHex()` / `tint()`.
- **Do** keep one white primary per area.
- **Do** use Departure Mono for UI, Figtree for user text and headings, Doto for glyphs, the clock and the logo.
- **Do** make controls chunky and tactile: generous hit areas, solid fills, clear hover and pressed states.
- **Do** keep every text at 11px or more and essential text at fg-label (`#9A9A9A`) or brighter; `#6B6B6B` is for placeholders and decorative icons only.
- **Do** keep a 2px white focus ring (offset 2) on everything focusable and respect `prefers-reduced-motion`.
- **Do** keep empty states plain: a dim glyph tile, a heading, one line of help, actions (`EmptyState`), or just a short line ("Nothing planned for the day").

### Don't:
- **Don't** add shadows, glows, gradients or a light theme.
- **Don't** put tones on chrome, buttons or backgrounds.
- **Don't** use red for missed tasks; missed is grey and never a guilt trip.
- **Don't** fake-bold Departure Mono or rely on weight for state.
- **Don't** draw dashed boxes around empty states; dashed borders mean a real drop zone or cancelled.
- **Don't** let a title row wrap its controls below it; scale or truncate the title instead.
- **Don't** use emoji or exclamation marks.
- **Don't** use the browser's native date, time or datetime inputs; use `DateField` / `TimeField`.

### Approved changes from the handoff (`design/DESIGN.md`)
Departure Mono replaces Pixelify Sans · custom transparent title bar, window buttons only · the clock moved to the sidebar foot (Doto 34px) · plain empty states (no dashed box) · 16 tones + custom colors · gray square scrollbars · Sonner-style toast stack · centered content columns · side panels run full height under the title bar · own date & time fields instead of the native pickers (Monday-first calendar, 24-hour typed or picked times) · a searchable tag box instead of the browser's suggestion list.

### Deliberate system choices (not defects)
These are part of the design and audits must not flag them: the monospace (pixel) UI font; small uppercase tracked section labels; numbered protocol steps (`01…`); 1px hairline row dividers and input/tile borders.
