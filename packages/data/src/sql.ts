/**
 * The few write statements the repositories use. Plain INSERT / UPDATE / DELETE only:
 * PowerSync's tables are views, which don't support upserts or RETURNING.
 */
import type { Param, SqlRunner } from "./db";
import type { TableName } from "./schema";

export async function insertRow(tx: SqlRunner, table: TableName, id: string, columns: Record<string, Param>): Promise<void> {
  const names = Object.keys(columns);
  const marks = names.map(() => "?").join(", ");
  await tx.execute(`INSERT INTO ${table} (id, ${names.join(", ")}) VALUES (?, ${marks})`, [id, ...Object.values(columns)]);
}

/** Sets only the given columns. Nothing to change → no statement at all. */
export async function updateRow(tx: SqlRunner, table: TableName, id: string, columns: Record<string, Param>): Promise<void> {
  const names = Object.keys(columns);
  if (names.length === 0) return;
  await tx.execute(`UPDATE ${table} SET ${names.map((n) => `${n} = ?`).join(", ")} WHERE id = ?`, [...Object.values(columns), id]);
}

export async function deleteRow(tx: SqlRunner, table: TableName, id: string): Promise<void> {
  await tx.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
}
