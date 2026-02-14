import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DEFAULT_DEPLOY_STATE_DIR = '/home/deploy/.deploy';

export type DeployedInfo = {
  packageVersion: string;
  gitShaShort: string;
  deployedAt: string | null;
};

export function getDeployedInfo(): DeployedInfo | null {
  try {
    const deployStateDir = process.env.DEPLOY_STATE_DIR ?? DEFAULT_DEPLOY_STATE_DIR;
    const p = join(deployStateDir, 'team-monitor_current.json');
    if (!existsSync(p)) return null;
    const data = JSON.parse(readFileSync(p, 'utf8'));
    const packageVersion = data?.packageVersion ?? '0.0.0';
    const gitShaShort = data?.gitShaShort ?? '';
    const deployedAt = data?.deployedAt ?? null;
    return { packageVersion, gitShaShort, deployedAt };
  } catch {
    return null;
  }
}
