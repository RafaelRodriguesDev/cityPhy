import { createHash } from 'node:crypto';
import { homedir } from 'node:os';
import { basename, dirname, relative } from 'node:path';
import { realpathSync, readdirSync } from 'node:fs';
import { fileStats, isDir, join, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import { addSkillsList, skillsListId } from './groundFloor.ts';
import type { CodexProjectSources } from './sources.ts';

function frontmatter(text: string): string {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
}

export interface Skill {
  id: string;
  listingBytes: number;
  sourceFile: string;
}

function canonical(path: string): string {
  try {
    return realpathSync(path).replace(/\\/g, '/').toLowerCase();
  } catch {
    return path.replace(/\\/g, '/').toLowerCase();
  }
}

function skillFiles(root: string): string[] {
  const out: string[] = [];
  const visited = new Set<string>();
  const walk = (dir: string): void => {
    const real = canonical(dir);
    if (visited.has(real)) return;
    visited.add(real);
    let entries: import('node:fs').Dirent[] = [];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.isFile() && entry.name.toLowerCase() === 'skill.md') out.push(path);
      else if (entry.isDirectory() || isDir(path)) walk(path);
    }
  };
  if (isDir(root)) walk(root);
  return out.sort();
}

function stableId(scope: string, root: string, path: string): string {
  const rel = relative(root, dirname(path)).replace(/\\/g, '/').toLowerCase();
  const hash = createHash('sha1').update(`${scope}:${rel}`).digest('hex').slice(0, 12);
  return `codex.skills.${scope}.${hash}`;
}

function addSkillsIn(t: TowerBuilder, root: string, scope: string, project: string | null, seen: Set<string>): Skill[] {
  const out: Skill[] = [];
  for (const path of skillFiles(root)) {
    const source = canonical(path);
    if (seen.has(source)) continue;
    const s = fileStats(path);
    const text = readText(path);
    if (!s || text === null) continue;
    seen.add(source);
    const id = stableId(scope, root, path);
    t.addFloor({
      id,
      label: basename(dirname(path)),
      section: 'skills',
      load: 'on-demand',
      sourceFile: path,
      bytes: s.bytes,
      updatedAt: s.updatedAt,
      project,
    });
    out.push({ id, sourceFile: source, listingBytes: Buffer.byteLength(frontmatter(text), 'utf8') });
  }
  return out;
}

/** User, shared and plugin skills exposed by the Codex desktop app. */
export function addGlobalSkills(t: TowerBuilder, home: string): Skill[] {
  const seen = new Set<string>();
  return [
    ...addSkillsIn(t, join(home, 'skills'), 'codex', null, seen),
    ...addSkillsIn(t, join(homedir(), '.agents', 'skills'), 'agents', null, seen),
    ...addSkillsIn(t, join(home, 'plugins', 'cache'), 'plugins', null, seen),
  ];
}

/** Project skills plus the always-loaded listing that names global and local skills. */
export function addProjectSkills(t: TowerBuilder, p: CodexProjectSources, global: Skill[]): void {
  const seen = new Set(global.map((s) => s.sourceFile));
  const own = [
    ...addSkillsIn(t, p.codexSkillsDir, `${p.key}.codex`, p.path, seen),
    ...addSkillsIn(t, p.agentsSkillsDir, `${p.key}.agents`, p.path, seen),
  ];
  const all = [...global, ...own];
  addSkillsList(t, p, all.reduce((sum, skill) => sum + skill.listingBytes, 0));
  for (const skill of all) t.link(skillsListId(p), skill.id, 'lists');
}

