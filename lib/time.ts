/**
 * Riyadh timezone (Asia/Riyadh) and date/month/week utilities.
 * Week starts Saturday. All dates normalized to 00:00 in Riyadh where applicable.
 */

const RIYADH_TZ = 'Asia/Riyadh';

/** Current date/time in Riyadh as Date. Uses Intl for reliable parsing across Node envs. */
export function getRiyadhNow(): Date {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RIYADH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '0';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const hr = Number(get('hour'));
  const min = Number(get('minute'));
  const sec = Number(get('second'));
  if (!Number.isFinite(y + m + d)) return now;
  return new Date(Date.UTC(y, m - 1, d, hr, min, sec, 0));
}

/**
 * Format date as YYYY-MM-DD in Riyadh.
 */
export function toRiyadhDateString(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    const n = new Date();
    return n.toISOString().slice(0, 10);
  }
  return date.toLocaleDateString('en-CA', { timeZone: RIYADH_TZ }).replace(/\//g, '-');
}

/**
 * Normalize a date to date-only at 00:00 in Riyadh.
 * Returns a Date at UTC midnight representing that calendar day (for DB DATE comparison).
 */
export function toRiyadhDateOnly(date: Date): Date {
  if (Number.isNaN(date.getTime())) {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0));
  }
  const str = toRiyadhDateString(date);
  const [y, m, d] = str.split('-').map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0));
  }
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

/**
 * Month key "YYYY-MM" for a date in Riyadh.
 */
export function formatMonthKey(date: Date): string {
  return toRiyadhDateString(date).slice(0, 7);
}

/** Normalize YYYY-MM string to ASCII digits (e.g. "2026-0١" → "2026-01") so Date parsing and DB queries work. */
export function normalizeMonthKey(monthKey: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return monthKey.replace(/[٠-٩]/g, (c) => String(arabicDigits.indexOf(c)));
}

/**
 * Start (inclusive) and end (exclusive) of month in Riyadh.
 * start: first day 00:00, endExclusive: first day of next month 00:00 (for range queries).
 */
export function getMonthRange(monthKey: string): { start: Date; endExclusive: Date } {
  const normalized = normalizeMonthKey(monthKey);
  const [y, m] = normalized.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  return { start, endExclusive };
}

/**
 * Week range in Riyadh with week starting Saturday.
 * Returns startSat and endExclusive (next Saturday 00:00 UTC) for the week containing the given date.
 * Uses UTC midnight dates for DB DATE comparison.
 */
export function getWeekRangeForDate(date: Date): { startSat: Date; endExclusiveFriPlus1: Date } {
  const str = toRiyadhDateString(date);
  const [y, m, d] = str.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  const dow = utc.getUTCDay(); // 0=Sun .. 6=Sat
  const daysToSaturday = (dow - 6 + 7) % 7;
  const startSat = new Date(utc);
  startSat.setUTCDate(startSat.getUTCDate() - daysToSaturday);
  const endExclusive = new Date(startSat);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 7);
  return { startSat, endExclusiveFriPlus1: endExclusive };
}

/**
 * Intersect two ranges [aStart, aEnd) and [bStart, bEnd).
 * Returns { start, end } for the overlap, or null if no overlap.
 */
export function intersectRanges(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): { start: Date; end: Date } | null {
  const start = new Date(Math.max(aStart.getTime(), bStart.getTime()));
  const end = new Date(Math.min(aEnd.getTime(), bEnd.getTime()));
  if (start.getTime() >= end.getTime()) return null;
  return { start, end };
}

/**
 * Number of calendar days in a month (for daily target = monthlyTarget / daysInMonth).
 */
export function getDaysInMonth(monthKey: string): number {
  const normalized = normalizeMonthKey(monthKey);
  const [y, m] = normalized.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0));
  return last.getUTCDate();
}
