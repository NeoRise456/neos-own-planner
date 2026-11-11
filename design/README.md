# planner-design: handoff for Claude Code

1. Unzip this folder into your repo as `neos-own-planner/design/`, next to `docs/` (TASK.md, SYSTEMS.md and PLAN.md).
2. Copy `tokens.css` into `apps/desktop/src/styles/` and import it after Tailwind:
   ```css
   @import "tailwindcss";
   @import "./tokens.css";
   ```
3. Add this to your CLAUDE.md so Claude Code always follows the design:
   ```md
   ## Design
   - The UI follows design/DESIGN.md (dark only, no light mode). Use the tokens in tokens.css; don't invent colors, radii or fonts.
   - design/screens/*.dc.html are visual references from the design canvas, not runnable code. Rebuild them in React + Tailwind + shadcn/ui.
   - Fonts are bundled locally with Fontsource: Figtree, Pixelify Sans, Doto.
   ```
4. A good first prompt: "Read design/DESIGN.md and design/screens/03-sidebar.dc.html and 10-todo.dc.html, then build the app shell (sidebar + Todo route) with shadcn/ui and the tokens."
