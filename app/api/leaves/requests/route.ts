/**
 * GET /api/leaves/requests — list leave requests (LeaveRequest) within resolved scope.
 * Query: boutiqueId (optional), status (optional), self=true (own only).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { resolveScopeForUser } from '@/lib/scope/resolveScope';
import type { Role } from '@prisma/client';

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const boutiqueId = searchParams.get('boutiqueId') ?? undefined;
  const status = searchParams.get('status') ?? undefined;
  const forSelf = searchParams.get('self') === 'true';

  const resolved = await resolveScopeForUser(user.id, user.role as Role, null);
  let boutiqueIds = resolved.boutiqueIds;
  if (boutiqueId && resolved.boutiqueIds.includes(boutiqueId)) boutiqueIds = [boutiqueId];
  if (boutiqueIds.length === 0) {
    return NextResponse.json([]);
  }

  const where: { boutiqueId: { in: string[] }; status?: string; userId?: string } = {
    boutiqueId: { in: boutiqueIds },
  };
  if (status) where.status = status;
  if (forSelf) where.userId = user.id;

  const list = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, empId: true }, include: { employee: { select: { name: true } } } },
      boutique: { select: { id: true, code: true, name: true } },
      createdByUser: { select: { empId: true } },
      approvedByUser: { select: { empId: true } },
      escalatedByUser: { select: { empId: true } },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  return NextResponse.json(list);
}
