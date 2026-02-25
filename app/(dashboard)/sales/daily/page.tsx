import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SalesDailyClient } from './SalesDailyClient';

export default async function SalesDailyPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN' && user.role !== 'MANAGER') redirect('/');

  return (
    <div className="min-h-screen bg-slate-100">
      <SalesDailyClient />
    </div>
  );
}

