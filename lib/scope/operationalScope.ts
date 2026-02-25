/**
 * OPERATIONAL SCOPE — Session-bound boutique only (no switching)
 * -----------------------------------------------------------------
 * Scope is user.boutiqueId from session, except SUPER_ADMIN who gets all boutiques (both branches).
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

export type OperationalScopeResult = {
  userId: string;
  role: Role;
  empId: string | null;
  boutiqueId: string;
  boutiqueIds: string[];
  label: string;
};

/**
 * Get operational scope from session. SUPER_ADMIN gets all active boutiques (covers both branches).
 */
export async function getOperationalScope(): Promise<OperationalScopeResult | null> {
  const user = await getSessionUser();
  if (!user?.id) return null;
  const role = user.role as Role;
  const boutiqueId = user.boutiqueId ?? '';

  if (role === 'SUPER_ADMIN') {
    const allBoutiques = await prisma.boutique.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    });
    const boutiqueIds = allBoutiques.map((b) => b.id);
    const label = boutiqueIds.length > 0
      ? `الفرعين معاً / Both branches (${boutiqueIds.length})`
      : 'SUPER_ADMIN';
    return {
      userId: user.id,
      role: 'SUPER_ADMIN',
      empId: user.empId ?? null,
      boutiqueId: boutiqueIds[0] ?? boutiqueId,
      boutiqueIds: boutiqueIds.length > 0 ? boutiqueIds : [boutiqueId],
      label,
    };
  }

  if (!boutiqueId) return null;
  const label = user.boutique
    ? `${user.boutique.name} (${user.boutique.code})`
    : boutiqueId;

  return {
    userId: user.id,
    role,
    empId: user.empId ?? null,
    boutiqueId,
    boutiqueIds: [boutiqueId],
    label,
  };
}

export type RequireOperationalScopeResult =
  | { scope: OperationalScopeResult; res: null }
  | { scope: null; res: NextResponse };

/**
 * Require operational scope (session boutique). 401 if not authenticated, 403 if no boutique.
 */
export async function requireOperationalScope(): Promise<RequireOperationalScopeResult> {
  const scope = await getOperationalScope();
  if (!scope) {
    return { scope: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (!scope.boutiqueId) {
    return {
      scope: null,
      res: NextResponse.json(
        { error: 'Account not assigned to a boutique' },
        { status: 403 }
      ),
    };
  }
  return { scope, res: null };
}
