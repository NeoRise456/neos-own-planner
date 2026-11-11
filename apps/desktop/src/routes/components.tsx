import { useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button, IconButton, RoundButton } from "@/components/ui/button";
import { Chip, DropZone, EmptyState, Label, Loader, Progress } from "@/components/ui/bits";
import { ChoiceCard, ChoiceGroup, RadioRow, StepHeading } from "@/components/ui/choice";
import { Field, Input, QuickAdd, Select } from "@/components/ui/field";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CircleCheckIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { Segmented } from "@/components/ui/segmented";
import { UnderlineTabs } from "@/components/ui/tabs";
import { Check, TaskTile, TileDots, type VisualState } from "@/components/ui/task-visuals";
import { toast } from "@/components/ui/toast";
import { Toggle } from "@/components/ui/toggle";
import { toneHex, type Tone } from "@/lib/tones";

export const Route = createFileRoute("/components")({ component: ComponentSheet });

/** Component sheet — screens/00-components + 02-tiles. Every base component, interactive. */
function ComponentSheet() {
  const [r1, setR1] = useState("Day");
  const [f, setF] = useState("All");
  const [r2, setR2] = useState("Day");
  const [tab, setTab] = useState("Month");
  const [t1, setT1] = useState(true);
  const [t2, setT2] = useState(true);
  const [t3, setT3] = useState(false);
  const [freq, setFreq] = useState("Weekly");
  const [gets, setGets] = useState("times");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [shelf, setShelf] = useState(0);
  const [rowStates, setRowStates] = useState<VisualState[]>(["done", "todo", "missed", "cancelled"]);

  return (
    <main className="min-w-0 flex-1 px-12 pt-11 pb-32">
      <div className="mx-auto flex max-w-[840px] flex-col gap-14">
        <div className="flex flex-col gap-2">
          <Label>For testing</Label>
          <h1 className="read m-0 text-[34px] leading-[38px] font-extrabold tracking-[-.02em] text-fg-white">Component sheet</h1>
        </div>

        <Sec label="Buttons">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="primary">
              <PlusIcon />
              Primary
            </Button>
            <Button>Quiet</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">
              <TrashIcon />
              Delete
            </Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="xl">
              <PlusIcon />
              Add a task
            </Button>
            <IconButton label="Edit">
              <PencilIcon />
            </IconButton>
            <IconButton label="Star" tone="filled">
              <StarIcon />
            </IconButton>
            <IconButton label="Mark done" tone="muted">
              <CircleCheckIcon />
            </IconButton>
            <RoundButton label="Previous">
              <ChevronLeftIcon />
            </RoundButton>
            <RoundButton label="Next">
              <ChevronRightIcon />
            </RoundButton>
          </div>
        </Sec>

        <Sec label="Segmented controls">
          <div className="flex flex-wrap items-center gap-2.5">
            <Segmented label="Range" value={r1} onValueChange={setR1} segmentClassName="min-w-[88px]" items={["Day", "Week", "Month"].map((v) => ({ value: v, label: v }))} />
            <Segmented
              label="Filter"
              value={f}
              onValueChange={setF}
              segmentClassName="px-[9px]"
              items={["All", "Not done", "Done", "Missed"].map((v) => ({ value: v, label: v, disabled: v === "Missed" }))}
            />
          </div>
          <div>
            <Segmented big label="Range (big)" value={r2} onValueChange={setR2} items={["Day", "Week", "Month"].map((v) => ({ value: v, label: v }))} />
          </div>
        </Sec>

        <Sec label="Underline tabs">
          <UnderlineTabs label="View" value={tab} onValueChange={setTab} items={["Month", "Week", "List"].map((v) => ({ value: v, label: v }))} />
        </Sec>

        <Sec label="Fields" width={414}>
          <Field label="Title (reading font)">{(a) => <Input {...a} kind="title" placeholder="Finish the essay" />}</Field>
          <Field label="Code (dot-matrix)" help="Six letters, from your other device.">
            {(a) => <Input {...a} kind="code" placeholder="ABC-123" />}
          </Field>
          <Field label="Routine">
            {(a) => (
              <Select {...a}>
                <option>Exercise plan</option>
                <option>Uni — Term 1</option>
                <option>Morning routine</option>
              </Select>
            )}
          </Field>
          <Field label="With an error" error={title.trim() ? undefined : "A title is required."}>
            {(a) => <Input {...a} kind="title" value={title} onChange={(e) => setTitle(e.target.value)} />}
          </Field>
          <QuickAdd placeholder="Add a task" value={draft} onChange={setDraft} onSubmit={(v) => toast(`Would add “${v}”.`)} />
          <span className="text-center font-ui text-[11px] text-fg-label">or</span>
          <label className="flex items-center justify-between font-ui text-[12px] text-fg-secondary">
            Show cancelled
            <Toggle checked={t1} onCheckedChange={setT1} />
          </label>
          <div className="flex gap-2.5">
            <Toggle aria-label="Example on" checked={t2} onCheckedChange={setT2} />
            <Toggle aria-label="Example off" checked={t3} onCheckedChange={setT3} />
          </div>
        </Sec>

        <Sec label="Choices & steps" width={414}>
          <StepHeading n={1}>How often</StepHeading>
          <ChoiceGroup label="How often" columns={3}>
            {[
              ["Daily", "Every day"],
              ["Weekly", "On some days"],
              ["Monthly", "1st, last Fri…"],
            ].map(([l, s]) => (
              <ChoiceCard key={l} label={l} sub={s} selected={freq === l} onClick={() => setFreq(l)} />
            ))}
          </ChoiceGroup>
          <div className="mt-3">
            <StepHeading n={2}>Each day gets</StepHeading>
          </div>
          <ChoiceGroup label="Each day gets">
            <RadioRow label="Fixed times" example="18:00, or 08:00 / 14:00 / 20:00" selected={gets === "times"} onClick={() => setGets("times")} />
            <RadioRow label="A count" example="Water 4 times a day" selected={gets === "count"} onClick={() => setGets("count")} />
          </ChoiceGroup>
        </Sec>

        <Sec label="Small bits" width={290}>
          <div className="flex items-center gap-2.5">
            <Chip>PDF</Chip>
            <Chip>3/4</Chip>
            <Chip>NEW</Chip>
            <Loader />
            <Loader cols={6} />
            <span className="font-ui text-[11px] text-fg-label">Saving…</span>
          </div>
          <Progress value={62} label="Progress" />
          <Progress value={35} label="Secondary progress" thin color="#8C8C8C" className="-mt-1.5" />
        </Sec>

        <Sec label="Drop zone" width={352}>
          <DropZone hint="ICS, CSV or JSON — or click to pick one" onFiles={(fs) => toast(fs.length ? `Picked ${fs.map((x) => x.name).join(", ")}` : "No file.")} />
        </Sec>

        <Sec label="Tiles & shelf">
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-3">
              <span className="read text-[23px] font-extrabold tracking-[-.01em] text-fg-white">This week ›</span>
              <span className="font-ui text-[11px] text-fg-label">7 cards</span>
            </div>
            <div className="flex gap-1.5">
              <RoundButton small label="Scroll back" disabled={shelf === 0} onClick={() => setShelf((s) => Math.max(0, s - 1))}>
                <ChevronLeftIcon size={10} />
              </RoundButton>
              <RoundButton small label="Scroll forward" disabled={shelf >= 2} onClick={() => setShelf((s) => Math.min(2, s + 1))}>
                <ChevronRightIcon size={10} />
              </RoundButton>
            </div>
          </div>
          <div className="-mr-2 overflow-hidden">
            <div className="flex gap-[11px] py-1 pr-2 transition-transform duration-[350ms] ease-snap" style={{ transform: `translateX(${-shelf * 147}px)` }}>
              {CARDS.map((c) => (
                <TaskTile
                  key={c.title}
                  {...c}
                  menu={<TileMenu title={c.title} onTone={c.state === "done"} />}
                  onOpen={() => toast(`Open “${c.title}”`)}
                />
              ))}
            </div>
          </div>
        </Sec>

        <Sec label="States on a tile">
          <div className="flex flex-wrap items-start gap-4">
            <TaskTile group="Exercise plan" glyph="Gy" title="Gym" meta="18:00 · 1h" count="11/12" tone="moss" />
            <TaskTile group="Exercise plan" glyph="Gy" title="Gym" meta="Done 19:04" count="12/12" tone="moss" state="done" />
            <TaskTile group="Morning routine" glyph="Vi" title="Vitamins" meta="Was by 12:00" count="8/9" tone="sand" state="missed" />
            <TaskTile group="One-off" glyph="De" title="Dentist" meta="Thu 15:00" count="1h" tone="sea" state="cancelled" />
            <TaskTile group="Morning routine" glyph="Wa" title="Water" meta="×4 daily" count="2/4" tone="rose" stack={2} />
          </div>
        </Sec>

        <Sec label="Same task, as a row — click the checks">
          <div className="flex max-w-[560px] flex-col gap-0.5">
            {ROWS.map((r, i) => {
              const s = rowStates[i];
              return (
                <div key={r.title} className={`flex h-12 items-center gap-3 rounded-card px-[14px] ${s === "done" ? "bg-ink-raised" : ""}`}>
                  <Check
                    state={s}
                    tone={r.tone}
                    label={`Cycle state: ${r.title}`}
                    onClick={() => setRowStates((xs) => xs.map((x, j) => (j === i ? NEXT[x] : x)))}
                  />
                  <span className="glyph w-[30px] text-[18px]" style={{ color: s === "missed" ? "#3A3A3A" : s === "cancelled" ? "#262626" : toneHex(r.tone) }} aria-hidden>
                    {r.glyph}
                  </span>
                  <span
                    className={`read text-[15px] font-semibold ${s === "todo" ? "text-fg-white" : "text-fg-label"} ${s === "cancelled" ? "line-through" : ""}`}
                  >
                    {r.title}
                  </span>
                  <span className={`meta ml-auto ${s === "todo" ? "text-fg-secondary" : "text-fg-label"}`}>{s === "todo" ? r.meta : s}</span>
                </div>
              );
            })}
          </div>
        </Sec>

        <Sec label="Toasts">
          <div className="flex gap-2.5">
            <Button onClick={() => toast("Saved.")}>Simple</Button>
            <Button onClick={() => toast("Task deleted.", { action: { label: "Undo", onClick: () => toast("Restored.") } })}>With action</Button>
            <Button onClick={() => toast("Couldn't sync. Check your connection.", { sticky: true, action: { label: "Retry", onClick: () => {} } })}>Sticky</Button>
          </div>
        </Sec>

        <Sec label="Empty state">
          <EmptyState
            glyph="Th"
            title="Nothing planned for Thursday"
            body="Type in the box above to add a task, or move one here from another day."
            actions={
              <>
                <Button variant="primary" size="lg" onClick={() => toast("Would focus the quick-add box.")}>
                  <PlusIcon />
                  Add a task
                </Button>
                <Button size="lg" onClick={() => toast("Would jump back to today.")}>
                  Back to today
                </Button>
              </>
            }
          />
        </Sec>
      </div>
    </main>
  );
}

function Sec({ label, width, children }: { label: string; width?: number; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-[14px]" style={width ? { width } : undefined}>
      <Label as="h2">{label}</Label>
      {children}
    </section>
  );
}

/** The tile "…" menu: the same menu on every task (02-tiles). */
function TileMenu({ title, onTone }: { title: string; onTone?: boolean }) {
  return (
    <Menu>
      <MenuTrigger asChild>
        <TileDots label={`More for ${title}`} onTone={onTone} />
      </MenuTrigger>
      <MenuContent>
        <MenuItem onSelect={() => toast(`Move “${title}”…`)}>Move</MenuItem>
        <MenuItem onSelect={() => toast(`Cancelled “${title}”.`, { action: { label: "Undo", onClick: () => {} } })}>Cancel</MenuItem>
        <MenuItem onSelect={() => toast(`Edit “${title}”…`)}>Edit</MenuItem>
        <MenuSeparator />
        <MenuItem danger icon={<TrashIcon />} onSelect={() => toast("Task deleted.", { action: { label: "Undo", onClick: () => {} } })}>
          Delete
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

const NEXT: Record<VisualState, VisualState> = { todo: "done", done: "missed", missed: "cancelled", cancelled: "todo" };

const CARDS: { group: string; glyph: string; title: string; meta: string; count: string; tone: Tone; state?: VisualState; stack?: number }[] = [
  { group: "Exercise plan", glyph: "Gy", title: "Gym", meta: "Mon · Wed · Fri", count: "11/12", tone: "moss", state: "done" },
  { group: "Uni — Term 1", glyph: "Ca", title: "Calculus (Mon)", meta: "09:00 · 2h", count: "8/9", tone: "stone" },
  { group: "Morning routine", glyph: "Wa", title: "Water", meta: "×4 daily", count: "12/16", tone: "rose", stack: 2 },
  { group: "One-off", glyph: "De", title: "Dentist", meta: "Thu 15:00", count: "1h", tone: "sea", state: "done" },
  { group: "Uni — Term 1", glyph: "Ph", title: "Physics (Tue)", meta: "11:00 · 2h", count: "6/7", tone: "sky" },
  { group: "One-off", glyph: "Es", title: "Finish essay", meta: "By Fri 23:59", count: "", tone: "sage" },
  { group: "Morning routine", glyph: "Vi", title: "Vitamins", meta: "Daily · by 12:00", count: "9/9", tone: "sand" },
];

const ROWS: { title: string; glyph: string; tone: Tone; meta: string }[] = [
  { title: "Calculus (Mon)", glyph: "Ca", tone: "stone", meta: "09:00 · 2h" },
  { title: "Gym", glyph: "Gy", tone: "moss", meta: "18:00 · 1h" },
  { title: "Vitamins", glyph: "Vi", tone: "sand", meta: "by 12:00" },
  { title: "Dentist", glyph: "De", tone: "sea", meta: "Thu 15:00" },
];
