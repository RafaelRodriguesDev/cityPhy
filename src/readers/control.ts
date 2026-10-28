import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MemoryStore } from '../memory/store.ts';

/** How much of each agent's work in a project went through cityPhy: old sessions imported, sessions captured live. */
export type ProjectControl = Record<string, { imported: number; live: number; firstLive: string | null }>;

/** Reads `<dataDir>/<project>/cityphy/memory.db` (read-only); empty when the project has no memory. */
export function readControl(dataDir: string, projectName: string): ProjectControl {
  const dir = join(dataDir, projectName, 'cityphy');
  if (!MemoryStore.exists(dir)) return {};
  const store = new MemoryStore(dir, true);
  try {
    return store.sessionOrigins();
  } finally {
    store.close();
  }
}

/** The fictional example ships its control numbers as a file (examples/data/control.json). */
export function readExampleControl(dataDir: string): Record<string, ProjectControl> {
  const path = join(dataDir, 'control.json');
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
}
