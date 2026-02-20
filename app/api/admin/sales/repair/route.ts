/**
 * GET/POST /api/admin/sales/repair — Self-heal SalesEntry from Daily Ledger for a date range.
 * ADMIN only. Syncs BoutiqueSalesSummary + BoutiqueSalesLine → SalesEntry for each date and boutique.
 * Query/body: from=YYYY-MM-DD, to=YYYY-MM-DD, boutiqueId optional (if omitted, all boutiques).
 * Returns: { repairedDates, boutiques, warnings, tookMs }.
 */

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { syncDailyLedgerToSalesEntry } from '@/lib/sales/syncDailyLedgerToSalesEntry';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

async function getParams(request: NextRequest): Promise<{ from: string; to: string; boutiqueId: string | null }> {
  const url = request.nextUrl;
  if (request.method === 'GET') {
    return {
      from: url.searchParams.get('from') ?? '',
      to: url.searchParams.get('to') ?? '',
      boutiqueId: url.searchParams.get('boutiqueId') || null,
    };
  }
  const body = await request.json().catch(() => ({}));
  return {
    from: typeof body.from === 'string' ? body.from.trim() : '',
    to: typeof body.to === 'string' ? body.to.trim() : '',
    boutiqueId: typeof body.boutiqueId === 'string' ? body.boutiqueId.trim() || null : null,
  };
}

export async function GET(request: NextRequest) {
  return runRepair(request);
}

export async function POST(request: NextRequest) {
  return runRepair(request);
}

async function runRepair(request: NextRequest) {
  const started = Date.now();
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole(['ADMIN']);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.boutiqueId) return NextResponse.json({ error: 'Account not assigned to a boutique' }, { status: 403 });

  const { from, to } = await getParams(request);

  if (!DATE_REGEX.test(from) || !DATE_REGEX.test(to)) {
    return NextResponse.json(
      { error: 'from and to are required as YYYY-MM-DD' },
      { status: 400 }
    );
  }
  const fromDate = new Date(from + 'T12:00:00.000Z');
  const toDate = new Date(to + 'T12:00:00.000Z');
  if (fromDate.getTime() > toDate.getTime()) {
    return NextResponse.json({ error: 'from must be <= to' }, { status: 400 });
  }

  const boutiqueIds = [user.boutiqueId];

  const dateStrs: string[] = [];
  const cur = new Date(fromDate);
  while (cur.getTime() <= toDate.getTime()) {
    dateStrs.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const warnings: string[] = [];
  let repaired = 0;
  for (const dateStr of dateStrs) {
    for (const boutiqueId of boutiqueIds) {
      const result = await syncDailyLedgerToSalesEntry({
        boutiqueId,
        date: dateStr,
        actorUserId: user.id,
      });
      if (result.error) {
        warnings.push(`${boutiqueId}/${dateStr}: ${result.error}`);
      } else {
        repaired++;
      }
    }
  }

  const tookMs = Date.now() - started;
  return NextResponse.json({
    repairedDates: dateStrs.length,
    boutiques: boutiqueIds.length,
    repaired,
    warnings,
    tookMs,
  });
}
