/**
 * UI state (PLAN.md §8: Zustand for "selected day, current view, open panels").
 * Only what the screen is showing — no data, no rules.
 */
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Minutes east of UTC, e.g. -300 for UTC−05:00. */
const systemOffset = -new Date().getTimezoneOffset();

interface UiState {
  /** Todo: days away from today (0 = today). */
  todoDayOffset: number;
  /** Todo and Calendar: task open in the side panel. */
  openTaskId: string | null;
  /** Todo: only tasks with this tag (null = all). */
  todoTagFilter: string | null;
  showDone: boolean;
  showCancelled: boolean;
  /** Calendar: weeks away from this week, and the view. */
  calWeekOffset: number;
  calView: "week" | "month";
  /** Calendar: only tasks with this tag (null = all). */
  calTagFilter: string | null;
  /** Settings: the hour the week grid opens scrolled to (0–23). */
  calStartHour: number;
  /** Settings: the time zone "now" is shown in (moves now, never the tasks). */
  utcOffsetMinutes: number;

  set: (patch: Partial<Omit<UiState, "set">>) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      todoDayOffset: 0,
      openTaskId: null,
      todoTagFilter: null,
      showDone: true,
      showCancelled: true,
      calWeekOffset: 0,
      calView: "week",
      calTagFilter: null,
      calStartHour: 7,
      utcOffsetMinutes: systemOffset,
      set: (patch) => set(patch),
    }),
    {
      // Settings stay on this computer until settings join the database (TASK.md).
      // Only the preferences: what's on screen (day, week, open panel, filters) starts fresh.
      // The time zone isn't kept yet: it follows the computer's zone at each launch.
      name: "planner.settings",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ showDone: s.showDone, showCancelled: s.showCancelled, calStartHour: s.calStartHour }),
    },
  ),
);

export function formatOffset(min: number) {
  const sign = min < 0 ? "−" : "+";
  const a = Math.abs(min);
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
