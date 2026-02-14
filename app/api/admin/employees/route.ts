import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getEmployeeTeam } from '@/lib/services/employeeTeam';
import type { Role, Team, EmployeePosition } from '@prisma/client';

const VALID_POSITIONS: EmployeePosition[] = ['BOUTIQUE_MANAGER', 'ASSISTANT_MANAGER', 'SENIOR_SALES', 'SALES'];

export async function GET() {
  try {
    await requireRole(['ADMIN', 'MANAGER'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const employees = await prisma.employee.findMany({
    where: { isSystemOnly: false },
    orderBy: { empId: 'asc' },
    include: {
      user: {
        select: { role: true, disabled: true, mustChangePassword: true },
      },
    },
  });

  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const withCurrentTeam = await Promise.all(
    employees.map(async (e) => {
      let currentTeam: string = e.team;
      try {
        currentTeam = await getEmployeeTeam(e.empId, today);
      } catch {
        // keep e.team
      }
      return { ...e, currentTeam };
    })
  );
  return NextResponse.json(withCurrentTeam);
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const empId = String(body.empId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const team = String(body.team ?? 'A').toUpperCase() as Team;
  const weeklyOffDay = Number(body.weeklyOffDay ?? 5);
  const position = body.position != null && VALID_POSITIONS.includes(body.position as EmployeePosition)
    ? (body.position as EmployeePosition)
    : undefined;
  const email = body.email != null ? String(body.email).trim() : null;
  const phone = body.phone != null ? String(body.phone).trim() : null;
  const language = body.language === 'ar' ? 'ar' : 'en';

  if (!empId || !name) {
    return NextResponse.json({ error: 'empId and name required' }, { status: 400 });
  }
  if (!['A', 'B'].includes(team)) {
    return NextResponse.json({ error: 'team must be A or B' }, { status: 400 });
  }
  if (weeklyOffDay < 0 || weeklyOffDay > 6) {
    return NextResponse.json({ error: 'weeklyOffDay must be 0-6' }, { status: 400 });
  }

  const employee = await prisma.employee.create({
    data: {
      empId,
      name,
      team,
      weeklyOffDay,
      position,
      email,
      phone,
      language,
      active: true,
    },
  });
  return NextResponse.json(employee);
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole(['ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const empId = String(body.empId ?? '').trim();
  if (!empId) return NextResponse.json({ error: 'empId required' }, { status: 400 });

  const update: {
    name?: string;
    email?: string | null;
    phone?: string | null;
    weeklyOffDay?: number;
    position?: EmployeePosition | null;
    language?: string;
  } = {};
  if (body.name !== undefined) update.name = String(body.name).trim();
  if (body.email !== undefined) update.email = body.email != null ? String(body.email).trim() : null;
  if (body.phone !== undefined) update.phone = body.phone != null ? String(body.phone).trim() : null;
  if (body.team !== undefined) {
    return NextResponse.json(
      { error: 'Team cannot be changed here. Use Change Team (effective-date) for future team changes.' },
      { status: 400 }
    );
  }
  if (body.weeklyOffDay !== undefined) {
    const n = Number(body.weeklyOffDay);
    if (n < 0 || n > 6) return NextResponse.json({ error: 'weeklyOffDay must be 0-6' }, { status: 400 });
    update.weeklyOffDay = n;
  }
  if (body.position !== undefined) {
    update.position = body.position == null || body.position === ''
      ? null
      : VALID_POSITIONS.includes(body.position as EmployeePosition)
        ? (body.position as EmployeePosition)
        : undefined;
    if (update.position === undefined) delete update.position;
  }
  if (body.language !== undefined) update.language = body.language === 'ar' ? 'ar' : 'en';

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const employee = await prisma.employee.update({
    where: { empId },
    data: update,
  });
  return NextResponse.json(employee);
}
