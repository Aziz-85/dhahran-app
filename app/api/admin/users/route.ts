import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import * as bcrypt from 'bcryptjs';
import type { Role } from '@prisma/client';

export async function GET() {
  try {
    await requireRole(['ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: { id: true, empId: true, role: true, mustChangePassword: true, disabled: true, canEditSchedule: true, createdAt: true },
  });
  return NextResponse.json(users);
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
  const password = String(body.password ?? '');
  const role = String(body.role ?? 'EMPLOYEE').toUpperCase() as Role;

  if (!empId || !password) {
    return NextResponse.json({ error: 'empId and password required' }, { status: 400 });
  }
  if (!['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'role must be EMPLOYEE, MANAGER, ASSISTANT_MANAGER, or ADMIN' }, { status: 400 });
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      empId,
      role,
      passwordHash: hash,
      mustChangePassword: true,
      canEditSchedule: role === 'ASSISTANT_MANAGER', // مساعد المدير: صلاحية تعديل الجدول افتراضياً
    },
  });
  return NextResponse.json({ id: user.id, empId: user.empId, role: user.role });
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

  const update: { role?: Role; disabled?: boolean; mustChangePassword?: boolean; canEditSchedule?: boolean } = {};
  if (body.role !== undefined) {
    const role = String(body.role).toUpperCase() as Role;
    if (!['EMPLOYEE', 'MANAGER', 'ASSISTANT_MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }
    update.role = role;
    if (role === 'ASSISTANT_MANAGER' && body.canEditSchedule === undefined) {
      update.canEditSchedule = true; // عند التحويل لمساعد مدير: منح صلاحية تعديل الجدول افتراضياً
    }
  }
  if (body.disabled !== undefined) update.disabled = Boolean(body.disabled);
  if (body.mustChangePassword !== undefined) update.mustChangePassword = Boolean(body.mustChangePassword);
  if (body.canEditSchedule !== undefined) update.canEditSchedule = Boolean(body.canEditSchedule);

  const user = await prisma.user.update({
    where: { empId },
    data: update,
  });
  return NextResponse.json({
    id: user.id,
    empId: user.empId,
    role: user.role,
    disabled: user.disabled,
    canEditSchedule: user.canEditSchedule,
  });
}
