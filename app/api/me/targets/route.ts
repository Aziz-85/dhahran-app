import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireOperationalScope } from '@/lib/scope/operationalScope';
import {
  getRiyadhNow,
  toRiyadhDateOnly,
  toRiyadhDateString,
  formatMonthKey,
  getMonthRange,
  getWeekRangeForDate,
  getDaysInMonth,
  intersectRanges,
  normalizeMonthKey,
} from '@/lib/time';

function getDailyTargetForDay(monthTarget: number, daysInMonth: number, dayOfMonth1Based: number): number {
  if (daysInMonth <= 0) return 0;
  const base = Math.floor(monthTarget / daysInMonth);
  const remainder = monthTarget - base * daysInMonth;
  return base + (dayOfMonth1Based <= remainder ? 1 : 0);
}

export async function GET(request: NextRequest) {
  const { scope, res } = await requireOperationalScope();
  if (res) return res;
  const boutiqueId = scope.boutiqueId;
  const userId = scope.userId;

  const now = getRiyadhNow();
  const monthKey = normalizeMonthKey(request.nextUrl.searchParams.get('month')?.trim() || formatMonthKey(now));

  const { start: monthStart, endExclusive: monthEnd } = getMonthRange(monthKey);
  const daysInMonth = getDaysInMonth(monthKey);
  const todayStr = toRiyadhDateString(now);
  const todayDateOnly = toRiyadhDateOnly(now);
  const todayInSelectedMonth = formatMonthKey(todayDateOnly) === monthKey;
  const anchorDate = todayInSelectedMonth ? todayDateOnly : monthStart;
  const { startSat, endExclusiveFriPlus1 } = getWeekRangeForDate(anchorDate);
  const weekInMonth = intersectRanges(startSat, endExclusiveFriPlus1, monthStart, monthEnd);

  const fridayDate = weekInMonth ? new Date(endExclusiveFriPlus1.getTime() - 86400000) : null;
  const weekRangeLabel =
    weekInMonth && fridayDate
      ? `${toRiyadhDateString(startSat)} – ${toRiyadhDateString(fridayDate)}`
      : '';

  const [boutiqueTarget, employeeTarget, salesInMonth, todayEntry, weekEntries] = await Promise.all([
    prisma.boutiqueMonthlyTarget.findFirst({
      where: { boutiqueId, month: monthKey },
    }),
    prisma.employeeMonthlyTarget.findFirst({
      where: { boutiqueId, month: monthKey, userId },
    }),
    prisma.salesEntry.findMany({
      where: { boutiqueId, userId, month: monthKey },
      select: { date: true, amount: true },
    }),
    prisma.salesEntry.findFirst({
      where: { boutiqueId, userId, date: todayDateOnly },
    }),
    weekInMonth
      ? prisma.salesEntry.findMany({
          where: {
            boutiqueId,
            userId,
            date: { gte: weekInMonth.start, lt: weekInMonth.end },
          },
          select: { date: true, amount: true },
        })
      : Promise.resolve([]),
  ]);

  const monthTarget = employeeTarget?.amount ?? 0;
  const mtdSales = salesInMonth.reduce((s, e) => s + e.amount, 0);
  const todaySales = todayInSelectedMonth ? (todayEntry?.amount ?? 0) : 0;
  const weekSales = weekEntries.reduce((s, e) => s + e.amount, 0);

  const todayDayOfMonth = todayDateOnly.getUTCDate();
  const dailyTarget = daysInMonth > 0 ? getDailyTargetForDay(monthTarget, daysInMonth, todayDayOfMonth) : 0;

  let weekTarget = 0;
  if (weekInMonth && daysInMonth > 0) {
    const start = weekInMonth.start.getTime();
    const end = weekInMonth.end.getTime();
    const dayMs = 24 * 60 * 60 * 1000;
    for (let t = start; t < end; t += dayMs) {
      const d = new Date(t);
      weekTarget += getDailyTargetForDay(monthTarget, daysInMonth, d.getUTCDate());
    }
  }

  const remaining = Math.max(0, monthTarget - mtdSales);
  const pctDaily = dailyTarget > 0 ? (todaySales / dailyTarget) * 100 : 0;
  const pctWeek = weekTarget > 0 ? (weekSales / weekTarget) * 100 : 0;
  const pctMonth = monthTarget > 0 ? (mtdSales / monthTarget) * 100 : 0;

  return NextResponse.json({
    monthKey,
    monthTarget,
    boutiqueTarget: boutiqueTarget?.amount ?? null,
    todaySales,
    weekSales,
    mtdSales,
    dailyTarget,
    weekTarget,
    remaining,
    pctDaily,
    pctWeek,
    pctMonth,
    daysInMonth,
    todayStr,
    todayInSelectedMonth,
    weekRangeLabel,
    leaveDaysInMonth: employeeTarget?.leaveDaysInMonth ?? null,
    presenceFactor: employeeTarget?.presenceFactor ?? null,
    scheduledDaysInMonth: employeeTarget?.scheduledDaysInMonth ?? null,
    // Aliases for /me and home widgets
    month: monthKey,
    monthlyTarget: monthTarget,
    todayTarget: dailyTarget,
    mtdPct: pctMonth,
    todayPct: pctDaily,
    weekPct: pctWeek,
  });
}
