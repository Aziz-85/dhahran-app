import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { logSalesTargetAudit } from '@/lib/sales-target-audit';

const ADMIN_ROLES = ['MANAGER', 'ADMIN'] as const;

export async function PATCH(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole([...ADMIN_ROLES]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { id?: string; amount?: number };
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

  const updated = await prisma.employeeMonthlyTarget.update({
    where: { id },
    data: { amount, updatedAt: new Date() },
  });
  await logSalesTargetAudit(existing.month, 'OVERRIDE_EMPLOYEE', user.id, {
    employeeMonthlyTargetId: id,
    userId: existing.userId,
    oldAmount: existing.amount,
    newAmount: amount,
  });
  return NextResponse.json(updated);
}
