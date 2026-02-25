/**
 * Sales Ledger RBAC: scope and permissions by role.
 * - EMPLOYEE: own rows only, active boutique.
 * - ASSISTANT_MANAGER: full boutique read (summary, ledger, returns); no import/resolve.
 * - MANAGER: full boutique + import + resolve issues for active boutique only.
 * - ADMIN: cross-boutique; optional filter by boutiqueId; import/resolve any.
 */

import { NextResponse } from 'next/server';
import { getOperationalScope } from '@/lib/scope/operationalScope';
import { getSessionUser } from '@/lib/auth';
import type { Role } from '@prisma/client';

export type SalesScopeResult = {
  userId: string;
  role: Role;
  empId: string | null;
  /** Boutique(s) the user can query. For non-ADMIN: [activeBoutiqueId]. For ADMIN: all if no filter. */
  allowedBoutiqueIds: string[];
  /** Requested boutiqueId (from query/body); for ADMIN can be any, for others must match active. */
  effectiveBoutiqueId: string;
  /** Can call POST import-ledger for effectiveBoutiqueId */
  canImport: boolean;
  /** Can PATCH import-issues (resolve/ignore) */
  canResolveIssues: boolean;
  /** Can add manual RETURN/EXCHANGE (MANAGER, ASSISTANT_MANAGER, ADMIN, SUPER_ADMIN) */
  canAddManualReturn: boolean;
  /** If true, all ledger/summary/returns queries must filter by employeeId = session empId */
  employeeOnly: boolean;
};

export type RequireSalesScopeOptions = {
  /** For import/update: require canImport. For issues resolve: require canResolveIssues. */
  requireImport?: boolean;
  requireResolveIssues?: boolean;
  /** Require canAddManualReturn (for POST manual return/exchange). */
  requireManualReturn?: boolean;
  /** Optional boutiqueId from request; for MANAGER must match scope.boutiqueId; ADMIN can pass any. */
  requestBoutiqueId?: string | null;
};

/**
 * Get sales scope from session. Returns null if not authenticated or no boutique (for non-ADMIN).
 */
export async function getSalesScope(
  options: RequireSalesScopeOptions = {}
): Promise<{ scope: SalesScopeResult; res: null } | { scope: null; res: NextResponse }> {
  const user = await getSessionUser();
  if (!user?.id) {
    return { scope: null, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const op = await getOperationalScope();
  const role = user.role as Role;
  const activeBoutiqueId = op?.boutiqueId ?? '';

  const roleStr = role as string;
  // Non-ADMIN/SUPER_ADMIN must have operational boutique
  if (roleStr !== 'ADMIN' && roleStr !== 'SUPER_ADMIN' && !activeBoutiqueId) {
    return {
      scope: null,
      res: NextResponse.json(
        { error: 'Account not assigned to a boutique' },
        { status: 403 }
      ),
    };
  }

  const requestBoutiqueId = (options.requestBoutiqueId ?? '').trim();
  let effectiveBoutiqueId: string;
  let allowedBoutiqueIds: string[];

  if (roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN') {
    allowedBoutiqueIds = requestBoutiqueId
      ? [requestBoutiqueId]
      : []; // empty = no filter = all boutiques
    effectiveBoutiqueId = requestBoutiqueId || activeBoutiqueId;
  } else {
    allowedBoutiqueIds = [activeBoutiqueId];
    effectiveBoutiqueId = activeBoutiqueId;
    if (requestBoutiqueId && requestBoutiqueId !== activeBoutiqueId) {
      return {
        scope: null,
        res: NextResponse.json(
          { error: 'Boutique must match your operational boutique' },
          { status: 403 }
        ),
      };
    }
  }

  const canImport =
    (roleStr === 'MANAGER' && !!activeBoutiqueId) || roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN';
  const canResolveIssues =
    (roleStr === 'MANAGER' && !!activeBoutiqueId) || roleStr === 'ADMIN' || roleStr === 'SUPER_ADMIN';
  const canAddManualReturn =
    ((roleStr === 'MANAGER' || roleStr === 'ASSISTANT_MANAGER') && !!activeBoutiqueId) ||
    roleStr === 'ADMIN' ||
    roleStr === 'SUPER_ADMIN';
  const employeeOnly = roleStr === 'EMPLOYEE';

  const scope: SalesScopeResult = {
    userId: user.id,
    role,
    empId: user.empId ?? null,
    allowedBoutiqueIds,
    effectiveBoutiqueId,
    canImport,
    canResolveIssues,
    canAddManualReturn,
    employeeOnly,
  };

  if (options.requireImport && !scope.canImport) {
    return {
      scope: null,
      res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  if (options.requireResolveIssues && !scope.canResolveIssues) {
    return {
      scope: null,
      res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  if (options.requireManualReturn && !scope.canAddManualReturn) {
    return {
      scope: null,
      res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { scope, res: null };
}
