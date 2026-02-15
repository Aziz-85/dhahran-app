import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { notDisabledUserWhere } from '@/lib/employeeWhere';
import type { Role } from '@prisma/client';

export async function GET() {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    where: { active: true, isSystemOnly: false, ...notDisabledUserWhere },
    select: { empId: true, name: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(employees);
}
