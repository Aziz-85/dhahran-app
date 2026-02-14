import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getWeeklyFollowUp } from '@/lib/services/inventoryFollowUp';
import type { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const weekStart = request.nextUrl.searchParams.get('weekStart');
  if (!weekStart) {
    return NextResponse.json({ error: 'weekStart required (YYYY-MM-DD, Saturday)' }, { status: 400 });
  }
  const d = new Date(weekStart + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) {
    return NextResponse.json({ error: 'Invalid weekStart' }, { status: 400 });
  }

  const result = await getWeeklyFollowUp(weekStart);
  return NextResponse.json(result);
}
