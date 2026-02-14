import { prisma } from '@/lib/db';
import { rosterForDate } from './roster';

/**
 * Coverage Validation Engine – VALIDATION + WARNINGS ONLY.
 * Does NOT modify base schedules, coverage rules, or auto-adjust shifts.
 * Computed on the fly; not persisted to DB.
 */

export type ValidationResultType = 'MIN_AM' | 'MIN_PM' | 'AM_GT_PM' | 'AM_LT_PM';

export interface ValidationResult {
  type: ValidationResultType;
  severity: 'warning';
  message: string;
  amCount: number;
  pmCount: number;
  minAm: number;
  minPm: number;
}

const CACHE_TTL_MS = 60 * 1000; // 1 minute
const cache = new Map<
  string,
  { result: ValidationResult[]; timestamp: number }
>();

function toDateKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Validates daily coverage for a date using:
 * - Coverage Rules (min AM / min PM per weekday)
 * - Business rule: Morning count must be <= Evening count
 * Data: base shifts + day overrides + leave (effective availability from roster).
 */
export async function validateCoverage(date: Date): Promise<ValidationResult[]> {
  const dateKey = toDateKey(date);
  const cached = cache.get(dateKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const roster = await rosterForDate(date);
  const amCount = roster.amEmployees.length;
  const pmCount = roster.pmEmployees.length;
  const dayOfWeek = new Date(dateKey + 'T12:00:00Z').getUTCDay();

  const rule = await prisma.coverageRule.findFirst({
    where: { dayOfWeek, enabled: true },
    select: { minAM: true, minPM: true },
  });
  const minPm = rule?.minPM ?? 0;
  /** Business rule: AM must be at least 2 when rule exists; never use DB value below 2. */
  const effectiveMinAm = rule ? Math.max(rule.minAM, 2) : 2;

  const results: ValidationResult[] = [];

  if (rule && amCount < effectiveMinAm) {
    results.push({
      type: 'MIN_AM',
      severity: 'warning',
      message: `AM count (${amCount}) is below minimum (${effectiveMinAm})`,
      amCount,
      pmCount,
      minAm: effectiveMinAm,
      minPm,
    });
  }

  if (minPm > 0 && pmCount < minPm) {
    results.push({
      type: 'MIN_PM',
      severity: 'warning',
      message: `PM count (${pmCount}) is below minimum (${minPm})`,
      amCount,
      pmCount,
      minAm: effectiveMinAm,
      minPm,
    });
  }

  if (amCount > pmCount) {
    results.push({
      type: 'AM_GT_PM',
      severity: 'warning',
      message: `AM (${amCount}) > PM (${pmCount})`,
      amCount,
      pmCount,
      minAm: effectiveMinAm,
      minPm,
    });
  }

  /** Business rule: AM must be >= PM every day (computed rule, not stored). */
  if (amCount < pmCount) {
    results.push({
      type: 'AM_LT_PM',
      severity: 'warning',
      message: `AM (${amCount}) < PM (${pmCount})`,
      amCount,
      pmCount,
      minAm: effectiveMinAm,
      minPm,
    });
  }

  cache.set(dateKey, { result: results, timestamp: Date.now() });
  return results;
}

/** Clear cache (e.g. when overrides, leaves, or coverage rules change). Call from API routes that mutate those. */
export function clearCoverageValidationCache(): void {
  cache.clear();
}

/** Helper: human-readable summary for tooltips/UI */
export function formatValidationSummary(results: ValidationResult[]): string {
  return results.map((r) => r.message).join('; ');
}
