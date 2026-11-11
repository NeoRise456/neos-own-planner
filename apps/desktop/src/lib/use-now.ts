import { useEffect, useState } from "react";
import { useUi } from "@/stores/ui";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * The current wall-clock time in the time zone picked in Settings.
 * Re-renders every 15 s. Display only (title bar clock, sidebar, calendar now line).
 */
export function useNow() {
  const offset = useUi((s) => s.utcOffsetMinutes);
  const [ms, setMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setMs(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  // A Date whose *UTC* fields read as local time in the chosen zone.
  const shifted = new Date(ms + offset * 60_000);
  const h = shifted.getUTCHours();
  const m = shifted.getUTCMinutes();
  return {
    hours: h + m / 60,
    label: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
    /** "Tue 10 Nov" */
    dateLabel: `${DAYS[shifted.getUTCDay()]} ${shifted.getUTCDate()} ${MONTHS[shifted.getUTCMonth()]}`,
  };
}
