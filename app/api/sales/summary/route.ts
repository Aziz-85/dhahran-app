/**
 * GET /api/sales/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&boutiqueId= (optional, ADMIN only)
 * RBAC: EMPLOYEE = own totals only; ASSISTANT_MANAGER/MANAGER = full boutique; ADMIN = optional boutiqueId filter.
 * Response: netSalesTotal, grossSalesTotal, returnsTotal, exchangesTotal, guestCoverageNetSales, breakdownByEmployee.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSalesScope } from '@/lib/sales/ledgerRbac';
import { parseDateRiyadh, formatDateRiyadh } from '@/lib/sales/normalizeDateRiyadh';

const DEFAULT_DAYS = 31;

export async function GET(request: NextRequest) {
  const boutiqueIdParam = request.nextUrl.searchParams.get('boutiqueId')?.trim();
  const scopeResult = await getSalesScope({
    requestBoutiqueId: boutiqueIdParam || undefined,
  });
  if (scopeResult.res) return scopeResult.res;
  const scope = scopeResult.scope;

  const fromParam = request.nextUrl.searchParams.get('from')?.trim();
  const toParam = request.nextUrl.searchParams.get('to')?.trim();
  const from = parseDateRiyadh(fromParam || '');
  const to = parseDateRiyadh(toParam || '');
  let fromDate = from;
  let toDate = to;
  if (!fromParam || !toParam) {
    const end = toDate.getTime() >= fromDate.getTime() ? toDate : fromDate;
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - DEFAULT_DAYS);
    fromDate = start;
    toDate = end;
  }
  if (fromDate.getTime() > toDate.getTime()) {
    [fromDate, toDate] = [toDate, fromDate];
  }

  const whereBase: { boutiqueId?: string; employeeId?: string; txnDate: { gte: Date; lte: Date } } = {
    txnDate: { gte: fromDate, lte: toDate },
  };

  if (scope.employeeOnly) {
    if (!scope.empId) {
      return NextResponse.json({ error: 'Employee not linked' }, { status: 403 });
    }
    whereBase.employeeId = scope.empId;
  }

  if (scope.allowedBoutiqueIds.length > 0) {
    whereBase.boutiqueId = scope.effectiveBoutiqueId;
  }
  // ADMIN with no filter: no boutiqueId in where = all boutiques

  const txns = await prisma.salesTransaction.findMany({
    where: whereBase,
    select: {
      id: true,
      boutiqueId: true,
      employeeId: true,
      type: true,
      netAmount: true,
      grossAmount: true,
      isGuestCoverage: true,
      coverageSourceBoutiqueId: true,
      coverageShift: true,
      employee: { select: { name: true } },
    },
  });

  const netSalesTotal = txns.reduce((s, t) => s + t.netAmount, 0);
  const grossSalesTotal = txns.filter((t) => t.type === 'SALE').reduce((s, t) => s + t.grossAmount, 0);
  const returnsTotal = txns.filter((t) => t.type === 'RETURN').reduce((s, t) => s + t.netAmount, 0);
  const exchangesTotal = txns.filter((t) => t.type === 'EXCHANGE').reduce((s, t) => s + t.netAmount, 0);
  const guestCoverageNetSales = txns.filter((t) => t.isGuestCoverage).reduce((s, t) => s + t.netAmount, 0);

  const byEmp = new Map<
    string,
    {
      employeeId: string;
      employeeName: string;
      netSales: number;
      guestCoverageNetSales: number;
      guestCoverageSources: Array<{ sourceBoutiqueId: string; sourceBoutiqueName?: string; netSales: number; shiftBreakdown?: Record<string, number> }>;
    }
  >();

  for (const t of txns) {
    const key = t.employeeId;
    if (!byEmp.has(key)) {
      byEmp.set(key, {
        employeeId: key,
        employeeName: t.employee?.name ?? key,
        netSales: 0,
        guestCoverageNetSales: 0,
        guestCoverageSources: [],
      });
    }
    const rec = byEmp.get(key)!;
    rec.netSales += t.netAmount;
    if (t.isGuestCoverage) {
      rec.guestCoverageNetSales += t.netAmount;
      const srcId = t.coverageSourceBoutiqueId ?? 'unknown';
      let src = rec.guestCoverageSources.find((s) => s.sourceBoutiqueId === srcId);
      if (!src) {
        src = { sourceBoutiqueId: srcId, netSales: 0, shiftBreakdown: {} };
        rec.guestCoverageSources.push(src);
      }
      src.netSales += t.netAmount;
      const shift = t.coverageShift ?? 'unknown';
      if (src.shiftBreakdown) {
        src.shiftBreakdown[shift] = (src.shiftBreakdown[shift] ?? 0) + t.netAmount;
      }
    }
  }

  const boutiqueIds = Array.from(
    new Set(txns.map((t) => t.coverageSourceBoutiqueId).filter((id): id is string => Boolean(id)))
  );
  const boutiques =
    boutiqueIds.length > 0
      ? await prisma.boutique.findMany({
          where: { id: { in: boutiqueIds } },
          select: { id: true, name: true, code: true },
        })
      : [];
  const boutiqueMap = new Map(boutiques.map((b) => [b.id, b.name ?? b.code]));

  const empValues = Array.from(byEmp.values());
  for (const rec of empValues) {
    for (const src of rec.guestCoverageSources) {
      (src as { sourceBoutiqueName?: string }).sourceBoutiqueName = boutiqueMap.get(src.sourceBoutiqueId) ?? undefined;
    }
  }

  const breakdownByEmployee = empValues;

  return NextResponse.json({
    from: formatDateRiyadh(fromDate),
    to: formatDateRiyadh(toDate),
    netSalesTotal,
    grossSalesTotal,
    returnsTotal,
    exchangesTotal,
    guestCoverageNetSales,
    breakdownByEmployee,
  });
}
