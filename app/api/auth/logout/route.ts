import { NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(clearSessionCookie());
  return NextResponse.json({ ok: true });
}
