import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getAssignments, setAssignment } from '@/lib/services/inventoryZones';
import type { Role } from '@prisma/client';

export async function GET() {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const assignments = await getAssignments();
  return NextResponse.json(assignments);
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const raw = body.assignments;
  let list: Array<{ zoneId: string; empId: string | null }>;
  if (Array.isArray(raw)) {
    list = raw
      .filter((a: unknown) => a && typeof a === 'object' && 'zoneId' in a)
      .map((a: { zoneId?: string; empId?: string }) => ({
        zoneId: String(a.zoneId ?? ''),
        empId: a.empId ? String(a.empId) : null,
      }))
      .filter((a) => a.zoneId);
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    list = Object.entries(raw as Record<string, string>).map(([zoneId, empId]) => ({
      zoneId,
      empId: empId ? String(empId) : null,
    }));
  } else {
    return NextResponse.json({ error: 'assignments required (array or zoneId -> empId object)' }, { status: 400 });
  }
  for (const a of list) {
    await setAssignment(a.zoneId, a.empId);
  }
  const result = await getAssignments();
  return NextResponse.json(result);
}
