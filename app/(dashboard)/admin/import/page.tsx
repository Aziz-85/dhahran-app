import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';

export default async function AdminImportPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  return (
    <div className="p-4 md:p-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Import (stub)</h1>
        <p className="mt-2 text-base text-slate-600">
          Import not implemented in v1. Route exists for future use.
        </p>
      </div>
    </div>
  );
}
