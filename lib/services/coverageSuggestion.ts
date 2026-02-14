import { prisma } from '@/lib/db';
import { rosterForDate } from './roster';
import { validateCoverage } from './coverageValidation';

/**
 * Coverage Move Suggestions – ADVISORY ONLY.
 * Does NOT auto-apply overrides. Suggests moving one AM → PM when AM > PM.
 */

export interface CoverageSuggestionImpact {
  amBefore: number;
  pmBefore: number;
  amAfter: number;
  pmAfter: number;
}

export interface CoverageSuggestion {
  date: string;
  fromShift: 'MORNING';
  toShift: 'EVENING';
  empId: string;
  employeeName: string;
  reason: string;
  impact: CoverageSuggestionImpact;
}

export interface CoverageSuggestionResult {
  suggestion: CoverageSuggestion | null;
  explanation?: string;
}

function toDateKey(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

/**
 * Get a single suggested move for a date when AM > PM.
 * Candidate: one AM employee; after move (AM-1) >= MinAM.
 * Ranking: prefer employees with fewer overrides in the same month (fairness).
 */
export async function getCoverageSuggestion(date: Date): Promise<CoverageSuggestionResult> {
  const dateKey = toDateKey(date);
  const validations = await validateCoverage(date);
  const amGtPm = validations.find((v) => v.type === 'AM_GT_PM');
  if (!amGtPm) {
    return { suggestion: null, explanation: undefined };
  }

  const roster = await rosterForDate(date);
  const amCount = roster.amEmployees.length;
  const pmCount = roster.pmEmployees.length;
  /** Business rule: AM must be at least 2; never use DB value below 2. */
  const effectiveMinAm = Math.max(amGtPm.minAm, 2);

  if (amCount <= pmCount) {
    return { suggestion: null, explanation: undefined };
  }

  const afterAm = amCount - 1;
  const afterPm = pmCount + 1;
  if (afterAm < effectiveMinAm) {
    return {
      suggestion: null,
      explanation: 'Cannot suggest move because AM would fall below minimum (2)',
    };
  }
  if (afterAm < afterPm) {
    return {
      suggestion: null,
      explanation: 'Cannot suggest move because AM would be less than PM after move',
    };
  }

  if (roster.amEmployees.length === 0) {
    return { suggestion: null, explanation: 'No AM employees to move' };
  }

  // Month bounds for override-count ranking
  const d = new Date(dateKey + 'T12:00:00Z');
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));

  const overrideCounts = await prisma.shiftOverride.groupBy({
    by: ['empId'],
    where: {
      isActive: true,
      date: { gte: monthStart, lte: monthEnd },
    },
    _count: { id: true },
  });
  const countByEmpId = new Map(overrideCounts.map((o) => [o.empId, o._count.id]));

  // Sort AM employees by override count ascending (fewer overrides = preferred)
  const candidates = [...roster.amEmployees].sort((a, b) => {
    const na = countByEmpId.get(a.empId) ?? 0;
    const nb = countByEmpId.get(b.empId) ?? 0;
    return na - nb;
  });

  const chosen = candidates[0];
  if (!chosen) {
    return { suggestion: null, explanation: 'All AM employees are unavailable or blocked' };
  }

  const reason = `AM (${amCount}) > PM (${pmCount}). Moving 1 person from AM to PM makes AM=${afterAm}, PM=${afterPm} and still meets Min AM=${effectiveMinAm}.`;

  const suggestion: CoverageSuggestion = {
    date: dateKey,
    fromShift: 'MORNING',
    toShift: 'EVENING',
    empId: chosen.empId,
    employeeName: chosen.name,
    reason,
    impact: {
      amBefore: amCount,
      pmBefore: pmCount,
      amAfter: amCount - 1,
      pmAfter: pmCount + 1,
    },
  };

  return { suggestion, explanation: undefined };
}
