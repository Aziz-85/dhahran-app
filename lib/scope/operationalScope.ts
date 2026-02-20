/**
 * OPERATIONAL SCOPE — Session-bound boutique only (no switching)
 * -----------------------------------------------------------------
 * Scope is always user.boutiqueId from session. No selector, no preference.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
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
 * Get operational scope from session (user.boutiqueId). Returns null if not authenticated or no boutique.
 */
export async function getOperationalScope(): Promise<OperationalScopeResult | null> {
  const user = await getSessionUser();
  if (!user?.id) return null;
  const boutiqueId = user.boutiqueId ?? '';
  if (!boutiqueId) return null;
  const label = user.boutique
    ? `${user.boutique.name} (${user.boutique.code})`
    : boutiqueId;

  return {
    userId: user.id,
    role: user.role as Role,
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
