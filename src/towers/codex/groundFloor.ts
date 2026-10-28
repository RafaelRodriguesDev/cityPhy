import { fileStats, join } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { CodexProjectSources } from './sources.ts';

export const BUILT_IN_ID = 'codex.ground.built-in';
export const skillsListId = (p: CodexProjectSources) => `codex.ground.${p.key}.skills-list`;

/** Ground floor shared by every project: Codex's built-in rules and global AGENTS.md. */
export function addGlobalGround(t: TowerBuilder, home: string): void {
  t.addFloor({
    id: BUILT_IN_ID,
    label: 'Regras do app e ferramentas',
    section: 'ground',
    load: 'always',
    sourceFile: '(embutido no Codex)',
    bytes: null,
  });

  const path = join(home, 'AGENTS.md');
  const s = fileStats(path);
  if (s) {
    t.addFloor({
      id: 'codex.ground.global-agents-md',
      label: 'AGENTS.md global',
      section: 'ground',
      load: 'always',
      sourceFile: path,
      bytes: s.bytes,
      updatedAt: s.updatedAt,
    });
  }
}

/** The project-root AGENTS.md, loaded for every session in this project. */
export function addProjectGround(t: TowerBuilder, p: CodexProjectSources): void {
  const path = join(p.path, 'AGENTS.md');
  const s = fileStats(path);
  if (!s) return;
  t.addFloor({
    id: `codex.ground.${p.key}.agents-md`,
    label: `AGENTS.md · ${p.name}`,
    section: 'ground',
    load: 'always',
    sourceFile: path,
    bytes: s.bytes,
    updatedAt: s.updatedAt,
    project: p.path,
  });
}

/** The skill name/description listing is loaded in every project session. */
export function addSkillsList(t: TowerBuilder, p: CodexProjectSources, listingBytes: number): void {
  t.addFloor({
    id: skillsListId(p),
    label: `Lista de skills · ${p.name}`,
    section: 'ground',
    load: 'always',
    sourceFile: '(nome e descrição de cada SKILL.md)',
    bytes: listingBytes,
    project: p.path,
  });
}

