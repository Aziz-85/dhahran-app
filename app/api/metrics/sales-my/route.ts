/**
 * GET /api/metrics/sales-my?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Canonical sales metrics for /sales/my. Uses resolveMetricsScope + getSalesMetrics.
 * Inclusive [from, to], Asia/Riyadh. Enforce from <= to (swap if reversed). toExclusive = to + 1 day.
 */

import { NextRequest, NextResponse } from 'next/server';
import { addDays } from '@/lib/time';
import { parseDateRiyadh, formatDateRiyadh } from '@/lib/sales/normalizeDateRiyadh';
import { toRiyadhDateOnly } from '@/lib/time';
import { resolveMetricsScope } from '@/lib/metrics/scope';
import { getSalesMetrics } from '@/lib/metrics/aggregator';
import { prisma } from '@/lib/db';

const DEFAULT_DAYS = 31;

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const scope = await resolveMetricsScope(request);
  if (!scope) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!scope.effectiveBoutiqueId) {
    return NextResponse.json({ error: 'No boutique scope for metrics' }, { status: 403 });
  }

  const fromParam = request.nextUrl.searchParams.get('from')?.trim();
  const toParam = request.nextUrl.searchParams.get('to')?.trim();
  let fromDate = parseDateRiyadh(fromParam || '');
  let toDate = parseDateRiyadh(toParam || '');
  if (!fromParam || !toParam) {
    const end = toDate.getTime() >= fromDate.getTime() ? toDate : new Date();
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - DEFAULT_DAYS);
    fromDate = toRiyadhDateOnly(start);
    toDate = toRiyadhDateOnly(end);
  } else {
    if (fromDate.getTime() > toDate.getTime()) [fromDate, toDate] = [toDate, fromDate];
    fromDate = toRiyadhDateOnly(fromDate);
    toDate = toRiyadhDateOnly(toDate);
  }

  const toExclusive = addDays(toDate, 1);

  const metrics = await getSalesMetrics({
    boutiqueId: scope.effectiveBoutiqueId,
    userId: scope.employeeOnly ? scope.userId : null,
    from: fromDate,
    toExclusive,
  });

  const breakdownByEmployee: Array<{
    employeeId: string;
    employeeName: string;
    netSales: number;
    guestCoverageNetSales: number;
  }> = [];
  if (scope.employeeOnly && scope.empId) {
    const u = await prisma.user.findUnique({
      where: { id: scope.userId },
      select: { employee: { select: { name: true } }, empId: true },
    });
    breakdownByEmployee.push({
      employeeId: scope.empId,
      employeeName: u?.employee?.name ?? u?.empId ?? scope.empId ?? '',
      netSales: metrics.netSalesTotal,
      guestCoverageNetSales: 0,
    });
  }

  return NextResponse.json({
    from: formatDateRiyadh(fromDate),
    to: formatDateRiyadh(toDate),
    netSalesTotal: metrics.netSalesTotal,
    grossSalesTotal: metrics.netSalesTotal,
    returnsTotal: 0,
    exchangesTotal: 0,
    guestCoverageNetSales: 0,
    entriesCount: metrics.entriesCount,
    byDateKey: metrics.byDateKey,
    breakdownByEmployee,
  });
}
