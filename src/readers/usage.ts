import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectConfig } from '../config/loadConfig.ts';
import { USAGE_READERS } from '../metrics/usage/index.ts';
import { mergeBreakdowns, type AgentUsage, type ModelBreakdown } from '../metrics/usage/types.ts';
import type { Multipliers } from '../metrics/modelStats.ts';

export interface UsageReport {
  multipliers: Multipliers;
  /** Per agent: usage per project and the merged per-model rows. */
  agents: Record<string, { projects: Record<string, AgentUsage>; breakdown: ModelBreakdown[] }>;
}

/** Real usage of every agent with a reader, in every configured project. Read-only. */
export async function readUsage(projects: ProjectConfig[], multipliers: Multipliers): Promise<UsageReport> {
  const agents: UsageReport['agents'] = {};
  for (const [agent, read] of Object.entries(USAGE_READERS)) {
    const per: Record<string, AgentUsage> = {};
    for (const p of projects) {
      const u = await read(p.path);
      if (u.breakdown.length) per[p.name] = u;
    }
    agents[agent] = { projects: per, breakdown: mergeBreakdowns(Object.values(per).map((u) => u.breakdown)) };
  }
  return { multipliers, agents };
}

/** The fictional example ships its usage as a file (examples/data/usage.json). */
export function readExampleUsage(dataDir: string): UsageReport {
  const path = join(dataDir, 'usage.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : { multipliers: {}, agents: {} };
}
