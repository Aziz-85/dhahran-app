import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ExecutiveDashboardClient } from './ExecutiveDashboardClient';

export default async function ExecutivePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') redirect('/dashboard');

  return (
    <div className="min-h-screen bg-[#F8F4E8]">
      <ExecutiveDashboardClient />
    </div>
  );
}
