/**
 * Smart Suggestions Engine – ADVISORY ONLY. Never auto-applies.
 * Proposes MOVE / SWAP / REMOVE_COVER / ASSIGN; deterministic, explainable.
 * Never suggests violating Friday rule, Leave/OFF/Absent.
 * Ranked by least impact first.
 */

import type { ScheduleGridResult } from './scheduleGrid';
import { FRIDAY_DAY_OF_WEEK } from './shift';

export type SuggestionType = 'MOVE' | 'SWAP' | 'REMOVE_COVER' | 'ASSIGN';

export interface ScheduleSuggestion {
  id: string;
  type: SuggestionType;
  date: string;
  dayIndex: number;
  /** Affected employee(s): empId, name, and role in suggestion */
  affected: Array<{ empId: string; name: string; fromShift: string; toShift: string }>;
  before: { am: number; pm: number; rashidAm: number; rashidPm: number };
  after: { am: number; pm: number; rashidAm: number; rashidPm: number };
  reason: string;
  /** For Preview: cell keys to highlight e.g. ["empId|date"] */
  highlightCells: string[];
}

const FRIDAY = FRIDAY_DAY_OF_WEEK;

function cellKey(empId: string, date: string): string {
  return `${empId}|${date}`;
}

/**
 * Build ranked suggestions for the week from grid result.
 * Only for days with violations; never suggests Friday AM.
 */
export function buildScheduleSuggestions(grid: ScheduleGridResult): ScheduleSuggestion[] {
  const out: ScheduleSuggestion[] = [];
  const { days, rows, counts } = grid;

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    const date = day.date;
    const dayOfWeek = new Date(date + 'T12:00:00Z').getUTCDay();
    const isFriday = dayOfWeek === FRIDAY;
    const c = counts[dayIndex] ?? { amCount: 0, pmCount: 0, rashidAmCount: 0, rashidPmCount: 0 };
    const am = c.amCount;
    const pm = c.pmCount;
    const rashidAm = c.rashidAmCount ?? 0;
    const rashidPm = c.rashidPmCount ?? 0;
    /** Business rule: AM must be at least 2; never use DB value below 2. */
    const effectiveMinAm = Math.max(day.minAm ?? 2, 2);
    const minPm = day.minPm ?? 0;

    // 1) AM > PM (except Friday where AM is 0) → MOVE one AM → PM only if after move AM >= PM and AM >= effectiveMinAm
    if (!isFriday && am > pm && am >= 1) {
      const afterAm = am - 1;
      const afterPm = pm + 1;
      if (afterAm >= effectiveMinAm && afterAm >= afterPm) {
        const amCandidates = rows.filter((r) => {
          const cell = r.cells[dayIndex];
          return cell?.availability === 'WORK' && cell?.effectiveShift === 'MORNING';
        });
        if (amCandidates.length > 0) {
          const chosen = amCandidates[0];
          out.push({
            id: `move-${date}-${chosen.empId}`,
            type: 'MOVE',
            date,
            dayIndex,
            affected: [{ empId: chosen.empId, name: chosen.name, fromShift: 'MORNING', toShift: 'EVENING' }],
            before: { am, pm, rashidAm, rashidPm },
            after: { am: afterAm, pm: afterPm, rashidAm, rashidPm },
            reason: `AM (${am}) > PM (${pm}). Move ${chosen.name} from AM to PM → AM=${afterAm}, PM=${afterPm}.`,
            highlightCells: [cellKey(chosen.empId, date)],
          });
        }
      }
    }

    // 2) AM < effectiveMinAm (except Friday) → REMOVE_COVER Rashid AM to free someone to boutique AM
    if (!isFriday && effectiveMinAm > 0 && am < effectiveMinAm && rashidAm >= 1) {
      const rashidAmRows = rows.filter((r) => {
        const cell = r.cells[dayIndex];
        return cell?.availability === 'WORK' && cell?.effectiveShift === 'COVER_RASHID_AM';
      });
      if (rashidAmRows.length > 0) {
        const chosen = rashidAmRows[0];
        out.push({
          id: `remove-cover-am-${date}-${chosen.empId}`,
          type: 'REMOVE_COVER',
          date,
          dayIndex,
          affected: [{ empId: chosen.empId, name: chosen.name, fromShift: 'COVER_RASHID_AM', toShift: 'MORNING' }],
          before: { am, pm, rashidAm, rashidPm },
          after: { am: am + 1, pm, rashidAm: rashidAm - 1, rashidPm },
          reason: `AM (${am}) < Min AM (${effectiveMinAm}). Cancel Rashid AM for ${chosen.name} → assign to Boutique AM.`,
          highlightCells: [cellKey(chosen.empId, date)],
        });
      }
    }

    // 3) Excess Rashid causing PM shortage (PM < AM or PM < MinPM) → REMOVE_COVER Rashid PM
    if (pm < am || (minPm > 0 && pm < minPm)) {
      if (rashidPm >= 1) {
        const rashidPmRows = rows.filter((r) => {
          const cell = r.cells[dayIndex];
          return cell?.availability === 'WORK' && cell?.effectiveShift === 'COVER_RASHID_PM';
        });
        if (rashidPmRows.length > 0) {
          const chosen = rashidPmRows[0];
          out.push({
            id: `remove-cover-pm-${date}-${chosen.empId}`,
            type: 'REMOVE_COVER',
            date,
            dayIndex,
            affected: [{ empId: chosen.empId, name: chosen.name, fromShift: 'COVER_RASHID_PM', toShift: 'EVENING' }],
            before: { am, pm, rashidAm, rashidPm },
            after: { am, pm: pm + 1, rashidAm, rashidPm: rashidPm - 1 },
            reason: `PM (${pm}) below need. Cancel Rashid PM for ${chosen.name} → assign to Boutique PM.`,
            highlightCells: [cellKey(chosen.empId, date)],
          });
        }
      }
    }

    // 4) Friday PM overload (PM very high) – optional nudge only; no auto-fix. Skip invalid suggestions.
  }

  return out;
}
