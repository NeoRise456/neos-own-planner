import { describe, expect, it } from "vitest";
import {
  type Routine,
  type RoutineEntry,
  type Task,
  FLOATING_ONCE,
  canDeleteProtocol,
  findProtocols,
  protocolStatus,
  protocolUsage,
  sortByProtocolStatus,
  addStep,
  clockFor,
  createProtocol,
  editStep,
  findTag,
  moveStep,
  removeStep,
  setOffset,
  tagForName,
  validateProtocol,
} from "../src";

describe("protocols", () => {
  const shower = createProtocol("shower", "Shower", ["Get the drier", "Turn on the warm water", "Open the shower"]);
  if (!shower.ok) throw new Error();
  const p = shower.value;

  it("needs a title; steps are non-empty strings", () => {
    expect(createProtocol("x", " ").ok).toBe(false);
    expect(validateProtocol({ ...p, steps: ["ok", " "] }).errors.map((e) => e.code)).toEqual(["step_empty"]);
  });

  it("can start empty, with a warning", () => {
    const r = createProtocol("x", "New protocol");
    expect(r.ok && r.warnings.map((w) => w.code)).toEqual(["no_steps"]);
  });

  it("adds, edits, removes and reorders steps", () => {
    const added = addStep(p, "  Wet hair ");
    expect(added.ok && added.value.steps.at(-1)).toBe("Wet hair");
    expect(addStep(p, "").ok).toBe(false);
    const edited = editStep(p, 1, "Warm water, wait 2 min");
    expect(edited.ok && edited.value.steps[1]).toBe("Warm water, wait 2 min");
    const removed = removeStep(p, 0);
    expect(removed.ok && removed.value.steps).toEqual(["Turn on the warm water", "Open the shower"]);
    expect(removeStep(p, 5).ok).toBe(false);
    const moved = moveStep(p, 2, 0);
    expect(moved.ok && moved.value.steps).toEqual(["Open the shower", "Get the drier", "Turn on the warm water"]);
  });
});

describe("protocol status: active / past / unused", () => {
  const today = "2025-11-11";
  const published = "2025-08-31T20:00+01:00";
  const running: Routine = { id: "morning", title: "Morning", startDate: "2025-11-01", endDate: "2026-01-31", lineage: "morning", publishedAt: published };
  const upcoming: Routine = { ...running, id: "winter", startDate: "2025-12-01", endDate: "2026-02-28", lineage: "winter" };
  const ended: Routine = { ...running, id: "spring", startDate: "2025-03-01", endDate: "2025-05-31", lineage: "spring" };
  const draft: Routine = { id: "draft", title: "Draft", startDate: "2025-12-01", endDate: "2026-02-28", lineage: "draft" };
  const routines = [running, upcoming, ended, draft];
  const blueprint = { title: "Shower", tags: [], rule: { freq: "daily" as const, interval: 1 }, perDay: FLOATING_ONCE };
  const entry = (routineId: string, ...protocolIds: (string | undefined)[]): RoutineEntry => ({
    id: `${routineId}-e`,
    routineId,
    versions: protocolIds.map((protocolId, i) => ({ ...blueprint, ...(protocolId ? { protocolId } : {}), from: `2025-0${i + 1}-01` })),
  });
  const status = (...entries: RoutineEntry[]) => protocolStatus("shower", routines, entries, today);

  it("active: a running or upcoming published routine uses it now", () => {
    expect(status(entry("morning", "shower"))).toBe("active");
    expect(status(entry("winter", "shower"))).toBe("active");
  });

  it("past: only history uses it — an ended routine, an older version, a removed entry", () => {
    expect(status(entry("spring", "shower"))).toBe("past");
    expect(status(entry("morning", "shower", "other"))).toBe("past");
    expect(status({ ...entry("morning", "shower"), removedFrom: "2025-11-05" })).toBe("past");
  });

  it("unused: no published routine — drafts and one-off tasks don't count", () => {
    expect(status()).toBe("unused");
    expect(status(entry("draft", "shower"))).toBe("unused");
  });

  it("active wins over past; using a past one again makes it active", () => {
    expect(status(entry("spring", "shower"), entry("morning", "shower"))).toBe("active");
  });

  it("lists where it's used", () => {
    const u = protocolUsage("shower", routines, [entry("morning", "shower"), entry("spring", "shower"), entry("draft", "shower")], today);
    expect([u.active, u.past, u.drafts].map((xs) => xs.map((e) => e.routineId))).toEqual([["morning"], ["spring"], ["draft"]]);
  });

  describe("deleting", () => {
    const p = { id: "shower", title: "Shower", steps: ["Wet hair"] };
    const del = (entries: RoutineEntry[], tasks: Task[] = []) => canDeleteProtocol({ protocol: p, routines, entries, tasks, today });

    it("only an unused one; draft entries and one-off tasks just lose it", () => {
      const tasks: Task[] = [
        { id: "t1", title: "Shower after gym", tags: [], protocolId: "shower" },
        { id: "t2", title: "Buy milk", tags: [] },
      ];
      expect(del([entry("draft", "shower")], tasks)).toEqual({ ok: true, value: { detachEntries: ["draft-e"], detachTasks: ["t1"] }, warnings: [] });
    });

    it("not an active one, nor a past one (it's history)", () => {
      const active = del([entry("morning", "shower")]);
      expect(!active.ok && active.errors[0]!.code).toBe("protocol_active");
      const past = del([entry("spring", "shower")]);
      expect(!past.ok && past.errors[0]!.code).toBe("protocol_past");
    });
  });
});

describe("finding a protocol to (re)use", () => {
  const list = [
    { id: "a", title: "Gym warm-up", steps: ["5 min bike"] },
    { id: "b", title: "Shower", steps: ["Warm water", "Dry hair"] },
    { id: "c", title: "Hair care", steps: ["Oil"] },
  ];

  it("matches the title first, then the steps, ignoring case", () => {
    expect(findProtocols(list, "HAIR").map((p) => p.id)).toEqual(["c", "b"]);
    expect(findProtocols(list, "  ").map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(findProtocols(list, "yoga")).toEqual([]);
  });

  it("sorts active, unused, past", () => {
    const sorted = sortByProtocolStatus([
      { protocol: list[0]!, status: "past" },
      { protocol: list[1]!, status: "unused" },
      { protocol: list[2]!, status: "active" },
    ]);
    expect(sorted.map((x) => x.status)).toEqual(["active", "unused", "past"]);
  });
});

describe("tags", () => {
  const tags = [{ id: "t1", name: "Uni", color: "sky" }];

  it("are found by name, ignoring case and extra spaces", () => {
    expect(findTag(tags, "  uni ")?.id).toBe("t1");
  });

  it("typing a new name makes a tag on the fly; a known name reuses it", () => {
    const known = tagForName(tags, "UNI", { id: "new", color: "lime" });
    expect(known.ok && known.value).toEqual({ tag: tags[0], created: false });
    const made = tagForName(tags, " home  chores ", { id: "t2", color: "lime" });
    expect(made.ok && made.value).toEqual({ tag: { id: "t2", name: "home chores", color: "lime" }, created: true });
    expect(tagForName(tags, "  ", { id: "t3", color: "lime" }).ok).toBe(false);
  });
});

describe("settings — time zone", () => {
  it("accepts UTC−12:00 … UTC+14:00", () => {
    expect(setOffset({ offset: 0 }, 840).ok).toBe(true);
    expect(setOffset({ offset: 0 }, 900).ok).toBe(false);
  });

  it("moves now, not the tasks", () => {
    const instant = Date.UTC(2026, 10, 11, 23, 30);
    expect(clockFor({ offset: 0 }, instant).at).toBe("2026-11-11T23:30");
    expect(clockFor({ offset: 120 }, instant).at).toBe("2026-11-12T01:30");
  });
});
