/**
 * MOCK STORE — in-memory demo state for the screens that aren't on real data yet
 * (routines, protocols, calendar). Nothing is saved: restarting resets it. No rules from
 * SYSTEMS.md live here; these setters just flip fields so you can try the UI.
 * Tasks are real since phase 2 (@planner/data); routines and protocols follow in phase 5.
 */
import { create } from "zustand";
import type { ProtocolStatus } from "@planner/core";
import type { Tone } from "@/lib/tones";
import { glyphOf } from "@/lib/glyph";
import { PROTOCOLS, ROUTINES, type MockEntry, type MockProtocol, type MockRoutine } from "./data";

let n = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;
export { glyphOf };

interface MockState {
  routines: MockRoutine[];
  protocols: MockProtocol[];

  // routines
  addRoutine: (r: { name: string; purpose: string; period: string; tone: Tone }) => string;
  updateRoutine: (id: string, patch: Partial<MockRoutine>) => void;
  duplicateRoutine: (id: string) => string;
  deleteRoutine: (id: string) => void;
  publishRoutine: (id: string) => void;
  unpublishRoutine: (id: string) => void;
  endRoutine: (id: string) => void;
  saveEntry: (routineId: string, entry: Omit<MockEntry, "id" | "seq" | "score"> & { id?: string }) => void;
  removeEntry: (routineId: string, entryId: string) => void;

  // protocols
  addProtocol: (title: string) => string;
  deleteProtocol: (id: string) => void;
  addStep: (protocolId: string, text: string) => void;
  removeStep: (protocolId: string, index: number) => void;
}

/**
 * Keep MockProtocol.used in step with an entry's protocol. Switching away in a draft just
 * drops the old use; in a published routine the old one stays as history (past).
 */
function syncProtocolUse(protocols: MockProtocol[], routine: MockRoutine, entry: MockEntry, before?: string): MockProtocol[] {
  return protocols.map((p) => {
    let used = p.used;
    if (before === p.id && entry.protocolId !== p.id) {
      used = routine.draft ? used.filter((u) => u.entryId !== entry.id) : used.map((u) => (u.entryId === entry.id ? { ...u, past: true } : u));
    }
    if (entry.protocolId === p.id) {
      used = [
        ...used.filter((u) => u.entryId !== entry.id),
        { label: entry.title, kind: routine.name, tone: entry.tone ?? routine.tone, routineId: routine.id, entryId: entry.id },
      ];
    }
    return used === p.used ? p : { ...p, used };
  });
}

/**
 * Mock stand-in for @planner/core's protocolUsage: active = a published routine that
 * hasn't ended uses it now; past = only ended routines / older versions did; unused =
 * no published routine (drafts don't count).
 */
export function protocolStatusOf(protocol: MockProtocol, routines: MockRoutine[]) {
  const byId = new Map(routines.map((r) => [r.id, r]));
  const out = { active: [] as MockProtocol["used"], past: [] as MockProtocol["used"], drafts: [] as MockProtocol["used"] };
  for (const u of protocol.used) {
    const r = byId.get(u.routineId);
    if (!r) continue;
    if (r.draft) out.drafts.push(u);
    else if (r.ended || u.past) out.past.push(u);
    else out.active.push(u);
  }
  const status: ProtocolStatus = out.active.length ? "active" : out.past.length ? "past" : "unused";
  return { status, ...out };
}

export const useMock = create<MockState>((set, get) => ({
  routines: ROUTINES,
  protocols: PROTOCOLS,

  // New routines start as drafts (SYSTEMS.md "Draft → publish").
  addRoutine: ({ name, purpose, period, tone }) => {
    const id = newId("r");
    set((s) => ({
      routines: [
        ...s.routines,
        { id, name, purpose, period, tone, glyph: glyphOf(name), status: "Draft", draft: true, pct: 0, pctLabel: "", entries: [] },
      ],
    }));
    return id;
  },

  updateRoutine: (id, patch) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  duplicateRoutine: (id) => {
    const src = get().routines.find((r) => r.id === id)!;
    const copyId = newId("r");
    // The copy is a draft: adjust it, then publish.
    const copy: MockRoutine = {
      ...src,
      id: copyId,
      name: `${src.name} (copy)`,
      ended: false,
      draft: true,
      status: "Draft",
      period: "Pick new dates",
      pct: 0,
      pctLabel: "",
      entries: src.entries.map((e) => ({ ...e, id: newId("e"), seq: "", score: "" })),
    };
    set((s) => ({ routines: [...s.routines, copy] }));
    return copyId;
  },

  // Only drafts, or routines with nothing done, can be deleted — no history is left behind.
  deleteRoutine: (id) =>
    set((s) => ({
      routines: s.routines.filter((r) => r.id !== id),
      protocols: s.protocols.map((p) => ({ ...p, used: p.used.filter((u) => u.routineId !== id) })),
    })),

  publishRoutine: (id) =>
    set((s) => ({
      routines: s.routines.map((r) =>
        r.id === id
          ? {
              ...r,
              draft: false,
              status: "Active · started today",
              pct: 0,
              pctLabel: "Nothing done yet",
              entries: r.entries.map((e) => ({ ...e, seq: "", score: "0/0" })),
            }
          : r,
      ),
    })),

  unpublishRoutine: (id) =>
    set((s) => ({
      routines: s.routines.map((r) =>
        r.id === id ? { ...r, draft: true, status: "Draft", pct: 0, pctLabel: "", entries: r.entries.map((e) => ({ ...e, seq: "", score: "" })) } : r,
      ),
      // Back to draft drops its history, so uses that were only history go too.
      protocols: s.protocols.map((p) => ({ ...p, used: p.used.filter((u) => !(u.routineId === id && u.past)) })),
    })),

  endRoutine: (id) =>
    set((s) => ({
      routines: s.routines.map((r) => {
        if (r.id !== id) return r;
        const start = r.period.split("→")[0]?.trim() ?? "";
        const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        return { ...r, ended: true, status: "Ended", period: `${start} → ${today}` };
      }),
    })),

  saveEntry: (routineId, entry) =>
    set((s) => {
      const routine = s.routines.find((r) => r.id === routineId)!;
      const existing = entry.id ? routine.entries.find((e) => e.id === entry.id) : undefined;
      const entryId = existing?.id ?? newId("e");
      const saved: MockEntry = existing
        ? { ...existing, ...entry, id: entryId }
        : { ...entry, id: entryId, seq: "", score: routine.draft ? "" : "0/0" };
      return {
        routines: s.routines.map((r) =>
          r.id !== routineId ? r : { ...r, entries: existing ? r.entries.map((e) => (e.id === entryId ? saved : e)) : [...r.entries, saved] },
        ),
        protocols: syncProtocolUse(s.protocols, routine, saved, existing?.protocolId),
      };
    }),

  removeEntry: (routineId, entryId) =>
    set((s) => {
      const routine = s.routines.find((r) => r.id === routineId)!;
      return {
        routines: s.routines.map((r) => (r.id === routineId ? { ...r, entries: r.entries.filter((e) => e.id !== entryId) } : r)),
        // Draft: the use just goes. Published: its history keeps using it → past.
        protocols: s.protocols.map((p) => ({
          ...p,
          used: routine.draft
            ? p.used.filter((u) => u.entryId !== entryId)
            : p.used.map((u) => (u.entryId === entryId ? { ...u, past: true } : u)),
        })),
      };
    }),

  addProtocol: (title) => {
    const id = newId("p");
    set((s) => ({ protocols: [...s.protocols, { id, title, glyph: glyphOf(title), tone: "stone", used: [], steps: [] }] }));
    return id;
  },

  // Only unused ones get here. Draft entries that used it just lose it
  // (SYSTEMS.md "Deleting a protocol").
  deleteProtocol: (id) =>
    set((s) => ({
      protocols: s.protocols.filter((p) => p.id !== id),
      routines: s.routines.map((r) => ({
        ...r,
        entries: r.entries.map((e) => (e.protocolId === id ? { ...e, protocolId: undefined } : e)),
      })),
    })),

  addStep: (protocolId, text) =>
    set((s) => ({ protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: [...p.steps, text] } : p)) })),

  removeStep: (protocolId, index) =>
    set((s) => ({
      protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: p.steps.filter((_, i) => i !== index) } : p)),
    })),
}));
