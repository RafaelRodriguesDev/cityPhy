import { fileStats, isDir, join, listDir, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import { addSkillsList, skillsListId } from './groundFloor.ts';
import type { ClaudeProjectSources } from './sources.ts';

/** The part of a SKILL.md that goes into the always-loaded listing: its frontmatter. */
function frontmatter(text: string): string {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
}

interface Skill {
  id: string;
  listingBytes: number;
}

/** One floor per SKILL.md under `root`; returns what each adds to the listing. */
function addSkillsIn(t: TowerBuilder, root: string, scope: string, project: string | null): Skill[] {
  const out: Skill[] = [];
  for (const name of listDir(root)) {
    if (!isDir(join(root, name))) continue;
    const path = join(root, name, 'SKILL.md');
    const s = fileStats(path);
    const text = readText(path);
    if (!s || text === null) continue;
    const id = `claude.skills.${scope}.${name}`;
    t.addFloor({ id, label: name, section: 'skills', load: 'on-demand', sourceFile: path, bytes: s.bytes, updatedAt: s.updatedAt, project });
    out.push({ id, listingBytes: Buffer.byteLength(frontmatter(text), 'utf8') });
  }
  return out;
}

/** Global skills (once). Plugin skills are not counted yet. */
export function addGlobalSkills(t: TowerBuilder, home: string): Skill[] {
  return addSkillsIn(t, join(home, 'skills'), 'global', null);
}

/**
 * Project skills plus the project's skills listing on the ground floor: the listing names the
 * global skills and this project's own, and is paid in every session there.
 */
export function addProjectSkills(t: TowerBuilder, p: ClaudeProjectSources, global: Skill[]): void {
  const own = addSkillsIn(t, join(p.path, '.claude', 'skills'), p.key, p.path);
  const all = [...global, ...own];
  addSkillsList(t, p, all.reduce((sum, s) => sum + s.listingBytes, 0));
  for (const s of all) t.link(skillsListId(p), s.id, 'lists');
}
