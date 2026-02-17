/**
 * Monthly Board Report API — READ ONLY aggregation. MANAGER + ADMIN only.
 * Scope resolved server-side; data filtered by boutiqueIds.
 * Query: month (YYYY-MM). Optional; defaults to current month.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getMonthRange } from '@/lib/time';
import { calculateBoutiqueScore } from '@/lib/executive/score';
import { resolveScopeForUser } from '@/lib/scope/resolveScope';
import type { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const role = user.role as Role;
  if (role !== 'MANAGER' && role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const scope = await resolveScopeForUser(user.id, role, null);
  const boutiqueIds = scope.boutiqueIds;
  if (boutiqueIds.length === 0) {
    return NextResponse.json({ error: 'No boutiques in scope' }, { status: 403 });
  }

  const boutiqueFilter = { boutiqueId: { in: boutiqueIds } };
  const zoneIdsResult = await prisma.inventoryZone.findMany({
    where: { boutiqueId: { in: boutiqueIds } },
    select: { id: true },
  });
  const zoneIds = zoneIdsResult.map((z) => z.id);

  const monthParam = request.nextUrl.searchParams.get('month');
  const monthKey =
    monthParam && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : new Date().toISOString().slice(0, 7);

  const { start: monthStart, endExclusive: monthEnd } = getMonthRange(monthKey);

  const [
    boutiqueTarget,
    salesAgg,
    employeeTargets,
    leaveCount,
    approvedLeaveCount,
    scheduleEditCount,
    taskCompletionsCount,
    zoneRunsCount,
    zoneCompletedCount,
    scoreResult,
  ] = await Promise.all([
    prisma.boutiqueMonthlyTarget.findFirst({
      where: { month: monthKey, ...boutiqueFilter },
    }),
    prisma.salesEntry.aggregate({
      where: { month: monthKey, ...boutiqueFilter },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.employeeMonthlyTarget.findMany({
      where: { month: monthKey, ...boutiqueFilter },
      select: { userId: true, amount: true },
    }),
    prisma.leave.count({
      where: {
        status: 'PENDING',
        startDate: { lt: monthEnd },
        endDate: { gte: monthStart },
      },
    }),
    prisma.leave.count({
      where: {
        status: 'APPROVED',
        startDate: { lt: monthEnd },
        endDate: { gte: monthStart },
      },
    }),
    prisma.scheduleEditAudit.count({
      where: {
        editedAt: { gte: monthStart, lt: monthEnd },
        ...boutiqueFilter,
      },
    }),
    prisma.taskCompletion.count({
      where: {
        undoneAt: null,
        completedAt: { gte: monthStart, lt: monthEnd },
      },
    }),
    zoneIds.length > 0
      ? prisma.inventoryWeeklyZoneRun.count({
          where: {
            weekStart: { gte: monthStart, lt: monthEnd },
            zoneId: { in: zoneIds },
          },
        })
      : 0,
    zoneIds.length > 0
      ? prisma.inventoryWeeklyZoneRun.count({
          where: {
            weekStart: { gte: monthStart, lt: monthEnd },
            zoneId: { in: zoneIds },
            OR: [{ status: 'COMPLETED' }, { completedAt: { not: null } }],
          },
        })
      : 0,
    calculateBoutiqueScore(monthKey, boutiqueIds),
  ]);

  const revenue = salesAgg._sum.amount ?? 0;
  const target = boutiqueTarget?.amount ?? 0;
  const achievementPct = target > 0 ? Math.round((revenue / target) * 100) : 0;
  const totalEmployeeTarget = employeeTargets.reduce((s, e) => s + e.amount, 0);
  const zoneCompliancePct =
    zoneRunsCount > 0
      ? Math.round((zoneCompletedCount / zoneRunsCount) * 100)
      : 100;

  return NextResponse.json({
    monthKey,
    boutiqueScore: {
      score: scoreResult.score,
      classification: scoreResult.classification,
      components: scoreResult.components,
    },
    salesIntelligence: {
      revenue,
      target,
      achievementPct,
      totalEmployeeTarget,
      entryCount: salesAgg._count.id,
    },
    workforceStability: {
      pendingLeaves: leaveCount,
      approvedLeavesInPeriod: approvedLeaveCount,
      employeeTargetCount: employeeTargets.length,
    },
    operationalDiscipline: {
      taskCompletionsInMonth: taskCompletionsCount,
      scheduleEditsInMonth: scheduleEditCount,
      zoneRunsTotal: zoneRunsCount,
      zoneCompliancePct,
    },
    riskScore: {
      score: scoreResult.score,
      classification: scoreResult.classification,
    },
  });
}
