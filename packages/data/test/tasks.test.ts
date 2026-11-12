import { beforeEach, describe, expect, it } from "vitest";
import { type Clock, type Task, clockAt, todoForDay } from "@planner/core";
import { DataError, createRepositories, runQuery, taskFromRow, type Repositories } from "../src";
import { type TestDb, testDb } from "./sqlite";

// Wed 11 Nov 2026, 10:00 at UTC+01:00.
const AT = (h: number, m = 0, day = 11) => clockAt(Date.UTC(2026, 10, day, h - 1, m), 60);

let db: TestDb;
let repos: Repositories;
let clock: Clock;
let ids: number;

beforeEach(() => {
  db = testDb();
  clock = AT(10);
  ids = 0;
  repos = createRepositories(db, {
    clock: () => clock,
    newId: () => `id-${++ids}`,
    nowUtc: () => "2026-11-11T09:00:00.000Z",
  });
});

const row = (id: string) => db.getOptional<Record<string, unknown>>("SELECT * FROM tasks WHERE id = ?", [id]);
const lastWrite = () => db.writes.at(-1)!;

async function expectInvalid(p: Promise<unknown>, code: string) {
  const e = await p.then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(DataError);
  expect((e as DataError).code).toBe("invalid");
  expect((e as DataError).issues.map((i) => i.code)).toContain(code);
}

describe("creating", () => {
  it("quick-add saves a one-off anytime task", async () => {
    const t = await repos.tasks.quickAdd("  Buy milk ");
    expect(t).toEqual({ id: "id-1", title: "Buy milk", tags: [] });
    expect(await row("id-1")).toMatchObject({
      title: "Buy milk",
      tag_ids: "[]",
      start_date: null,
      done_at: null,
      created_at: "2026-11-11T09:00:00.000Z",
      updated_at: "2026-11-11T09:00:00.000Z",
    });
  });

  it("quick-add while looking at a later day puts it on that day", async () => {
    expect(await repos.tasks.quickAdd("Pack", "2026-11-13")).toMatchObject({ startDate: "2026-11-13" });
    expect((await repos.tasks.quickAdd("Bin", "2026-11-09")).startDate).toBeUndefined();
  });

  it("refuses what the rules refuse, and writes nothing", async () => {
    await expectInvalid(repos.tasks.create({ title: "   " }), "title_required");
    await expectInvalid(repos.tasks.create({ title: "Gym", startTime: "18:00" }), "time_without_date");
    expect(await db.getAll("SELECT * FROM tasks")).toEqual([]);
  });

  it("keeps every field through the database", async () => {
    const t = await repos.tasks.create({
      title: "Dentist",
      notes: "Bring the card",
      tags: ["tag-a", "tag-b", "tag-a"],
      duration: 45,
      startDate: "2026-11-12",
      startTime: "15:00",
      dueDate: "2026-11-12",
      dueTime: "16:00",
    });
    expect(t.tags).toEqual(["tag-a", "tag-b"]);
    expect(await repos.tasks.get(t.id)).toEqual(t);
  });
});

describe("changing", () => {
  it("edit saves only the columns that changed", async () => {
    const t = await repos.tasks.quickAdd("Buy milk");
    await repos.tasks.edit(t.id, { title: "Buy oat milk", notes: "the barista one" });
    expect(lastWrite().sql).toBe("UPDATE tasks SET title = ?, notes = ?, updated_at = ? WHERE id = ?");
    expect(await repos.tasks.get(t.id)).toEqual({ id: t.id, title: "Buy oat milk", notes: "the barista one", tags: [] });
  });

  it("an edit that changes nothing writes nothing", async () => {
    const t = await repos.tasks.quickAdd("Buy milk");
    const before = db.writes.length;
    await repos.tasks.edit(t.id, { title: "Buy milk " });
    expect(db.writes.length).toBe(before);
  });

  it("clearing a field sets it to NULL", async () => {
    const t = await repos.tasks.create({ title: "Call mom", dueDate: "2026-11-15", notes: "x" });
    await repos.tasks.edit(t.id, { dueDate: undefined, notes: undefined });
    expect(await row(t.id)).toMatchObject({ due_date: null, notes: null });
  });

  it("move changes the date and time", async () => {
    const t = await repos.tasks.create({ title: "Gym", startDate: "2026-11-11", startTime: "18:00", duration: 60 });
    const moved = await repos.tasks.move(t.id, { startDate: "2026-11-12", startTime: "19:00" });
    expect(moved).toMatchObject({ startDate: "2026-11-12", startTime: "19:00", duration: 60 });
  });

  it("a missing task is not_found", async () => {
    const e = await repos.tasks.tick("nope").catch((err: unknown) => err);
    expect(e).toBeInstanceOf(DataError);
    expect((e as DataError).code).toBe("not_found");
  });
});

describe("ticking & cancelling", () => {
  it("tick sets done_at and logged_at from the clock; untick clears both", async () => {
    const t = await repos.tasks.quickAdd("Buy milk");
    const done = await repos.tasks.tick(t.id);
    expect(done).toMatchObject({ doneAt: "2026-11-11T10:00+01:00", loggedAt: "2026-11-11T10:00+01:00" });
    await expectInvalid(repos.tasks.tick(t.id), "already_done");
    const undone = await repos.tasks.untick(t.id);
    expect(undone.doneAt).toBeUndefined();
    expect(await row(t.id)).toMatchObject({ done_at: null, logged_at: null });
  });

  it("done on time: done_at is the given moment, logged_at is now", async () => {
    const t = await repos.tasks.create({ title: "Reply to email", dueDate: "2026-11-06" });
    const done = await repos.tasks.tick(t.id, "2026-11-06T23:59+01:00");
    expect(done).toMatchObject({ doneAt: "2026-11-06T23:59+01:00", loggedAt: "2026-11-11T10:00+01:00" });
  });

  it("cancel / uncancel, and a done task can't be cancelled", async () => {
    const t = await repos.tasks.quickAdd("Buy milk");
    expect((await repos.tasks.cancel(t.id)).cancelledAt).toBe("2026-11-11T10:00+01:00");
    await expectInvalid(repos.tasks.tick(t.id), "cancelled_cannot_tick");
    await repos.tasks.uncancel(t.id);
    await repos.tasks.tick(t.id);
    await expectInvalid(repos.tasks.cancel(t.id), "done_cannot_cancel");
  });
});

describe("deleting", () => {
  it("a one-off is removed, and restore puts the same task back in its place", async () => {
    const t = await repos.tasks.create({ title: "Buy milk", tags: ["x"] });
    const out = await repos.tasks.remove(t.id);
    expect(out).toEqual({ action: "deleted", task: t, createdAt: "2026-11-11T09:00:00.000Z" });
    expect(await row(t.id)).toBeNull();
    if (out.action !== "deleted") throw new Error("expected a delete");
    repos = createRepositories(db, { clock: () => clock, newId: () => "x", nowUtc: () => "2026-11-11T12:00:00.000Z" });
    await repos.tasks.restore(out.task, out.createdAt);
    expect(await repos.tasks.get(t.id)).toEqual(t);
    expect(await row(t.id)).toMatchObject({ created_at: "2026-11-11T09:00:00.000Z", updated_at: "2026-11-11T12:00:00.000Z" });
  });

  it("a routine copy is cancelled instead of removed", async () => {
    await db.execute(
      "INSERT INTO tasks (id, title, tag_ids, start_date, routine_entry_id, occurrence_date, occurrence_slot) VALUES (?, ?, ?, ?, ?, ?, ?)",
      ["copy-1", "Gym", "[]", "2026-11-11", "entry-1", "2026-11-11", 1],
    );
    const out = await repos.tasks.remove("copy-1");
    expect(out.action).toBe("cancelled");
    expect(await row("copy-1")).toMatchObject({ cancelled_at: "2026-11-11T10:00+01:00" });
  });
});

describe("reading a day", () => {
  /** What the Todo view shows: the query narrows, core decides. */
  async function day(date: string) {
    const tasks = await runQuery(db, repos.tasks.aroundDay(date));
    const d = todoForDay(tasks, date, clock);
    const titles = (ts: Task[]) => ts.map((t) => t.title);
    return {
      missed: titles(d.missed),
      scheduled: titles(d.scheduled),
      during: titles(d.during),
      anytime: titles(d.anytime),
      done: titles(d.done),
      cancelled: titles(d.cancelled),
    };
  }

  beforeEach(async () => {
    await repos.tasks.quickAdd("Buy milk");
    await repos.tasks.create({ title: "Reply to email", dueDate: "2026-11-06" }); // missed
    await repos.tasks.create({ title: "Dentist", startDate: "2026-11-12", startTime: "15:00", duration: 60 });
    await repos.tasks.create({ title: "Call mom", startDate: "2026-11-11", dueDate: "2026-11-15" });
    const old = await repos.tasks.quickAdd("Old chore");
    clock = AT(9, 0, 9); // ticked on Mon 9 Nov
    await repos.tasks.tick(old.id);
    clock = AT(10);
  });

  it("today", async () => {
    expect(await day("2026-11-11")).toEqual({
      missed: ["Reply to email"],
      scheduled: [],
      during: ["Call mom"],
      anytime: ["Buy milk"],
      done: [],
      cancelled: [],
    });
  });

  it("tomorrow and a past day", async () => {
    expect(await day("2026-11-12")).toMatchObject({ scheduled: ["Dentist"], during: ["Call mom"], anytime: [] });
    expect(await day("2026-11-09")).toMatchObject({ done: ["Old chore"], anytime: [], during: [] });
  });

  it("the query leaves out closed tasks from other days", async () => {
    const titles = (await runQuery(db, repos.tasks.aroundDay("2026-11-11"))).map((t) => t.title);
    expect(titles).not.toContain("Old chore");
  });

  it("byId reads one task", async () => {
    const [t] = await runQuery(db, repos.tasks.byId("id-1"));
    expect(t?.title).toBe("Buy milk");
  });
});

it("rows map back without empty fields", () => {
  expect(taskFromRow({ id: "a", title: "x", tag_ids: null, duration: null, notes: null })).toEqual({ id: "a", title: "x", tags: [] });
});
