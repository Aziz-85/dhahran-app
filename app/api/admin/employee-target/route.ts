import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logSalesTargetAudit } from '@/lib/sales-target-audit';
import { getRiyadhNow } from '@/lib/time';

const ADMIN_ROLES = ['MANAGER', 'ADMIN'] as const;

/** After day 3 of month (Riyadh), only ADMIN can edit targets and must provide a reason. */
function isTargetLockedForNonAdmin(monthKey: string): { locked: boolean; dayOfMonth: number } {
  const now = getRiyadhNow();
  const dayOfMonth = now.getUTCDate();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const locked = currentMonth === monthKey && dayOfMonth > 3;
  return { locked, dayOfMonth };
}

export async function PATCH(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole([...ADMIN_ROLES]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { id?: string; amount?: number; reason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const amount =
    typeof body.amount === 'number' && Number.isFinite(body.amount)
      ? Math.round(body.amount)
      : Number(body.amount);
  if (amount < 0 || !Number.isFinite(amount)) {
    return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 });
  }

  const existing = await prisma.employeeMonthlyTarget.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { locked } = isTargetLockedForNonAdmin(existing.month);
  if (locked && user.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'After day 3 of the month only ADMIN can edit employee targets' },
      { status: 403 }
    );
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  if (locked && !reason) {
    return NextResponse.json(
      { error: 'Reason is required when editing targets after day 3' },
      { status: 400 }
    );
  }

  const updated = await prisma.employeeMonthlyTarget.update({
    where: { id },
    data: { amount, updatedAt: new Date() },
  });
  await logSalesTargetAudit(existing.month, 'OVERRIDE_EMPLOYEE', user.id, {
    employeeMonthlyTargetId: id,
    userId: existing.userId,
    oldAmount: existing.amount,
    newAmount: amount,
    ...(reason ? { reason } : {}),
  });
  return NextResponse.json(updated);
}
