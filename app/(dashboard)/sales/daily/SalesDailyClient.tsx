'use client';

import { useEffect, useState, useRef } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return toLocalDateString(d);
}

type Line = { id: string; employeeId: string; amountSar: number; source: string };
type Summary = {
  id: string | null;
  boutiqueId: string;
  boutique: { id: string; code: string; name: string };
  date: string;
  totalSar: number;
  status: string;
  linesTotal: number;
  diff: number;
  canLock: boolean;
  lines: Line[];
};

type DailyData = {
  date: string;
  scope: { boutiqueIds: string[]; label: string };
  summaries: Summary[];
};

export function SalesDailyClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSummary, setSavingSummary] = useState<string | null>(null);
  const [savingLine, setSavingLine] = useState<string | null>(null);
  const [locking, setLocking] = useState<string | null>(null);
  const [importing, setImporting] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{
    boutiqueId: string;
    batchId: string;
    managerTotalSar: number;
    linesTotalSar: number;
    diffSar: number;
    canApply: boolean;
    warnings?: string[];
  } | null>(null);
  const [applyingBatch, setApplyingBatch] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sales/daily?date=${date}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setData(null);
        else setData(d);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [date]);

  const refetch = () => {
    setLoading(true);
    fetch(`/api/sales/daily?date=${date}`)
      .then((r) => r.json())
      .then((d) => (d.error ? null : setData(d)))
      .finally(() => setLoading(false));
  };

  const setManagerTotal = async (boutiqueId: string, totalSar: number) => {
    setSavingSummary(boutiqueId);
    try {
      const res = await fetch('/api/sales/daily/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutiqueId, date, totalSar }),
      });
      if (res.ok) refetch();
    } finally {
      setSavingSummary(null);
    }
  };

  const upsertLine = async (boutiqueId: string, employeeId: string, amountSar: number) => {
    setSavingLine(`${boutiqueId}-${employeeId}`);
    try {
      const res = await fetch('/api/sales/daily/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutiqueId, date, employeeId, amountSar }),
      });
      if (res.ok) refetch();
    } finally {
      setSavingLine(null);
    }
  };

  const lock = async (boutiqueId: string) => {
    setLocking(boutiqueId);
    try {
      const res = await fetch('/api/sales/daily/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boutiqueId, date }),
      });
      if (res.ok) refetch();
    } finally {
      setLocking(null);
    }
  };

  const handleImportFile = (boutiqueId: string, file: File) => {
    setImporting(boutiqueId);
    const form = new FormData();
    form.set('file', file);
    form.set('boutiqueId', boutiqueId);
    form.set('date', date);
    fetch('/api/sales/import', { method: 'POST', body: form })
      .then((r) => r.json())
      .then((j) => {
        setImportPreview({
          boutiqueId,
          batchId: j.batchId,
          managerTotalSar: j.preview?.managerTotalSar ?? 0,
          linesTotalSar: j.preview?.linesTotalSar ?? 0,
          diffSar: j.preview?.diffSar ?? 0,
          canApply: j.preview?.canApply ?? false,
          warnings: j.warnings,
        });
      })
      .catch(() => setImportPreview(null))
      .finally(() => setImporting(null));
  };

  const applyImport = async () => {
    if (!importPreview?.batchId) return;
    setApplyingBatch(true);
    try {
      const res = await fetch('/api/sales/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId: importPreview.batchId }),
      });
      if (res.ok) {
        setImportPreview(null);
        refetch();
      }
    } finally {
      setApplyingBatch(false);
    }
  };

  const diffClass = (d: number) =>
    d === 0 ? 'text-green-700' : d >= 1 ? 'text-amber-700' : 'text-red-700';
  const diffText = (d: number) => (d === 0 ? '0' : d >= 1 ? `+${d}` : d);

  return (
    <div className="overflow-x-hidden p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">Daily Sales Ledger</h1>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDate(addDays(date, -1))}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              ← Prev
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900"
            />
            <button
              type="button"
              onClick={() => setDate(addDays(date, 1))}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              Next →
            </button>
          </div>
          {data?.scope?.label && (
            <span className="rounded bg-slate-200 px-2 py-1 text-sm text-slate-700">
              Scope: {data.scope.label}
            </span>
          )}
        </div>
        {loading && <p className="text-slate-500">Loading…</p>}
        {!loading && data?.summaries?.length === 0 && (
          <p className="text-slate-500">No summaries for this date. Set manager total per boutique below.</p>
        )}
        {!loading &&
          data?.summaries?.map((s) => (
            <OpsCard key={s.id ?? s.boutiqueId} className="mb-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h2 className="font-medium text-slate-900">
                    {s.boutique.name} ({s.boutique.code})
                  </h2>
                  <span
                    className={
                      s.status === 'LOCKED' ? 'rounded bg-amber-100 px-2 py-0.5 text-sm text-amber-800' : 'rounded bg-slate-100 px-2 py-0.5 text-sm text-slate-700'
                    }
                  >
                    {s.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <label className="text-xs text-slate-500">Manager total (SAR)</label>
                    <ManagerTotalInput
                      summary={s}
                      saving={savingSummary === s.boutiqueId}
                      onSave={(v) => setManagerTotal(s.boutiqueId, v)}
                    />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Lines total (SAR)</p>
                    <p className="font-mono text-slate-900">{s.linesTotal.toLocaleString('en-SA')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Diff</p>
                    <p className={`font-mono ${diffClass(s.diff)}`}>{diffText(s.diff)}</p>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      disabled={!s.canLock || locking === s.boutiqueId}
                      onClick={() => lock(s.boutiqueId)}
                      className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                    >
                      {locking === s.boutiqueId ? 'Locking…' : 'Lock'}
                    </button>
                  </div>
                </div>
                {s.diff !== 0 && (
                  <p className="text-sm text-amber-700">{t('me.cannotLockUntilDiffZero')}</p>
                )}
                <div className="overflow-x-auto overflow-y-visible" style={{ maxWidth: '100%' }}>
                  <table className="w-full min-w-0 table-auto border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-slate-600">
                        <th className="py-2 pr-2">Employee ID</th>
                        <th className="py-2 pr-2">Amount (SAR)</th>
                        <th className="w-0" />
                      </tr>
                    </thead>
                    <tbody>
                      {s.lines.map((line) => (
                        <LineRow
                          key={line.id}
                          boutiqueId={s.boutiqueId}
                          line={line}
                          saving={savingLine === `${s.boutiqueId}-${line.employeeId}`}
                          onSave={upsertLine}
                          disabled={s.status === 'LOCKED'}
                        />
                      ))}
                      <NewLineRow boutiqueId={s.boutiqueId} date={date} onSave={upsertLine} saving={!!savingLine} />
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap gap-2 pt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xlsm,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImportFile(s.boutiqueId, f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={importing === s.boutiqueId}
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {importing === s.boutiqueId ? 'Importing…' : 'Import Excel'}
                  </button>
                </div>
              </div>
            </OpsCard>
          ))}
        {importPreview && (
          <OpsCard className="fixed inset-x-4 top-1/2 z-10 mx-auto max-w-md -translate-y-1/2 border-2 border-slate-300 bg-white shadow-lg">
            <h3 className="mb-2 font-medium text-slate-900">Import preview</h3>
            <p className="text-sm text-slate-600">
              Manager total: {importPreview.managerTotalSar.toLocaleString('en-SA')} SAR
            </p>
            <p className="text-sm text-slate-600">
              Lines total: {importPreview.linesTotalSar.toLocaleString('en-SA')} SAR
            </p>
            <p className="text-sm text-slate-600">Diff: {importPreview.diffSar}</p>
            {importPreview.warnings?.length ? (
              <ul className="my-2 text-sm text-amber-700">
                {importPreview.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={!importPreview.canApply || applyingBatch}
                onClick={applyImport}
                className="rounded bg-slate-800 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {applyingBatch ? 'Applying…' : 'Apply'}
              </button>
              <button
                type="button"
                onClick={() => setImportPreview(null)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
              >
                Cancel
              </button>
            </div>
          </OpsCard>
        )}
      </div>
    </div>
  );
}

function ManagerTotalInput({
  summary,
  saving,
  onSave,
}: {
  summary: Summary;
  saving: boolean;
  onSave: (v: number) => void;
}) {
  const [val, setVal] = useState(String(summary.totalSar));
  useEffect(() => setVal(String(summary.totalSar)), [summary.totalSar]);
  const num = parseInt(val, 10);
  const valid = Number.isInteger(num) && num >= 0;
  return (
    <div className="flex gap-1">
      <input
        type="number"
        min={0}
        step={1}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        disabled={summary.status === 'LOCKED'}
        className="w-28 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-900"
      />
      {summary.status === 'DRAFT' && (
        <button
          type="button"
          disabled={saving || !valid}
          onClick={() => valid && onSave(num)}
          className="rounded bg-slate-200 px-2 py-1 text-sm text-slate-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Save'}
        </button>
      )}
    </div>
  );
}

function LineRow({
  boutiqueId,
  line,
  saving,
  onSave,
  disabled,
}: {
  boutiqueId: string;
  line: Line;
  saving: boolean;
  onSave: (b: string, e: string, a: number) => void;
  disabled: boolean;
}) {
  const [amount, setAmount] = useState(String(line.amountSar));
  useEffect(() => setAmount(String(line.amountSar)), [line.amountSar]);
  const num = parseInt(amount, 10);
  const valid = Number.isInteger(num) && num >= 0;
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1 pr-2 font-mono text-slate-900">{line.employeeId}</td>
      <td className="py-1 pr-2">
        <input
          type="number"
          min={0}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={disabled}
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-900"
        />
      </td>
      <td className="py-1">
        {!disabled && (
          <button
            type="button"
            disabled={saving || !valid}
            onClick={() => valid && onSave(boutiqueId, line.employeeId, num)}
            className="text-sm text-sky-600 hover:underline"
          >
            {saving ? '…' : 'Save'}
          </button>
        )}
      </td>
    </tr>
  );
}

function NewLineRow({
  boutiqueId,
  onSave,
  saving,
}: {
  boutiqueId: string;
  date?: string;
  onSave: (b: string, e: string, a: number) => void;
  saving: boolean;
}) {
  const [empId, setEmpId] = useState('');
  const [amount, setAmount] = useState('');
  const num = parseInt(amount, 10);
  const valid = empId.trim() && Number.isInteger(num) && num >= 0;
  return (
    <tr className="border-b border-slate-100 bg-slate-50/50">
      <td className="py-1 pr-2">
        <input
          type="text"
          placeholder="Emp ID"
          value={empId}
          onChange={(e) => setEmpId(e.target.value)}
          className="w-28 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-900"
        />
      </td>
      <td className="py-1 pr-2">
        <input
          type="number"
          min={0}
          step={1}
          placeholder="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-24 rounded border border-slate-300 bg-white px-2 py-1 font-mono text-slate-900"
        />
      </td>
      <td className="py-1">
        <button
          type="button"
          disabled={saving || !valid}
          onClick={() => {
            if (valid) {
              onSave(boutiqueId, empId.trim(), num);
              setEmpId('');
              setAmount('');
            }
          }}
          className="text-sm text-sky-600 hover:underline"
        >
          Add
        </button>
      </td>
    </tr>
  );
}
