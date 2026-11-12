import type { Issue } from "@planner/core";

export type DataErrorCode = "not_found" | "invalid";

/** The one error the repositories throw (PLAN.md §6). `issues` come from @planner/core. */
export class DataError extends Error {
  readonly code: DataErrorCode;
  readonly issues: Issue[];

  constructor(code: DataErrorCode, issues: Issue[]) {
    super(issues.map((i) => i.message).join(" ") || code);
    this.name = "DataError";
    this.code = code;
    this.issues = issues;
  }

  static notFound(what: string, id: string): DataError {
    return new DataError("not_found", [{ code: "not_found", message: `There's no ${what} with id ${id}.` }]);
  }
}

export function isDataError(e: unknown): e is DataError {
  return e instanceof DataError;
}
