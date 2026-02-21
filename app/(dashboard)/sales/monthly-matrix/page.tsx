import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { MonthlySalesMatrixClient } from './MonthlySalesMatrixClient';

export default async function MonthlyMatrixPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const allowed: string[] = ['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER'];
  if (!allowed.includes(user.role)) redirect('/');

  return (
    <div className="min-h-screen bg-slate-50">
      <MonthlySalesMatrixClient />
    </div>
  );
}
