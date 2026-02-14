import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { approveWeek } from '@/lib/services/scheduleLock';
import { canApproveWeek } from '@/lib/permissions';
import { ensureTaskKeysForApprovedWeekWithTx } from '@/lib/sync/ensureTaskKeys';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole(['MANAGER', 'ADMIN']);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user || !canApproveWeek(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const weekStart = String(body.weekStart ?? '').trim();
  if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'weekStart (YYYY-MM-DD, Saturday) required' }, { status: 400 });
  }
  const d = new Date(weekStart + 'T00:00:00Z');
  if (d.getUTCDay() !== 6) {
    return NextResponse.json({ error: 'weekStart must be a Saturday' }, { status: 400 });
  }

  await approveWeek(weekStart, user.id);

  const weekEnd = new Date(d);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  const weekRange = `${weekStart} – ${weekEnd.toISOString().slice(0, 10)}`;

  let keyResult: { backfilled: number; totalInScope: number; remainingNull: number };
  try {
    keyResult = await prisma.$transaction(async (tx) => {
      return ensureTaskKeysForApprovedWeekWithTx(tx, weekStart);
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[Approve Week] taskKey backfill failed: ${msg}`);
    return NextResponse.json(
      { error: msg || 'Task key backfill failed' },
      { status: 500 }
    );
  }

  console.log(
    `[Approve Week] weekStart=${weekStart} period=${weekRange} totalInScope=${keyResult.totalInScope} backfilled=${keyResult.backfilled} remainingNull=${keyResult.remainingNull}`
  );

  await logAudit(
    user.id,
    'WEEK_APPROVED',
    'ScheduleWeekStatus',
    weekStart,
    null,
    JSON.stringify({ weekStart }),
    'Week approved',
    { module: 'SCHEDULE', weekStart }
  );

  return NextResponse.json({ ok: true, weekStart, status: 'APPROVED' });
}
