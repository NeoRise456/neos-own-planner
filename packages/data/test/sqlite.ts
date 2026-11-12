/**
 * A temporary in-memory database for the repository tests (PLAN.md §10): plain SQLite
 * (Node's built-in node:sqlite) with the same tables and columns as the PowerSync
 * schema, behind the same `Db` shape. PowerSync's views accept the same plain
 * INSERT / UPDATE / DELETE / SELECT statements the repositories use.
 */
import { DatabaseSync } from "node:sqlite";
import type { Db, Param, Row, SqlRunner } from "../src/db";
import { TABLES } from "../src/schema";

export interface TestDb extends Db {
  /** Every statement that wrote something, in order — to check what a change touched. */
  writes: { sql: string; params: Param[] }[];
}

export function testDb(): TestDb {
  const sqlite = new DatabaseSync(":memory:");
  for (const [table, cols] of Object.entries(TABLES)) {
    const defs = Object.entries(cols).map(([name, type]) => `${name} ${type === "integer" ? "INTEGER" : "TEXT"}`);
    sqlite.exec(`CREATE TABLE ${table} (id TEXT PRIMARY KEY NOT NULL, ${defs.join(", ")})`);
  }

  const writes: TestDb["writes"] = [];
  const plain = (row: unknown): Row => ({ ...(row as Row) });

  const runner: SqlRunner = {
    async execute(sql, params = []) {
      writes.push({ sql, params });
      return sqlite.prepare(sql).run(...params);
    },
    async getAll<T>(sql: string, params: Param[] = []) {
      return sqlite.prepare(sql).all(...params).map(plain) as T[];
    },
    async getOptional<T>(sql: string, params: Param[] = []) {
      const row = sqlite.prepare(sql).get(...params);
      return (row === undefined ? null : plain(row)) as T | null;
    },
  };

  let queue: Promise<unknown> = Promise.resolve();
  return {
    ...runner,
    writes,
    // One transaction at a time, like PowerSync's write lock.
    writeTransaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T> {
      const run = queue.then(async () => {
        sqlite.exec("BEGIN");
        try {
          const out = await fn(runner);
          sqlite.exec("COMMIT");
          return out;
        } catch (e) {
          sqlite.exec("ROLLBACK");
          throw e;
        }
      });
      queue = run.catch(() => undefined);
      return run;
    },
  };
}
