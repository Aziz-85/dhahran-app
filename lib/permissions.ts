import type { Role } from '@prisma/client';

/** Roles that can edit schedule (batch save) and access /schedule/edit */
export const SCHEDULE_EDIT_ROLES: Role[] = ['MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'];

// --- Phase F: Lock & approval (by role only, no DB) ---
export function canLockUnlockDay(role: Role): boolean {
  return role === 'ASSISTANT_MANAGER' || role === 'MANAGER' || role === 'ADMIN';
}
/** Sprint 1: Lock Week = Admin only */
export function canLockWeek(role: Role): boolean {
  return role === 'ADMIN';
}
export function canUnlockWeek(role: Role): boolean {
  return role === 'ADMIN';
}
export function canApproveWeek(role: Role): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

/** Roles that can view full schedule grid (all rows) on /schedule/view */
export const SCHEDULE_VIEW_FULL_ROLES: Role[] = ['MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'];

export function canEditSchedule(role: Role): boolean {
  return SCHEDULE_EDIT_ROLES.includes(role);
}

export function canViewFullSchedule(role: Role): boolean {
  return SCHEDULE_VIEW_FULL_ROLES.includes(role);
}

/** Sprint 2B: MANAGER/ADMIN auto-apply; ASSISTANT_MANAGER must go through approval. */
export function canAutoApprove(role: Role): boolean {
  return role === 'MANAGER' || role === 'ADMIN';
}

export function requiresApproval(role: Role): boolean {
  return role === 'ASSISTANT_MANAGER';
}

/**
 * مصدر واحد للصلاحيات: أي المسارات والصلاحيات مُعلنة لأي دور.
 * غيّر هنا لتظهر أو تُخفى الصفحات حسب الدور.
 */
export const ROLE_ROUTES: Record<Role, string[]> = {
  EMPLOYEE: [
    '/dashboard',
    '/employee',
    '/schedule/view',
    '/tasks',
    '/me/target',
    '/leaves/requests',
    '/inventory/daily',
    '/inventory/zones',
    '/about',
    '/change-password',
  ],
  MANAGER: [
    '/',
    '/dashboard',
    '/executive',
    '/executive/monthly',
    '/executive/insights',
    '/executive/compare',
    '/executive/employees',
    '/approvals',
    '/schedule',
    '/schedule/view',
    '/schedule/edit',
    '/schedule/audit',
    '/schedule/audit-edits',
    '/tasks',
    '/tasks/monitor',
    '/tasks/setup',
    '/planner-export',
    '/sync/planner',
    '/leaves',
    '/boutique/leaves',
    '/boutique/tasks',
    '/inventory/daily',
    '/inventory/daily/history',
    '/inventory/zones',
    '/inventory/follow-up',
    '/admin/employees',
    '/admin/targets',
    '/admin/sales-edit-requests',
    '/sales/daily',
    '/sales/monthly-matrix',
    '/me/target',
    '/about',
    '/change-password',
  ],
  /** مساعد المدير: نفس صلاحيات الموظف + تعديل الجدول الأسبوعي + المصفوفة الشهرية */
  ASSISTANT_MANAGER: [
    '/dashboard',
    '/employee',
    '/schedule/view',
    '/schedule/edit',
    '/tasks',
    '/me/target',
    '/leaves/requests',
    '/inventory/daily',
    '/inventory/zones',
    '/sales/monthly-matrix',
    '/about',
    '/change-password',
  ],
  ADMIN: [
    '/',
    '/dashboard',
    '/executive',
    '/executive/monthly',
    '/executive/insights',
    '/executive/compare',
    '/executive/employees',
    '/approvals',
    '/schedule',
    '/schedule/view',
    '/schedule/edit',
    '/schedule/audit',
    '/schedule/audit-edits',
    '/tasks',
    '/tasks/monitor',
    '/tasks/setup',
    '/planner-export',
    '/sync/planner',
    '/leaves',
    '/boutique/leaves',
    '/boutique/tasks',
    '/inventory/daily',
    '/inventory/daily/history',
    '/inventory/zones',
    '/inventory/follow-up',
    '/admin/employees',
    '/admin/targets',
    '/admin/sales-edit-requests',
    '/admin/users',
    '/admin/coverage-rules',
    '/admin/import',
    '/admin/audit/login',
    '/admin/boutiques',
    '/admin/regions',
    '/admin/boutique-groups',
    '/admin/memberships',
    '/admin/system',
    '/sales/daily',
    '/sales/monthly-matrix',
    '/me/target',
    '/about',
    '/change-password',
  ],
};

export { getNavLinksForUser, getNavLinksForRole } from '@/lib/navConfig';

export function canAccessRoute(role: Role, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return false;
  if (allowed.includes(pathname)) return true;
  return allowed.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

