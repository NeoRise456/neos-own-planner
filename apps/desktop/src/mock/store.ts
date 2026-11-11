/**
 * MOCK STORE — in-memory demo state so every screen is clickable.
 * Nothing is saved: restarting the app resets it. No rules from TASK.md /
 * SYSTEMS.md live here; these setters just flip fields so you can try the UI.
 * Replaced by repositories + TanStack Query (+ @planner/core) in phase 2.
 */
import { create } from "zustand";
import type { Tone } from "@/lib/tones";
import {
  PROTOCOLS,
  ROUTINES,
  TASKS,
  type MockEntry,
  type MockProtocol,
  type MockRoutine,
  type MockTask,
} from "./data";

let n = 0;
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;
export const glyphOf = (title: string) => {
  const t = title.trim();
  return (t.slice(0, 1).toUpperCase() + t.slice(1, 2).toLowerCase()) || "··";
};

interface MockState {
  tasks: MockTask[];
  routines: MockRoutine[];
  protocols: MockProtocol[];

  // tasks
  tick: (id: string, doneMeta?: string) => void;
  setCancelled: (id: string, cancelled: boolean) => void;
  addTask: (title: string) => void;
  updateTask: (id: string, patch: Partial<MockTask>) => void;
  deleteTask: (id: string) => void;

  // routines
  addRoutine: (r: { name: string; purpose: string; period: string; tone: Tone }) => string;
  updateRoutine: (id: string, patch: Partial<MockRoutine>) => void;
  duplicateRoutine: (id: string) => string;
  deleteRoutine: (id: string) => void;
  saveEntry: (routineId: string, entry: Omit<MockEntry, "id" | "seq" | "score"> & { id?: string }) => void;

  // protocols
  addProtocol: (title: string) => string;
  addStep: (protocolId: string, text: string) => void;
  removeStep: (protocolId: string, index: number) => void;
}

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const useMock = create<MockState>((set, get) => ({
  tasks: TASKS,
  routines: ROUTINES,
  protocols: PROTOCOLS,

  tick: (id, doneMeta) =>
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        if (t.count) {
          // Count task: each tick fills one more copy; ticking a full one opens it back up.
          if (t.done) return { ...t, done: false, count: { ...t.count, done: t.count.of - 1 } };
          const done = t.count.done + 1;
          return { ...t, count: { ...t.count, done }, done: done >= t.count.of, doneMeta: `done ${nowHHMM()}` };
        }
        return t.done ? { ...t, done: false } : { ...t, done: true, cancelled: false, doneMeta: doneMeta ?? `done ${nowHHMM()}` };
      }),
    })),

  setCancelled: (id, cancelled) =>
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, cancelled, done: cancelled ? false : t.done } : t)) })),

  addTask: (title) =>
    set((s) => ({
      tasks: [
        ...s.tasks,
        { id: newId("t"), title, glyph: glyphOf(title), tone: "stone", section: "anytime", meta: "", done: false, cancelled: false, group: "One-off" },
      ],
    })),

  updateTask: (id, patch) => set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

  addRoutine: ({ name, purpose, period, tone }) => {
    const id = newId("r");
    set((s) => ({
      routines: [
        ...s.routines.filter((r) => !r.ended),
        { id, name, purpose, period, tone, glyph: glyphOf(name), status: "Active", pct: 0, pctLabel: "Nothing done yet", entries: [] },
        ...s.routines.filter((r) => r.ended),
      ],
    }));
    return id;
  },

  updateRoutine: (id, patch) => set((s) => ({ routines: s.routines.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  duplicateRoutine: (id) => {
    const src = get().routines.find((r) => r.id === id)!;
    const copyId = newId("r");
    const copy: MockRoutine = {
      ...src,
      id: copyId,
      name: `${src.name} (copy)`,
      ended: false,
      status: "Upcoming",
      period: "Pick new dates",
      pct: 0,
      pctLabel: "Nothing done yet",
      entries: src.entries.map((e) => ({ ...e, id: newId("e"), seq: "", score: "0/0" })),
    };
    set((s) => ({ routines: [...s.routines.filter((r) => !r.ended), copy, ...s.routines.filter((r) => r.ended)] }));
    return copyId;
  },

  deleteRoutine: (id) => set((s) => ({ routines: s.routines.filter((r) => r.id !== id) })),

  saveEntry: (routineId, entry) =>
    set((s) => ({
      routines: s.routines.map((r) => {
        if (r.id !== routineId) return r;
        if (entry.id && r.entries.some((e) => e.id === entry.id)) {
          return { ...r, entries: r.entries.map((e) => (e.id === entry.id ? { ...e, ...entry, id: e.id } : e)) };
        }
        return { ...r, entries: [...r.entries, { ...entry, id: newId("e"), seq: "", score: "0/0" }] };
      }),
    })),

  addProtocol: (title) => {
    const id = newId("p");
    set((s) => ({ protocols: [...s.protocols, { id, title, glyph: glyphOf(title), tone: "stone", used: [], steps: [] }] }));
    return id;
  },

  addStep: (protocolId, text) =>
    set((s) => ({ protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: [...p.steps, text] } : p)) })),

  removeStep: (protocolId, index) =>
    set((s) => ({
      protocols: s.protocols.map((p) => (p.id === protocolId ? { ...p, steps: p.steps.filter((_, i) => i !== index) } : p)),
    })),
}));
