import { beforeEach, describe, expect, it } from "vitest";
import { type Clock, type EntryBlueprint, type Task, clockAt, expandRoutineTasks, routineStatus } from "@planner/core";
import { DataError, createRepositories, runQuery, type Repositories } from "../src";
import { type TestDb, testDb } from "./sqlite";

// Wed 11 Nov 2026 at UTC+01:00.
const AT = (day: number, h = 10, m = 0) => clockAt(Date.UTC(2026, 10, day, h - 1, m), 60);

let db: TestDb;
let repos: Repositories;
let clock: Clock;
let ids: number;

beforeEach(() => {
  db = testDb();
  clock = AT(11);
  ids = 0;
  repos = createRepositories(db, { clock: () => clock, newId: () => `id-${++ids}`, nowUtc: () => "2026-11-11T09:00:00.000Z" });
});

const gym: EntryBlueprint = {
  title: "Gym",
  tags: [],
  duration: 60,
  rule: { freq: "weekly", interval: 1, weekdays: [1, 3, 5] },
  perDay: { kind: "times", times: [{ startTime: "18:00" }] },
};

/** What Todo / Calendar would show from the routines between two days. */
async function shown(from: string, to: string): Promise<Task[]> {
  return expandRoutineTasks({
    routines: await runQuery(db, repos.routines.all()),
    entries: await runQuery(db, repos.routines.entries()),
    saved: await runQuery(db, repos.tasks.savedCopies(from, to)),
    from,
    to,
  });
}

async function invalid(p: Promise<unknown>): Promise<string[]> {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(DataError);
  return (e as DataError).issues.map((i) => i.code);
}

async function publishedExercise() {
  const r = await repos.routines.create({ title: "Exercise plan", startDate: "2026-11-01", endDate: "2026-11-30", color: "moss" });
  const entry = await repos.routines.addEntry(r.id, gym);
  await repos.routines.publish(r.id);
  return { r, entry };
}

describe("a routine's life", () => {
  it("a new routine is a draft and produces nothing", async () => {
    const r = await repos.routines.create({ title: "Exercise plan", startDate: "2026-11-01", endDate: "2026-11-30", color: "moss" });
    await repos.routines.addEntry(r.id, gym);
    expect(routineStatus((await runQuery(db, repos.routines.all()))[0]!, "2026-11-11")).toBe("draft");
    expect(await shown("2026-11-09", "2026-11-15")).toEqual([]);
  });

  it("publishing needs an entry; then tasks start from today, never filling the past", async () => {
    const r = await repos.routines.create({ title: "Empty", startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(await invalid(repos.routines.publish(r.id))).toContain("entries_required");
    await publishedExercise();
    const days = (await shown("2026-11-09", "2026-11-15")).map((t) => t.startDate);
    expect(days).toEqual(["2026-11-11", "2026-11-13"]); // Mon 9 is before the publish day
  });

  it("a published start date is locked; the end can't move before the last done task", async () => {
    const { r } = await publishedExercise();
    expect(await invalid(repos.routines.edit(r.id, { startDate: "2026-11-02" }))).toContain("start_locked");
    const [fri] = await shown("2026-11-13", "2026-11-13");
    clock = AT(13, 19);
    await repos.tasks.tick(fri!);
    expect(await invalid(repos.routines.edit(r.id, { endDate: "2026-11-12" }))).toContain("end_before_last_done");
  });
});

describe("touch-to-save", () => {
  it("ticking a fresh routine task saves it, with its derived id", async () => {
    await publishedExercise();
    const [wed] = await shown("2026-11-11", "2026-11-11");
    expect(await runQuery(db, repos.tasks.savedCopies("2026-11-11", "2026-11-11"))).toEqual([]);
    clock = AT(11, 19);
    const done = await repos.tasks.tick(wed!);
    expect(done.id).toBe(wed!.id);
    const saved = await runQuery(db, repos.tasks.savedCopies("2026-11-11", "2026-11-11"));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: wed!.id, doneAt: "2026-11-11T19:00+01:00", occurrenceSlot: 1 });
    // Shown once: the saved one replaces the fresh one.
    expect((await shown("2026-11-11", "2026-11-11")).map((t) => t.doneAt)).toEqual(["2026-11-11T19:00+01:00"]);
  });

  it("deleting a routine task cancels it (and saves it)", async () => {
    await publishedExercise();
    const [fri] = await shown("2026-11-13", "2026-11-13");
    const out = await repos.tasks.remove(fri!);
    expect(out.action).toBe("cancelled");
    expect((await shown("2026-11-13", "2026-11-13"))[0]!.cancelledAt).toBeDefined();
  });

  it("one-off queries never see routine tasks", async () => {
    await publishedExercise();
    const [wed] = await shown("2026-11-11", "2026-11-11");
    await repos.tasks.move(wed!, { startDate: "2026-11-11", startTime: "19:00" });
    expect(await runQuery(db, repos.tasks.aroundDay("2026-11-11"))).toEqual([]);
    expect(await runQuery(db, repos.tasks.between("2026-11-09", "2026-11-15"))).toEqual([]);
  });
});

describe("changing a published routine", () => {
  it("an entry change applies from today on; earlier days keep the old one", async () => {
    const { entry } = await publishedExercise();
    clock = AT(16); // Mon 16
    await repos.routines.changeEntry(entry.id, { ...gym, perDay: { kind: "times", times: [{ startTime: "19:00" }] } });
    const times = (await shown("2026-11-11", "2026-11-18")).map((t) => `${t.startDate} ${t.startTime}`);
    expect(times).toEqual(["2026-11-11 18:00", "2026-11-13 18:00", "2026-11-16 19:00", "2026-11-18 19:00"]);
  });

  it("removing an entry stops its tasks from today; touched ones after go, done ones stay", async () => {
    const { entry } = await publishedExercise();
    const [wed, fri] = await shown("2026-11-11", "2026-11-13");
    clock = AT(11, 19);
    await repos.tasks.tick(wed!);
    await repos.tasks.move(fri!, { startDate: "2026-11-13", startTime: "17:00" });
    await repos.routines.removeEntry(entry.id);
    const left = await shown("2026-11-09", "2026-11-22");
    expect(left.map((t) => t.startDate)).toEqual(["2026-11-11"]);
    expect(left[0]!.doneAt).toBeDefined();
  });

  it("End: ends today; touched tasks after today go", async () => {
    const { r } = await publishedExercise();
    const [fri] = await shown("2026-11-13", "2026-11-13");
    await repos.tasks.move(fri!, { startDate: "2026-11-13", startTime: "07:00" });
    const ended = await repos.routines.end(r.id);
    expect(ended.endDate).toBe("2026-11-11");
    expect(await shown("2026-11-12", "2026-11-30")).toEqual([]);
    expect(await runQuery(db, repos.tasks.savedCopies("2026-11-01", "2026-11-30"))).toEqual([]);
  });
});

describe("back to draft, delete, duplicate", () => {
  it("back to draft only while nothing is done; touched tasks go away", async () => {
    const { r } = await publishedExercise();
    const [wed] = await shown("2026-11-11", "2026-11-11");
    await repos.tasks.cancel(wed!);
    await repos.routines.unpublish(r.id);
    expect(await runQuery(db, repos.tasks.copiesOfRoutine(r.id))).toEqual([]);
    expect(await shown("2026-11-09", "2026-11-15")).toEqual([]);
  });

  it("delete: refused once something is done (end it instead)", async () => {
    const { r } = await publishedExercise();
    const [wed] = await shown("2026-11-11", "2026-11-11");
    clock = AT(11, 19);
    await repos.tasks.tick(wed!);
    expect(await invalid(repos.routines.remove(r.id))).toContain("has_done_tasks");
    expect(await invalid(repos.routines.unpublish(r.id))).toContain("has_done_tasks");
  });

  it("delete a draft: its entries go; copies made from it keep going without the link", async () => {
    const r = await repos.routines.create({ title: "Exercise plan", startDate: "2026-11-01", endDate: "2026-11-30" });
    await repos.routines.addEntry(r.id, gym);
    const copy = await repos.routines.duplicate(r.id, { startDate: "2027-01-04", endDate: "2027-03-28" });
    expect(copy).toMatchObject({ clonedFrom: r.id, lineage: r.id, title: "Exercise plan" });
    await repos.routines.remove(r.id);
    const routines = await runQuery(db, repos.routines.all());
    expect(routines.map((x) => x.id)).toEqual([copy.id]);
    expect(routines[0]!.clonedFrom).toBeUndefined();
    const entries = await runQuery(db, repos.routines.entries());
    expect(entries.map((e) => [e.routineId, e.versions[0]!.title, e.versions[0]!.from])).toEqual([[copy.id, "Gym", "2027-01-04"]]);
  });
});

it("an entry's new tag names are made with it; a refused entry makes none", async () => {
  const r = await repos.routines.create({ title: "Exercise plan", startDate: "2026-11-01", endDate: "2026-11-30" });
  const e = await repos.routines.addEntry(r.id, gym, [{ name: "Health", color: "moss" }]);
  const health = (await repos.tags.list()).find((t) => t.name === "Health")!;
  expect(e.versions[0]!.tags).toEqual([health.id]);
  await invalid(repos.routines.addEntry(r.id, { ...gym, title: " " }, [{ name: "Nope", color: "sky" }]));
  expect((await repos.tags.list()).map((t) => t.name)).toEqual(["Health"]);
});

describe("protocols", () => {
  it("steps: add, edit, move, remove, and put back", async () => {
    const p = await repos.protocols.create("Shower");
    await repos.protocols.addStep(p.id, "Warm water");
    await repos.protocols.addStep(p.id, "Soap");
    await repos.protocols.addStep(p.id, "Rinse");
    await repos.protocols.moveStep(p.id, 2, 0);
    await repos.protocols.editStep(p.id, 1, "Warm water, 2 min");
    const after = await repos.protocols.removeStep(p.id, 2);
    expect(after.steps).toEqual(["Rinse", "Warm water, 2 min"]);
    expect((await repos.protocols.addStep(p.id, "Soap", 2)).steps).toEqual(["Rinse", "Warm water, 2 min", "Soap"]);
  });

  it("only an unused one can be deleted; drafts and one-offs just lose it", async () => {
    const p = await repos.protocols.create("Warm-up", ["Jog 5 min"]);
    const draft = await repos.routines.create({ title: "Draft", startDate: "2026-11-01", endDate: "2026-11-30" });
    const draftEntry = await repos.routines.addEntry(draft.id, { ...gym, protocolId: p.id });
    const task = await repos.tasks.create({ title: "Run", protocolId: p.id });
    const live = await repos.routines.create({ title: "Live", startDate: "2026-11-01", endDate: "2026-11-30" });
    const liveEntry = await repos.routines.addEntry(live.id, { ...gym, protocolId: p.id });
    await repos.routines.publish(live.id);
    expect(await invalid(repos.protocols.remove(p.id))).toContain("protocol_active");

    clock = AT(12);
    await repos.routines.changeEntry(liveEntry.id, gym); // stops using it from Thu…
    expect(await invalid(repos.protocols.remove(p.id))).toContain("protocol_past"); // …but its history did

    await repos.routines.unpublish(live.id); // back to its latest version: now only a draft and a one-off use it
    expect(await repos.protocols.remove(p.id)).toEqual({ detachedEntries: 1, detachedTasks: 1 });
    const entries = await runQuery(db, repos.routines.entries());
    expect(entries.find((e) => e.id === draftEntry.id)!.versions[0]!.protocolId).toBeUndefined();
    expect((await repos.tasks.get(task.id))!.protocolId).toBeUndefined();
  });
});
