import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { clearCoverageValidationCache } from '@/lib/services/coverageValidation';
import type { Role, LeaveType, LeaveStatus } from '@prisma/client';

const VALID_LEAVE_TYPES: LeaveType[] = ['ANNUAL', 'EXHIBITION', 'SICK', 'OTHER_BRANCH', 'EMERGENCY', 'OTHER'];
const VALID_LEAVE_STATUSES: LeaveStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

export async function GET(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');
  const empId = request.nextUrl.searchParams.get('empId');
  const type = request.nextUrl.searchParams.get('type');

  const where: {
    empId?: string;
    type?: LeaveType;
    endDate?: { gte: Date };
    startDate?: { lte: Date };
  } = {};

  if (empId) where.empId = empId;
  if (type && VALID_LEAVE_TYPES.includes(type as LeaveType)) where.type = type as LeaveType;
  if (from) where.endDate = { gte: new Date(from + 'T00:00:00Z') };
  if (to) where.startDate = { lte: new Date(to + 'T00:00:00Z') };

  const leaves = await prisma.leave.findMany({
    where,
    include: { employee: { select: { empId: true, name: true } } },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(leaves);
}

export async function POST(request: NextRequest) {
  try {
    await requireRole(['MANAGER', 'ADMIN'] as Role[]);
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'UNAUTHORIZED') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const empId = String(body.empId ?? '').trim();
  const type = String(body.type ?? 'ANNUAL').toUpperCase() as LeaveType;
  const status = body.status != null && VALID_LEAVE_STATUSES.includes(body.status as LeaveStatus)
    ? (body.status as LeaveStatus)
    : 'APPROVED';
  const startDate = body.startDate ? new Date(String(body.startDate) + 'T00:00:00Z') : null;
  const endDate = body.endDate ? new Date(String(body.endDate) + 'T00:00:00Z') : null;
  const notes = body.notes != null ? String(body.notes).trim() || null : null;

  if (!empId) return NextResponse.json({ error: 'empId required' }, { status: 400 });
  if (!startDate || !endDate) return NextResponse.json({ error: 'startDate and endDate required' }, { status: 400 });
  if (!VALID_LEAVE_TYPES.includes(type)) return NextResponse.json({ error: 'Invalid leave type' }, { status: 400 });
  if (startDate > endDate) return NextResponse.json({ error: 'startDate must be <= endDate' }, { status: 400 });

  const leave = await prisma.leave.create({
    data: { empId, type, status, startDate, endDate, notes },
    include: { employee: { select: { empId: true, name: true } } },
  });
  clearCoverageValidationCache();
  return NextResponse.json(leave);
}
