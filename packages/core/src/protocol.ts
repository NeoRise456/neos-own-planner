/**
 * Protocols — SYSTEMS.md. A shared, ordered list of plain-text steps; just a reminder.
 */
import { type Check, type Issue, type Result, fail, fromCheck, issue, ok } from "./result";
import type { LocalDate } from "./dates";
import { type Routine, type RoutineEntry, isDraft, routineStatus } from "./routine";
import { type Task, isRoutineCopy } from "./task";

export interface Protocol {
  id: string;
  title: string;
  steps: string[];
}

export function validateProtocol(protocol: Protocol): Check {
  const errors: Issue[] = [];
  const warnings: Issue[] = [];
  if (protocol.title.trim() === "") errors.push(issue("title_required", "The title can't be empty.", "title"));
  protocol.steps.forEach((s, i) => {
    if (s.trim() === "") errors.push(issue("step_empty", `Step ${i + 1} is empty.`, `steps.${i}`));
  });
  if (protocol.steps.length === 0) warnings.push(issue("no_steps", "It has no steps yet.", "steps"));
  return { errors, warnings };
}

export function createProtocol(id: string, title: string, steps: string[] = []): Result<Protocol> {
  const protocol = { id, title: title.trim(), steps: steps.map((s) => s.trim()) };
  return fromCheck(protocol, validateProtocol(protocol));
}

export function renameProtocol(protocol: Protocol, title: string): Result<Protocol> {
  const next = { ...protocol, title: title.trim() };
  return fromCheck(next, validateProtocol(next));
}

/** Adds a step at the end, or at `index`. */
export function addStep(protocol: Protocol, text: string, index = protocol.steps.length): Result<Protocol> {
  const step = text.trim();
  if (step === "") return fail(issue("step_empty", "A step can't be empty.", "steps"));
  const steps = [...protocol.steps];
  steps.splice(Math.max(0, Math.min(index, steps.length)), 0, step);
  return ok({ ...protocol, steps });
}

export function editStep(protocol: Protocol, index: number, text: string): Result<Protocol> {
  if (!inRange(protocol, index)) return fail(issue("step_missing", `There's no step ${index + 1}.`, "steps"));
  const step = text.trim();
  if (step === "") return fail(issue("step_empty", "A step can't be empty.", `steps.${index}`));
  return ok({ ...protocol, steps: protocol.steps.map((s, i) => (i === index ? step : s)) });
}

export function removeStep(protocol: Protocol, index: number): Result<Protocol> {
  if (!inRange(protocol, index)) return fail(issue("step_missing", `There's no step ${index + 1}.`, "steps"));
  return ok({ ...protocol, steps: protocol.steps.filter((_, i) => i !== index) });
}

export function moveStep(protocol: Protocol, from: number, to: number): Result<Protocol> {
  if (!inRange(protocol, from) || !inRange(protocol, to)) {
    return fail(issue("step_missing", "That step doesn't exist.", "steps"));
  }
  const steps = [...protocol.steps];
  const [step] = steps.splice(from, 1);
  steps.splice(to, 0, step!);
  return ok({ ...protocol, steps });
}

// ── Status: active / past / unused ───────────────────────────────────────

/**
 * Worked out from the routines, never stored (SYSTEMS.md "Protocol status"):
 * - active: a published routine that hasn't ended (running or upcoming) uses it in an
 *   entry as the entry is now
 * - past: only history uses it — ended routines, removed entries, or an older version
 *   of an entry
 * - unused: no published routine uses it. Drafts and one-off tasks don't count.
 */
export type ProtocolStatus = "active" | "past" | "unused";

export interface ProtocolUsage {
  status: ProtocolStatus;
  /** Entries of running/upcoming routines that use it now. */
  active: RoutineEntry[];
  /** Entries whose history uses it. */
  past: RoutineEntry[];
  /** Entries of drafts that use it (don't count for the status). */
  drafts: RoutineEntry[];
}

export function protocolUsage(protocolId: string, routines: Routine[], entries: RoutineEntry[], today: LocalDate): ProtocolUsage {
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const usage: ProtocolUsage = { status: "unused", active: [], past: [], drafts: [] };

  for (const entry of entries) {
    if (!entry.versions.some((v) => v.protocolId === protocolId)) continue;
    const routine = routineById.get(entry.routineId);
    if (!routine) continue;
    if (isDraft(routine)) {
      usage.drafts.push(entry);
      continue;
    }
    const latest = entry.versions[entry.versions.length - 1]!;
    const running = routineStatus(routine, today) !== "ended" && (entry.removedFrom === undefined || entry.removedFrom > today);
    if (running && latest.protocolId === protocolId) usage.active.push(entry);
    else usage.past.push(entry);
  }

  usage.status = usage.active.length ? "active" : usage.past.length ? "past" : "unused";
  return usage;
}

export function protocolStatus(protocolId: string, routines: Routine[], entries: RoutineEntry[], today: LocalDate): ProtocolStatus {
  return protocolUsage(protocolId, routines, entries, today).status;
}

/**
 * Only an **unused** protocol can be deleted. Active ones are in use; past ones are part
 * of history (use them again any time instead). Deleting an unused one: draft entries
 * and one-off tasks that use it just lose it — `detachEntries` / `detachTasks` are their
 * ids, and the warning should say so.
 */
export function canDeleteProtocol(input: {
  protocol: Protocol;
  routines: Routine[];
  entries: RoutineEntry[];
  tasks: Task[];
  today: LocalDate;
}): Result<{ detachEntries: string[]; detachTasks: string[] }> {
  const { protocol } = input;
  const usage = protocolUsage(protocol.id, input.routines, input.entries, input.today);
  if (usage.status === "active") {
    return fail(issue("protocol_active", "A running routine uses it. Remove it from those entries first."));
  }
  if (usage.status === "past") {
    return fail(issue("protocol_past", "Past routines used it, so it's part of their history. You can use it again any time."));
  }
  return ok({
    detachEntries: usage.drafts.map((e) => e.id),
    detachTasks: input.tasks.filter((t) => !isRoutineCopy(t) && t.protocolId === protocol.id).map((t) => t.id),
  });
}

// ── Finding one to (re)use ───────────────────────────────────────────────

/**
 * Search by title, then by step text (ignoring case) — past protocols included, so an
 * old one can be used again. Title matches come first; an empty query returns all.
 */
export function findProtocols<P extends Protocol>(protocols: P[], query: string): P[] {
  const q = query.trim().toLocaleLowerCase();
  if (q === "") return [...protocols];
  const inTitle = protocols.filter((p) => p.title.toLocaleLowerCase().includes(q));
  const inSteps = protocols.filter((p) => !inTitle.includes(p) && p.steps.some((s) => s.toLocaleLowerCase().includes(q)));
  return [...inTitle, ...inSteps];
}

/** Picker / sidebar order: active, then unused, then past; by title inside each. */
export function sortByProtocolStatus<P extends { title: string }>(items: { protocol: P; status: ProtocolStatus }[]): { protocol: P; status: ProtocolStatus }[] {
  const rank: Record<ProtocolStatus, number> = { active: 0, unused: 1, past: 2 };
  return [...items].sort((a, b) => rank[a.status] - rank[b.status] || a.protocol.title.localeCompare(b.protocol.title));
}

function inRange(protocol: Protocol, index: number): boolean {
  return Number.isInteger(index) && index >= 0 && index < protocol.steps.length;
}
