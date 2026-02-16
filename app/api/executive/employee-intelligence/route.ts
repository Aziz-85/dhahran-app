/**
 * GET /api/executive/employee-intelligence?weekStart=YYYY-MM-DD
 * Returns per-employee revenue intelligence: MTD, target, achievement %, 3-week trend,
 * consistency, ERS score + label + reasons. Sorted by ERS (best first). ADMIN + MANAGER only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getRiyadhNow } from '@/lib/time';
import { getWeekStart } from '@/lib/services/scheduleLock';
import { prisma } from '@/lib/db';
import {
  getLastNWeeksRanges,
  getRevenueTrendDirection,
  weeklyRevenueConsistencyScore,
  computeEmployeeRevenueScore,
  type ERSLevel,
} from '@/lib/executive/metrics';
import type { Role } from '@prisma/client';

export type EmployeeIntelligenceRow = {
  userId: string;
  name: string;
  revenueWTD: number;
  revenueMTD: number;
  employeeMonthlyTarget: number;
  achievementPercent: number;
  trend: 'uptrend' | 'flat' | 'downtrend';
  consistency: number;
  ersScore: number;
  ersLabel: ERSLevel;
  reasons: string[];
};

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = user.role as Role;
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const now = getRiyadhNow();
  const defaultWeekStart = getWeekStart(now);
  const weekStartParam = request.nextUrl.searchParams.get('weekStart');
  const weekStart =
    weekStartParam && /^\d{4}-\d{2}-\d{2}$/.test(weekStartParam)
      ? weekStartParam
      : defaultWeekStart;

  const monthKey = weekStart.slice(0, 7);
  const ranges = getLastNWeeksRanges(3, new Date(weekStart + 'T12:00:00Z'));
  const weekEnd = ranges[0].weekEnd;
  const weekStartDate = new Date(weekStart + 'T00:00:00Z');
  const weekEndDate = new Date(weekEnd + 'T23:59:59.999Z');

  const [targets, mtdByUser, wtdByUser, week1ByUser, week2ByUser, week3ByUser] = await Promise.all([
    prisma.employeeMonthlyTarget.findMany({
      where: { month: monthKey },
      include: {
        user: {
          select: {
            id: true,
            employee: { select: { name: true } },
            empId: true,
          },
        },
      },
    }),
    prisma.salesEntry.groupBy({
      by: ['userId'],
      where: {
        month: monthKey,
        date: { lte: weekEndDate },
      },
      _sum: { amount: true },
    }),
    prisma.salesEntry.groupBy({
      by: ['userId'],
      where: {
        date: { gte: weekStartDate, lte: weekEndDate },
      },
      _sum: { amount: true },
    }),
    prisma.salesEntry.groupBy({
      by: ['userId'],
      where: {
        date: {
          gte: new Date(ranges[0].weekStart + 'T00:00:00Z'),
          lte: new Date(ranges[0].weekEnd + 'T23:59:59.999Z'),
        },
      },
      _sum: { amount: true },
    }),
    prisma.salesEntry.groupBy({
      by: ['userId'],
      where: {
        date: {
          gte: new Date(ranges[1].weekStart + 'T00:00:00Z'),
          lte: new Date(ranges[1].weekEnd + 'T23:59:59.999Z'),
        },
      },
      _sum: { amount: true },
    }),
    prisma.salesEntry.groupBy({
      by: ['userId'],
      where: {
        date: {
          gte: new Date(ranges[2].weekStart + 'T00:00:00Z'),
          lte: new Date(ranges[2].weekEnd + 'T23:59:59.999Z'),
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const mtdMap = new Map(mtdByUser.map((r) => [r.userId, r._sum.amount ?? 0]));
  const wtdMap = new Map(wtdByUser.map((r) => [r.userId, r._sum.amount ?? 0]));
  const w1Map = new Map(week1ByUser.map((r) => [r.userId, r._sum.amount ?? 0]));
  const w2Map = new Map(week2ByUser.map((r) => [r.userId, r._sum.amount ?? 0]));
  const w3Map = new Map(week3ByUser.map((r) => [r.userId, r._sum.amount ?? 0]));

  const rows: EmployeeIntelligenceRow[] = targets.map((t) => {
    const revenueWTD = wtdMap.get(t.userId) ?? 0;
    const revenueMTD = mtdMap.get(t.userId) ?? 0;
    const target = t.amount;
    const achievementPercent =
      target > 0 ? Math.round((revenueMTD / target) * 100) : 0;
    const last3Weeks = [
      w1Map.get(t.userId) ?? 0,
      w2Map.get(t.userId) ?? 0,
      w3Map.get(t.userId) ?? 0,
    ];
    const trend = getRevenueTrendDirection(last3Weeks);
    const consistency = weeklyRevenueConsistencyScore(last3Weeks);
    const ers = computeEmployeeRevenueScore({
      achievementPct: achievementPercent,
      revenueTrendDirection: trend,
      consistencyScore: consistency,
    });
    const name =
      t.user?.employee?.name ?? t.user?.empId ?? t.userId;
    return {
      userId: t.userId,
      name,
      revenueWTD,
      revenueMTD,
      employeeMonthlyTarget: target,
      achievementPercent,
      trend,
      consistency,
      ersScore: ers.score,
      ersLabel: ers.label,
      reasons: ers.reasons,
    };
  });

  rows.sort((a, b) => b.ersScore - a.ersScore);

  return NextResponse.json({
    weekStart,
    weekEnd,
    monthKey,
    employees: rows,
  });
}
