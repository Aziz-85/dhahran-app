import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LeavesPageClient } from './LeavesPageClient';

export default async function LeavesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role === 'EMPLOYEE') redirect('/employee');

  return <LeavesPageClient />;
}
