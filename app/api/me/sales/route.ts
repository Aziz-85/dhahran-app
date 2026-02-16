import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toRiyadhDateOnly, toRiyadhDateString, formatMonthKey, getRiyadhNow, getMonthRange, getDaysInMonth, normalizeMonthKey } from '@/lib/time';
import { canEditSalesForDate, canEditSalesForDateWithGrant } from '@/lib/sales-targets';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rawMonth = request.nextUrl.searchParams.get('month')?.trim();
  const monthKey = rawMonth ? normalizeMonthKey(rawMonth) : '';
  if (monthKey && /^\d{4}-\d{2}$/.test(monthKey)) {
    const { start, endExclusive } = getMonthRange(monthKey);
    const now = new Date();
    const [entries, grants] = await Promise.all([
      prisma.salesEntry.findMany({
        where: { userId: user.id, date: { gte: start, lt: endExclusive } },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, amount: true },
      }),
      prisma.salesEditGrant.findMany({
        where: {
          userId: user.id,
          date: { gte: start, lt: endExclusive },
          expiresAt: { gt: now },
        },
        select: { date: true },
      }),
    ]);
    const grantDateSet = new Set(grants.map((g) => toRiyadhDateString(g.date)));
    const withDateStr = entries.map((e) => {
      const dateStr = toRiyadhDateString(e.date);
      const canEdit =
        canEditSalesForDate(user.role, dateStr) || grantDateSet.has(dateStr);
      return { id: e.id, date: dateStr, amount: e.amount, canEdit };
    });
    const daysInMonth = getDaysInMonth(monthKey);
    const [y, m] = monthKey.split('-').map(Number);
    const canEditDates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (canEditSalesForDate(user.role, dateStr) || grantDateSet.has(dateStr)) {
        canEditDates.push(dateStr);
      }
    }
    return NextResponse.json({ mode: 'month', monthKey, entries: withDateStr, canEditDates });
  }

  const days = Math.min(31, Math.max(1, Number(request.nextUrl.searchParams.get('days')) || 7));
  const now = getRiyadhNow();
  const today = toRiyadhDateOnly(now);
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - (days - 1));

  const entries = await prisma.salesEntry.findMany({
    where: { userId: user.id, date: { gte: from, lte: today } },
    orderBy: { date: 'desc' },
    select: { id: true, date: true, amount: true },
  });
  const withDateStr = await Promise.all(
    entries.map(async (e) => {
      const dateStr = toRiyadhDateString(e.date);
      const canEdit = await canEditSalesForDateWithGrant(prisma, user, dateStr);
      return { id: e.id, date: dateStr, amount: e.amount, canEdit };
    })
  );
  return NextResponse.json({ entries: withDateStr });
}

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { date?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const dateStr = typeof body.date === 'string' ? body.date.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: 'date must be YYYY-MM-DD' }, { status: 400 });
  }
  const canEdit = await canEditSalesForDateWithGrant(prisma, user, dateStr);
  if (!canEdit) {
    return NextResponse.json(
      { error: 'You can only enter sales for today or yesterday, or with an approved edit grant' },
      { status: 403 }
    );
  }
  const amount = typeof body.amount === 'number' && Number.isFinite(body.amount)
    ? Math.round(body.amount)
    : Number(body.amount);
  if (amount < 0) {
    return NextResponse.json({ error: 'amount must be >= 0' }, { status: 400 });
  }

  const dateNorm = toRiyadhDateOnly(new Date(dateStr + 'T12:00:00.000Z'));
  const month = formatMonthKey(dateNorm);

  const entry = await prisma.salesEntry.upsert({
    where: {
      userId_date: { userId: user.id, date: dateNorm },
    },
    create: {
      date: dateNorm,
      month,
      userId: user.id,
      amount,
      createdById: user.id,
    },
    update: { amount, updatedAt: new Date() },
  });
  return NextResponse.json(entry);
}

/** DELETE: clear all sales entries for the current user in the given month. Query: month=YYYY-MM. */
export async function DELETE(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const month = request.nextUrl.searchParams.get('month')?.trim() ?? '';
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const result = await prisma.salesEntry.deleteMany({
    where: { userId: user.id, month },
  });
  return NextResponse.json({ ok: true, deletedCount: result.count });
}
