import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { plannerRows, plannerRowsToCSV } from '@/lib/services/planner';
import type { Role } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const fromStr = String(body.from ?? '');
  const toStr = String(body.to ?? '');

  if (!fromStr || !toStr) {
    return NextResponse.json({ error: 'from and to required (YYYY-MM-DD)' }, { status: 400 });
  }

  const from = new Date(fromStr + 'T00:00:00Z');
  const to = new Date(toStr + 'T00:00:00Z');
  if (from > to) {
    return NextResponse.json({ error: 'from must be before or equal to to' }, { status: 400 });
  }

  const rows = await plannerRows(from, to);
  const csv = plannerRowsToCSV(rows);
  const filename = `planner-export-${fromStr}-${toStr}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
