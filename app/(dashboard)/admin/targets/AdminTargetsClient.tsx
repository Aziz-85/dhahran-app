'use client';

import { useEffect, useState, useRef } from 'react';
import { useI18n } from '@/app/providers';
import { OpsCard } from '@/components/ui/OpsCard';
import { SALES_TARGET_ROLE_LABELS, type SalesTargetRole } from '@/lib/sales-target-weights';

const ROLE_WEIGHTS: Array<{ role: SalesTargetRole; weight: number }> = [
  { role: 'MANAGER', weight: 0.5 },
  { role: 'ASSISTANT_MANAGER', weight: 0.75 },
  { role: 'HIGH_JEWELLERY_EXPERT', weight: 2.0 },
  { role: 'SENIOR_SALES_ADVISOR', weight: 1.5 },
  { role: 'SALES_ADVISOR', weight: 1.0 },
];

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type EmployeeRow = {
  id: string;
  user: { id: string; empId: string; name: string; email: string | null };
  role: string;
  roleLabel: string;
  weight: number;
  active: boolean;
  scheduledDaysInMonth: number | null;
  leaveDaysInMonth: number | null;
  presentDaysInMonth: number | null;
  presenceFactor: number | null;
  effectiveWeightAtGeneration: number | null;
  distributionMethod: string | null;
  monthlyTarget: number;
  mtdSales: number;
  mtdPct: number;
  todaySales: number;
  todayTarget: number;
  todayPct: number;
  weekSales: number;
  weekTarget: number;
  weekPct: number;
};

type AdminTargetsData = {
  month: string;
  boutiqueTarget: { id: string; amount: number } | null;
  employees: EmployeeRow[];
  todayStr: string;
  warnings?: {
    sumWeights: number;
    sumWeightsZero: boolean;
    hasMissingRole: boolean;
    hasUnknownRole: boolean;
    zeroScheduledCount?: number;
    hasManyZeroScheduled?: boolean;
  };
};

type ImportResult = {
  importedCount: number;
  updatedCount: number;
  skippedCount: number;
  skippedRowCount?: number;
  skippedRowsCount?: number;
  skipped: Array<{ rowNumber: number; empId?: string; columnHeader?: string; reason: string }>;
  warnings?: Array<{ rowNumber: number; date?: string; message?: string; totalAfter?: number; sumEmployees?: number; delta?: number }>;
  ignoredColumns?: string[];
};

export function AdminTargetsClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [boutiqueAmount, setBoutiqueAmount] = useState('');
  const [data, setData] = useState<AdminTargetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBoutique, setSavingBoutique] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [regenerateModal, setRegenerateModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMode, setImportMode] = useState<'simple' | 'msr'>('simple');
  const [importMonth, setImportMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [showImportDetails, setShowImportDetails] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');

  const load = () => {
    setLoading(true);
    fetch(`/api/admin/targets?month=${month}`)
      .then((r) => r.json())
      .then((d: AdminTargetsData) => {
        setData(d);
        setBoutiqueAmount(d.boutiqueTarget != null ? String(d.boutiqueTarget.amount) : '');
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run only when month changes
  }, [month]);

  const saveBoutique = async () => {
    const amount = Math.round(Number(boutiqueAmount));
    if (amount < 0 || !Number.isFinite(amount)) return;
    setSavingBoutique(true);
    try {
      const res = await fetch('/api/admin/boutique-target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, amount }),
      });
      if (res.ok) load();
    } finally {
      setSavingBoutique(false);
    }
  };

  const generateTargets = async (regenerate: boolean) => {
    setRegenerateModal(false);
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/generate-employee-targets?regenerate=${regenerate}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      if (res.ok) load();
    } finally {
      setGenerating(false);
    }
  };

  const patchEmployeeTarget = async (id: string, amount: number) => {
    const res = await fetch('/api/admin/employee-target', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, amount }),
    });
    if (res.ok) {
      setEditingId(null);
      setEditAmount('');
      load();
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    form.append('importMode', importMode);
    form.append('month', importMonth);
    try {
      const res = await fetch('/api/admin/sales-import', { method: 'POST', body: form });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setImportResult({
          importedCount: json.importedCount ?? 0,
          updatedCount: json.updatedCount ?? 0,
          skippedCount: json.skippedCount ?? 0,
          skippedRowCount: json.skippedRowCount ?? json.skippedRowsCount ?? 0,
          skippedRowsCount: json.skippedRowsCount ?? json.skippedRowCount ?? 0,
          skipped: json.skipped ?? [],
          warnings: json.warnings ?? [],
          ignoredColumns: json.ignoredColumns ?? [],
        });
        setShowImportDetails(true);
        load();
      }
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatNum = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString() : '—');
  const formatPct = (n: number) => (Number.isFinite(n) ? `${n.toFixed(1)}%` : '—');
  const warnings = data?.warnings;

  if (loading && !data) {
    return (
      <div className="p-4">
        <p className="text-slate-600">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-4 text-xl font-semibold text-slate-900">{t('targets.masterTitle')}</h1>

        <div className="mb-4 flex flex-wrap items-center gap-4">
          <label className="text-sm font-medium text-slate-700">{t('targets.month')}</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <OpsCard title={t('targets.boutiqueTarget')} className="mb-4">
          <div className="mb-2 flex items-center gap-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                data?.boutiqueTarget ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
              }`}
            >
              {data?.boutiqueTarget ? t('targets.boutiqueStatusSet') : t('targets.boutiqueStatusNotSet')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={0}
              value={boutiqueAmount}
              onChange={(e) => setBoutiqueAmount(e.target.value)}
              className="w-32 rounded border border-slate-300 px-3 py-2 text-sm"
              placeholder="0"
            />
            <span className="text-slate-600">{t('targets.sar')}</span>
            <button
              type="button"
              onClick={saveBoutique}
              disabled={savingBoutique}
              className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {savingBoutique ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </OpsCard>

        <OpsCard title={t('targets.weightedExplanation')} className="mb-4 border-sky-100 bg-sky-50/50">
          <p className="text-sm text-slate-700">{t('targets.weightedLeaveAdjusted')}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-2 font-medium text-slate-700">{t('targets.role')}</th>
                  <th className="p-2 font-medium text-slate-700">{t('targets.weight')}</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_WEIGHTS.map(({ role, weight }) => (
                  <tr key={role} className="border-b border-slate-100">
                    <td className="p-2">{SALES_TARGET_ROLE_LABELS[role]}</td>
                    <td className="p-2">{weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OpsCard>

        {warnings && (warnings.sumWeightsZero || warnings.hasMissingRole || warnings.hasUnknownRole || warnings.hasManyZeroScheduled) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {warnings.sumWeightsZero && (
              <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                {t('targets.warningSumWeightsZero')}
              </span>
            )}
            {warnings.hasMissingRole && (
              <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                {t('targets.warningMissingRole')}
              </span>
            )}
            {warnings.hasUnknownRole && (
              <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                {t('targets.warningUnknownRole')}
              </span>
            )}
            {warnings.hasManyZeroScheduled && (
              <span className="inline-flex rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">
                {t('targets.warningManyZeroScheduled')}
              </span>
            )}
          </div>
        )}

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => generateTargets(false)}
            disabled={generating || !data?.boutiqueTarget}
            className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {generating ? t('common.loading') : t('targets.generateTargets')}
          </button>
          <button
            type="button"
            onClick={() => setRegenerateModal(true)}
            disabled={generating || !data?.boutiqueTarget}
            className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {t('targets.recalculateUsingLeaves')}
          </button>
        </div>

        <OpsCard title={t('targets.importSales')} className="mb-4">
          <div className="mb-3 flex flex-wrap items-center gap-4">
            <fieldset className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'simple'}
                  onChange={() => setImportMode('simple')}
                  className="rounded border-slate-300"
                />
                {t('targets.importSimple')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'msr'}
                  onChange={() => setImportMode('msr')}
                  className="rounded border-slate-300"
                />
                {t('targets.importMsr')}
              </label>
            </fieldset>
            {importMode === 'msr' && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700">{t('targets.month')}</label>
                <input
                  type="month"
                  value={importMonth}
                  onChange={(e) => setImportMonth(e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <span className="text-xs text-slate-500">{t('targets.importMsrMonthHint')}</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={onFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="rounded bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {importing ? t('common.loading') : t('targets.uploadExcel')}
          </button>
        </OpsCard>

        {regenerateModal && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50"
              aria-hidden
              onClick={() => setRegenerateModal(false)}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
              <h3 className="mb-2 text-lg font-semibold text-slate-900">{t('targets.recalculateConfirmTitle')}</h3>
              <p className="mb-4 text-sm text-slate-600">{t('targets.recalculateConfirmBody')}</p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegenerateModal(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => generateTargets(true)}
                  className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  {t('targets.confirm')}
                </button>
              </div>
            </div>
          </>
        )}

        {importResult != null && (
          <div className="mb-4 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <p>
              {t('targets.imported')}: {importResult.importedCount} · {t('targets.updated')}: {importResult.updatedCount} ·{' '}
              {t('targets.skipped')}: {importResult.skippedCount}
              {(importResult.skippedRowCount ?? importResult.skippedRowsCount ?? 0) > 0 && ` · ${t('targets.skippedRows')}: ${importResult.skippedRowCount ?? importResult.skippedRowsCount}`}
              {(importResult.warnings?.length ?? 0) > 0 && ` · ${t('targets.warnings')}: ${importResult.warnings!.length}`}
              {(importResult.ignoredColumns?.length ?? 0) > 0 && ` · ${t('targets.ignoredColumns')}: ${importResult.ignoredColumns!.length}`}
            </p>
            <button
              type="button"
              onClick={() => setShowImportDetails(!showImportDetails)}
              className="mt-1 text-sky-600 hover:underline"
            >
              {showImportDetails ? t('common.close') : t('targets.showDetails')}
            </button>
            {showImportDetails && (
              <div className="mt-2 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-xs">
                {importResult.skipped.length > 0 && (
                  <p className="font-medium text-slate-700">{t('targets.skipped')}:</p>
                )}
                {importResult.skipped.slice(0, 50).map((s, i) => (
                  <div key={i} className="py-0.5">
                    Row {s.rowNumber}
                    {s.empId != null && ` empId ${s.empId}`}
                    {s.columnHeader != null && ` col "${s.columnHeader}"`}: {s.reason}
                  </div>
                ))}
                {importResult.skipped.length > 50 && (
                  <p className="text-slate-500">… and {importResult.skipped.length - 50} more</p>
                )}
                {(importResult.ignoredColumns?.length ?? 0) > 0 && (
                  <>
                    <p className="mt-2 font-medium text-slate-600">{t('targets.ignoredColumns')}:</p>
                    <p className="py-0.5 text-slate-600">{importResult.ignoredColumns!.slice(0, 30).join(', ')}{importResult.ignoredColumns!.length > 30 ? '…' : ''}</p>
                  </>
                )}
                {(importResult.warnings?.length ?? 0) > 0 && (
                  <>
                    <p className="mt-2 font-medium text-amber-700">{t('targets.warnings')}:</p>
                    {importResult.warnings!.slice(0, 20).map((w, i) => (
                      <div key={i} className="py-0.5">
                        Row {w.rowNumber}{w.message != null ? `: ${w.message}` : w.date != null ? ` date ${w.date}: Total Sale After ${w.totalAfter}, sum employees ${w.sumEmployees}, delta ${w.delta}` : ''}
                      </div>
                    ))}
                    {importResult.warnings!.length > 20 && (
                      <p className="text-slate-500">… and {importResult.warnings!.length - 20} more</p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <OpsCard title={t('targets.employeesTable')}>
          {!data?.employees?.length ? (
            <p className="text-slate-500">{t('targets.noEmployees')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="p-2 font-medium text-slate-700">{t('targets.empId')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('common.name')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.role')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.weight')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.active')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.scheduledDays')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.leaveDays')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.presenceFactor')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.effectiveWeight')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.monthlyTarget')}</th>
                    <th className="p-2 font-medium text-slate-700">MTD Sales</th>
                    <th className="p-2 font-medium text-slate-700">MTD %</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.todaySales')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.todayTarget')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.weekSales')}</th>
                    <th className="p-2 font-medium text-slate-700">{t('targets.weekTarget')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.employees.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="p-2 font-mono text-slate-600">{row.user.empId}</td>
                      <td className="p-2">{row.user.name}</td>
                      <td className="p-2">{row.roleLabel}</td>
                      <td className="p-2">{row.weight}</td>
                      <td className="p-2">{row.active ? t('targets.yes') : t('targets.no')}</td>
                      <td className="p-2">{row.scheduledDaysInMonth ?? '—'}</td>
                      <td className="p-2">{row.leaveDaysInMonth ?? '—'}</td>
                      <td className="p-2">{row.presenceFactor != null ? (row.presenceFactor * 100).toFixed(0) + '%' : '—'}</td>
                      <td className="p-2">{row.effectiveWeightAtGeneration ?? '—'}</td>
                      <td className="p-2">
                        {editingId === row.id ? (
                          <input
                            type="number"
                            min={0}
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            onBlur={() => {
                              const v = Math.round(Number(editAmount));
                              if (Number.isFinite(v) && v >= 0) patchEmployeeTarget(row.id, v);
                              else setEditingId(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const v = Math.round(Number(editAmount));
                                if (Number.isFinite(v) && v >= 0) patchEmployeeTarget(row.id, v);
                              }
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            className="w-24 rounded border border-slate-300 px-2 py-1 text-sm"
                            autoFocus
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(row.id);
                              setEditAmount(String(row.monthlyTarget));
                            }}
                            className="text-left underline hover:no-underline"
                          >
                            {formatNum(row.monthlyTarget)}
                          </button>
                        )}
                      </td>
                      <td className="p-2">{formatNum(row.mtdSales)}</td>
                      <td className="p-2">{formatPct(row.mtdPct)}</td>
                      <td className="p-2">{formatNum(row.todaySales)}</td>
                      <td className="p-2">{formatNum(row.todayTarget)}</td>
                      <td className="p-2">{formatNum(row.weekSales)}</td>
                      <td className="p-2">{formatNum(row.weekTarget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </OpsCard>
      </div>
    </div>
  );
}
