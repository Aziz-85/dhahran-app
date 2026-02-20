import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import type { User, Role } from '@prisma/client';

const SESSION_COOKIE = 'dt_session';
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

export type SessionUser = User & {
  boutiqueId: string;
  employee?: { name: string; language: string } | null;
  boutique?: { id: string; name: string; code: string } | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await prisma.user.findFirst({
    where: { id: token, disabled: false },
    include: {
      employee: { select: { name: true, language: true } },
      boutique: { select: { id: true, name: true, code: true } },
    },
  });
  return user as SessionUser | null;
}

export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError('UNAUTHORIZED');
  }
  return user;
}

export async function requireRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    throw new AuthError('FORBIDDEN');
  }
  return user;
}

export function setSessionCookie(userId: string) {
  return {
    name: SESSION_COOKIE,
    value: userId,
    ...COOKIE_OPTIONS,
  };
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    ...COOKIE_OPTIONS,
    maxAge: 0,
  };
}

export class AuthError extends Error {
  constructor(public code: 'UNAUTHORIZED' | 'FORBIDDEN') {
    super(code);
    this.name = 'AuthError';
  }
}
