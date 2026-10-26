import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CityphyConfig } from '../config/loadConfig.ts';
import { CONSUMPTION_READERS } from '../metrics/consumption/index.ts';
import type { ToolConsumption } from '../metrics/consumption/types.ts';

/** Consumption of every tool with a reader, with the limits from the local config. Read-only. */
export async function readConsumption(config: CityphyConfig): Promise<ToolConsumption[]> {
  const out: ToolConsumption[] = [];
  for (const [agent, read] of Object.entries(CONSUMPTION_READERS)) {
    const l = config.tools?.[agent] ?? {};
    const c = await read({ daily: l.dailyLimit ?? null, weekly: l.weeklyLimit ?? null });
    if (c.week.calls > 0 || c.windows.length) out.push(c);
  }
  return out;
}

/** The fictional example ships its consumption as a file (examples/data/consumption.json). */
export function readExampleConsumption(dataDir: string): ToolConsumption[] {
  const path = join(dataDir, 'consumption.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
}
