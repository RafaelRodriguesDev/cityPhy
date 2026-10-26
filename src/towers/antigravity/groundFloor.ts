import { fileStats, join } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { AntigravityProjectSources } from './sources.ts';

export const BUILT_IN_ID = 'antigravity.ground.built-in';
export const skillsListId = (p: AntigravityProjectSources) => `antigravity.ground.${p.key}.skills-list`;

/** Ground floor shared by every project: built-in instructions/tools and global config. */
export function addGlobalGround(t: TowerBuilder, home: string): void {
  // Built-in system prompt, persona and tool definitions are not files on disk: size unknown.
  t.addFloor({
    id: BUILT_IN_ID,
    label: 'Regras do app e ferramentas',
    section: 'ground',
    load: 'always',
    sourceFile: '(embutido no Antigravity)',
    bytes: null,
  });

  const configPath = join(home, 'config', 'config.json');
  const s = fileStats(configPath);
  if (s) {
    t.addFloor({
      id: 'antigravity.ground.global-config',
      label: 'Configuração global · Antigravity',
      section: 'ground',
      load: 'always',
      sourceFile: configPath,
      bytes: s.bytes,
      updatedAt: s.updatedAt,
    });
  }
}

/** Ground floor of one project: what Antigravity loads at the start of every session there. */
export function addProjectGround(t: TowerBuilder, p: AntigravityProjectSources): void {
  const agentsPath = join(p.path, 'AGENTS.md');
  const s = fileStats(agentsPath);
  if (s) {
    t.addFloor({
      id: `antigravity.ground.${p.key}.agents-md`,
      label: `AGENTS.md · ${p.name}`,
      section: 'ground',
      load: 'always',
      sourceFile: agentsPath,
      bytes: s.bytes,
      updatedAt: s.updatedAt,
      project: p.path,
    });
  }
}

/** The skills listing is loaded in every session of the project. */
export function addSkillsList(t: TowerBuilder, p: AntigravityProjectSources, listingBytes: number): void {
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
