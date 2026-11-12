import { beforeEach, describe, expect, it } from "vitest";
import { type Tag, clockAt } from "@planner/core";
import { DataError, createRepositories, runQuery, type Repositories } from "../src";
import { type TestDb, testDb } from "./sqlite";

let db: TestDb;
let repos: Repositories;
let ids: number;

beforeEach(() => {
  ids = 0;
  db = testDb();
  repos = createRepositories(db, {
    clock: () => clockAt(Date.UTC(2026, 10, 11, 9), 60),
    newId: () => `id-${++ids}`,
    nowUtc: () => "2026-11-11T09:00:00.000Z",
  });
});

it("ensure creates a tag once, then finds it ignoring case and spaces", async () => {
  const uni = await repos.tags.ensure("  Uni ", "sky");
  expect(uni).toEqual({ id: "id-1", name: "Uni", color: "sky" });
  expect(await repos.tags.ensure("uni", "rose")).toEqual(uni);
  expect(await repos.tags.list()).toEqual([uni]);
});

it("an empty name is refused", async () => {
  await expect(repos.tags.ensure("  ", "sky")).rejects.toBeInstanceOf(DataError);
});

it("rename refuses a name another tag has", async () => {
  await repos.tags.ensure("Uni", "sky");
  const gym = await repos.tags.ensure("Gym", "moss");
  const e = (await repos.tags.rename(gym.id, "UNI").catch((err: unknown) => err)) as DataError;
  expect(e.issues.map((i) => i.code)).toEqual(["name_taken"]);
  expect((await repos.tags.rename(gym.id, "Gym  days")).name).toBe("Gym days");
});

it("tasks keep their tag ids; all() lists by name", async () => {
  const b = await repos.tags.ensure("b-tag", "sky");
  const a = await repos.tags.ensure("a-tag", "moss");
  const t = await repos.tasks.create({ title: "Read", tags: [b.id, a.id] });
  expect((await repos.tasks.get(t.id))?.tags).toEqual([b.id, a.id]);
  expect((await runQuery(db, repos.tags.all())).map((x) => x.name)).toEqual(["a-tag", "b-tag"]);
});

describe("Settings → Tags", () => {
  let uni: Tag, gym: Tag;
  beforeEach(async () => {
    uni = await repos.tags.ensure("Uni", "sky");
    gym = await repos.tags.ensure("Gym", "moss");
  });
  const tagsOf = async (id: string) => (await repos.tasks.get(id))?.tags;

  it("recolor saves only the color", async () => {
    expect(await repos.tags.recolor(uni.id, "#112233")).toEqual({ ...uni, color: "#112233" });
    expect(db.writes.at(-1)!.sql).toBe("UPDATE tags SET color = ?, updated_at = ? WHERE id = ?");
  });

  it("withUses counts the tasks that have each tag", async () => {
    await repos.tasks.create({ title: "Essay", tags: [uni.id] });
    await repos.tasks.create({ title: "Lab", tags: [uni.id, gym.id] });
    const uses = await runQuery(db, repos.tags.withUses());
    expect(uses.map((t) => [t.name, t.uses])).toEqual([
      ["Gym", 1],
      ["Uni", 2],
    ]);
  });

  it("delete takes it off every task; restore puts it back in the same place", async () => {
    const lab = await repos.tasks.create({ title: "Lab", tags: [uni.id, gym.id] });
    const removed = await repos.tags.remove(uni.id);
    expect(removed.from).toEqual([{ taskId: lab.id, index: 0 }]);
    expect(await tagsOf(lab.id)).toEqual([gym.id]);
    expect(await repos.tags.list()).toEqual([gym]);
    await repos.tags.restore(removed);
    expect(await tagsOf(lab.id)).toEqual([uni.id, gym.id]);
    expect((await repos.tags.list()).map((t) => t.id)).toContain(uni.id);
  });

  it("merge moves every task to the other tag and deletes the old one", async () => {
    const both = await repos.tasks.create({ title: "Both", tags: [gym.id, uni.id] });
    const one = await repos.tasks.create({ title: "One", tags: [gym.id] });
    expect(await repos.tags.merge(gym.id, uni.id)).toBe(2);
    expect(await tagsOf(both.id)).toEqual([uni.id]);
    expect(await tagsOf(one.id)).toEqual([uni.id]);
    expect(await repos.tags.list()).toEqual([uni]);
  });
});

describe("tagging a task with new names", () => {
  it("creates the new tags with the task's edit, in order", async () => {
    const uni = await repos.tags.ensure("Uni", "sky");
    const t = await repos.tasks.quickAdd("Essay");
    const saved = await repos.tasks.edit(t.id, {}, [{ name: "Writing", color: "rose" }, { id: uni.id }, { name: "uni", color: "lime" }]);
    const writing = (await repos.tags.list()).find((x) => x.name === "Writing")!;
    expect(saved.tags).toEqual([writing.id, uni.id]);
  });

  it("a refused edit creates no tag", async () => {
    const t = await repos.tasks.quickAdd("Essay");
    await expect(repos.tasks.edit(t.id, { title: " " }, [{ name: "Writing", color: "rose" }])).rejects.toBeInstanceOf(DataError);
    expect(await repos.tags.list()).toEqual([]);
  });
});
