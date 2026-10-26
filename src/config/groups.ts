// Project groups (monorepos): pure helpers, also used by the page.
import type { ProjectConfig } from './loadConfig.ts';

export interface ProjectGroup {
  name: string;
  path: string;
  members: ProjectConfig[];
}

const norm = (s: string) => s.replace(/[\\/]+/g, '/').replace(/\/$/, '').toLowerCase();
export const samePathish = (a: string, b: string) => norm(a) === norm(b);

/** Unique groups of the configured projects, in config order. */
export function groupsOf(projects: ProjectConfig[]): ProjectGroup[] {
  const out = new Map<string, ProjectGroup>();
  for (const p of projects) {
    if (!p.group) continue;
    const key = norm(p.group.path);
    const g = out.get(key) ?? { name: p.group.name, path: p.group.path, members: [] };
    g.members.push(p);
    out.set(key, g);
  }
  return [...out.values()];
}

/**
 * What the agents actually open: projects without a group, plus each group root (once). Towers,
 * usage and memory of a monorepo live at its root.
 */
export function agentWorkspaces(projects: ProjectConfig[]): ProjectConfig[] {
  return [...projects.filter((p) => !p.group), ...groupsOf(projects).map((g) => ({ name: g.name, path: g.path }))];
}
