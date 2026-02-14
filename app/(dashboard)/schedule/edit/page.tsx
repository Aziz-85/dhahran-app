import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { canEditSchedule } from '@/lib/permissions';
import { ScheduleEditClient } from './ScheduleEditClient';

export default async function ScheduleEditPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!canEditSchedule(user.role)) redirect('/schedule/view');
  return <ScheduleEditClient initialRole={user.role} />;
}
