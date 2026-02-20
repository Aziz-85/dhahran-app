import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser, setSessionCookie } from '@/lib/auth';
import { canEditSchedule, canApproveWeek } from '@/lib/rbac/schedulePermissions';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  const cookieStore = await cookies();
  cookieStore.set(setSessionCookie(user.id));
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
  });
}
