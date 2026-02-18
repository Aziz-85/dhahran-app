import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AdminEmployeesClient } from './AdminEmployeesClient';

export default async function AdminEmployeesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  return <AdminEmployeesClient />;
}
