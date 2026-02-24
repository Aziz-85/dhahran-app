import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { canEditSchedule, canApproveWeek } from '@/lib/rbac/schedulePermissions';
import { SESSION_IDLE_MINUTES } from '@/lib/sessionConfig';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const boutiqueLabel =
    user.boutique != null
      ? `${user.boutique.name} (${user.boutique.code})`
      : user.boutiqueId
        ? String(user.boutiqueId)
        : undefined;

  return NextResponse.json({
    user: {
      id: user.id,
      empId: user.empId,
      role: user.role,
      boutiqueId: user.boutiqueId ?? undefined,
      boutiqueLabel,
      mustChangePassword: user.mustChangePassword,
      name: user.employee?.name,
      language: user.employee?.language ?? 'en',
      canEditSchedule: canEditSchedule(user),
      canApproveWeek: canApproveWeek(user),
    },
    idleMinutes: SESSION_IDLE_MINUTES,
    idleWarningMinutes: Math.max(1, SESSION_IDLE_MINUTES - 2),
  });
}
