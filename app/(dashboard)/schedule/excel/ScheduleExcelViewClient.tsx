'use client';

import { getFirstName } from '@/lib/name';
import { getSlotColumnClass } from '@/lib/schedule/scheduleSlots';

export type ExcelClassicGridData = {
  days: Array<{ date: string; dayName?: string }>;
  counts: Array<{ amCount: number; pmCount: number }>;
};

export type ExcelClassicExcelData = {
  morningByDay: string[][];
  eveningByDay: string[][];
  rashidAmByDay: string[][];
  rashidPmByDay: string[][];
};

export function ScheduleExcelViewClient({
  gridData,
  excelData,
  visibleSlots,
  maxPerCell,
  showMaxColumnsWarning,
  formatDDMM,
  getDayName,
  t,
}: {
  gridData: ExcelClassicGridData;
  excelData: ExcelClassicExcelData;
  visibleSlots: number;
  maxPerCell: number;
  showMaxColumnsWarning?: boolean;
  formatDDMM: (d: string) => string;
  getDayName: (d: string) => string;
  t: (k: string) => string;
}) {
  const { days, counts } = gridData;
  const { morningByDay, eveningByDay, rashidAmByDay, rashidPmByDay } = excelData;
  const slotExtra = getSlotColumnClass(visibleSlots);
  const showWarning = showMaxColumnsWarning && maxPerCell > 6;

  const cellBase = 'border border-slate-200 px-2 py-1 text-center text-sm';
  const headerCell = 'border border-slate-200 bg-slate-300 px-2 py-1 text-center text-sm font-semibold text-slate-800';
  const headerDayEnd = `${headerCell} border-r-2 border-slate-400`;
  const headerMorningBlock = `${headerCell} border-l-2 border-r-2 border-blue-300`;
  const headerEveningBlock = `${headerCell} border-l-2 border-r-2 border-amber-300`;
  const headerRashid = `${headerCell} border-l-2 border-slate-400`;
  const headerAm = `${headerCell} border-l-2 border-slate-400`;
  const headerPm = `${headerCell} border-l-2 border-slate-400`;
  const morningCell = `${cellBase} bg-blue-50 text-blue-900`;
  const morningFirst = `${morningCell} border-l-2 border-blue-300`;
  const morningLast = `${morningCell} border-r-2 border-blue-300`;
  const eveningCell = `${cellBase} bg-amber-50 text-amber-900`;
  const eveningFirst = `${eveningCell} border-l-2 border-amber-300`;
  const eveningLast = `${eveningCell} border-r-2 border-amber-300`;
  const rashidCell = `${cellBase} bg-slate-50 text-slate-700 border-l-2 border-slate-400`;
  const amCountCell = `${cellBase} bg-blue-100 font-semibold border-l-2 border-slate-400`;
  const pmCountCell = `${cellBase} bg-amber-100 font-semibold border-l-2 border-slate-400`;

  return (
    <>
      {/* Mobile: stacked cards per day (no horizontal scroll) */}
      <div className="space-y-3 md:hidden" dir="ltr">
        {days.map((day, dayIdx) => {
          const morning = (morningByDay[dayIdx] ?? []).map(getFirstName).filter((n) => n?.trim());
          const evening = (eveningByDay[dayIdx] ?? []).map(getFirstName).filter((n) => n?.trim());
          const rashidAm = rashidAmByDay[dayIdx] ?? [];
          const rashidPm = rashidPmByDay[dayIdx] ?? [];
          const rashidDisplay =
            rashidAm[0] != null
              ? { name: getFirstName(rashidAm[0]), shift: 'AM' as const }
              : rashidPm[0] != null
                ? { name: getFirstName(rashidPm[0]), shift: 'PM' as const }
                : null;
          const amCount = counts[dayIdx]?.amCount ?? 0;
          const pmCount = counts[dayIdx]?.pmCount ?? 0;
          return (
            <div
              key={day.date}
              className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden"
            >
              <div className="border-b border-slate-200 bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">
                {formatDDMM(day.date)} — {getDayName(day.date)}
              </div>
              <div className="px-3 py-2 space-y-2 text-sm">
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">{t('schedule.morning')}</div>
                  <div className="bg-blue-50 rounded border border-blue-200 px-2 py-1.5 text-blue-900">
                    {morning.length > 0 ? morning.join(', ') : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{t('schedule.amCount')}: {amCount}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">{t('schedule.evening')}</div>
                  <div className="bg-amber-50 rounded border border-amber-200 px-2 py-1.5 text-amber-900">
                    {evening.length > 0 ? evening.join(', ') : '—'}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{t('schedule.pmCount')}: {pmCount}</div>
                </div>
                {rashidDisplay && (
                  <div className="text-xs text-slate-600">
                    {t('schedule.rashidCoverage')}: {rashidDisplay.name}{' '}
                    <span
                      className={`rounded px-1 py-0.5 ${rashidDisplay.shift === 'AM' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}
                      dir="ltr"
                    >
                      {rashidDisplay.shift === 'AM' ? t('schedule.rashid.amShort') : t('schedule.rashid.pmShort')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: table, no horizontal scroll */}
      {showWarning && (
        <p className="hidden md:block mb-1 text-xs text-amber-700" role="status">
          {t('schedule.maxColumnsReachedWarning')}
        </p>
      )}
      <div className="hidden md:block" dir="ltr">
      <table className={`w-full border-collapse text-sm ${visibleSlots > 4 ? 'table-fixed' : ''}`}>
        <thead>
          <tr>
            <th className={headerCell} scope="col">
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
            const morning = (morningByDay[dayIdx] ?? []).map(getFirstName);
            const evening = (eveningByDay[dayIdx] ?? []).map(getFirstName);
            const rashidAm = rashidAmByDay[dayIdx] ?? [];
            const rashidPm = rashidPmByDay[dayIdx] ?? [];
            const rashidDisplay =
              rashidAm[0] != null
                ? { name: getFirstName(rashidAm[0]), shift: 'AM' as const }
                : rashidPm[0] != null
                  ? { name: getFirstName(rashidPm[0]), shift: 'PM' as const }
                  : null;
            const amCount = counts[dayIdx]?.amCount ?? 0;
            const pmCount = counts[dayIdx]?.pmCount ?? 0;
            return (
              <tr key={day.date}>
                <td className={cellBase}>{formatDDMM(day.date)}</td>
                <td className={`${cellBase} border-r-2 border-slate-400`} dir="auto">
                  {getDayName(day.date)}
                </td>
                {Array.from({ length: visibleSlots }, (_, i) => (
                  <td key={i} className={`${i === 0 ? morningFirst : i === visibleSlots - 1 ? morningLast : morningCell} ${slotExtra}`}>
                    {morning[i] && morning[i].trim() ? morning[i] : '—'}
                  </td>
                ))}
                {Array.from({ length: visibleSlots }, (_, i) => (
                  <td key={i} className={`${i === 0 ? eveningFirst : i === visibleSlots - 1 ? eveningLast : eveningCell} ${slotExtra}`}>
                    {evening[i] && evening[i].trim() ? evening[i] : '—'}
                  </td>
                ))}
                <td className={rashidCell}>
                  {rashidDisplay ? (
                    <>
                      {rashidDisplay.name}
                      <span
                        className={`ml-1 rounded px-1 py-0.5 text-[10px] leading-4 ${rashidDisplay.shift === 'AM' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}
                        dir="ltr"
                      >
                        {rashidDisplay.shift === 'AM' ? t('schedule.rashid.amShort') : t('schedule.rashid.pmShort')}
                      </span>
                    </>
                  ) : (
                    '—'
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
    </>
  );
}
