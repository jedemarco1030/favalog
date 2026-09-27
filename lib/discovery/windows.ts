/**
 * Release-date windows for discovery shelves. All dates are UTC calendar days
 * (`YYYY-MM-DD`). A title only qualifies for a date-based shelf when the
 * provider states a full, valid date — a bare year never does.
 */

/** "Recent releases": originally released within this many days, up to today. */
export const RECENT_WINDOW_DAYS = 45;

/** "Coming soon": releasing from tomorrow up to this many days ahead. */
export const UPCOMING_WINDOW_DAYS = 365;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export interface DateWindow {
  from: string;
  to: string;
}

export function recentWindow(now: Date): DateWindow {
  return { from: isoDay(addDays(now, -RECENT_WINDOW_DAYS)), to: isoDay(now) };
}

export function upcomingWindow(now: Date): DateWindow {
  return {
    from: isoDay(addDays(now, 1)),
    to: isoDay(addDays(now, UPCOMING_WINDOW_DAYS)),
  };
}

/** A real calendar date in `YYYY-MM-DD` form, or `undefined`. */
export function parseReleaseDate(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || isoDay(parsed) !== value) {
    return undefined;
  }
  return value;
}

export function isWithin(date: string, window: DateWindow): boolean {
  return date >= window.from && date <= window.to;
}

export function yearOf(date: string | undefined): number | undefined {
  if (!date) return undefined;
  const year = Number(date.slice(0, 4));
  return Number.isInteger(year) && year > 0 ? year : undefined;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** e.g. "Oct 30, 2026". */
export function formatReleaseDate(date: string): string {
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`));
}
