'use client';

import { useCallback, useEffect, useState } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { LuxuryTable, LuxuryTableHead, LuxuryTh, LuxuryTableBody, LuxuryTd } from '@/components/ui/LuxuryTable';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type User = {
  id: string;
  empId: string;
  role: string;
  mustChangePassword: boolean;
  disabled: boolean;
  canEditSchedule?: boolean;
};

export function AdminUsersClient() {
  const { messages } = useI18n();
  const t = useCallback((key: string) => (getNested(messages, key) as string) || key, [messages]);
  const [list, setList] = useState<User[]>([]);

  const fetchList = useCallback(() => {
    fetch('/api/admin/users')
      .then((r) => r.json().catch(() => []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const setUserScheduleEditPermission = useCallback(
    async (empId: string, enabled: boolean) => {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId, canEditSchedule: enabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || t('admin.onlyAdminCanChangePermissions'));
        return;
      }
      setList((prev) =>
        prev.map((u) => (u.empId === empId ? { ...u, canEditSchedule: enabled } : u))
      );
    },
    [t]
  );

  return (
    <div className="p-4 md:p-6">
      <OpsCard title={t('nav.admin.users')}>
        <LuxuryTable>
          <LuxuryTableHead>
            <LuxuryTh>Emp ID</LuxuryTh>
            <LuxuryTh>Role</LuxuryTh>
            <LuxuryTh title={t('admin.scheduleEditPermissionHint')}>{t('admin.scheduleEditPermission')}</LuxuryTh>
            <LuxuryTh>Must change password</LuxuryTh>
            <LuxuryTh>Disabled</LuxuryTh>
          </LuxuryTableHead>
          <LuxuryTableBody>
            {list.map((u) => (
              <tr key={u.id}>
                <LuxuryTd>{u.empId}</LuxuryTd>
                <LuxuryTd>{u.role}</LuxuryTd>
                <LuxuryTd>
                  {u.role === 'ASSISTANT_MANAGER' ? (
                    <button
                      type="button"
                      onClick={() => setUserScheduleEditPermission(u.empId, !u.canEditSchedule)}
                      className={`rounded border px-2 py-1 text-sm ${
                        u.canEditSchedule
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-300 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {u.canEditSchedule ? t('admin.revoke') : t('admin.grant')}
                    </button>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </LuxuryTd>
                <LuxuryTd>{u.mustChangePassword ? 'Yes' : 'No'}</LuxuryTd>
                <LuxuryTd>{u.disabled ? 'Yes' : 'No'}</LuxuryTd>
              </tr>
            ))}
          </LuxuryTableBody>
        </LuxuryTable>
      </OpsCard>
    </div>
  );
}
