import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { setSessionCookie } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getRequestClientInfo } from '@/lib/requestClientInfo';

async function writeAuthAudit(data: {
  event: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT';
  userId?: string | null;
  emailAttempted?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceHint?: string | null;
  reason?: string | null;
  metadata?: Prisma.InputJsonValue | null;
}) {
  try {
    await prisma.authAuditLog.create({
      data: {
        event: data.event,
        userId: data.userId ?? null,
        emailAttempted: data.emailAttempted ?? null,
        ip: data.ip ?? null,
        userAgent: data.userAgent ?? null,
        deviceHint: data.deviceHint ?? null,
        reason: data.reason ?? null,
        metadata: data.metadata ?? undefined,
      },
    });
  } catch {
    // Do not fail login/logout if audit write fails
  }
}

export async function POST(request: NextRequest) {
  const client = getRequestClientInfo(request.headers);

  try {
    const body = await request.json();
    const empId = String(body.username ?? body.empId ?? '').trim();
    const password = String(body.password ?? '');

    if (!empId || !password) {
      return NextResponse.json(
        { error: 'Username and password required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { empId },
    });

    if (!user) {
      await writeAuthAudit({
        event: 'LOGIN_FAILED',
        emailAttempted: empId,
        reason: 'USER_NOT_FOUND',
        ...client,
      });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    if (user.disabled) {
      await writeAuthAudit({
        event: 'LOGIN_FAILED',
        userId: user.id,
        emailAttempted: empId,
        reason: 'BLOCKED',
        ...client,
      });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      await writeAuthAudit({
        event: 'LOGIN_FAILED',
        userId: user.id,
        emailAttempted: empId,
        reason: 'INVALID_PASSWORD',
        ...client,
      });
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    await writeAuthAudit({
      event: 'LOGIN_SUCCESS',
      userId: user.id,
      emailAttempted: empId,
      ...client,
    });

    const cookieStore = await cookies();
    cookieStore.set(setSessionCookie(user.id));

    return NextResponse.json({
      ok: true,
      empId: user.empId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
