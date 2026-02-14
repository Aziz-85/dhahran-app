import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { Sidebar } from '@/components/nav/Sidebar';
import { MobileTopBar } from '@/components/nav/MobileTopBar';
import { RouteGuard } from '@/components/RouteGuard';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={user.role} name={user.employee?.name ?? undefined} />
      <div className="flex flex-1 min-w-0 flex-col">
        <MobileTopBar role={user.role} name={user.employee?.name ?? undefined} />
        <main className="flex-1 min-w-0">
          <RouteGuard role={user.role}>{children}</RouteGuard>
        </main>
      </div>
    </div>
  );
}
