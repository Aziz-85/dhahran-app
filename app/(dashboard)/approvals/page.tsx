import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { canAutoApprove } from '@/lib/permissions';
import { ApprovalsClient } from './ApprovalsClient';

export default async function ApprovalsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!canAutoApprove(user.role)) redirect('/');
  return <ApprovalsClient />;
}
