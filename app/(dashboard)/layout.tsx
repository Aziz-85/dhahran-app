import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
import { Sidebar } from '@/components/nav/Sidebar';
import { MobileTopBar } from '@/components/nav/MobileTopBar';
import { RouteGuard } from '@/components/RouteGuard';
import { IdleDetector } from '@/components/IdleDetector';
import { canEditSchedule, canApproveWeek } from '@/lib/rbac/schedulePermissions';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  if (!user.boutiqueId) {
    redirect('/login?error=no_boutique');
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <IdleDetector />
      <Sidebar
        role={user.role}
        name={user.employee?.name ?? undefined}
        canEditSchedule={canEditSchedule(user)}
        canApproveWeek={canApproveWeek(user)}
      />
      <div className="flex flex-1 min-w-0 flex-col">
        <MobileTopBar
          role={user.role}
          name={user.employee?.name ?? undefined}
          canEditSchedule={canEditSchedule(user)}
          canApproveWeek={canApproveWeek(user)}
        />
        <main className="flex-1 min-w-0">
          <RouteGuard role={user.role}>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}
