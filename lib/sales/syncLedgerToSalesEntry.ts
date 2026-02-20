/**
 * Sync Daily Sales Ledger (BoutiqueSalesSummary + BoutiqueSalesLine) to SalesEntry.
 * Executive/Dashboard/Monthly read from SalesEntry; ledger writes must flow here.
 * Idempotent: repeated sync does not duplicate (upsert by userId+date).
 * Month key derived in Asia/Riyadh for consistency with read-side.
 */

import { prisma } from '@/lib/db';
import { formatMonthKey } from '@/lib/time';

/**
 * Sync all lines of a summary to SalesEntry for that date and boutique.
 * For each line: resolve User from employeeId (empId), upsert SalesEntry (userId, date, boutiqueId, amount).
 * Call after line upsert and after lock.
 */
export async function syncSummaryToSalesEntry(
  summaryId: string,
  createdById: string
): Promise<{ upserted: number; skipped: number }> {
  const summary = await prisma.boutiqueSalesSummary.findUnique({
    where: { id: summaryId },
    include: { lines: true },
  });
  if (!summary) return { upserted: 0, skipped: 0 };

  const date = summary.date;
  const dateOnly = date instanceof Date ? date : new Date(date);
  const monthKey = formatMonthKey(dateOnly);
  const boutiqueId = summary.boutiqueId;

  const empIds = summary.lines.map((l) => l.employeeId).filter(Boolean);
  if (empIds.length === 0) {
    return { upserted: 0, skipped: 0 };
  }

  const users = await prisma.user.findMany({
    where: { empId: { in: empIds } },
    select: { id: true, empId: true },
  });
  const userIdByEmpId = new Map(users.map((u) => [u.empId, u.id]));
  const userIdsInLines = new Set<string>();
  for (const line of summary.lines) {
    const uid = userIdByEmpId.get(line.employeeId);
    if (uid) userIdsInLines.add(uid);
  }

  let upserted = 0;
  for (const line of summary.lines) {
    const userId = userIdByEmpId.get(line.employeeId);
    if (!userId) continue;
    await prisma.salesEntry.upsert({
      where: {
        userId_date: { userId, date: dateOnly },
      },
      create: {
        userId,
        date: dateOnly,
        month: monthKey,
        boutiqueId,
        amount: line.amountSar,
        createdById,
      },
      update: {
        amount: line.amountSar,
        boutiqueId,
        updatedAt: new Date(),
      },
    });
    upserted++;
  }

  // Remove SalesEntry rows for this date+boutique that are no longer in ledger lines (stale entries)
  const toDelete = await prisma.salesEntry.findMany({
    where: { date: dateOnly, boutiqueId },
    select: { userId: true },
  });
  const staleUserIds = toDelete.filter((r) => !userIdsInLines.has(r.userId)).map((r) => r.userId);
  if (staleUserIds.length > 0) {
    await prisma.salesEntry.deleteMany({
      where: { date: dateOnly, boutiqueId, userId: { in: staleUserIds } },
    });
  }

  return { upserted, skipped: summary.lines.length - upserted };
}
