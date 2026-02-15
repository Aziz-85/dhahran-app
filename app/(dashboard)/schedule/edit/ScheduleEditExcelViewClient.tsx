'use client';

import { useCallback, useMemo } from 'react';
import { getFirstName } from '@/lib/name';
import { getVisibleSlotCount, getSlotColumnClass } from '@/lib/schedule/scheduleSlots';

const FRIDAY_DAY_OF_WEEK = 5;

type GridCell = { date: string; availability: string; effectiveShift: string; overrideId: string | null; baseShift: string };
type GridRow = { empId: string; name: string; team: string; cells: GridCell[] };
type GridDay = { date: string; dayName: string; dayOfWeek: number; minAm: number; minPm: number };

export type ScheduleEditExcelViewProps = {
  gridData: { days: GridDay[]; rows: GridRow[]; counts: Array<{ amCount: number; pmCount: number }> };
  getDraftShift: (empId: string, date: string, serverEffective: string) => string;
  getRowAndCell: (empId: string, date: string) => { row: GridRow; cell: GridCell } | null;
  addPendingEdit: (empId: string, date: string, newShift: string, row: GridRow, cell: GridCell) => void;
  canEdit: boolean;
  lockedDaySet: Set<string>;
  formatDDMM: (d: string) => string;
  getDayName: (d: string) => string;
  getDayShort?: (d: string) => string;
  t: (key: string) => string;
};

export function ScheduleEditExcelViewClient({
  gridData,
  getDraftShift,
  getRowAndCell,
  addPendingEdit,
  canEdit,
  lockedDaySet,
  formatDDMM,
  getDayName,
  getDayShort,
  t,
}: ScheduleEditExcelViewProps) {
  const { days, rows, counts } = gridData;
  const dayShort = (d: string) => (getDayShort ? getDayShort(d) : getDayName(d).slice(0, 3));

  const { morningByDay, eveningByDay, rashidByDay, eligibleByDay } = useMemo(() => {
    const morningByDay: string[][] = [];
    const eveningByDay: string[][] = [];
    const rashidByDay: string[] = [];
    const eligibleByDay: GridRow[][] = [];
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const date = days[dayIdx].date;
      const isFriday = days[dayIdx].dayOfWeek === FRIDAY_DAY_OF_WEEK;
      const morning: string[] = [];
      const evening: string[] = [];
      let rashidEmpId: string | null = null;
      const eligible: GridRow[] = [];
      for (const row of rows) {
        const cell = row.cells[dayIdx];
        if (!cell || cell.availability !== 'WORK') continue;
        eligible.push(row);
        const shift = getDraftShift(row.empId, date, cell.effectiveShift);
        if (isFriday) {
          if (shift === 'EVENING') evening.push(row.empId);
        } else {
          if (shift === 'MORNING') morning.push(row.empId);
          if (shift === 'EVENING') evening.push(row.empId);
        }
        if ((shift === 'COVER_RASHID_AM' || shift === 'COVER_RASHID_PM') && rashidEmpId == null) rashidEmpId = row.empId;
      }
      morningByDay.push(morning);
      eveningByDay.push(evening);
      rashidByDay.push(rashidEmpId ?? '');
      eligibleByDay.push(eligible);
    }
    return { morningByDay, eveningByDay, rashidByDay, eligibleByDay };
  }, [days, rows, getDraftShift]);

  const { visibleSlots, maxPerCell } = useMemo(
    () => getVisibleSlotCount({ morningByDay, eveningByDay }),
    [morningByDay, eveningByDay]
  );
  const slotExtra = getSlotColumnClass(visibleSlots);
  const showMaxColumnsWarning = maxPerCell > 6;

  /** أعمدة فارغة طوال الأسبوع تُعطى عرضاً ضيقاً (2rem) */
  const { emptyMorningSlots, emptyEveningSlots } = useMemo(() => {
    const emptyM = Array.from({ length: visibleSlots }, (_, i) =>
      days.every((_, dayIdx) => !(morningByDay[dayIdx] ?? [])[i])
    );
    const emptyE = Array.from({ length: visibleSlots }, (_, i) =>
      days.every((_, dayIdx) => !(eveningByDay[dayIdx] ?? [])[i])
    );
    return { emptyMorningSlots: emptyM, emptyEveningSlots: emptyE };
  }, [days, morningByDay, eveningByDay, visibleSlots]);

  const handleSlotChange = useCallback(
    (date: string, shift: 'MORNING' | 'EVENING', slotIndex: number, newEmpId: string, currentEmpId: string | null) => {
      if (newEmpId === '' || newEmpId === '—') {
        if (currentEmpId) {
          const rc = getRowAndCell(currentEmpId, date);
          if (rc) addPendingEdit(currentEmpId, date, 'NONE', rc.row, rc.cell);
        }
        return;
      }
      if (currentEmpId && currentEmpId !== newEmpId) {
        const rcPrev = getRowAndCell(currentEmpId, date);
        if (rcPrev) addPendingEdit(currentEmpId, date, 'NONE', rcPrev.row, rcPrev.cell);
      }
      const rc = getRowAndCell(newEmpId, date);
      if (rc) addPendingEdit(newEmpId, date, shift, rc.row, rc.cell);
    },
    [getRowAndCell, addPendingEdit]
  );

  const handleRashidChange = useCallback(
    (date: string, newEmpId: string, currentEmpId: string | null) => {
      if (newEmpId === '' || newEmpId === '—') {
        if (currentEmpId) {
          const rc = getRowAndCell(currentEmpId, date);
          if (rc) addPendingEdit(currentEmpId, date, 'NONE', rc.row, rc.cell);
        }
        return;
      }
      if (currentEmpId && currentEmpId !== newEmpId) {
        const rcPrev = getRowAndCell(currentEmpId, date);
        if (rcPrev) addPendingEdit(currentEmpId, date, 'NONE', rcPrev.row, rcPrev.cell);
      }
      const rc = getRowAndCell(newEmpId, date);
      if (rc) addPendingEdit(newEmpId, date, 'COVER_RASHID_AM', rc.row, rc.cell);
    },
    [getRowAndCell, addPendingEdit]
  );

  const cellBase = 'border border-slate-200 px-2 py-1.5 text-center text-sm leading-tight align-middle overflow-hidden';
  const cellDate = 'border border-slate-200 border-l-2 border-slate-400 px-1.5 py-1 text-center text-xs leading-tight align-middle overflow-hidden';
  const headerCell = 'border border-slate-200 bg-slate-300 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 leading-tight';
  const headerDate = `${headerCell} border-l-2 border-slate-400 w-[52px]`;
  const headerDayEnd = `${headerCell} border-r-2 border-slate-400 text-xs px-1.5 py-1 w-[44px]`;
  const headerMorningBlock = `${headerCell} border-l-2 border-r-2 border-blue-300`;
  const headerEveningBlock = `${headerCell} border-l-2 border-r-2 border-amber-300`;
  const headerRashid = `${headerCell} border-l-2 border-slate-400`;
  const headerAm = 'border border-slate-200 border-l-2 border-slate-400 bg-slate-300 px-1 py-1 text-center text-xs font-semibold text-slate-800 leading-tight w-[28px]';
  const headerPm = 'border border-slate-200 border-l-2 border-slate-400 bg-slate-300 px-1 py-1 text-center text-xs font-semibold text-slate-800 leading-tight w-[28px]';
  const morningCell = `${cellBase} bg-blue-50 text-blue-900`;
  const morningFirst = `${morningCell} border-l-2 border-blue-300`;
  const morningLast = `${morningCell} border-r-2 border-blue-300`;
  const eveningCell = `${cellBase} bg-amber-50 text-amber-900`;
  const eveningFirst = `${eveningCell} border-l-2 border-amber-300`;
  const eveningLast = `${eveningCell} border-r-2 border-amber-300`;
  const rashidCell = `${cellBase} bg-slate-50 text-slate-700 border-l-2 border-slate-400`;
  const amCountCell = 'border border-slate-200 border-l-2 border-slate-400 px-1 py-1 text-center text-xs font-semibold align-middle bg-blue-100 w-[28px]';
  const pmCountCell = 'border border-slate-200 border-l-2 border-slate-400 px-1 py-1 text-center text-xs font-semibold align-middle bg-amber-100 w-[28px]';

  const selectClass = 'w-full min-w-0 cursor-pointer rounded border border-slate-300 bg-white px-1 py-0.5 text-xs';

  return (
    <div dir="ltr">
      {showMaxColumnsWarning && (
        <p className="mb-1 text-xs text-amber-700" role="status">
          {t('schedule.maxColumnsReachedWarning')}
        </p>
      )}
      <table className={`w-full border-collapse text-sm ${visibleSlots > 4 ? 'table-fixed' : ''}`}>
        <colgroup>
          <col className="w-[52px]" />
          <col className="w-[44px]" />
          {Array.from({ length: visibleSlots }, (_, i) => (
            <col key={`m-${i}`} style={emptyMorningSlots[i] ? { width: '2rem', minWidth: '2rem' } : undefined} />
          ))}
          {Array.from({ length: visibleSlots }, (_, i) => (
            <col key={`e-${i}`} style={emptyEveningSlots[i] ? { width: '2rem', minWidth: '2rem' } : undefined} />
          ))}
          <col />
          <col className="w-[28px]" />
          <col className="w-[28px]" />
        </colgroup>
        <thead>
          <tr>
            <th className={headerDate} scope="col">
              {t('schedule.date')}
            </th>
            <th className={headerDayEnd} scope="col">
              {t('schedule.dayName')}
            </th>
            <th className={headerMorningBlock} colSpan={visibleSlots} scope="colgroup">
              {t('schedule.morning')}
            </th>
            <th className={headerEveningBlock} colSpan={visibleSlots} scope="colgroup">
              {t('schedule.evening')}
            </th>
            <th className={headerRashid} scope="col">
              {t('schedule.rashidCoverage')}
            </th>
            <th className={headerAm} scope="col">
              {t('schedule.amCount')}
            </th>
            <th className={headerPm} scope="col">
              {t('schedule.pmCount')}
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day, dayIdx) => {
            const date = day.date;
            const locked = lockedDaySet.has(date);
            const editable = canEdit && !locked;
            const isFriday = day.dayOfWeek === FRIDAY_DAY_OF_WEEK;
            const morning = morningByDay[dayIdx] ?? [];
            const evening = eveningByDay[dayIdx] ?? [];
            const rashidEmpId = rashidByDay[dayIdx] ?? '';
            const eligible = eligibleByDay[dayIdx] ?? [];
            const amCount = counts[dayIdx]?.amCount ?? 0;
            const pmCount = counts[dayIdx]?.pmCount ?? 0;

            const inOtherMorning = (slotIdx: number) => new Set(morning.filter((_, j) => j !== slotIdx));
            const inOtherEvening = (slotIdx: number) => new Set(evening.filter((_, j) => j !== slotIdx));

            return (
              <tr key={date}>
                <td className={`${cellDate} border-r-2 border-slate-400`} title={formatDDMM(date)}>{formatDDMM(date)}</td>
                <td className={`${cellBase} border-r-2 border-slate-400 text-xs px-1.5 py-1 whitespace-nowrap min-w-0`} dir="auto" title={getDayName(date)}>
                  {dayShort(date)}
                </td>
                {Array.from({ length: visibleSlots }, (_, i) => {
                  const occupant = morning[i] ?? null;
                  const options = editable ? eligible.filter((emp) => occupant === emp.empId || !inOtherMorning(i).has(emp.empId)) : [];
                  return (
                    <td
                      key={i}
                      className={`${i === 0 ? morningFirst : i === visibleSlots - 1 ? morningLast : morningCell} ${slotExtra} ${emptyMorningSlots[i] ? 'w-[2rem] min-w-0 max-w-[2rem]' : ''}`}
                    >
                      {isFriday ? (
                        <span className="text-slate-500">—</span>
                      ) : editable ? (
                        <select
                          value={occupant ?? ''}
                          onChange={(e) => handleSlotChange(date, 'MORNING', i, e.target.value, occupant)}
                          className={selectClass}
                          title={locked ? t('governance.scheduleLocked') : undefined}
                        >
                          <option value="">—</option>
                          {options.map((emp) => (
                            <option key={emp.empId} value={emp.empId}>
                              {getFirstName(emp.name)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        occupant ? getFirstName(rows.find((r) => r.empId === occupant)?.name ?? '') : '—'
                      )}
                    </td>
                  );
                })}
                {Array.from({ length: visibleSlots }, (_, i) => {
                  const occupant = evening[i] ?? null;
                  const options = editable ? eligible.filter((emp) => occupant === emp.empId || !inOtherEvening(i).has(emp.empId)) : [];
                  return (
                    <td
                      key={i}
                      className={`${i === 0 ? eveningFirst : i === visibleSlots - 1 ? eveningLast : eveningCell} ${slotExtra} ${emptyEveningSlots[i] ? 'w-[2rem] min-w-0 max-w-[2rem]' : ''}`}
                    >
                      {editable ? (
                        <select
                          value={occupant ?? ''}
                          onChange={(e) => handleSlotChange(date, 'EVENING', i, e.target.value, occupant)}
                          className={selectClass}
                          title={locked ? t('governance.scheduleLocked') : undefined}
                        >
                          <option value="">—</option>
                          {options.map((emp) => (
                            <option key={emp.empId} value={emp.empId}>
                              {getFirstName(emp.name)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        occupant ? getFirstName(rows.find((r) => r.empId === occupant)?.name ?? '') : '—'
                      )}
                    </td>
                  );
                })}
                <td className={rashidCell}>
                  {editable ? (
                    <select
                      value={rashidEmpId}
                      onChange={(e) => handleRashidChange(date, e.target.value, rashidEmpId || null)}
                      className={selectClass}
                      title={locked ? t('governance.scheduleLocked') : undefined}
                    >
                      <option value="">—</option>
                      {eligible.map((emp) => (
                        <option key={emp.empId} value={emp.empId}>
                          {getFirstName(emp.name)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    rashidEmpId ? getFirstName(rows.find((r) => r.empId === rashidEmpId)?.name ?? '') : '—'
                  )}
                </td>
                <td className={amCountCell}>{amCount}</td>
                <td className={pmCountCell}>{pmCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
