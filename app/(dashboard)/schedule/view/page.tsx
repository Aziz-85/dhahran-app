import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { canViewFullSchedule } from '@/lib/permissions';
import { getRamadanRange } from '@/lib/time/ramadan';
import { ScheduleViewClient } from './ScheduleViewClient';

export default async function ScheduleViewPage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  const fullGrid = canViewFullSchedule(user.role);
  const ramadanRange = getRamadanRange();
  const canAddGuestCoverage = ['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER'].includes(user.role);
  const canSearchAllEmployeesForGuest = user.role === 'ADMIN';
  return (
    <ScheduleViewClient
      fullGrid={fullGrid}
      ramadanRange={ramadanRange}
      canAddGuestCoverage={canAddGuestCoverage}
      canSearchAllEmployeesForGuest={canSearchAllEmployeesForGuest}
    />
  );
}
