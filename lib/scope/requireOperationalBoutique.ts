/**
 * REQUIRE OPERATIONAL BOUTIQUE — Session-bound only (no switching)
 * ----------------------------------------------------------------
 * Delegates to requireOperationalScope(); scope = user.boutiqueId from session.
 */

import { NextResponse } from 'next/server';
import { requireOperationalScope } from '@/lib/scope/operationalScope';

export type RequireOperationalBoutiqueResult = {
  boutiqueId: string;
  boutiqueLabel: string;
};

export type RequireOperationalBoutiqueReturn =
  | { ok: true; boutiqueId: string; boutiqueLabel: string }
  | { ok: false; res: NextResponse };

export async function requireOperationalBoutique(): Promise<RequireOperationalBoutiqueReturn> {
  const { scope, res } = await requireOperationalScope();
  if (res) return { ok: false, res };
  if (!scope!.boutiqueId) {
    return {
      ok: false,
      res: NextResponse.json(
        { error: 'Account not assigned to a boutique' },
        { status: 403 }
      ),
    };
  }
  return {
    ok: true,
    boutiqueId: scope!.boutiqueId,
    boutiqueLabel: scope!.label,
  };
}
