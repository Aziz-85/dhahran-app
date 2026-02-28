/**
 * GET /api/metrics/sales-my?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Canonical sales metrics for /sales/my. Uses resolveMetricsScope + getSalesMetrics.
 * Accept ONLY ISO dates YYYY-MM-DD. Inclusive [from, to]; toExclusive = addDays(to, 1).
 */

import { NextRequest, NextResponse } from 'next/server';
import { addDays, toRiyadhDateOnly } from '@/lib/time';
import { parseIsoDateOrThrow, formatIsoDate } from '@/lib/time/parse';
import { parseDateRiyadh } from '@/lib/sales/normalizeDateRiyadh';
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
  let fromDate: Date;
  let toDate: Date;

  if (fromParam && toParam) {
    try {
      fromDate = parseIsoDateOrThrow(fromParam);
      toDate = parseIsoDateOrThrow(toParam);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid date';
      return NextResponse.json({ error: `from and to must be YYYY-MM-DD. ${message}` }, { status: 400 });
    }
    if (fromDate.getTime() > toDate.getTime()) [fromDate, toDate] = [toDate, fromDate];
    fromDate = toRiyadhDateOnly(fromDate);
    toDate = toRiyadhDateOnly(toDate);
  } else {
    const end = toParam ? parseDateRiyadh(toParam) : new Date();
    const start = fromParam ? parseDateRiyadh(fromParam) : new Date(end);
    if (start.getTime() > end.getTime()) {
      fromDate = toRiyadhDateOnly(end);
      toDate = toRiyadhDateOnly(start);
    } else {
      if (!fromParam) {
        const defaultStart = new Date(end);
        defaultStart.setUTCDate(defaultStart.getUTCDate() - DEFAULT_DAYS);
        fromDate = toRiyadhDateOnly(defaultStart);
      } else {
        fromDate = toRiyadhDateOnly(start);
      }
      toDate = toRiyadhDateOnly(end);
    }
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
    from: formatIsoDate(fromDate),
    to: formatIsoDate(toDate),
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
