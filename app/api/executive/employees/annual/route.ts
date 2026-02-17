/**
 * GET /api/executive/employees/annual?year=YYYY&global=true — Annual totals. ADMIN + MANAGER only.
 * global=true: ADMIN only, all boutiques + audit. MANAGER: always scope. SAR integer only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveExecutiveBoutiqueIds } from '@/lib/executive/scope';
import type { Role } from '@prisma/client';

export type EmployeeAnnualRow = {
  empId: string;
  name: string;
  annualTotal: number;
  byBoutique: { boutiqueId: string; boutiqueCode: string; boutiqueName: string; total: number }[];
  monthlySeries: number[];
  consistencyScore: number;
  topMonths: { month: string; amount: number }[];
  bottomMonths: { month: string; amount: number }[];
  /** Achievement % when EmployeeMonthlyTarget exists for the year; null otherwise (show "—"). */
  achievementPct: number | null;
};

function variance(arr: number[]): number {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const sq = arr.map((x) => (x - mean) ** 2);
  return sq.reduce((a, b) => a + b, 0) / arr.length;
}

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = user.role as Role;
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const globalParam = request.nextUrl.searchParams.get('global');
  const { boutiqueIds } = await resolveExecutiveBoutiqueIds(user.id, role, globalParam, 'EXECUTIVE_EMPLOYEES');
  if (boutiqueIds.length === 0) {
    return NextResponse.json({ error: 'No boutiques in scope' }, { status: 403 });
  }

  const yearParam = request.nextUrl.searchParams.get('year');
  const year = yearParam && /^\d{4}$/.test(yearParam) ? yearParam : String(new Date().getFullYear());
  const start = new Date(`${year}-01-01T00:00:00Z`);
  const end = new Date(`${year}-12-31T23:59:59.999Z`);

  const lines = await prisma.boutiqueSalesLine.findMany({
    where: {
      summary: {
        boutiqueId: { in: boutiqueIds },
        date: { gte: start, lte: end },
      },
    },
    select: {
      employeeId: true,
      amountSar: true,
      summary: { select: { boutiqueId: true, date: true, boutique: { select: { code: true, name: true } } } },
    },
  });

  const empIds = Array.from(new Set(lines.map((l) => l.employeeId)));
  const [employees, users] = await Promise.all([
    prisma.employee.findMany({
      where: { empId: { in: empIds } },
      select: { empId: true, name: true },
    }),
    prisma.user.findMany({
      where: { empId: { in: empIds } },
      select: { id: true, empId: true },
    }),
  ]);
  const empName = new Map(employees.map((e) => [e.empId, e.name ?? e.empId]));
  const empIdToUserId = new Map(users.map((u) => [u.empId, u.id]));
  const userIds = Array.from(empIdToUserId.values());
  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
  const targets = await prisma.employeeMonthlyTarget.findMany({
    where: { userId: { in: userIds }, month: { in: monthKeys } },
    select: { userId: true, month: true, amount: true },
  });
  const targetByUserId = new Map<string, number>();
  for (const t of targets) {
    targetByUserId.set(t.userId, (targetByUserId.get(t.userId) ?? 0) + t.amount);
  }

  const byEmp = new Map<string, { total: number; byBoutique: Map<string, { code: string; name: string; total: number }>; byMonth: Map<string, number> }>();
  for (const l of lines) {
    const s = l.summary;
    if (!s) continue;
    let rec = byEmp.get(l.employeeId);
    if (!rec) {
      rec = { total: 0, byBoutique: new Map(), byMonth: new Map() };
      byEmp.set(l.employeeId, rec);
    }
    rec.total += l.amountSar;
    const bid = s.boutiqueId;
    const monthKey = (s.date as Date).toISOString().slice(0, 7);
    if (bid) {
      const bout = (s as { boutique?: { code: string; name: string } }).boutique;
      let b = rec.byBoutique.get(bid);
      if (!b) {
        b = { code: bout?.code ?? bid, name: bout?.name ?? bid, total: 0 };
        rec.byBoutique.set(bid, b);
      }
      b.total += l.amountSar;
    }
    const prev = rec.byMonth.get(monthKey) ?? 0;
    rec.byMonth.set(monthKey, prev + l.amountSar);
  }

  const result: EmployeeAnnualRow[] = [];
  for (const empId of empIds) {
    const rec = byEmp.get(empId);
    if (!rec) continue;
    const monthlySeries = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return rec.byMonth.get(`${year}-${m}`) ?? 0;
    });
    const nonZero = monthlySeries.filter((x) => x > 0);
    const consistencyScore = nonZero.length <= 1 ? 100 : Math.max(0, 100 - Math.round(Math.sqrt(variance(monthlySeries))));
    const monthAmounts = monthlySeries.map((amount, i) => ({ month: `${year}-${String(i + 1).padStart(2, '0')}`, amount }));
    const sorted = [...monthAmounts].sort((a, b) => b.amount - a.amount);
    const topMonths = sorted.slice(0, 3);
    const bottomMonths = sorted.filter((m) => m.amount > 0).slice(-3).reverse();

    const byBoutique = Array.from(rec.byBoutique.entries()).map(([boutiqueId, v]) => ({
      boutiqueId,
      boutiqueCode: v.code,
      boutiqueName: v.name,
      total: v.total,
    })).filter((x) => x.total > 0);

    const userId = empIdToUserId.get(empId);
    const annualTarget = userId != null ? targetByUserId.get(userId) ?? 0 : 0;
    const achievementPct = annualTarget > 0 ? Math.round((rec.total / annualTarget) * 100) : null;

    result.push({
      empId,
      name: empName.get(empId) ?? empId,
      annualTotal: rec.total,
      byBoutique,
      monthlySeries,
      consistencyScore,
      topMonths,
      bottomMonths,
      achievementPct,
    });
  }

  result.sort((a, b) => b.annualTotal - a.annualTotal);

  return NextResponse.json({ year, employees: result });
}
