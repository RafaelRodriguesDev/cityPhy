import { join } from 'node:path';
import type { CityphyConfig, ProjectConfig } from '../config/loadConfig.ts';

const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/** `<dataDir>/<project>/cityphy`: memory, options and metrics of one project. */
export function projectDir(config: CityphyConfig, project: ProjectConfig): string {
  return join(config.dataDir, project.name, 'cityphy');
}

/** graphify graph of the project. */
export function projectGraph(config: CityphyConfig, project: ProjectConfig): string {
  return join(config.dataDir, project.name, 'graphify-out', 'graph.json');
}

/** Project by name, or the one whose folder contains `cwd` (deepest match wins). */
export function findProject(config: CityphyConfig, nameOrCwd: string): ProjectConfig | null {
  const byName = config.projects.find((p) => p.name.toLowerCase() === nameOrCwd.toLowerCase());
  if (byName) return byName;
  const target = norm(nameOrCwd);
  const matches = config.projects.filter((p) => target === norm(p.path) || target.startsWith(norm(p.path) + '/'));
  return matches.sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

/** Path relative to the project root with forward slashes (how graphify names source files). */
export function relativeToProject(project: ProjectConfig, file: string): string | null {
  const f = norm(file);
  const root = norm(project.path);
  if (!f.startsWith(root + '/')) return null;
  return file.replace(/\\/g, '/').slice(root.length + 1);
}
