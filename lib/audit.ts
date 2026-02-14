import { prisma } from '@/lib/db';

export type AuditModule = 'SCHEDULE' | 'INVENTORY' | 'TEAM' | 'LOCK' | 'APPROVALS';

export async function logAudit(
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  beforeJson: string | null,
  afterJson: string | null,
  reason: string | null = null,
  options?: {
    module?: AuditModule;
    targetEmployeeId?: string | null;
    targetDate?: Date | string | null;
    weekStart?: Date | string | null;
  }
) {
  const targetDate = options?.targetDate
    ? typeof options.targetDate === 'string'
      ? new Date(options.targetDate + 'T00:00:00Z')
      : options.targetDate
    : null;
  const weekStart = options?.weekStart
    ? typeof options.weekStart === 'string'
      ? new Date(options.weekStart + 'T00:00:00Z')
      : options.weekStart
    : null;

  await prisma.auditLog.create({
    data: {
      actorUserId,
      action,
      entityType,
      entityId,
      beforeJson,
      afterJson,
      reason,
      module: options?.module ?? null,
      targetEmployeeId: options?.targetEmployeeId ?? null,
      targetDate,
      weekStart,
    },
  });
}
