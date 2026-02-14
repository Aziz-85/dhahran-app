import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { canEditSchedule } from '@/lib/rbac/schedulePermissions';
import { getRamadanRange } from '@/lib/time/ramadan';
import { ScheduleEditClient } from './ScheduleEditClient';

export default async function ScheduleEditPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  if (!canEditSchedule(user)) redirect('/schedule/view');
  const ramadanRange = getRamadanRange();
  return <ScheduleEditClient initialRole={user.role} ramadanRange={ramadanRange} />;
}
