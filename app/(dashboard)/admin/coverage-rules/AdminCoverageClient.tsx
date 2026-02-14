'use client';

import { useEffect, useState } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { LuxuryTable, LuxuryTableHead, LuxuryTh, LuxuryTableBody, LuxuryTd } from '@/components/ui/LuxuryTable';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type Rule = { id: string; dayOfWeek: number; minAM: number; minPM: number; enabled: boolean };

// Underlying index mapping follows JS Date.getDay(): 0=Sun..6=Sat.
// Display rows in business order: Saturday → Friday.
const DAY_KEYS = ['days.sun', 'days.mon', 'days.tue', 'days.wed', 'days.thu', 'days.fri', 'days.sat'] as const;

export function AdminCoverageClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [list, setList] = useState<Rule[]>([]);

  // Ordered indices for week: Saturday → Friday
  const orderedDays = [6, 0, 1, 2, 3, 4, 5] as const;
  const FRIDAY_DAY_OF_WEEK = 5;

  const orderedRules: Rule[] = orderedDays
    .map((day) => list.find((r) => Number(r.dayOfWeek) === day) ?? null)
    .filter((r): r is Rule => r !== null);

  /** Required Min AM: Friday => 0, else max(storedMinAM, 2). Null when rule disabled. */
  function requiredMinAm(rule: Rule): number | null {
    if (!rule.enabled) return null;
    if (rule.dayOfWeek === FRIDAY_DAY_OF_WEEK) return 0;
    return Math.max(rule.minAM, 2);
  }

  /** True when stored minAM differs from required (Friday stored ≠ 0, or non-Friday stored < 2). */
  function isAdjustedByPolicy(rule: Rule): boolean {
    if (!rule.enabled) return false;
    const required = requiredMinAm(rule);
    if (required === null) return false;
    return rule.minAM !== required;
  }

  useEffect(() => {
    fetch('/api/admin/coverage-rules')
      .then((r) => r.json().catch(() => []))
      .then((data) => {
        if (process.env.NODE_ENV !== 'production') {
          // Dev-only diagnostics: confirm shape and values from API/DB.
          // Do not remove without checking CoverageRule seeds and logic.
          // eslint-disable-next-line no-console
          console.log('coverage rules', data);
        }
        setList(Array.isArray(data) ? data : []);
      })
      .catch(() => setList([]));
  }, []);

  return (
    <div className="p-4 md:p-6">
      <OpsCard title={t('nav.admin.coverageRules')}>
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">{t('coverage.effectivePolicyTitle')}</h3>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-slate-700">
            <li>{t('coverage.effectivePolicyAmGtePm')}</li>
            <li>{t('coverage.effectivePolicyAmAtLeast2')}</li>
            <li>{t('coverage.effectivePolicyWeekSatFri')}</li>
            <li>{t('coverage.effectivePolicyFridayException')}</li>
            <li>{t('coverage.minPMInformational')}</li>
          </ul>
        </div>

        <LuxuryTable>
          <LuxuryTableHead>
            <LuxuryTh className="pr-4">{t('schedule.dayName')}</LuxuryTh>
            <LuxuryTh className="px-4">{t('coverage.storedMinAM')}</LuxuryTh>
            <LuxuryTh className="px-4">{t('coverage.storedMinPM')}</LuxuryTh>
            <LuxuryTh className="px-4">{t('coverage.requiredMinAM')}</LuxuryTh>
            <LuxuryTh className="pl-4">{t('coverage.enabled')}</LuxuryTh>
          </LuxuryTableHead>
          <LuxuryTableBody>
            {orderedRules.map((r) => {
              const required = requiredMinAm(r);
              const adjusted = isAdjustedByPolicy(r);
              return (
                <tr key={r.id} className="border-b border-slate-200">
                  <LuxuryTd className="py-2.5 pr-4 font-medium">{t(DAY_KEYS[r.dayOfWeek] ?? 'days.sun')}</LuxuryTd>
                  <LuxuryTd className="px-4 py-2.5">{r.minAM}</LuxuryTd>
                  <LuxuryTd className="px-4 py-2.5">{r.minPM}</LuxuryTd>
                  <LuxuryTd className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2">
                      <span className="text-slate-700">{required !== null ? required : '—'}</span>
                      {adjusted && (
                        <span className="inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200">
                          {t('coverage.adjustedByPolicy')}
                        </span>
                      )}
                    </span>
                  </LuxuryTd>
                  <LuxuryTd className="pl-4 py-2.5">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${r.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {r.enabled ? t('coverage.enabledYes') : t('coverage.enabledNo')}
                    </span>
                  </LuxuryTd>
                </tr>
              );
            })}
          </LuxuryTableBody>
        </LuxuryTable>

        <p className="mt-4 text-xs text-slate-500">{t('coverage.tableNote')}</p>
      </OpsCard>
    </div>
  );
}
