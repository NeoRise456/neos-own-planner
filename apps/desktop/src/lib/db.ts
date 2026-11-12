/**
 * Opens the local database (PLAN.md §6): the PowerSync Tauri plugin, a SQLite file in
 * %APPDATA%\com.neo.planner\ — planner.db for the installed app, planner-dev.db while
 * developing. Local only: connect() is never called, so nothing leaves the device.
 */
import { isTauri } from "@tauri-apps/api/core";
import { appDataDir } from "@tauri-apps/api/path";
import { createRepositories, schema } from "@planner/data";
import type { DataContextValue } from "@planner/data/react";
import { currentClock } from "./clock";

/** VITE_DB_FILE=planner-test.db pnpm dev → a throwaway database for trying things (dev only). */
export const DB_FILE = import.meta.env.DEV ? (import.meta.env.VITE_DB_FILE ?? "planner-dev.db") : "planner.db";

export async function openData(): Promise<DataContextValue> {
  if (!isTauri()) {
    return { db: null, repos: null, unavailable: "This browser preview has no database. Run the desktop app (pnpm dev) to save tasks." };
  }
  try {
    const { PowerSyncTauriDatabase } = await import("@powersync/tauri-plugin");
    const db = new PowerSyncTauriDatabase({ schema, database: { dbFilename: DB_FILE, dbLocationAsync: appDataDir } });
    await db.init();
    return { db, repos: createRepositories(db, { clock: currentClock }) };
  } catch (e) {
    console.error("Opening the database failed", e);
    return { db: null, repos: null, unavailable: `The database didn't open: ${e instanceof Error ? e.message : String(e)}` };
  }
}
