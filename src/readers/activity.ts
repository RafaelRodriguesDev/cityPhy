import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { agentWorkspaces } from '../config/groups.ts';
import { ACTIVITY_READERS } from '../metrics/activity/index.ts';
import { DEFAULT_ACTIVE_MINUTES, type ActivityReport } from '../metrics/activity/types.ts';

/** Last activity of every tool in every workspace (project or group root). Read-only, file dates only. */
export async function readActivity(config: CityphyConfig): Promise<ActivityReport> {
  const agents: ActivityReport['agents'] = {};
  for (const [agent, read] of Object.entries(ACTIVITY_READERS)) {
    const per: Record<string, string> = {};
    for (const w of agentWorkspaces(config.projects)) {
      const last = await read(w.path);
      if (last) per[w.name] = last;
    }
    agents[agent] = per;
  }
  return { windowMinutes: config.activeWindowMinutes ?? DEFAULT_ACTIVE_MINUTES, generatedAt: new Date().toISOString(), agents };
}

/**
 * The fictional example ships "minutes ago" per tool and project (examples/data/activity.json),
 * turned into dates now so some cables are always lit in the demo.
 */
export function readExampleActivity(dataDir: string): ActivityReport {
  const path = join(dataDir, 'activity.json');
  const now = Date.now();
  const raw: Record<string, Record<string, number>> = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const agents: ActivityReport['agents'] = {};
  for (const [agent, per] of Object.entries(raw)) {
    agents[agent] = Object.fromEntries(Object.entries(per).map(([p, min]) => [p, new Date(now - min * 60_000).toISOString()]));
  }
  return { windowMinutes: DEFAULT_ACTIVE_MINUTES, generatedAt: new Date(now).toISOString(), agents };
}
