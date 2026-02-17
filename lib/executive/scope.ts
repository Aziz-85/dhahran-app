/**
 * Resolve boutique IDs for executive APIs. Server-side only.
 * - MANAGER: always resolveScope (no global).
 * - ADMIN: if global=true param, use all active boutiques and audit; else resolveScope.
 * Never trust query param alone: global is only applied when role === 'ADMIN'.
 */

import { prisma } from '@/lib/db';
import { resolveScopeForUser } from '@/lib/scope/resolveScope';
import { writeAdminAudit } from '@/lib/admin/audit';
import type { Role } from '@prisma/client';

export type ExecutiveScopeResult = {
  boutiqueIds: string[];
  isGlobal: boolean;
};

/**
 * Returns boutique IDs for executive compare/employees APIs.
 * globalParam: from query (e.g. searchParams.get('global') === 'true').
 * Only ADMIN can use global; otherwise scope is used.
 */
export async function resolveExecutiveBoutiqueIds(
  userId: string,
  role: Role,
  globalParam: string | null,
  module: 'EXECUTIVE_COMPARE' | 'EXECUTIVE_EMPLOYEES'
): Promise<ExecutiveScopeResult> {
  const useGlobal = role === 'ADMIN' && globalParam === 'true';

  if (!useGlobal) {
    const scope = await resolveScopeForUser(userId, role, null);
    return { boutiqueIds: scope.boutiqueIds, isGlobal: false };
  }

  const all = await prisma.boutique.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { code: 'asc' },
  });
  const boutiqueIds = all.map((b) => b.id);

  await writeAdminAudit({
    actorUserId: userId,
    action: 'EXECUTIVE_GLOBAL_VIEW_ACCESSED',
    entityType: module,
    entityId: null,
    afterJson: JSON.stringify({
      module,
      actorId: userId,
      timestamp: new Date().toISOString(),
    }),
    boutiqueId: boutiqueIds[0] ?? undefined,
  });

  return { boutiqueIds, isGlobal: true };
}
