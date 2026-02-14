'use client';

import { useEffect, useState } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { LuxuryTable, LuxuryTableHead, LuxuryTh, LuxuryTableBody, LuxuryTd } from '@/components/ui/LuxuryTable';
import { useI18n } from '@/app/providers';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type User = { id: string; empId: string; role: string; mustChangePassword: boolean; disabled: boolean };

export function AdminUsersClient() {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [list, setList] = useState<User[]>([]);

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json().catch(() => []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  }, []);

  return (
    <div className="p-4 md:p-6">
      <OpsCard title={t('nav.admin.users')}>
        <LuxuryTable>
          <LuxuryTableHead>
            <LuxuryTh>Emp ID</LuxuryTh>
            <LuxuryTh>Role</LuxuryTh>
            <LuxuryTh>Must change password</LuxuryTh>
            <LuxuryTh>Disabled</LuxuryTh>
          </LuxuryTableHead>
          <LuxuryTableBody>
            {list.map((u) => (
              <tr key={u.id}>
                <LuxuryTd>{u.empId}</LuxuryTd>
                <LuxuryTd>{u.role}</LuxuryTd>
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
