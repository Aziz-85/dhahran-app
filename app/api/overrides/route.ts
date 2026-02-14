import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { createOrExecuteApproval } from '@/lib/services/approvals';
import { applyOverrideChange } from '@/lib/services/scheduleApply';
import { getWeekStart } from '@/lib/services/scheduleLock';
import { assertScheduleEditable, ScheduleLockedError } from '@/lib/guards/scheduleLockGuard';
import { requiresApproval } from '@/lib/permissions';
import { isAmShiftForbiddenOnDate } from '@/lib/services/shift';
import { API_ERROR_MESSAGES } from '@/lib/validationErrors';
import type { Role } from '@prisma/client';

const ALLOWED_SHIFTS = ['MORNING', 'EVENING', 'NONE', 'COVER_RASHID_AM', 'COVER_RASHID_PM'] as const;

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole(['MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const empId = String(body.empId ?? '');
  const dateStr = String(body.date ?? '');
  const overrideShift = String(body.overrideShift ?? 'NONE').toUpperCase();
  const reason = String(body.reason ?? '').trim();

  if (!empId || !dateStr) {
    return NextResponse.json({ error: API_ERROR_MESSAGES.EMPID_DATE_REQUIRED }, { status: 400 });
  }
  if (!reason) {
    return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
  }
  try {
    await assertScheduleEditable({ dates: [dateStr] });
  } catch (e) {
    if (e instanceof ScheduleLockedError) {
      const lockInfo = e.lockInfo;
      const message = lockInfo?.reason
        ? `${e.message}. Reason: ${lockInfo.reason}`
        : e.message;
      return NextResponse.json(
        {
          error: message,
          code: e.code,
          lock: lockInfo
            ? {
                scope: lockInfo.scopeType,
                date: lockInfo.scopeValue,
                reason: lockInfo.reason,
                lockedBy: lockInfo.lockedByUserId,
                lockedAt: lockInfo.lockedAt.toISOString(),
              }
            : undefined,
        },
        { status: 423 }
      );
    }
    throw e;
  }
  if (!ALLOWED_SHIFTS.includes(overrideShift as (typeof ALLOWED_SHIFTS)[number])) {
    return NextResponse.json({ error: API_ERROR_MESSAGES.OVERRIDE_SHIFT_INVALID }, { status: 400 });
  }

  const date = new Date(dateStr + 'T00:00:00Z');
  if (isAmShiftForbiddenOnDate(date, overrideShift as 'MORNING' | 'COVER_RASHID_AM')) {
    return NextResponse.json({ error: API_ERROR_MESSAGES.FRIDAY_PM_ONLY }, { status: 400 });
  }

  const payload = { empId, date: dateStr, overrideShift, reason };
  const weekStart = getWeekStart(date);

  if (requiresApproval(user.role)) {
    const result = await createOrExecuteApproval({
      user,
      module: 'SCHEDULE',
      actionType: 'OVERRIDE_CREATE',
      payload,
      effectiveDate: dateStr,
      weekStart,
      perform: () => applyOverrideChange(payload, user.id),
    });
    if (result.status === 'PENDING_APPROVAL') {
      return NextResponse.json(
        { code: 'PENDING_APPROVAL', requestId: result.requestId },
        { status: 202 }
      );
    }
    return NextResponse.json(result.result);
  }

  const created = await applyOverrideChange(payload, user.id);
  return NextResponse.json(created);
}
