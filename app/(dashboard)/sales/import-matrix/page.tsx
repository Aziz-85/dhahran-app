import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { ImportMatrixClient } from './ImportMatrixClient';

export default async function ImportMatrixPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const allowed = ['ADMIN', 'SUPER_ADMIN', 'MANAGER'];
  if (!allowed.includes(user.role)) redirect('/');

  return (
    <div className="min-h-screen bg-slate-50">
      <ImportMatrixClient />
    </div>
  );
}
