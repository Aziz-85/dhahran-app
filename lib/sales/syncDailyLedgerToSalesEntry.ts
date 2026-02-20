/**
 * Sync Daily Sales Ledger (BoutiqueSalesSummary + BoutiqueSalesLine) to SalesEntry.
 * Call after any ledger mutation so Executive Monthly / Dashboard read correct totals.
 * Input: boutiqueId + date + actorUserId (no summaryId required).
 */

import { prisma } from '@/lib/db';
import { syncSummaryToSalesEntry } from '@/lib/sales/syncLedgerToSalesEntry';
import { toRiyadhDateOnly } from '@/lib/time';

export type SyncDailyLedgerInput = {
  boutiqueId: string;
  date: Date | string;
  actorUserId: string;
};

export type SyncDailyLedgerResult = {
  ok: boolean;
  summaryId: string | null;
  upserted: number;
  skipped: number;
  error?: string;
};

/**
 * Sync ledger for the given boutique+date to SalesEntry.
 * Finds BoutiqueSalesSummary by boutiqueId+date; if none, returns ok:true with 0 upserted.
 * If an empId does not map to a User, skips with no crash (sync continues).
 */
export async function syncDailyLedgerToSalesEntry(
  input: SyncDailyLedgerInput
): Promise<SyncDailyLedgerResult> {
  const { boutiqueId, date, actorUserId } = input;
  const dateNorm = typeof date === 'string' ? new Date(date + 'T12:00:00.000Z') : date;
  const dateOnly = toRiyadhDateOnly(dateNorm);

  const summary = await prisma.boutiqueSalesSummary.findUnique({
    where: { boutiqueId_date: { boutiqueId, date: dateOnly } },
    select: { id: true },
  });

  if (!summary) {
    return { ok: true, summaryId: null, upserted: 0, skipped: 0 };
  }

  try {
    const result = await syncSummaryToSalesEntry(summary.id, actorUserId);
    return {
      ok: true,
      summaryId: summary.id,
      upserted: result.upserted,
      skipped: result.skipped,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === 'development') {
      console.warn('[syncDailyLedgerToSalesEntry]', message);
    }
    return {
      ok: false,
      summaryId: summary.id,
      upserted: 0,
      skipped: 0,
      error: message,
    };
  }
}
