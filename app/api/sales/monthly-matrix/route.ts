/**
 * GET /api/sales/monthly-matrix?scopeId=&month=YYYY-MM&includePreviousMonth=true|false
 * Single source of truth: BoutiqueSalesSummary + BoutiqueSalesLine (ledger).
 * RBAC: ADMIN, MANAGER, ASSISTANT_MANAGER. Scope = operational boutique (session).
 * UTC month boundaries; employees = active in scope ∪ any employeeId in sales (no missing employees).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { requireOperationalBoutique } from '@/lib/scope/requireOperationalBoutique';
import { getMonthRange, normalizeMonthKey } from '@/lib/time';

export const dynamic = 'force-dynamic';

const MONTH_REGEX = /^\d{4}-\d{2}$/;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

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

  const scopeId = scope.boutiqueId;
  const monthParam = request.nextUrl.searchParams.get('month')?.trim() ?? '';
  const monthKey = normalizeMonthKey(monthParam);
  if (!MONTH_REGEX.test(monthKey)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 });
  }
  const includePreviousMonth =
    request.nextUrl.searchParams.get('includePreviousMonth') === 'true';

  let startUTC: Date;
  let endExclusiveUTC: Date;
  if (includePreviousMonth) {
    const [y, m] = monthKey.split('-').map(Number);
    const prevMonth = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
    startUTC = getMonthRange(prevMonth).start;
    endExclusiveUTC = getMonthRange(monthKey).endExclusive;
  } else {
    const range = getMonthRange(monthKey);
    startUTC = range.start;
    endExclusiveUTC = range.endExclusive;
  }

  const days: string[] = [];
  for (let d = new Date(startUTC.getTime()); d < endExclusiveUTC; d = addDays(d, 1)) {
    days.push(toDateKey(d));
  }

  const [summaries, activeEmployees, allEmployeesByEmpId] = await Promise.all([
    prisma.boutiqueSalesSummary.findMany({
      where: {
        boutiqueId: scopeId,
        date: { gte: startUTC, lt: endExclusiveUTC },
      },
      include: {
        lines: { select: { employeeId: true, amountSar: true } },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.employee.findMany({
      where: { boutiqueId: scopeId, active: true, isSystemOnly: false },
      select: { empId: true, name: true },
      orderBy: { empId: 'asc' },
    }),
    prisma.employee.findMany({
      select: { empId: true, name: true },
    }).then((list) => new Map(list.map((e) => [e.empId, e.name]))),
  ]);

  const employeeIdsFromSales = new Set<string>();
  for (const s of summaries) {
    for (const line of s.lines) {
      employeeIdsFromSales.add(line.employeeId);
    }
  }

  const activeSet = new Set(activeEmployees.map((e) => e.empId));
  const employees: Array<{
    employeeId: string;
    empId: string;
    name: string;
    active: boolean;
    source: 'active_scope' | 'sales_records';
  }> = [];
  for (const e of activeEmployees) {
    employees.push({
      employeeId: e.empId,
      empId: e.empId,
      name: e.name ?? '',
      active: true,
      source: 'active_scope',
    });
  }
  for (const empId of Array.from(employeeIdsFromSales)) {
    if (activeSet.has(empId)) continue;
    employees.push({
      employeeId: empId,
      empId,
      name: allEmployeesByEmpId.get(empId) ?? '',
      active: false,
      source: 'sales_records',
    });
  }

  const matrix: Record<string, Record<string, number | null>> = {};
  for (const day of days) {
    matrix[day] = {};
    for (const e of employees) {
      matrix[day][e.employeeId] = null;
    }
  }

  for (const s of summaries) {
    const dateStr = s.date instanceof Date ? toDateKey(s.date) : String(s.date).slice(0, 10);
    if (!matrix[dateStr]) continue;
    for (const line of s.lines) {
      if (matrix[dateStr][line.employeeId] === undefined) {
        matrix[dateStr][line.employeeId] = null;
      }
      matrix[dateStr][line.employeeId] = line.amountSar;
    }
  }

  const totalsByEmployee: Array<{ employeeId: string; totalSar: number }> = [];
  let grandTotalSar = 0;
  for (const e of employees) {
    let total = 0;
    for (const day of days) {
      const v = matrix[day]?.[e.employeeId];
      if (typeof v === 'number') total += v;
    }
    totalsByEmployee.push({ employeeId: e.employeeId, totalSar: total });
    grandTotalSar += total;
  }

  const totalsByDay: Array<{ date: string; totalSar: number }> = [];
  for (const day of days) {
    let total = 0;
    const row = matrix[day];
    if (row) {
      for (const empId of Object.keys(row)) {
        const v = row[empId];
        if (typeof v === 'number') total += v;
      }
    }
    totalsByDay.push({ date: day, totalSar: total });
  }

  let salesCount = 0;
  for (const s of summaries) {
    salesCount += s.lines.length;
  }

  return NextResponse.json({
    scopeId,
    month: monthKey,
    includePreviousMonth,
    range: {
      startUTC: startUTC.toISOString(),
      endExclusiveUTC: endExclusiveUTC.toISOString(),
    },
    employees,
    days,
    matrix,
    totalsByEmployee,
    totalsByDay,
    grandTotalSar,
    diagnostics: {
      salesCount,
      employeeCountActive: activeEmployees.length,
      employeeCountFromSales: employeeIdsFromSales.size,
      employeeUnionCount: employees.length,
    },
  });
}
