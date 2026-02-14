import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_DEPLOY_STATE_DIR = '/home/deploy/.deploy';

export async function GET() {
  const deployStateDir = process.env.DEPLOY_STATE_DIR ?? DEFAULT_DEPLOY_STATE_DIR;
  const currentPath = join(deployStateDir, 'team-monitor_current.json');
  const root = process.cwd();
  const pkgPath = join(root, 'package.json');

  if (existsSync(currentPath)) {
    try {
      const data = JSON.parse(readFileSync(currentPath, 'utf8'));
      return NextResponse.json({
        appName: data.appName ?? null,
        packageVersion: data.packageVersion ?? null,
        gitSha: data.gitSha ?? null,
        gitShaShort: data.gitShaShort ?? null,
        deployedAt: data.deployedAt ?? null,
        branch: data.branch ?? null,
        version: data.packageVersion ? `v${data.packageVersion}` : null,
      });
    } catch {
      // fall through to fallback
    }
  }

  // Fallback: package.json + git if available
  let packageVersion = '0.0.0';
  let gitSha: string | null = null;
  let gitShaShort: string | null = null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    packageVersion = pkg?.version ?? '0.0.0';
  } catch {
    // keep default
  }
  try {
    gitSha = execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: root }).trim();
    gitShaShort = execSync('git rev-parse --short HEAD', { encoding: 'utf8', cwd: root }).trim();
  } catch {
    // not in git or git unavailable
  }

  return NextResponse.json({
    appName: 'team-monitor',
    packageVersion,
    gitSha,
    gitShaShort,
    deployedAt: null,
    branch: null,
    version: `v${packageVersion}`,
  });
}
