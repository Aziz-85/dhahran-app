'use client';

import { useEffect, useState } from 'react';
import { OpsCard } from '@/components/ui/OpsCard';
import { LuxuryTable, LuxuryTableHead, LuxuryTh, LuxuryTableBody, LuxuryTd } from '@/components/ui/LuxuryTable';
import { useI18n } from '@/app/providers';
import type { Role } from '@prisma/client';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

type EmployeePosition = 'BOUTIQUE_MANAGER' | 'ASSISTANT_MANAGER' | 'SENIOR_SALES' | 'SALES';

type Employee = {
  empId: string;
  name: string;
  email: string | null;
  phone: string | null;
  team: string;
  currentTeam?: string; // effective team as of today (from assignments/history)
  weeklyOffDay: number;
  position: EmployeePosition | null;
  active: boolean;
  language: string;
  user?: { role: Role; disabled: boolean; mustChangePassword: boolean } | null;
};

const ROLES: Role[] = ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'];

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const POSITIONS: EmployeePosition[] = ['BOUTIQUE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES', 'SALES'];

type TeamPreview = {
  weekStart: string;
  teamACount: number;
  teamBCount: number;
  afterTeamACount: number;
  afterTeamBCount: number;
  imbalance: boolean;
};

export function AdminEmployeesClient({ initialRole = 'MANAGER' }: { initialRole?: Role }) {
  const { messages } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;
  const [list, setList] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    empId: '',
    name: '',
    email: '',
    phone: '',
    team: 'A' as 'A' | 'B',
    weeklyOffDay: 5,
    position: '' as EmployeePosition | '',
    language: 'en' as 'en' | 'ar',
  });
  const [createModal, setCreateModal] = useState<{ empId: string } | null>(null);
  const [editModal, setEditModal] = useState<Employee | null>(null);
  const [editEmployeeModal, setEditEmployeeModal] = useState<Employee | null>(null);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    name: '',
    email: '',
    phone: '',
    team: 'A' as 'A' | 'B',
    weeklyOffDay: 5,
    position: '' as EmployeePosition | '',
    language: 'en' as 'en' | 'ar',
  });
  const [createPassword, setCreatePassword] = useState('');
  const [createRole, setCreateRole] = useState<Role>('EMPLOYEE');
  const [editRole, setEditRole] = useState<Role>('EMPLOYEE');
  const [editDisabled, setEditDisabled] = useState(false);
  const [editMustChange, setEditMustChange] = useState(false);
  const [teamChangeModal, setTeamChangeModal] = useState<{ empId: string; name: string; currentTeam: string } | null>(null);
  const [teamChangeForm, setTeamChangeForm] = useState({ newTeam: 'A' as 'A' | 'B', effectiveFrom: '', reason: '', allowImbalanceOverride: false });
  const [teamChangeSuccessToast, setTeamChangeSuccessToast] = useState<string | null>(null);
  const [teamPreview, setTeamPreview] = useState<TeamPreview | null>(null);
  const [teamPreviewLoading, setTeamPreviewLoading] = useState(false);

  const load = () => {
    fetch('/api/admin/employees')
      .then((r) => r.json().catch(() => []))
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch(() => setList([]));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!teamChangeModal?.empId || !teamChangeForm.effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(teamChangeForm.effectiveFrom)) {
      setTeamPreview(null);
      return;
    }
    setTeamPreviewLoading(true);
    setTeamPreview(null);
    const q = new URLSearchParams({ effectiveFrom: teamChangeForm.effectiveFrom, newTeam: teamChangeForm.newTeam });
    fetch(`/api/employees/${encodeURIComponent(teamChangeModal.empId)}/change-team/preview?${q}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: TeamPreview | null) => setTeamPreview(data ?? null))
      .catch(() => setTeamPreview(null))
      .finally(() => setTeamPreviewLoading(false));
  }, [teamChangeModal?.empId, teamChangeForm.effectiveFrom, teamChangeForm.newTeam]);

  const handleTeamChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamChangeModal) return;
    if (!teamChangeForm.effectiveFrom || !teamChangeForm.reason.trim()) {
      setError(t('adminEmp.teamChangeReason'));
      return;
    }
    if (teamPreview?.imbalance && initialRole !== 'ADMIN') {
      setError(t('adminEmp.teamImbalanceManagerBlock'));
      return;
    }
    if (teamPreview?.imbalance && initialRole === 'ADMIN' && !teamChangeForm.allowImbalanceOverride) {
      setError(t('adminEmp.teamImbalanceConfirm'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/employees/${encodeURIComponent(teamChangeModal.empId)}/change-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTeam: teamChangeForm.newTeam,
          effectiveFrom: teamChangeForm.effectiveFrom,
          reason: teamChangeForm.reason.trim(),
          allowImbalanceOverride: teamPreview?.imbalance && initialRole === 'ADMIN' ? teamChangeForm.allowImbalanceOverride : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed');
        return;
      }
      const effectiveDate = (data as { effectiveFrom?: string }).effectiveFrom ?? teamChangeForm.effectiveFrom;
      const message = t('adminEmp.teamUpdatedEffective')?.replace('{date}', effectiveDate) || `Team updated effective ${effectiveDate}`;
      setTeamChangeSuccessToast(message);
      setTeamChangeModal(null);
      load();
      setTimeout(() => setTeamChangeSuccessToast(null), 5000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empId: form.empId.trim(),
          name: form.name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          team: form.team,
          weeklyOffDay: form.weeklyOffDay,
          position: form.position || undefined,
          language: form.language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed');
        return;
      }
      setForm({ empId: '', name: '', email: '', phone: '', team: 'A', weeklyOffDay: 5, position: '', language: 'en' });
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createModal || !createPassword.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId: createModal.empId, password: createPassword, role: createRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed');
        return;
      }
      setCreateModal(null);
      setCreatePassword('');
      setCreateRole('EMPLOYEE');
      load();
    } finally {
      setLoading(false);
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empId: editModal.empId,
          role: editRole,
          disabled: editDisabled,
          mustChangePassword: editMustChange,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed');
        return;
      }
      setEditModal(null);
      load();
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (emp: Employee) => {
    if (!emp.user) return;
    setEditModal(emp);
    setEditRole(emp.user.role);
    setEditDisabled(emp.user.disabled);
    setEditMustChange(emp.user.mustChangePassword);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditEmployeeModal(emp);
    const displayTeam = (emp.currentTeam ?? emp.team) as 'A' | 'B';
    setEditEmployeeForm({
      name: emp.name,
      email: emp.email ?? '',
      phone: emp.phone ?? '',
      team: displayTeam,
      weeklyOffDay: emp.weeklyOffDay,
      position: (emp.position ?? '') as EmployeePosition | '',
      language: emp.language as 'en' | 'ar',
    });
  };

  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployeeModal) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/employees', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empId: editEmployeeModal.empId,
          name: editEmployeeForm.name.trim(),
          email: editEmployeeForm.email.trim() || null,
          phone: editEmployeeForm.phone.trim() || null,
          weeklyOffDay: editEmployeeForm.weeklyOffDay,
          position: editEmployeeForm.position || null,
          language: editEmployeeForm.language,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || 'Failed');
        return;
      }
      setEditEmployeeModal(null);
      load();
    } finally {
      setLoading(false);
    }
  };

  const roleLabel = (r: Role) => {
    if (r === 'EMPLOYEE') return t('adminEmp.roleEmployee');
    if (r === 'MANAGER') return t('adminEmp.roleManager');
    if (r === 'ASSISTANT_MANAGER') return t('adminEmp.roleAssistantManager');
    return t('adminEmp.roleAdmin');
  };

  const dayName = (dayNum: number) => t(`days.${DAY_KEYS[dayNum] ?? 'sun'}`);
  const positionLabel = (p: EmployeePosition | null) => {
    if (!p) return '—';
    if (p === 'BOUTIQUE_MANAGER') return t('adminEmp.positionBoutiqueManager');
    if (p === 'ASSISTANT_MANAGER') return t('adminEmp.positionAssistantManager');
    if (p === 'SENIOR_SALES') return t('adminEmp.positionSeniorSales');
    return t('adminEmp.positionSales');
  };

  return (
    <div className="p-4 md:p-6">
      <OpsCard title={t('adminEmp.addEmployee')} className="mb-6">
        <form onSubmit={handleAddEmployee} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="text"
            placeholder="Emp ID"
            value={form.empId}
            onChange={(e) => setForm((f) => ({ ...f, empId: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
            required
          />
          <input
            type="text"
            placeholder={t('common.name')}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
            required
          />
          <input
            type="text"
            placeholder={t('common.email')}
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          />
          <input
            type="text"
            placeholder={t('common.phone')}
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          />
          <select
            value={form.team}
            onChange={(e) => setForm((f) => ({ ...f, team: e.target.value as 'A' | 'B' }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          >
            <option value="A">A</option>
            <option value="B">B</option>
          </select>
          <select
            value={form.weeklyOffDay}
            onChange={(e) => setForm((f) => ({ ...f, weeklyOffDay: Number(e.target.value) }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          >
            {DAY_KEYS.map((key, i) => (
              <option key={key} value={i}>
                {t('common.offDay')}: {t(`days.${key}`)}
              </option>
            ))}
          </select>
          <select
            value={form.position}
            onChange={(e) => setForm((f) => ({ ...f, position: e.target.value as EmployeePosition | '' }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          >
            <option value="">— {t('adminEmp.position')}</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {positionLabel(p)}
              </option>
            ))}
          </select>
          <select
            value={form.language}
            onChange={(e) => setForm((f) => ({ ...f, language: e.target.value as 'en' | 'ar' }))}
            className="rounded border border-slate-300 px-3 py-2 text-base"
          >
            <option value="en">{t('common.english')}</option>
            <option value="ar">{t('common.arabic')}</option>
          </select>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-sky-600 px-4 py-2 text-base font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {t('common.add')}
            </button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </OpsCard>

      <OpsCard title={t('nav.admin.employees')}>
        <LuxuryTable>
          <LuxuryTableHead>
            <LuxuryTh>Emp ID</LuxuryTh>
            <LuxuryTh>{t('common.name')}</LuxuryTh>
            <LuxuryTh>{t('common.email')}</LuxuryTh>
            <LuxuryTh>{t('common.team')}</LuxuryTh>
            <LuxuryTh>{t('common.offDay')}</LuxuryTh>
            <LuxuryTh>{t('adminEmp.position')}</LuxuryTh>
            <LuxuryTh>{t('common.role')}</LuxuryTh>
            <LuxuryTh>—</LuxuryTh>
          </LuxuryTableHead>
          <LuxuryTableBody>
            {list.map((e) => (
              <tr key={e.empId}>
                <LuxuryTd>{e.empId}</LuxuryTd>
                <LuxuryTd>{e.name}</LuxuryTd>
                <LuxuryTd>{e.email ?? '—'}</LuxuryTd>
                <LuxuryTd>{e.currentTeam ?? e.team}</LuxuryTd>
                <LuxuryTd>{dayName(e.weeklyOffDay)}</LuxuryTd>
                <LuxuryTd>{positionLabel(e.position ?? null)}</LuxuryTd>
                <LuxuryTd>
                  {e.user ? (
                    <span>
                      {roleLabel(e.user.role)}
                      {e.user.disabled ? ` (${t('adminEmp.disabled')})` : ''}
                    </span>
                  ) : (
                    t('adminEmp.noAccount')
                  )}
                </LuxuryTd>
                <LuxuryTd>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditEmployee(e)}
                      className="text-base text-sky-600 hover:underline"
                    >
                      {t('common.edit')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError('');
                        const currentTeam = e.currentTeam ?? e.team;
                        setTeamChangeModal({ empId: e.empId, name: e.name, currentTeam });
                        setTeamChangeForm({
                          newTeam: (currentTeam === 'A' ? 'B' : 'A') as 'A' | 'B',
                          effectiveFrom: new Date().toISOString().slice(0, 10),
                          reason: '',
                          allowImbalanceOverride: false,
                        });
                      }}
                      className="text-base text-sky-600 hover:underline"
                    >
                      {t('adminEmp.changeTeam')}
                    </button>
                    {initialRole === 'ADMIN' &&
                      (e.user ? (
                        <button
                          type="button"
                          onClick={() => openEdit(e)}
                          className="text-base text-sky-600 hover:underline"
                        >
                          {t('adminEmp.editAccount')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCreateModal({ empId: e.empId })}
                          className="text-base text-sky-600 hover:underline"
                        >
                          {t('adminEmp.createAccount')}
                        </button>
                      ))}
                  </div>
                </LuxuryTd>
              </tr>
            ))}
          </LuxuryTableBody>
        </LuxuryTable>
      </OpsCard>

      {createModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setCreateModal(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">{t('adminEmp.createAccount')}</h3>
            <p className="mb-2 text-base text-slate-600">Emp ID: {createModal.empId}</p>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">{t('auth.password')}</label>
                <input
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.role')}</label>
                <select
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as Role)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setCreateModal(null)} className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {editEmployeeModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setEditEmployeeModal(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">{t('adminEmp.editEmployee')}</h3>
            <p className="mb-4 text-base text-slate-600">
              <span dir="ltr">{editEmployeeModal.empId}</span>
            </p>
            <form onSubmit={handleEditEmployee} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">{t('common.name')}</label>
                <input
                  type="text"
                  value={editEmployeeForm.name}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.email')}</label>
                <input
                  type="text"
                  value={editEmployeeForm.email}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.phone')}</label>
                <input
                  type="text"
                  value={editEmployeeForm.phone}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.team')}</label>
                <p className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700">
                  {editEmployeeForm.team}
                  <span className="ml-2 text-xs text-slate-500">
                    ({t('adminEmp.changeTeam')} for future-dated change)
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.offDay')}</label>
                <select
                  value={editEmployeeForm.weeklyOffDay}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, weeklyOffDay: Number(e.target.value) }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  {DAY_KEYS.map((key, i) => (
                    <option key={key} value={i}>
                      {t(`days.${key}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">{t('adminEmp.position')}</label>
                <select
                  value={editEmployeeForm.position}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, position: e.target.value as EmployeePosition | '' }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  <option value="">—</option>
                  {POSITIONS.map((p) => (
                    <option key={p} value={p}>
                      {positionLabel(p)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">{t('common.language')}</label>
                <select
                  value={editEmployeeForm.language}
                  onChange={(e) => setEditEmployeeForm((f) => ({ ...f, language: e.target.value as 'en' | 'ar' }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  <option value="en">{t('common.english')}</option>
                  <option value="ar">{t('common.arabic')}</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setEditEmployeeModal(null)} className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {teamChangeModal && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setTeamChangeModal(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold">{t('adminEmp.teamChangeTitle')}</h3>
            <p className="mb-2 text-base text-slate-600">
              {teamChangeModal.name} (<span dir="ltr">{teamChangeModal.empId}</span>) — {t('adminEmp.currentTeam')}: <span dir="ltr">{teamChangeModal.currentTeam}</span>
            </p>
            <p className="mb-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {(() => {
                const msg = t('adminEmp.teamChangeImpact');
                const dateVal = teamChangeForm.effectiveFrom || '…';
                if (msg.includes('{date}')) {
                  const [before, after] = msg.split('{date}');
                  return <>{before}<span dir="ltr">{dateVal}</span>{after}</>;
                }
                return msg.replace('{date}', dateVal);
              })()}
            </p>
            {teamPreviewLoading && <p className="mb-2 text-sm text-slate-500">{t('adminEmp.checkingImbalance')}</p>}
            {teamPreview && !teamPreviewLoading && (
              <p className="mb-2 text-sm text-slate-600">
                {t('adminEmp.weekTeamCounts')}: <span dir="ltr">A = {teamPreview.teamACount}, B = {teamPreview.teamBCount}</span>
                → {t('adminEmp.afterChange')}: <span dir="ltr">A = {teamPreview.afterTeamACount}, B = {teamPreview.afterTeamBCount}</span>
              </p>
            )}
            {teamPreview?.imbalance && (
              <div className="mb-4 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t('adminEmp.teamImbalanceWarning')}
                {initialRole === 'ADMIN' && (
                  <label className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={teamChangeForm.allowImbalanceOverride}
                      onChange={(e) => setTeamChangeForm((f) => ({ ...f, allowImbalanceOverride: e.target.checked }))}
                    />
                    {t('adminEmp.proceedDespiteImbalance')}
                  </label>
                )}
                {initialRole !== 'ADMIN' && (
                  <p className="mt-1 font-medium">{t('adminEmp.onlyAdminCanOverride')}</p>
                )}
              </div>
            )}
            <form onSubmit={handleTeamChange} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">{t('adminEmp.newTeam')}</label>
                <select
                  value={teamChangeForm.newTeam}
                  onChange={(e) => setTeamChangeForm((f) => ({ ...f, newTeam: e.target.value as 'A' | 'B' }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">{t('adminEmp.effectiveFrom')}</label>
                <input
                  type="date"
                  value={teamChangeForm.effectiveFrom}
                  onChange={(e) => setTeamChangeForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">{t('adminEmp.teamChangeReason')}</label>
                <textarea
                  value={teamChangeForm.reason}
                  onChange={(e) => setTeamChangeForm((f) => ({ ...f, reason: e.target.value }))}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base min-h-[80px]"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !teamChangeForm.effectiveFrom ||
                    !teamChangeForm.reason.trim() ||
                    (teamPreview?.imbalance && initialRole !== 'ADMIN') ||
                    (teamPreview?.imbalance && initialRole === 'ADMIN' && !teamChangeForm.allowImbalanceOverride)
                  }
                  className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700 disabled:opacity-50"
                >
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setTeamChangeModal(null)} className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {teamChangeSuccessToast && (
        <div className="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-lg">
          {teamChangeSuccessToast}
        </div>
      )}

      {editModal && editModal.user && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setEditModal(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">{t('adminEmp.editAccount')}</h3>
            <p className="mb-2 text-base text-slate-600">
              {editModal.name} ({editModal.empId})
            </p>
            <form onSubmit={handleEditAccount} className="space-y-3">
              <div>
                <label className="block text-sm font-medium">{t('common.role')}</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full rounded border border-slate-300 px-3 py-2 text-base"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-base">
                <input type="checkbox" checked={editDisabled} onChange={(e) => setEditDisabled(e.target.checked)} />
                {t('adminEmp.disabled')}
              </label>
              <label className="flex items-center gap-2 text-base">
                <input type="checkbox" checked={editMustChange} onChange={(e) => setEditMustChange(e.target.checked)} />
                {t('adminEmp.mustChangePassword')}
              </label>
              <div className="flex gap-2">
                <button type="submit" disabled={loading} className="rounded bg-sky-600 px-4 py-2 text-white hover:bg-sky-700">
                  {t('common.save')}
                </button>
                <button type="button" onClick={() => setEditModal(null)} className="rounded border border-slate-300 px-4 py-2 hover:bg-slate-50">
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
