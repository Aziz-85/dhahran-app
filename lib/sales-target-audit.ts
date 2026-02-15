import { prisma } from '@/lib/db';

export type SalesTargetAuditAction =
  | 'GENERATE'
  | 'REGENERATE'
  | 'OVERRIDE_EMPLOYEE'
  | 'SET_BOUTIQUE_TARGET'
  | 'IMPORT_SALES';

export async function logSalesTargetAudit(
  monthKey: string,
  action: SalesTargetAuditAction,
  actorUserId: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.salesTargetAudit.create({
      data: {
        monthKey,
        action,
        actorUserId,
        detailsJson: details as object,
      },
    });
  } catch {
    // non-fatal
  }
}
