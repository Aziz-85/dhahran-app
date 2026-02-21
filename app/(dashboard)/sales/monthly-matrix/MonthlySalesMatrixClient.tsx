'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

function currentMonthKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function addMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

type Employee = { id: string; empId: string; name: string; role: string };
type MatrixData = {
  monthKey: string;
  boutique: { id: string; code: string; name: string };
  daysInMonth: number;
  employees: Employee[];
  matrix: Record<string, number[]>;
  rowTotals: Record<string, number>;
  colTotals: number[];
  grandTotal: number;
};

const DAYS_WINDOW_SIZE = 7;

export function MonthlySalesMatrixClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;

  const [monthKey, setMonthKey] = useState(() => currentMonthKey());
  const [data, setData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dayWindow, setDayWindow] = useState(0);
  const [search, setSearch] = useState('');
  const [onlyNonZero, setOnlyNonZero] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/sales/monthly-matrix?month=${encodeURIComponent(monthKey)}`)
      .then((r) => r.json())
      .then((d) => (d.error ? setData(null) : setData(d)))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [monthKey]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredEmployees = useMemo(() => {
    if (!data) return [];
    let list = data.employees;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) => e.empId.toLowerCase().includes(q) || (e.name && e.name.toLowerCase().includes(q))
      );
    }
    if (onlyNonZero) {
      list = list.filter((e) => (data.rowTotals[e.empId] ?? 0) > 0);
    }
    return list;
  }, [data, search, onlyNonZero]);

  const daysInMonth = data?.daysInMonth ?? 31;
  const maxWindow = Math.max(0, Math.ceil(daysInMonth / DAYS_WINDOW_SIZE) - 1);
  const currentWindow = Math.min(dayWindow, maxWindow);
  const startDay = currentWindow * DAYS_WINDOW_SIZE;
  const endDay = Math.min(startDay + DAYS_WINDOW_SIZE, daysInMonth);
  const dayIndices = Array.from({ length: endDay - startDay }, (_, i) => startDay + i);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6">
      <h1 className="text-xl font-bold text-slate-900">
        {t('sales.monthlyMatrix.title') ?? 'Monthly Sales Matrix'}
      </h1>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthKey(addMonth(monthKey, -1))}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            ←
          </button>
          <span className="min-w-[100px] text-center font-medium text-slate-800">
            {t('sales.monthlyMatrix.month') ?? 'Month'}: {monthKey}
          </span>
          <button
            type="button"
            onClick={() => setMonthKey(addMonth(monthKey, 1))}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            →
          </button>
        </div>
        {data?.boutique && (
          <p className="text-sm text-slate-600">
            {t('common.workingOnBoutique') ?? 'Working on'}: {data.boutique.name}
            {data.boutique.code ? ` (${data.boutique.code})` : ''}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder={t('common.search') ?? 'Search'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyNonZero}
            onChange={(e) => setOnlyNonZero(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {t('sales.monthlyMatrix.onlyNonZero') ?? 'Only with sales'}
        </label>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-slate-500">{t('common.loading') ?? 'Loading…'}</p>
      )}

      {!loading && data && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs font-medium text-slate-500">
              {t('sales.monthlyMatrix.daysWindow') ?? 'Days'}:
            </span>
            {Array.from({ length: maxWindow + 1 }, (_, i) => {
              const a = i * DAYS_WINDOW_SIZE + 1;
              const b = Math.min((i + 1) * DAYS_WINDOW_SIZE, daysInMonth);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDayWindow(i)}
                  className={`rounded px-2 py-1 text-xs font-medium ${
                    currentWindow === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {a}–{b}
                </button>
              );
            })}
          </div>

          <div className="mt-4 overflow-x-auto overflow-y-visible rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-0 border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="sticky left-0 z-10 min-w-[140px] border-r border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
                    {t('sales.monthlyMatrix.employee') ?? 'Employee'}
                  </th>
                  {dayIndices.map((d) => (
                    <th
                      key={d}
                      className="w-14 border-r border-slate-200 px-2 py-2 text-center font-semibold text-slate-700 last:border-r-0"
                    >
                      {d + 1}
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 min-w-[80px] border-l border-slate-200 bg-slate-50 px-3 py-2 text-right font-semibold text-slate-700">
                    {t('sales.monthlyMatrix.total') ?? 'Total'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr key={emp.empId} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2 font-medium text-slate-800">
                      {emp.name || emp.empId}
                    </td>
                    {dayIndices.map((d) => (
                      <td
                        key={d}
                        className="w-14 border-r border-slate-100 px-2 py-1.5 text-right tabular-nums text-slate-700 last:border-r-0"
                      >
                        {(data.matrix[emp.empId]?.[d] ?? 0).toLocaleString('en-SA')}
                      </td>
                    ))}
                    <td className="sticky right-0 z-10 border-l border-slate-200 bg-white px-3 py-2 text-right font-medium tabular-nums text-slate-800">
                      {(data.rowTotals[emp.empId] ?? 0).toLocaleString('en-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-100 font-semibold">
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-slate-100 px-3 py-2 text-left text-slate-800">
                    {t('sales.monthlyMatrix.dayTotal') ?? 'Day total'}
                  </td>
                  {dayIndices.map((d) => (
                    <td
                      key={d}
                      className="w-14 border-r border-slate-200 px-2 py-2 text-right tabular-nums text-slate-800 last:border-r-0"
                    >
                      {(data.colTotals[d] ?? 0).toLocaleString('en-SA')}
                    </td>
                  ))}
                  <td className="sticky right-0 z-10 border-l border-slate-200 bg-slate-100 px-3 py-2 text-right tabular-nums text-slate-900">
                    {data.grandTotal.toLocaleString('en-SA')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {t('sales.monthlyMatrix.grandTotal') ?? 'Grand total'}: {data.grandTotal.toLocaleString('en-SA')} SAR
          </p>
        </>
      )}

      {!loading && !data && (
        <p className="mt-4 text-sm text-slate-500">{t('schedule.filteredByBoutiqueHint') ?? 'No data or select a boutique.'}</p>
      )}
    </div>
  );
}
