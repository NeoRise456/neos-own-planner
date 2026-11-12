/**
 * What the repositories need from a database. The PowerSync database fits this shape
 * as is; the tests use plain SQLite (node:sqlite) behind the same shape.
 */
export type Param = string | number | null;
export type Row = Record<string, unknown>;

export interface SqlRunner {
  execute(sql: string, params?: Param[]): Promise<unknown>;
  getAll<T = Row>(sql: string, params?: Param[]): Promise<T[]>;
  getOptional<T = Row>(sql: string, params?: Param[]): Promise<T | null>;
}

export interface Db extends SqlRunner {
  writeTransaction<T>(fn: (tx: SqlRunner) => Promise<T>): Promise<T>;
}

/**
 * A read the UI can watch: the SQL and a mapper from rows to domain objects. The
 * repositories build these; `useLive` (react.ts) re-runs them whenever their tables change.
 */
export interface LiveQuery<T> {
  sql: string;
  parameters: Param[];
  mapper: (row: Row) => T;
}

/** Run a live query once (tests, one-off reads). */
export async function runQuery<T>(db: SqlRunner, query: LiveQuery<T>): Promise<T[]> {
  const rows = await db.getAll<Row>(query.sql, query.parameters);
  return rows.map(query.mapper);
}
