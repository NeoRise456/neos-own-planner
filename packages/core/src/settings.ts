/**
 * Settings — the time zone as a UTC offset. It moves "now" (today, the now line, when
 * time runs out), never the times you gave your tasks.
 */
import { type Clock, type OffsetMinutes, clockAt, isValidOffset } from "./dates";
import { type Result, fail, issue, ok } from "./result";

export interface Settings {
  offset: OffsetMinutes;
}

export function setOffset(settings: Settings, offset: OffsetMinutes): Result<Settings> {
  if (!isValidOffset(offset)) {
    return fail(issue("offset_invalid", "The offset must be between UTC−12:00 and UTC+14:00.", "offset"));
  }
  return ok({ ...settings, offset });
}

/** "Now" for the rules, from a real instant and the setting. */
export function clockFor(settings: Settings, instant: Date | number = Date.now()): Clock {
  return clockAt(instant, settings.offset);
}
