import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { BoutiqueLeavesClient } from './BoutiqueLeavesClient';

export default async function BoutiqueLeavesPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (user.role !== 'MANAGER' && user.role !== 'ADMIN') redirect('/');

  return <BoutiqueLeavesClient />;
}
