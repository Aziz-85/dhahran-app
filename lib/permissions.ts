import type { Role } from '@prisma/client';
import { canEditSchedule as canEditScheduleRbac, canApproveWeek as canApproveWeekRbac } from '@/lib/rbac/schedulePermissions';
import type { User } from '@prisma/client';

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
    '/inventory/daily',
    '/inventory/zones',
    '/change-password',
  ],
  MANAGER: [
    '/',
    '/dashboard',
    '/executive',
    '/executive/monthly',
    '/executive/insights',
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
    '/inventory/daily',
    '/inventory/daily/history',
    '/inventory/zones',
    '/inventory/follow-up',
    '/admin/employees',
    '/admin/targets',
    '/admin/sales-edit-requests',
    '/me/target',
    '/change-password',
  ],
  /** مساعد المدير: نفس صلاحيات الموظف + تعديل الجدول الأسبوعي فقط */
  ASSISTANT_MANAGER: [
    '/dashboard',
    '/employee',
    '/schedule/view',
    '/schedule/edit',
    '/tasks',
    '/me/target',
    '/inventory/daily',
    '/inventory/zones',
    '/change-password',
  ],
  ADMIN: [
    '/',
    '/dashboard',
    '/executive',
    '/executive/monthly',
    '/executive/insights',
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
    '/me/target',
    '/change-password',
  ],
};

/** روابط الشريط الجانبي حسب الدور (للعرض في الواجهة) */
export const NAV_ITEMS: Array<{ href: string; key: string; roles: Role[] }> = [
  { href: '/', key: 'nav.home', roles: ['MANAGER', 'ADMIN'] },
  { href: '/dashboard', key: 'nav.dashboard', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/executive', key: 'nav.executive', roles: ['ADMIN', 'MANAGER'] },
  { href: '/executive/monthly', key: 'nav.executiveMonthly', roles: ['ADMIN', 'MANAGER'] },
  { href: '/executive/insights', key: 'nav.executiveInsights', roles: ['ADMIN', 'MANAGER'] },
  { href: '/employee', key: 'nav.employeeHome', roles: ['EMPLOYEE', 'ASSISTANT_MANAGER'] },
  { href: '/schedule/view', key: 'nav.schedule', roles: ['EMPLOYEE'] },
  { href: '/schedule/view', key: 'nav.scheduleView', roles: ['MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/schedule/edit', key: 'nav.scheduleEditor', roles: ['MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/schedule/audit', key: 'nav.scheduleAudit', roles: ['MANAGER', 'ADMIN'] },
  { href: '/schedule/audit-edits', key: 'schedule.auditEditsTitle', roles: ['MANAGER', 'ADMIN'] },
  { href: '/approvals', key: 'nav.approvals', roles: ['MANAGER', 'ADMIN'] },
  { href: '/tasks', key: 'nav.tasks', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/tasks/monitor', key: 'tasks.monitorNav', roles: ['MANAGER', 'ADMIN'] },
  { href: '/tasks/setup', key: 'tasks.setup', roles: ['MANAGER', 'ADMIN'] },
  { href: '/sync/planner', key: 'nav.export', roles: ['MANAGER', 'ADMIN'] },
  { href: '/leaves', key: 'nav.leaves', roles: ['MANAGER', 'ADMIN'] },
  { href: '/inventory/daily', key: 'nav.inventoryDaily', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/inventory/zones', key: 'nav.inventoryZones', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/inventory/follow-up', key: 'nav.inventoryFollowUp', roles: ['MANAGER', 'ADMIN'] },
  { href: '/change-password', key: 'nav.changePassword', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/admin/employees', key: 'nav.admin.employees', roles: ['ADMIN', 'MANAGER'] },
  { href: '/admin/targets', key: 'nav.targets', roles: ['ADMIN', 'MANAGER'] },
  { href: '/admin/sales-edit-requests', key: 'nav.salesEditRequests', roles: ['ADMIN', 'MANAGER'] },
  { href: '/me/target', key: 'nav.myTarget', roles: ['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] },
  { href: '/admin/users', key: 'nav.admin.users', roles: ['ADMIN'] },
  { href: '/admin/coverage-rules', key: 'nav.admin.coverageRules', roles: ['ADMIN'] },
  { href: '/admin/import', key: 'nav.admin.import', roles: ['ADMIN'] },
  { href: '/admin/audit/login', key: 'nav.admin.loginAudit', roles: ['ADMIN'] },
];

export function canAccessRoute(role: Role, pathname: string): boolean {
  const allowed = ROLE_ROUTES[role];
  if (!allowed) return false;
  if (allowed.includes(pathname)) return true;
  return allowed.some((route) => pathname === route || pathname.startsWith(route + '/'));
}

export function getNavLinksForRole(role: Role): typeof NAV_ITEMS {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}

/** Filter nav by schedule permissions: Schedule Editor requires canEditSchedule, Approvals requires canApproveWeek. */
export function getNavLinksForUser(user: Pick<User, 'role' | 'canEditSchedule'> & { canApproveWeek?: boolean }): typeof NAV_ITEMS {
  const canApprove = user.canApproveWeek ?? canApproveWeekRbac(user);
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(user.role)) return false;
    if (item.href === '/schedule/edit') return canEditScheduleRbac(user);
    if (item.href === '/approvals') return canApprove;
    return true;
  });
}
