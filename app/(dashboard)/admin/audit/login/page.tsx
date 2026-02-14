import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { LoginAuditClient } from './LoginAuditClient';

export default async function AdminLoginAuditPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  return <LoginAuditClient />;
}
