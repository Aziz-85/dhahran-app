import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canEditSchedule, canApproveWeek } from '@/lib/rbac/schedulePermissions';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      empId: user.empId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      name: user.employee?.name,
      language: user.employee?.language ?? 'en',
      canEditSchedule: canEditSchedule(user),
      canApproveWeek: canApproveWeek(user),
    },
  });
}
