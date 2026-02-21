/**
 * GET /api/sales/monthly-matrix?month=YYYY-MM
 * Returns employee × day matrix of sales for the operational boutique.
 * RBAC: ADMIN, MANAGER, ASSISTANT_MANAGER. Data from SalesEntry only; month in Asia/Riyadh.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireOperationalBoutique } from '@/lib/scope/requireOperationalBoutique';
import { getDaysInMonth, normalizeMonthKey, toRiyadhDateString } from '@/lib/time';

const MONTH_REGEX = /^\d{4}-\d{2}$/;

export async function GET(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole(['ADMIN', 'MANAGER', 'ASSISTANT_MANAGER']);
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scope = await requireOperationalBoutique();
  if (!scope.ok) return scope.res;

  const monthParam = request.nextUrl.searchParams.get('month')?.trim() ?? '';
  const monthKey = normalizeMonthKey(monthParam);
  if (!MONTH_REGEX.test(monthKey)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }

  const boutiqueId = scope.boutiqueId;
  const daysInMonth = getDaysInMonth(monthKey);

  const [boutique, employees, salesEntries] = await Promise.all([
    prisma.boutique.findUnique({
      where: { id: boutiqueId },
      select: { id: true, code: true, name: true },
    }),
    prisma.employee.findMany({
      where: { boutiqueId, active: true, isSystemOnly: false },
      select: { empId: true, name: true, position: true },
      orderBy: [{ empId: 'asc' }, { name: 'asc' }],
    }),
    prisma.salesEntry.findMany({
      where: { boutiqueId, month: monthKey },
      select: { userId: true, date: true, amount: true },
    }),
  ]);

  const userIds = Array.from(new Set(salesEntries.map((e) => e.userId)));
  const userIdToEmpIdMap =
    userIds.length > 0
      ? new Map(
          (await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, empId: true },
          })).map((u) => [u.id, u.empId])
        )
      : new Map<string, string>();

  const empIdToIndex = new Map(employees.map((e, i) => [e.empId, i]));
  const matrix: Record<string, number[]> = {};
  const rowTotals: Record<string, number> = {};
  for (const e of employees) {
    matrix[e.empId] = Array.from({ length: daysInMonth }, () => 0);
    rowTotals[e.empId] = 0;
  }

  const colTotals = Array.from({ length: daysInMonth }, () => 0);

  for (const entry of salesEntries) {
    const empId = userIdToEmpIdMap.get(entry.userId);
    if (empId == null || !empIdToIndex.has(empId)) continue;
    const dateStr = toRiyadhDateString(entry.date instanceof Date ? entry.date : new Date(entry.date));
    const dayOfMonth = Number(dateStr.slice(8, 10));
    if (!Number.isFinite(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > daysInMonth) continue;
    const dayIndex = dayOfMonth - 1;
    const amount = entry.amount ?? 0;
    matrix[empId][dayIndex] += amount;
    rowTotals[empId] = (rowTotals[empId] ?? 0) + amount;
    colTotals[dayIndex] = (colTotals[dayIndex] ?? 0) + amount;
  }

  const grandTotal = colTotals.reduce((a, b) => a + b, 0);

  return NextResponse.json({
    monthKey,
    boutique: boutique
      ? { id: boutique.id, code: boutique.code ?? '', name: boutique.name }
      : { id: boutiqueId, code: '', name: '' },
    daysInMonth,
    employees: employees.map((e) => ({
      id: e.empId,
      empId: e.empId,
      name: e.name,
      role: e.position ?? '',
    })),
    matrix,
    rowTotals,
    colTotals,
    grandTotal,
  });
}
