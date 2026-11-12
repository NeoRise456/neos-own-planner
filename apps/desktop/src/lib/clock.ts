/**
 * "Now" for the rules: a @planner/core Clock from the real time and the time zone set
 * in Settings (which moves now, never the tasks).
 */
import { useEffect, useMemo, useState } from "react";
import { type Clock, clockAt } from "@planner/core";
import { useUi } from "@/stores/ui";

/** For actions (tick, cancel…): read at the moment they run. */
export const currentClock = (): Clock => clockAt(Date.now(), useUi.getState().utcOffsetMinutes);

/** For rendering: a new Clock each minute (so tasks turn missed on time) or when the zone changes. */
export function useClock(): Clock {
  const offset = useUi((s) => s.utcOffsetMinutes);
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / 60_000));
  useEffect(() => {
    const id = window.setInterval(() => setMinute(Math.floor(Date.now() / 60_000)), 5_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => clockAt(minute * 60_000, offset), [minute, offset]);
}
