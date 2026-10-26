import type { ProjectConfig } from '../config/loadConfig.ts';
import { relativeToProject } from './paths.ts';

/**
 * Observations name files the way graphify names `source_file` (relative to the project root,
 * forward slashes), so a memory entry points at the same graph nodes `graphify query` returns.
 * Files outside the project are dropped.
 */
export function linkFiles(project: ProjectConfig, paths: Array<string | undefined>): string[] {
  const out = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    const rel = relativeToProject(project, p);
    if (rel) out.add(rel);
  }
  return [...out];
}
