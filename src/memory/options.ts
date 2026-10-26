import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_OPTIONS, type ProjectOptions } from './schema.ts';

const file = (dir: string) => join(dir, 'project.json');

/** Options of a project; everything off until someone answers the setup questions. */
export function readOptions(dir: string): ProjectOptions {
  if (!existsSync(file(dir))) return { ...DEFAULT_OPTIONS };
  try {
    return { ...DEFAULT_OPTIONS, ...JSON.parse(readFileSync(file(dir), 'utf8')) };
  } catch {
    return { ...DEFAULT_OPTIONS };
  }
}

export function writeOptions(dir: string, options: ProjectOptions): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(file(dir), JSON.stringify(options, null, 2), 'utf8');
}
