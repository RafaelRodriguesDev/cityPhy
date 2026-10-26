import { fileStats, isDir, join, listDir, readText } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import { addSkillsList, skillsListId } from './groundFloor.ts';
import type { AntigravityProjectSources } from './sources.ts';

function frontmatter(text: string): string {
  return /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
}

export interface Skill {
  id: string;
  listingBytes: number;
}

function addSkillsIn(t: TowerBuilder, root: string, scope: string, project: string | null): Skill[] {
  const out: Skill[] = [];
  for (const name of listDir(root)) {
    if (!isDir(join(root, name))) continue;
    const path = join(root, name, 'SKILL.md');
    const s = fileStats(path);
    const text = readText(path);
    if (!s || text === null) continue;
    const id = `antigravity.skills.${scope}.${name}`;
    if (!t.has(id)) {
      t.addFloor({
        id,
        label: name,
        section: 'skills',
        load: 'on-demand',
        sourceFile: path,
        bytes: s.bytes,
        updatedAt: s.updatedAt,
        project,
      });
    }
    out.push({ id, listingBytes: Buffer.byteLength(frontmatter(text), 'utf8') });
  }
  return out;
}

/** Global skills: builtin and user-configured skills in ~/.gemini. */
export function addGlobalSkills(t: TowerBuilder, home: string): Skill[] {
  const builtin = addSkillsIn(t, join(home, 'antigravity', 'builtin', 'skills'), 'builtin', null);
  const config = addSkillsIn(t, join(home, 'config', 'skills'), 'config', null);
  return [...builtin, ...config];
}

/** Project skills (e.g. <project>/.agents/skills) + project skills list linked to ground floor. */
export function addProjectSkills(t: TowerBuilder, p: AntigravityProjectSources, global: Skill[]): void {
  const own = addSkillsIn(t, p.agentsSkillsDir, p.key, p.path);
  const all = [...global, ...own];
  addSkillsList(t, p, all.reduce((sum, s) => sum + s.listingBytes, 0));
  for (const s of all) t.link(skillsListId(p), s.id, 'lists');
}
