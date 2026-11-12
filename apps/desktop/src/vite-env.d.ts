/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Dev only: another database file in the app data folder (see lib/db.ts). */
  readonly VITE_DB_FILE?: string;
}
