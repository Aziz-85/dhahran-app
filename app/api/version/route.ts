import { NextResponse } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  const root = process.cwd();
  const versionPath = join(root, 'VERSION');
  const pkgPath = join(root, 'package.json');

  let version = '';
  let packageVersion = '';
  let gitSha = '';

  try {
    version = readFileSync(versionPath, 'utf8').trim();
    const parts = version.split('+');
    if (parts.length >= 2) {
      packageVersion = parts[0];
      gitSha = parts.slice(1).join('+');
    } else {
      packageVersion = version;
    }
  } catch {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      packageVersion = pkg?.version ?? '';
      version = packageVersion;
    } catch {
      version = '0.0.0';
      packageVersion = '0.0.0';
    }
  }

  const deployedAt = process.env.DEPLOYED_AT ?? null;

  return NextResponse.json({
    version,
    packageVersion,
    gitSha: gitSha || null,
    deployedAt,
  });
}
