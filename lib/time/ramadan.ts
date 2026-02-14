/**
 * Ramadan date range: during this period, shifts are AM-only (PM not selectable).
 * Off / Weekly off unchanged. Uses env RAMADAN_START and RAMADAN_END (YYYY-MM-DD).
 * If either is missing, returns false (no Ramadan mode).
 */

export function isRamadan(date: Date): boolean {
  const start = process.env.RAMADAN_START;
  const end = process.env.RAMADAN_END;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return false;
  }
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const startMs = new Date(start + 'T00:00:00Z').getTime();
  const endMs = new Date(end + 'T23:59:59.999Z').getTime();
  const t = d.getTime();
  return t >= startMs && t <= endMs;
}

/** Returns { start, end } from env or null if not set. */
export function getRamadanRange(): { start: string; end: string } | null {
  const start = process.env.RAMADAN_START;
  const end = process.env.RAMADAN_END;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return null;
  }
  return { start, end };
}
