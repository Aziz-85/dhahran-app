'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useI18n } from '@/app/providers';
import { APP_VERSION } from '@/lib/version';
import { getNavLinksForUser } from '@/lib/permissions';
import type { Role } from '@prisma/client';

function getNested(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((o: unknown, k) => (o as Record<string, unknown>)?.[k], obj);
}

export function Sidebar({
  role,
  name,
  canEditSchedule,
  canApproveWeek,
}: {
  role: Role;
  name?: string;
  canEditSchedule: boolean;
  canApproveWeek: boolean;
}) {
  const pathname = usePathname();
  const { messages, locale, setLocale } = useI18n();
  const t = (key: string) => (getNested(messages, key) as string) || key;

  const links = getNavLinksForUser({ role, canEditSchedule, canApproveWeek }).filter((item) => item.href !== '/change-password');
  const isRtl = locale === 'ar';

  return (
    <aside className={`hidden h-screen w-52 flex-col bg-white lg:w-56 md:flex ${isRtl ? 'border-l border-slate-200' : 'border-r border-slate-200'}`}>
      {/* Header */}
      <div className="border-b border-slate-200 px-3 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900 hover:text-slate-700">
          Dhahran Team
        </Link>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {links.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? `bg-slate-100 font-medium text-slate-900 ${isRtl ? 'border-r-4 border-r-sky-500' : 'border-l-4 border-l-sky-500'}`
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t(item.key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer: User info + Actions */}
      <div className="border-t border-slate-200 px-3 py-4">
        {name && (
          <div className="mb-3 text-sm font-medium text-slate-900">{name}</div>
        )}
        <div className="space-y-2">
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as 'en' | 'ar')}
            className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="en">{t('common.english')}</option>
            <option value="ar">{t('common.arabic')}</option>
          </select>
          <Link
            href="/change-password"
            className="flex h-9 items-center rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('nav.changePassword')}
          </Link>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              window.location.href = '/login';
            }}
            className="w-full text-left h-9 rounded-lg px-3 text-sm text-slate-700 hover:bg-slate-50"
          >
            {t('common.logout')}
          </button>
        </div>
        <div className="mt-4 text-xs text-slate-400">
          Dhahran Team v{APP_VERSION}
        </div>
      </div>
    </aside>
  );
}
