'use client';

import { useState, useEffect, useCallback } from 'react';
import { formatSarFromHalala } from '@/lib/utils/money';

type Summary = {
  from: string;
  to: string;
  netSalesTotal: number;
  grossSalesTotal: number;
  returnsTotal: number;
  exchangesTotal: number;
  guestCoverageNetSales: number;
  breakdownByEmployee: Array<{
    employeeId: string;
    employeeName: string;
    netSales: number;
    guestCoverageNetSales: number;
  }>;
};

export function SalesMyClient() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    setTo(end.toISOString().slice(0, 10));
    setFrom(start.toISOString().slice(0, 10));
  }, []);

  const load = useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/metrics/sales-my?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? 'Failed to load');
        return;
      }
      const data = await res.json();
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    if (from && to) load();
  }, [from, to, load]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">My Sales</h1>
      <div className="flex flex-wrap items-center gap-2">
        <label>
          <span className="mr-1 text-sm">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <label>
          <span className="mr-1 text-sm">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded border px-2 py-1"
          />
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded bg-slate-700 px-3 py-1 text-white disabled:opacity-50"
        >
          {loading ? 'Loading…' : 'Apply'}
        </button>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {summary && (
        <div className="space-y-3 rounded-lg border bg-white p-4">
          <p className="text-sm text-slate-600">
            {summary.from} – {summary.to}
          </p>
          <div className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span>Net sales</span>
              <span className="font-medium">{formatSarFromHalala(summary.netSalesTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Guest coverage net sales</span>
              <span>{formatSarFromHalala(summary.guestCoverageNetSales)}</span>
            </div>
            <div className="flex justify-between">
              <span>Returns</span>
              <span>{formatSarFromHalala(summary.returnsTotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Exchanges</span>
              <span>{formatSarFromHalala(summary.exchangesTotal)}</span>
            </div>
          </div>
          {summary.breakdownByEmployee.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">My totals</p>
              <p className="text-sm">
                {summary.breakdownByEmployee[0].employeeName}: {formatSarFromHalala(summary.breakdownByEmployee[0].netSales)} net
                {summary.breakdownByEmployee[0].guestCoverageNetSales !== 0 && (
                  <span> ({formatSarFromHalala(summary.breakdownByEmployee[0].guestCoverageNetSales)} guest coverage)</span>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
