import { prisma } from '@/lib/db';

export type SalesTargetAuditAction =
  | 'GENERATE'
  | 'REGENERATE'
  | 'RESET'
  | 'OVERRIDE_EMPLOYEE'
  | 'SET_BOUTIQUE_TARGET'
  | 'CLEAR_BOUTIQUE_TARGET'
  | 'IMPORT_SALES'
  | 'CLEAR_SALES_MONTH';

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
