import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { TowerGraph } from '../towers/schema.ts';

/** Every agent tower found in <dataDir>/torre-<agent>/graphify-out/graph.json. Read-only. */
export function readTowers(dataDir: string): TowerGraph[] {
  if (!existsSync(dataDir)) return [];
  const towers: TowerGraph[] = [];
  for (const dir of readdirSync(dataDir).filter((d) => d.startsWith('torre-')).sort()) {
    const path = join(dataDir, dir, 'graphify-out', 'graph.json');
    if (!existsSync(path)) continue;
    try {
      const graph = JSON.parse(readFileSync(path, 'utf8')) as TowerGraph;
      if (graph.graph?.cityphy?.kind === 'agent-tower') towers.push(graph);
    } catch {
      // a tower being rewritten right now: skip it, the next request picks it up
    }
  }
  return towers;
}
