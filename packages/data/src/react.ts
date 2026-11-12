/**
 * React bindings: the data context and `useLive`, a watched query.
 *
 * `useLive` is a trimmed rewrite of `useQuery` / `QueryRunner` from @powersync/react
 * 2.2.1 (Apache-2.0, © Journey Mobile, Inc. — github.com/powersync-ja/powersync-js).
 * We can't use that package: it needs @powersync/common ≥ 2.5, and the Tauri plugin pins
 * 2.0.0 (PLAN.md §6). The pieces it relies on — `db.query().differentialWatch()` — are
 * already in 2.0.0. Kept from the original:
 * - one store per hook, read through `useSyncExternalStore`;
 * - the query only starts once a render is committed (a `useEffect`), so renders React
 *   throws away never run SQL, and work stops when nothing listens;
 * - a differential watch: rows that didn't change keep the same object, so React only
 *   redraws what changed.
 * Changed for this app:
 * - takes our repositories' `LiveQuery` (SQL + mapper to domain objects), rows keyed by `id`;
 * - no sync streams, suspense, run-once or refresh (local only for now);
 * - while a changed query (another day…) loads, the previous rows stay — no flash of empty.
 */
import { createContext, createElement, useContext, useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import type { CommonPowerSyncDatabase, DifferentialWatchedQuery } from "@powersync/common";
import type { LiveQuery } from "./db";
import type { Repositories } from "./index";

/** The database as the hook needs it. */
export type WatchDb = Pick<CommonPowerSyncDatabase, "query">;

export interface DataContextValue {
  db: WatchDb | null;
  repos: Repositories | null;
  /** Why there's no database (e.g. running in a plain browser). */
  unavailable?: string;
}

const DataContext = createContext<DataContextValue>({ db: null, repos: null, unavailable: "No data provider." });

export function DataProvider({ value, children }: { value: DataContextValue; children: ReactNode }) {
  return createElement(DataContext.Provider, { value }, children);
}

export function useData(): DataContextValue {
  return useContext(DataContext);
}

/** The repositories. Throws where there's no database — guard with `useData().repos`. */
export function useRepos(): Repositories {
  const { repos, unavailable } = useData();
  if (!repos) throw new Error(unavailable ?? "No database.");
  return repos;
}

export interface LiveResult<T> {
  /** Don't mutate: unchanged rows are shared between results. */
  readonly data: T[];
  /** Only true before the first result. */
  readonly isLoading: boolean;
  readonly error: Error | undefined;
}

const LOADING: LiveResult<never> = { data: [], isLoading: true, error: undefined };
const EMPTY: LiveResult<never> = { data: [], isLoading: false, error: undefined };

interface Source<T> {
  db: WatchDb;
  query: LiveQuery<T>;
  key: string;
}

const keyOf = (q: LiveQuery<unknown>) => JSON.stringify([q.sql, q.parameters]);

class LiveRunner<T extends { id: string }> {
  private listeners = new Set<() => void>();
  private source: Source<T> | null = null;
  private watch: DifferentialWatchedQuery<T> | null = null;
  private unlisten: (() => void) | null = null;
  private result: LiveResult<T> = LOADING;

  readonly subscribe = (onChange: () => void) => {
    this.listeners.add(onChange);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(onChange);
      if (this.listeners.size === 0) this.stop();
    };
  };

  readonly getSnapshot = () => this.result;

  /** Called after commit. Same database + same SQL and parameters → nothing to do. */
  configure(db: WatchDb, query: LiveQuery<T>) {
    const key = keyOf(query);
    if (this.source?.db === db && this.source.key === key) return;
    this.source = { db, query, key };
    if (this.listeners.size > 0) {
      this.stop();
      this.start();
    }
  }

  private start() {
    if (!this.source || this.watch) return;
    const { db, query } = this.source;
    const watch = db
      .query<T>({ sql: query.sql, parameters: query.parameters, mapper: query.mapper })
      .differentialWatch({ rowComparator: { keyBy: (row) => row.id, compareBy: (row) => JSON.stringify(row) } });
    this.watch = watch;
    this.unlisten = watch.registerListener({
      onStateChange: (state) => {
        if (this.watch !== watch) return;
        // Still loading the (new) query: keep showing what we had.
        if (state.isLoading && !state.error) return;
        this.result = { data: state.data as T[], isLoading: false, error: state.error ?? undefined };
        for (const notify of this.listeners) notify();
      },
    });
  }

  private stop() {
    this.unlisten?.();
    this.unlisten = null;
    void this.watch?.close();
    this.watch = null;
  }
}

/**
 * The rows of a repository read, kept up to date: re-runs whenever a table it reads
 * changes (here, or later through sync). Pass `null` to read nothing.
 *
 * @example const { data: tasks } = useLive(repos.tasks.aroundDay(day));
 */
export function useLive<T extends { id: string }>(query: LiveQuery<T> | null): LiveResult<T> {
  const { db, unavailable } = useData();
  const ref = useRef<LiveRunner<T>>(null);
  const runner = (ref.current ??= new LiveRunner<T>());
  const snapshot = useSyncExternalStore(runner.subscribe, runner.getSnapshot, runner.getSnapshot);

  useEffect(() => {
    if (db && query) runner.configure(db, query);
  });

  if (!db) return { ...EMPTY, error: new Error(unavailable ?? "No database.") };
  if (!query) return EMPTY;
  return snapshot;
}
