'use client';

import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/app/providers';
import { OpsCard } from '@/components/ui/OpsCard';
import { LuxuryTable, LuxuryTableHead, LuxuryTh, LuxuryTableBody, LuxuryTd } from '@/components/ui/LuxuryTable';
import { formatDateTimeEn } from '@/lib/formatDateTimeEn';

const EVENT_OPTIONS = [
  { value: '', label: 'All events' },
  { value: 'LOGIN_SUCCESS', label: 'Login success' },
  { value: 'LOGIN_FAILED', label: 'Login failed' },
  { value: 'LOGOUT', label: 'Logout' },
] as const;

const DATE_RANGE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
] as const;

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type AuditRow = {
  id: string;
  createdAt: string;
  event: string;
  userId: string | null;
  userEmpId: string | null;
  userName: string | null;
  userEmail: string | null;
  emailAttempted: string | null;
  ip: string | null;
  userAgent: string | null;
  deviceHint: string | null;
  reason: string | null;
};

export function LoginAuditClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;

  const [list, setList] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [eventFilter, setEventFilter] = useState('');
  const [dateRange, setDateRange] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (eventFilter) params.set('event', eventFilter);
    if (searchQ) params.set('q', searchQ);
    if (dateRange) {
      const days = parseInt(dateRange, 10);
      const now = new Date();
      const fromDate = new Date(now);
      fromDate.setUTCDate(fromDate.getUTCDate() - days);
      params.set('from', fromDate.toISOString().slice(0, 10));
      params.set('to', now.toISOString().slice(0, 10));
    }
    fetch(`/api/admin/auth-audit?${params}`)
      .then(async (res) => {
        if (res.status === 403 || res.status === 401) {
          window.location.href = '/';
          return { ok: false as const, list: [] as AuditRow[], total: 0 };
        }
        if (!res.ok) {
          setError(true);
          setList([]);
          setTotal(0);
          return { ok: false as const, list: [] as AuditRow[], total: 0 };
        }
        const data = (await res.json()) as { list?: AuditRow[]; total?: number };
        return { ok: true as const, list: Array.isArray(data?.list) ? data.list : [], total: typeof data?.total === 'number' ? data.total : 0 };
      })
      .then((result) => {
        if (result.ok) {
          setList(result.list);
          setTotal(result.total);
        }
      })
      .catch(() => {
        setList([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, eventFilter, searchQ, dateRange]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="p-4 md:p-6">
      <OpsCard title={t('admin.loginAudit.title')}>
        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Event</span>
            <select
              value={eventFilter}
              onChange={(e) => {
                setEventFilter(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[140px]"
            >
              {EVENT_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Date range</span>
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPage(1);
              }}
              className="rounded border border-slate-300 px-2 py-1.5 text-sm min-w-[140px]"
            >
              {DATE_RANGE_OPTIONS.map((o) => (
                <option key={o.value || 'any'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-600">Search (email / username)</span>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchList())}
              placeholder="Search…"
              className="rounded border border-slate-300 px-2 py-1.5 text-sm w-48"
            />
          </label>
          <button
            type="button"
            onClick={() => fetchList()}
            className="rounded border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            {t('common.refresh')}
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">{t('common.loading')}</p>
        ) : error ? (
          <div className="py-6 text-center text-slate-600">
            <p className="mb-2 text-sm">Failed to load audit log.</p>
            <button
              type="button"
              onClick={() => fetchList()}
              className="rounded border border-slate-400 bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <LuxuryTable>
              <LuxuryTableHead>
                <LuxuryTh>Time (en, Gregorian, Asia/Riyadh)</LuxuryTh>
                <LuxuryTh>Event</LuxuryTh>
                <LuxuryTh>User</LuxuryTh>
                <LuxuryTh>Email attempted</LuxuryTh>
                <LuxuryTh>IP</LuxuryTh>
                <LuxuryTh>Device</LuxuryTh>
                <LuxuryTh>User-Agent</LuxuryTh>
                <LuxuryTh>Reason</LuxuryTh>
              </LuxuryTableHead>
              <LuxuryTableBody>
                {list.length === 0 ? (
                  <tr>
                    <LuxuryTd colSpan={8} className="text-center text-slate-500 py-4">
                      {t('tasks.emptyList')}
                    </LuxuryTd>
                  </tr>
                ) : (
                  list.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100">
                      <LuxuryTd className="text-sm text-slate-700 whitespace-nowrap">
                        {formatDateTimeEn(r.createdAt)}
                      </LuxuryTd>
                      <LuxuryTd>
                        <span
                          className={
                            r.event === 'LOGIN_SUCCESS'
                              ? 'text-emerald-700'
                              : r.event === 'LOGIN_FAILED'
                                ? 'text-amber-700'
                                : 'text-slate-700'
                          }
                        >
                          {r.event}
                        </span>
                      </LuxuryTd>
                      <LuxuryTd className="text-slate-700">
                        {r.userName ? `${r.userName} (${r.userEmpId ?? ''})` : r.userEmpId ?? '—'}
                      </LuxuryTd>
                      <LuxuryTd className="text-slate-700">{r.emailAttempted ?? '—'}</LuxuryTd>
                      <LuxuryTd className="text-slate-700 font-mono text-xs">{r.ip ?? '—'}</LuxuryTd>
                      <LuxuryTd className="text-slate-700">{r.deviceHint ?? '—'}</LuxuryTd>
                      <LuxuryTd className="text-slate-700 max-w-[180px]">
                        {r.userAgent ? (
                          <span
                            title={r.userAgent}
                            className="block truncate text-xs cursor-help"
                          >
                            {r.userAgent.length > 40 ? r.userAgent.slice(0, 40) + '…' : r.userAgent}
                          </span>
                        ) : (
                          '—'
                        )}
                      </LuxuryTd>
                      <LuxuryTd className="text-slate-600 text-xs">{r.reason ?? '—'}</LuxuryTd>
                    </tr>
                  ))
                )}
              </LuxuryTableBody>
            </LuxuryTable>

            {totalPages > 1 && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages} ({total} total)
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </OpsCard>
    </div>
  );
}
