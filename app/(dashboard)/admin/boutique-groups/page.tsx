import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { AdminBoutiqueGroupsClient } from './AdminBoutiqueGroupsClient';

export default async function AdminBoutiqueGroupsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'ADMIN') redirect('/');

  return <AdminBoutiqueGroupsClient />;
}
