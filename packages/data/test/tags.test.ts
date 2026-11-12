import { beforeEach, expect, it } from "vitest";
import { clockAt } from "@planner/core";
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
