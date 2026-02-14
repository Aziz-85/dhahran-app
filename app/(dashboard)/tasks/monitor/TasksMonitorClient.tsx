'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type TaskMonitorRow = {
  taskId: string;
  title: string;
  type: string;
  dueDate: string;
  assignedTo: string | null;
  assignedEmpId: string | null;
  status: 'done' | 'pending';
  completedAt: string | null;
  overdue: boolean;
  completionDelay?: { kind: 'early' | 'onTime' | 'late'; text: string; minutes?: number };
  overdueByDays?: number;
};

type EmployeeStatRow = {
  empId: string;
  name: string;
  assigned: number;
  completed: number;
  pending: number;
  overdue: number;
  completionRate: number;
  onTimeRate: number;
  avgDelayMinutes: number;
};

type SuspiciousBurstRow = {
  empId: string;
  empName: string;
  burstCount: number;
  biggestBurstSize: number;
  burstStart: string;
  burstEnd: string;
  tasks: { title: string; completedAt: string }[];
};

type MonitorData = {
  dateStr: string;
  employees: { empId: string; name: string }[];
  summary: { completed: number; pending: number; overdue: number; suspicious?: number };
  completedTasks: TaskMonitorRow[];
  pendingTasks: TaskMonitorRow[];
  employeeStats: EmployeeStatRow[];
  suspiciousBursts: SuspiciousBurstRow[];
};

function formatDDMM(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  return `${d ?? ''}/${m ?? ''}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function formatBurstRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  return `${s.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} – ${e.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}

/** Validate periodKey YYYY-W01..W53 (zero-padded week). */
function isValidPeriodKey(s: string): boolean {
  return /^\d{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/.test(s.trim());
}

export function TasksMonitorClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('week');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending' | 'overdue'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [onlySuspicious, setOnlySuspicious] = useState(false);
  const [startPeriodKey, setStartPeriodKey] = useState('');

  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    q.set('dateRange', dateRange);
    if (dateRange === 'custom' && customStart && customEnd) {
      q.set('start', customStart);
      q.set('end', customEnd);
    }
    q.set('status', statusFilter);
    q.set('assignee', assigneeFilter);
    q.set('type', typeFilter);
    if (search.trim()) q.set('search', search.trim());
    if (onlySuspicious) q.set('onlySuspicious', '1');
    const startKey = startPeriodKey.trim();
    if (startKey && isValidPeriodKey(startKey)) q.set('startPeriodKey', startKey);
    return q.toString();
  }, [dateRange, customStart, customEnd, statusFilter, assigneeFilter, typeFilter, search, onlySuspicious, startPeriodKey]);

  const fetchMonitor = useCallback(() => {
    setLoading(true);
    fetch(`/api/tasks/monitor?${buildQuery()}`)
      .then((r) => r.json().catch(() => null))
      .then((res: MonitorData | { error?: string } | null) => {
        if (res && !('error' in res)) setData(res as MonitorData);
        else setData(null);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [buildQuery]);

  useEffect(() => {
    fetchMonitor();
  }, [fetchMonitor]);

  const typeLabel = (type: string) => {
    if (type === 'DAILY') return t('tasks.daily');
    if (type === 'WEEKLY') return t('tasks.weekly');
    if (type === 'MONTHLY') return t('tasks.monthly');
    return type;
  };

  const employees = data?.employees ?? [];
  const summary = data?.summary ?? { completed: 0, pending: 0, overdue: 0, suspicious: 0 };
  const completedTasks = data?.completedTasks ?? [];
  const pendingTasks = data?.pendingTasks ?? [];
  const employeeStats = data?.employeeStats ?? [];
  const suspiciousBursts = data?.suspiciousBursts ?? [];

  return (
    <div className="p-4 md:p-6 overflow-hidden">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-800">{t('tasks.monitorTitle')}</h1>

        {/* Filters bar — responsive, no horizontal scroll */}
        <div className="mb-4 space-y-3">
          <div className="text-sm font-medium text-slate-600">{t('tasks.filters')}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm text-slate-600">{t('tasks.dateRange')}:</span>
              <button
                type="button"
                onClick={() => setDateRange('today')}
                className={`rounded border px-2 py-1.5 text-sm ${dateRange === 'today' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {t('tasks.today')}
              </button>
              <button
                type="button"
                onClick={() => setDateRange('week')}
                className={`rounded border px-2 py-1.5 text-sm ${dateRange === 'week' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {t('tasks.thisWeek')}
              </button>
              <button
                type="button"
                onClick={() => setDateRange('month')}
                className={`rounded border px-2 py-1.5 text-sm ${dateRange === 'month' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {t('tasks.thisMonth')}
              </button>
              <button
                type="button"
                onClick={() => setDateRange('custom')}
                className={`rounded border px-2 py-1.5 text-sm ${dateRange === 'custom' ? 'border-slate-600 bg-slate-700 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
              >
                {t('tasks.customRange')}
              </button>
            </div>
            {dateRange === 'custom' && (
              <div className="flex flex-wrap gap-2 items-center">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
                <span className="text-slate-500">–</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-slate-600">{t('tasks.status')}:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="all">{t('tasks.all')}</option>
              <option value="completed">{t('tasks.completed')}</option>
              <option value="pending">{t('tasks.pending')}</option>
              <option value="overdue">{t('tasks.overdue')}</option>
            </select>
            <span className="text-sm text-slate-600">{t('tasks.assignee')}:</span>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white min-w-0 max-w-[180px]"
            >
              <option value="all">{t('tasks.all')}</option>
              {employees.map((e) => (
                <option key={e.empId} value={e.empId}>{e.name}</option>
              ))}
            </select>
            <span className="text-sm text-slate-600">{t('tasks.type')}:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
            >
              <option value="all">{t('tasks.all')}</option>
              <option value="DAILY">{t('tasks.daily')}</option>
              <option value="WEEKLY">{t('tasks.weekly')}</option>
              <option value="MONTHLY">{t('tasks.monthly')}</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlySuspicious}
                onChange={(e) => setOnlySuspicious(e.target.checked)}
                className="rounded border-slate-300"
              />
              {t('tasks.onlySuspicious')}
            </label>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600">{t('tasks.search')}:</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('tasks.search')}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-40 min-w-0"
            />
            <button
              type="button"
              onClick={fetchMonitor}
              className="rounded border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              {t('common.refresh')}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-slate-600">{t('tasks.startPeriod')}:</span>
            <input
              type="text"
              value={startPeriodKey}
              onChange={(e) => setStartPeriodKey(e.target.value)}
              placeholder={t('tasks.startPeriodPlaceholder')}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-28 min-w-0"
            />
            <button
              type="button"
              onClick={() => { setStartPeriodKey('2026-W08'); }}
              className="rounded border px-2 py-1.5 text-sm border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            >
              {t('tasks.newBoutiqueFromW08')}
            </button>
            {startPeriodKey.trim() && !isValidPeriodKey(startPeriodKey) && (
              <span className="text-xs text-red-600">{t('tasks.startPeriodKeyInvalid')}</span>
            )}
            {startPeriodKey.trim() && isValidPeriodKey(startPeriodKey) && (
              <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
                {(t('tasks.startPeriodActiveChip') as string).replace('{periodKey}', startPeriodKey.trim())}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        ) : (
          <>
            {/* Summary cards */}
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 max-w-2xl">
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <div className="text-2xl font-semibold text-emerald-700">{summary.completed}</div>
                <div className="text-xs text-slate-600">{t('tasks.summaryCompleted')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <div className="text-2xl font-semibold text-slate-700">{summary.pending}</div>
                <div className="text-xs text-slate-600">{t('tasks.summaryPending')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <div className="text-2xl font-semibold text-amber-700">{summary.overdue}</div>
                <div className="text-xs text-slate-600">{t('tasks.summaryOverdue')}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
                <div className="text-2xl font-semibold text-slate-600">{summary.suspicious ?? 0}</div>
                <div className="text-xs text-slate-600">{t('tasks.summarySuspicious')}</div>
              </div>
            </div>

            {/* Completed table */}
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('tasks.completedTableTitle')}</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden md:block overflow-x-auto" style={{ overflowX: 'hidden' }}>
                  <table className="w-full border-collapse text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.colTitle')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[7%]">{t('tasks.type')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.assignedTo')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[7%]">{t('tasks.due')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.completedAt')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.delay')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {completedTasks.length === 0 ? (
                        <tr><td colSpan={6} className="px-2 py-3 text-slate-500 text-center">{t('tasks.emptyList')}</td></tr>
                      ) : (
                        completedTasks.map((row) => (
                          <tr key={`${row.taskId}-${row.dueDate}`} className="border-b border-slate-100">
                            <td className="px-2 py-2 truncate" title={row.title}>{row.title}</td>
                            <td className="px-2 py-2">{typeLabel(row.type)}</td>
                            <td className="px-2 py-2 truncate">{row.assignedTo ?? '—'}</td>
                            <td className="px-2 py-2">{formatDDMM(row.dueDate)}</td>
                            <td className="px-2 py-2 text-slate-600">{formatDateTime(row.completedAt)}</td>
                            <td className="px-2 py-2">
                              {row.completionDelay?.kind === 'onTime' && <span className="text-emerald-700">{t('tasks.onTime')}</span>}
                              {row.completionDelay?.kind === 'early' && <span className="text-slate-600">{row.completionDelay.text}</span>}
                              {row.completionDelay?.kind === 'late' && <span className="text-amber-700">{row.completionDelay.text}</span>}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-2 p-2">
                  {completedTasks.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">{t('tasks.emptyList')}</p>
                  ) : (
                    completedTasks.map((row) => (
                      <div key={`${row.taskId}-${row.dueDate}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-800">{row.title}</div>
                        <div className="mt-1 text-slate-600">{t('tasks.type')}: {typeLabel(row.type)} · {t('tasks.assignedTo')}: {row.assignedTo ?? '—'}</div>
                        <div className="mt-1 text-slate-600">{t('tasks.due')}: {formatDDMM(row.dueDate)} · {t('tasks.completedAt')}: {formatDateTime(row.completedAt)}</div>
                        <div className="mt-1">{row.completionDelay?.kind === 'onTime' ? t('tasks.onTime') : row.completionDelay?.text ?? '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Pending / Overdue table */}
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('tasks.pendingTableTitle')}</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden md:block overflow-x-auto" style={{ overflowX: 'hidden' }}>
                  <table className="w-full border-collapse text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[20%]">{t('tasks.colTitle')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.type')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[18%]">{t('tasks.assignedTo')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.due')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[18%]">{t('tasks.status')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.overdue')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {pendingTasks.length === 0 ? (
                        <tr><td colSpan={6} className="px-2 py-3 text-slate-500 text-center">{t('tasks.emptyList')}</td></tr>
                      ) : (
                        pendingTasks.map((row) => (
                          <tr key={`${row.taskId}-${row.dueDate}`} className="border-b border-slate-100">
                            <td className="px-2 py-2 truncate" title={row.title}>{row.title}</td>
                            <td className="px-2 py-2">{typeLabel(row.type)}</td>
                            <td className="px-2 py-2 truncate">{row.assignedTo ?? '—'}</td>
                            <td className="px-2 py-2">{formatDDMM(row.dueDate)}</td>
                            <td className="px-2 py-2">
                              {row.overdue ? (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">{t('tasks.overdue')}</span>
                              ) : (
                                <span className="text-slate-600">{t('tasks.pending')}</span>
                              )}
                            </td>
                            <td className="px-2 py-2">{row.overdueByDays != null ? `+${row.overdueByDays}d` : '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-2 p-2">
                  {pendingTasks.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">{t('tasks.emptyList')}</p>
                  ) : (
                    pendingTasks.map((row) => (
                      <div key={`${row.taskId}-${row.dueDate}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-800">{row.title}</div>
                        <div className="mt-1 text-slate-600">{t('tasks.type')}: {typeLabel(row.type)} · {t('tasks.assignedTo')}: {row.assignedTo ?? '—'}</div>
                        <div className="mt-1">{t('tasks.due')}: {formatDDMM(row.dueDate)}</div>
                        <div className="mt-1">
                          {row.overdue ? (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">{t('tasks.overdue')} {row.overdueByDays != null ? `+${row.overdueByDays}d` : ''}</span>
                          ) : (
                            <span className="text-slate-600">{t('tasks.pending')}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Employee Performance */}
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('tasks.employeePerformanceTitle')}</h2>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="hidden md:block overflow-x-auto" style={{ overflowX: 'hidden' }}>
                  <table className="w-full border-collapse text-sm table-fixed">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-700">
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[20%]">{t('common.name')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.assignedCount')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.completedCount')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.pendingCount')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[10%]">{t('tasks.overdueCount')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.completionRate')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.onTimeRate')}</th>
                        <th className="border-b border-slate-200 px-2 py-2 text-xs font-semibold w-[12%]">{t('tasks.avgDelay')}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {employeeStats.length === 0 ? (
                        <tr><td colSpan={8} className="px-2 py-3 text-slate-500 text-center">{t('tasks.emptyList')}</td></tr>
                      ) : (
                        employeeStats.map((e) => (
                          <tr key={e.empId} className="border-b border-slate-100">
                            <td className="px-2 py-2 truncate" title={e.name}>{e.name}</td>
                            <td className="px-2 py-2">{e.assigned}</td>
                            <td className="px-2 py-2">{e.completed}</td>
                            <td className="px-2 py-2">{e.pending}</td>
                            <td className="px-2 py-2">{e.overdue}</td>
                            <td className="px-2 py-2">{e.completionRate}%</td>
                            <td className="px-2 py-2">{e.onTimeRate}%</td>
                            <td className="px-2 py-2">{e.avgDelayMinutes != null && e.avgDelayMinutes !== 0 ? (e.avgDelayMinutes >= 60 ? `${Math.round(e.avgDelayMinutes / 60)}h` : `${e.avgDelayMinutes}m`) : '—'}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="md:hidden space-y-2 p-2">
                  {employeeStats.length === 0 ? (
                    <p className="text-sm text-slate-500 py-2">{t('tasks.emptyList')}</p>
                  ) : (
                    employeeStats.map((e) => (
                      <div key={e.empId} className="rounded-lg border border-slate-200 p-3 text-sm">
                        <div className="font-medium text-slate-800">{e.name}</div>
                        <div className="mt-1 text-slate-600">{t('tasks.assignedCount')}: {e.assigned} · {t('tasks.completedCount')}: {e.completed} · {t('tasks.pendingCount')}: {e.pending} · {t('tasks.overdueCount')}: {e.overdue}</div>
                        <div className="mt-1">{t('tasks.completionRate')}: {e.completionRate}% · {t('tasks.onTimeRate')}: {e.onTimeRate}% · {t('tasks.avgDelay')}: {e.avgDelayMinutes != null && e.avgDelayMinutes !== 0 ? (e.avgDelayMinutes >= 60 ? `${Math.round(e.avgDelayMinutes / 60)}h` : `${e.avgDelayMinutes}m`) : '—'}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            {/* Suspicious Activity */}
            <section className="mb-4">
              <h2 className="mb-2 text-sm font-semibold text-slate-700">{t('tasks.suspiciousTitle')}</h2>
              <p className="mb-2 text-xs text-slate-500">{t('tasks.suspiciousHint')}</p>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                {suspiciousBursts.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500">{t('tasks.emptyList')}</p>
                ) : (
                  <div className="p-3 space-y-3">
                    {suspiciousBursts.map((b) => (
                      <div key={b.empId} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-sm">
                        <div className="font-medium text-slate-800">{b.empName}</div>
                        <div className="mt-1 text-slate-600">
                          {t('tasks.burstSize')}: {b.biggestBurstSize} · {t('tasks.burstWindow')}: {formatBurstRange(b.burstStart, b.burstEnd)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{t('tasks.burstRange')}: {formatBurstRange(b.burstStart, b.burstEnd)}</div>
                        <ul className="mt-2 list-disc list-inside text-slate-600">
                          {b.tasks.slice(0, 8).map((task, i) => (
                            <li key={i}>{task.title} — {formatDateTime(task.completedAt)}</li>
                          ))}
                          {b.tasks.length > 8 && <li className="text-slate-500">+{b.tasks.length - 8} more</li>}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
