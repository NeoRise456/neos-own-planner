/**
 * How rules report problems. An error blocks the change; a warning is allowed but
 * should be shown (e.g. "due before start" — TASK.md).
 */

export interface Issue {
  /** Stable machine code, e.g. "title_required". The UI turns it into words. */
  code: string;
  /** The field it's about, when there is one. */
  field?: string;
  /** Plain-English explanation (for logs and tests; the UI may phrase it differently). */
  message: string;
}

export interface Check {
  errors: Issue[];
  warnings: Issue[];
}

export type Result<T> =
  | { ok: true; value: T; warnings: Issue[] }
  | { ok: false; errors: Issue[]; warnings: Issue[] };

export function issue(code: string, message: string, field?: string): Issue {
  return field === undefined ? { code, message } : { code, field, message };
}

export function ok<T>(value: T, warnings: Issue[] = []): Result<T> {
  return { ok: true, value, warnings };
}

export function fail<T = never>(errors: Issue | Issue[], warnings: Issue[] = []): Result<T> {
  return { ok: false, errors: Array.isArray(errors) ? errors : [errors], warnings };
}

/** Turns a check into a result: errors → fail, otherwise ok with the warnings. */
export function fromCheck<T>(value: T, check: Check): Result<T> {
  return check.errors.length ? fail(check.errors, check.warnings) : ok(value, check.warnings);
}
