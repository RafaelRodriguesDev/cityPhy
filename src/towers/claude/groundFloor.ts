import { fileStats, join } from '../fileStats.ts';
import type { TowerBuilder } from '../towerBuilder.ts';
import type { ClaudeProjectSources } from './sources.ts';

export const BUILT_IN_ID = 'claude.ground.built-in';
export const memoryIndexId = (p: ClaudeProjectSources) => `claude.ground.${p.key}.memory-index`;
export const skillsListId = (p: ClaudeProjectSources) => `claude.ground.${p.key}.skills-list`;

/** Ground floor shared by every project: the app's rules and the global CLAUDE.md. */
export function addGlobalGround(t: TowerBuilder, home: string): void {
  // The app's own system prompt and tool definitions are not files on disk: size unknown.
  t.addFloor({ id: BUILT_IN_ID, label: 'Regras do app e ferramentas', section: 'ground', load: 'always', sourceFile: '(embutido no Claude Code)', bytes: null });
  const path = join(home, 'CLAUDE.md');
  const s = fileStats(path);
  if (s) t.addFloor({ id: 'claude.ground.global-claude-md', label: 'CLAUDE.md global', section: 'ground', load: 'always', sourceFile: path, bytes: s.bytes, updatedAt: s.updatedAt });
}

/** Ground floor of one project: what Claude Code loads at the start of every session there. */
export function addProjectGround(t: TowerBuilder, p: ClaudeProjectSources): void {
  const files: Array<[id: string, label: string, path: string]> = [
    [`claude.ground.${p.key}.claude-md`, `CLAUDE.md · ${p.name}`, join(p.path, 'CLAUDE.md')],
    [`claude.ground.${p.key}.agents-md`, `AGENTS.md · ${p.name}`, join(p.path, 'AGENTS.md')],
    [memoryIndexId(p), `Índice da memória · ${p.name}`, join(p.memoryDir, 'MEMORY.md')],
  ];
  for (const [id, label, path] of files) {
    const s = fileStats(path);
    if (!s) continue;
    t.addFloor({ id, label, section: 'ground', load: 'always', sourceFile: path, bytes: s.bytes, updatedAt: s.updatedAt, project: p.path });
  }
}

/** The skills listing (name + description of each skill) is loaded in every session of the project. */
export function addSkillsList(t: TowerBuilder, p: ClaudeProjectSources, listingBytes: number): void {
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
