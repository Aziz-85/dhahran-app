'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/app/providers';
import { APP_VERSION } from '@/lib/version';
import { getNavGroupsForUser } from '@/lib/navConfig';
import { OperationalBoutiqueSelector } from '@/components/scope/OperationalBoutiqueSelector';
import type { Role, EmployeePosition } from '@prisma/client';
import { getRoleDisplayLabel } from '@/lib/roleLabel';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

const DEFAULT_OPEN_GROUPS: Record<string, boolean> = {
  OPERATIONS: true,
  EXECUTIVE: true, // will be overridden by role
  SALES: false,
  LEAVES: false,
  PLANNER_SYNC: false,
  ADMINISTRATION: false,
  KPI: false,
  HELP: false,
};

export function Sidebar({
  role,
  name,
  position,
  canEditSchedule,
  canApproveWeek,
}: {
  role: Role;
  name?: string;
  position?: EmployeePosition | null;
  canEditSchedule: boolean;
  canApproveWeek: boolean;
}) {
  const pathname = usePathname();
  const { messages, locale, setLocale } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;

  const groups = useMemo(
    () => getNavGroupsForUser({ role, canEditSchedule, canApproveWeek }),
    [role, canEditSchedule, canApproveWeek]
  );

  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { ...DEFAULT_OPEN_GROUPS };
    if (role !== 'ADMIN' && role !== 'MANAGER') initial.EXECUTIVE = false;
    return initial;
  });

  const isItemActive = useCallback(
    (href: string) => pathname === href || (href !== '/' && pathname.startsWith(href + '/')),
    [pathname]
  );

  const activeGroupKey = useMemo(() => {
    for (const g of groups) {
      if (g.items.some((item) => isItemActive(item.href))) return g.key;
    }
    return null;
  }, [groups, isItemActive]);

  useEffect(() => {
    if (activeGroupKey != null && !openKeys[activeGroupKey]) {
      setOpenKeys((prev) => ({ ...prev, [activeGroupKey]: true }));
    }
  }, [activeGroupKey, openKeys]);

  const toggleGroup = useCallback((key: string) => {
    setOpenKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isRtl = locale === 'ar';

  return (
    <aside className={`hidden h-screen w-52 flex-col bg-white lg:w-56 md:flex ${isRtl ? 'border-l border-slate-200' : 'border-r border-slate-200'}`}>
      <div className="flex min-w-0 flex-col h-full">
        {/* Header + Scope */}
        <div className="shrink-0 border-b border-slate-200 px-3 py-4">
          <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700 truncate block min-w-0">
            Team Monitor
          </Link>
          {!pathname.startsWith('/admin') && (
            <div className="mt-2 min-w-0">
              <p className="text-xs font-medium text-slate-500 mb-1">{t('common.workingOnBoutique')}:</p>
              <OperationalBoutiqueSelector role={role} />
            </div>
          )}
        </div>

        {/* Nav: collapsible groups */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 min-w-0">
          <ul className="space-y-1">
            {groups.map((group) => {
              const isOpen = openKeys[group.key] ?? false;
              return (
                <li key={group.key} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50 min-w-0"
                    aria-expanded={isOpen}
                  >
                    <span className="truncate min-w-0">{t(group.labelKey)}</span>
                    <span className="shrink-0 text-slate-400" aria-hidden>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>
                  {isOpen && (
                    <ul className="mt-1 space-y-0.5 pl-2 border-l border-slate-200 ml-3">
                      {group.items.map((item) => {
                        const active = isItemActive(item.href);
                        return (
                          <li key={item.href} className="min-w-0">
                            <Link
                              href={item.href}
                              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors min-w-0 truncate ${
                                active
                                  ? `bg-slate-100 font-medium text-slate-900 ${isRtl ? 'border-r-4 border-r-sky-500' : 'border-l-4 border-l-sky-500'}`
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="truncate min-w-0">{t(item.key)}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-200 px-3 py-4 min-w-0">
          {name && (
            <div className="mb-3 min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">{name}</div>
              <div className="truncate text-xs text-slate-500">{getRoleDisplayLabel(role, position ?? null, t)}</div>
            </div>
          )}
          <div className="space-y-2">
            <select
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'en' | 'ar')}
              className="h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="en">{t('common.english')}</option>
              <option value="ar">{t('common.arabic')}</option>
            </select>
            <Link
              href="/change-password"
              className="flex h-9 items-center rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 truncate min-w-0"
            >
              {t('nav.changePassword')}
            </Link>
            <button
              type="button"
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                window.location.href = '/login';
              }}
              className="w-full text-left h-9 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50 min-w-0"
            >
              {t('common.logout')}
            </button>
          </div>
          <div className="mt-4 text-xs text-slate-400 truncate min-w-0">Team Monitor v{APP_VERSION}</div>
        </div>
      </div>
    </aside>
  );
}
