import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import type { Role } from '@prisma/client';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { taskId } = await params;
    const body = await request.json();
    const primaryEmpId = String(body.primaryEmpId ?? '').trim();
    const backup1EmpId = (body.backup1EmpId != null && String(body.backup1EmpId).trim() !== '')
      ? String(body.backup1EmpId).trim()
      : primaryEmpId;
    const backup2EmpId = (body.backup2EmpId != null && String(body.backup2EmpId).trim() !== '')
      ? String(body.backup2EmpId).trim()
      : primaryEmpId;

    if (!primaryEmpId) {
      return NextResponse.json({ error: 'primaryEmpId required' }, { status: 400 });
    }

    const b1 = (body.backup1EmpId != null && String(body.backup1EmpId).trim() !== '') ? String(body.backup1EmpId).trim() : null;
    const b2 = (body.backup2EmpId != null && String(body.backup2EmpId).trim() !== '') ? String(body.backup2EmpId).trim() : null;
    if (b1 && b1 === primaryEmpId) {
      return NextResponse.json({ error: 'Primary and Backup 1 cannot be the same', code: 'DUPLICATE_PRIMARY_BACKUP1' }, { status: 400 });
    }
    if (b2 && b2 === primaryEmpId) {
      return NextResponse.json({ error: 'Primary and Backup 2 cannot be the same', code: 'DUPLICATE_PRIMARY_BACKUP2' }, { status: 400 });
    }
    if (b1 && b2 && b1 === b2) {
      return NextResponse.json({ error: 'Backup 1 and Backup 2 cannot be the same', code: 'DUPLICATE_BACKUP1_BACKUP2' }, { status: 400 });
    }

    const existing = await prisma.taskPlan.findFirst({ where: { taskId } });
    const data = { taskId, primaryEmpId, backup1EmpId, backup2EmpId };

    const plan = existing
      ? await prisma.taskPlan.update({ where: { id: existing.id }, data })
      : await prisma.taskPlan.create({ data });

    return NextResponse.json(plan);
  } catch (err) {
    console.error('/api/tasks/setup/[taskId]/plan PUT error:', err);
    return NextResponse.json(
      { error: 'Server error', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
