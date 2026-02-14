'use client';

import { useEffect, useState } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { ShiftCard } from '@/components/ui/ShiftCard';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type EmployeeHomeData = {
  date: string;
  todaySchedule: { am: boolean; pm: boolean };
  weekRoster: { am: Array<{ empId: string; name: string }>; pm: Array<{ empId: string; name: string }> };
  todayTasks: Array<{ taskName: string; reason: string }>;
};

export function EmployeeHomeClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [data, setData] = useState<EmployeeHomeData | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    fetch(`/api/employee/home?date=${date}`)
      .then((r) => r.json().catch(() => null))
      .then(setData)
      .catch(() => setData(null));
  }, [date]);

  if (!data) {
    return (
      <div className="p-4">
        <p className="text-slate-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4">
          <label className="mr-2 text-base font-medium text-slate-700">{t('common.date')}</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <ShiftCard variant="morning" title={t('schedule.morning')}>
            {data.todaySchedule.am ? (
              <p className="text-base">You are on shift</p>
            ) : (
              <p className="text-base text-slate-500">Off</p>
            )}
          </ShiftCard>
          <ShiftCard variant="evening" title={t('schedule.evening')}>
            {data.todaySchedule.pm ? (
              <p className="text-base">You are on shift</p>
            ) : (
              <p className="text-base text-slate-500">Off</p>
            )}
          </ShiftCard>
        </div>

        <OpsCard title={t('tasks.today')} className="mt-6">
          <ul className="list-disc space-y-1 pl-4">
            {data.todayTasks.map((t) => (
              <li key={t.taskName}>
                {t.taskName} <span className="text-slate-500">({t.reason})</span>
              </li>
            ))}
            {data.todayTasks.length === 0 && <li className="text-slate-500">—</li>}
          </ul>
        </OpsCard>

        <OpsCard title={t('schedule.week')} className="mt-6">
          <p className="mb-2 text-base text-slate-600">{t('schedule.morning')}</p>
          <p className="mb-2 text-base">
            {data.weekRoster.am.map((e) => e.name).join(', ') || '—'}
          </p>
          <p className="mb-2 text-base text-slate-600">{t('schedule.evening')}</p>
          <p className="text-base">
            {data.weekRoster.pm.map((e) => e.name).join(', ') || '—'}
          </p>
        </OpsCard>
      </div>
    </div>
  );
}
