import { join } from 'node:path';
import { readLessons } from '../memory/lessons.ts';
import { readOptions } from '../memory/options.ts';
import type { Observation, ProjectOptions } from '../memory/schema.ts';
import { MemoryStore } from '../memory/store.ts';
import { readSavings, type Savings } from '../metrics/savings.ts';

/** What cityPhy knows about a project beyond its graph: options, memory and savings. */
export interface ProjectExtras {
  options: ProjectOptions;
  memory: (ReturnType<MemoryStore['stats']> & { recent: Observation[] }) | null;
  lessonsTokens: number | null;
  savings: Savings;
}

/** Reads `<dataDir>/<project>/cityphy` (read-only). */
export function readProjectExtras(dataDir: string, projectName: string): ProjectExtras {
  const dir = join(dataDir, projectName, 'cityphy');
  let memory: ProjectExtras['memory'] = null;
  if (MemoryStore.exists(dir)) {
    const store = new MemoryStore(dir, true);
    try {
      memory = { ...store.stats(), recent: store.recent(8, ['prompt', 'edit', 'note', 'graph-query']) };
    } finally {
      store.close();
    }
  }
  const lessons = readLessons(dir);
  return { options: readOptions(dir), memory, lessonsTokens: lessons ? Math.round(lessons.length / 4) : null, savings: readSavings(dir) };
}
