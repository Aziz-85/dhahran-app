/**
 * POST /api/sales/import/apply
 * Body: { batchId }
 * RBAC: ADMIN, MANAGER. Apply batch lines (upsert) + audit; return reconcile result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireRole, getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getOperationalScope } from '@/lib/scope/operationalScope';
import { reconcileSummary } from '@/lib/sales/reconcile';
import { recordSalesLedgerAudit } from '@/lib/sales/audit';
import { syncSummaryToSalesEntry } from '@/lib/sales/syncLedgerToSalesEntry';

const ALLOWED_ROLES = ['ADMIN', 'MANAGER'] as const;

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getSessionUser>>;
  try {
    user = await requireRole([...ALLOWED_ROLES]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const batchId = typeof body.batchId === 'string' ? body.batchId.trim() : '';
  if (!batchId) {
    return NextResponse.json({ error: 'batchId required' }, { status: 400 });
  }

  const batch = await prisma.salesImportBatch.findUnique({
    where: { id: batchId },
    include: { summary: { include: { lines: true } } },
  });
  if (!batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
  }

  const scope = await getOperationalScope();
  if (!scope?.boutiqueId) {
    return NextResponse.json({ error: 'No operational boutique available' }, { status: 403 });
  }
  if (batch.boutiqueId !== scope.boutiqueId) {
    return NextResponse.json({ error: 'Batch boutique must match your operational boutique' }, { status: 403 });
  }

  const totals = batch.totalsJson as {
    managerTotalSar?: number;
    linesTotalSar?: number;
    diffSar?: number;
    rowCount?: number;
    unmatchedRowsCount?: number;
  };
  const managerTotalSar = Number(totals?.managerTotalSar ?? 0);
  const linesTotalSar = Number(totals?.linesTotalSar ?? 0);
  const diffSar = Number(totals?.diffSar ?? 0);
  const unmatchedRowsCount = Number(totals?.unmatchedRowsCount ?? 0);

  if (unmatchedRowsCount > 0) {
    return NextResponse.json(
      {
        error: 'Cannot apply: one or more rows have unmatched employees. Fix or remove unmatched rows and re-import.',
        unmatchedRowsCount,
      },
      { status: 400 }
    );
  }

  if (diffSar !== 0) {
    return NextResponse.json(
      {
        error: 'Cannot apply: import total does not match manager total. Reconcile first.',
        managerTotalSar,
        linesTotalSar,
        diffSar,
      },
      { status: 400 }
    );
  }

  const summary = batch.summary;
  if (summary.status === 'LOCKED') {
    await prisma.boutiqueSalesSummary.update({
      where: { id: summary.id },
      data: { status: 'DRAFT', lockedById: null, lockedAt: null },
    });
    await recordSalesLedgerAudit({
      boutiqueId: batch.boutiqueId,
      date: batch.date,
      actorId: user.id,
      action: 'POST_LOCK_EDIT',
      reason: 'Excel import apply after lock; auto-unlock',
      metadata: { batchId },
    });
  }

  const rowCount = Number(totals?.rowCount ?? 0);
  if (rowCount === 0) {
    await recordSalesLedgerAudit({
      boutiqueId: batch.boutiqueId,
      date: batch.date,
      actorId: user.id,
      action: 'IMPORT_APPLY',
      metadata: { batchId, appliedRows: 0 },
    });
    const recon = await reconcileSummary(summary.id);
    return NextResponse.json({
      ok: true,
      batchId,
      appliedRows: 0,
      linesTotal: recon?.linesTotal ?? 0,
      summaryTotal: recon?.summaryTotal ?? summary.totalSar,
      diff: recon?.diff ?? 0,
      canLock: recon?.canLock ?? false,
    });
  }

  const parsedRows = getParsedRowsFromBatch(batch);
  if (!parsedRows.length) {
    return NextResponse.json(
      { error: 'Batch has no stored row data to apply. Re-import the file.' },
      { status: 400 }
    );
  }

  for (const row of parsedRows) {
    await prisma.boutiqueSalesLine.upsert({
      where: {
        summaryId_employeeId: { summaryId: summary.id, employeeId: row.employeeId },
      },
      create: {
        summaryId: summary.id,
        employeeId: row.employeeId,
        amountSar: row.amountSar,
        source: 'EXCEL_IMPORT',
        importBatchId: batchId,
      },
      update: {
        amountSar: row.amountSar,
        source: 'EXCEL_IMPORT',
        importBatchId: batchId,
        updatedAt: new Date(),
      },
    });
  }

  await recordSalesLedgerAudit({
    boutiqueId: batch.boutiqueId,
    date: batch.date,
    actorId: user.id,
    action: 'IMPORT_APPLY',
    metadata: { batchId, appliedRows: parsedRows.length },
  });

  await syncSummaryToSalesEntry(summary.id, user.id);

  const recon = await reconcileSummary(summary.id);
  return NextResponse.json({
    ok: true,
    batchId,
    appliedRows: parsedRows.length,
    linesTotal: recon?.linesTotal ?? 0,
    summaryTotal: recon?.summaryTotal ?? summary.totalSar,
    diff: recon?.diff ?? 0,
    canLock: recon?.canLock ?? false,
  });
}

function getParsedRowsFromBatch(batch: { totalsJson: unknown }): { employeeId: string; amountSar: number }[] {
  const t = batch.totalsJson as { rows?: Array<{ employeeId?: string; amountSar?: number }> };
  const rows = t?.rows;
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((r) => typeof r?.employeeId === 'string' && typeof r?.amountSar === 'number' && Number.isInteger(r.amountSar))
    .map((r) => ({ employeeId: r.employeeId!, amountSar: r.amountSar! }));
}
