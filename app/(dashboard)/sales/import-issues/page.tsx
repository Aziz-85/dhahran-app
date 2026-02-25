import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { SalesImportIssuesClient } from './SalesImportIssuesClient';

export default async function SalesImportIssuesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!['ASSISTANT_MANAGER', 'MANAGER', 'ADMIN'].includes(user.role)) redirect('/');

  const canResolve = user.role === 'MANAGER' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

  return (
    <div className="min-h-screen bg-slate-100 p-4">
      <SalesImportIssuesClient canResolve={canResolve} />
    </div>
  );
}
