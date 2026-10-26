import { join } from 'node:path';
import type { CityphyConfig, ProjectConfig } from '../config/loadConfig.ts';
import { agentWorkspaces, groupsOf } from '../config/groups.ts';

const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();

/** `<dataDir>/<project>/cityphy`: memory, options and metrics of one project. */
export function projectDir(config: CityphyConfig, project: ProjectConfig): string {
  return join(config.dataDir, project.name, 'cityphy');
}

/** graphify graph of the project. */
export function projectGraph(config: CityphyConfig, project: ProjectConfig): string {
  return join(config.dataDir, project.name, 'graphify-out', 'graph.json');
}

/**
 * Project by name, or the one whose folder contains `cwd` (deepest match wins). A folder inside a
 * group root but outside every member (e.g. the monorepo root itself) resolves to the group, which
 * then works as a project for memory, hooks and context (it has no graph of its own).
 */
export function findProject(config: CityphyConfig, nameOrCwd: string): ProjectConfig | null {
  const all = agentWorkspaces(config.projects).filter((w) => !config.projects.includes(w));
  const candidates = [...config.projects, ...all];
  const byName = candidates.find((p) => p.name.toLowerCase() === nameOrCwd.toLowerCase());
  if (byName) return byName;
  const target = norm(nameOrCwd);
  const matches = candidates.filter((p) => target === norm(p.path) || target.startsWith(norm(p.path) + '/'));
  return matches.sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}

/** Members of a group project (empty for a normal project). */
export function groupMembers(config: CityphyConfig, project: ProjectConfig): ProjectConfig[] {
  return groupsOf(config.projects).find((g) => norm(g.path) === norm(project.path))?.members ?? [];
}

/** Path relative to the project root with forward slashes (how graphify names source files). */
export function relativeToProject(project: ProjectConfig, file: string): string | null {
  const f = norm(file);
  const root = norm(project.path);
  if (!f.startsWith(root + '/')) return null;
  return file.replace(/\\/g, '/').slice(root.length + 1);
}
