import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { agentWorkspaces } from '../config/groups.ts';
import { claudeWork } from '../metrics/work/claudeWork.ts';
import { codexWork } from '../metrics/work/codexWork.ts';
import type { AgentWork, WorkReport } from '../metrics/work/types.ts';

const READERS: Record<string, (path: string) => Promise<AgentWork>> = { claude: claudeWork, codex: codexWork };

/** Conversations of every agent with a work reader, per configured project (a group is read once at its root). Read-only. */
export async function readWork(config: CityphyConfig): Promise<WorkReport> {
  const out: WorkReport = {};
  for (const p of agentWorkspaces(config.projects)) {
    const agents: AgentWork[] = [];
    for (const read of Object.values(READERS)) {
      const w = await read(p.path);
      if (w.sessions.length) agents.push(w);
    }
    out[p.name] = agents;
  }
  return out;
}

/** The fictional example ships its conversations as a file (examples/data/work.json). */
export function readExampleWork(dataDir: string): WorkReport {
  const path = join(dataDir, 'work.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
