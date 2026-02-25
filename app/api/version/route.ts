import { NextResponse } from 'next/server';
import { APP_VERSION, GIT_HASH, BUILD_DATE, getEnvironment } from '@/lib/version';

export const dynamic = 'force-dynamic';

/** Public: returns build metadata. No secrets. */
export async function GET() {
  return NextResponse.json({
    appVersion: APP_VERSION,
    gitHash: GIT_HASH,
    buildDate: BUILD_DATE,
    environment: getEnvironment(),
  });
}
