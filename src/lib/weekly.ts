/**
 * The weekly to-do board's sense of "this week".
 *
 * Checking an item stores the Sunday it belongs to, and an item only reads as
 * done while that Sunday is the current one. So the board resets itself at the
 * turn of the week with no scheduled job to run or miss.
 */

/**
 * Weeks turn over in the church's own timezone, not the server's. Production
 * runs in UTC, where Sunday starts at 8pm Saturday local — the board would
 * wipe itself on Saturday evening, right before the biggest day of the week.
 */
export const CHURCH_TIMEZONE = "America/New_York";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The calendar date and weekday as they read on a wall clock at the church. */
function localParts(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/**
 * The Sunday that starts the week containing `at`, as YYYY-MM-DD.
 * Church weeks run Sunday to Saturday, matching the rest of the app.
 */
export function weekStart(at: Date = new Date(), timeZone = CHURCH_TIMEZONE): string {
  const { year, month, day, weekday } = localParts(at, timeZone);
  // Plain calendar arithmetic: built from UTC and shifted by whole days, so
  // no DST gap can land us on the wrong date.
  const sunday = new Date(Date.UTC(year, month - 1, day) - weekday * DAY_MS);
  return sunday.toISOString().slice(0, 10);
}

/** An item is done only if it was checked during the current week. */
export function isCheckedThisWeek(
  checkedWeek: string | null,
  at: Date = new Date(),
  timeZone = CHURCH_TIMEZONE,
): boolean {
  if (!checkedWeek) return false;
  return checkedWeek === weekStart(at, timeZone);
}

/** Days until the board resets, for the hint under the heading. */
export function daysUntilReset(at: Date = new Date(), timeZone = CHURCH_TIMEZONE): number {
  const { weekday } = localParts(at, timeZone);
  return 7 - weekday;
}
