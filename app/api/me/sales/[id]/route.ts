import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toRiyadhDateString } from '@/lib/time';
import { canEditSalesForDate } from '@/lib/sales-targets';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const entry = await prisma.salesEntry.findFirst({
    where: { id, userId: user.id },
  });
  if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const dateStr = toRiyadhDateString(entry.date);
  if (!canEditSalesForDate(user.role, dateStr)) {
    return NextResponse.json({ error: 'You can only delete sales for today or yesterday' }, { status: 403 });
  }

  await prisma.salesEntry.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
