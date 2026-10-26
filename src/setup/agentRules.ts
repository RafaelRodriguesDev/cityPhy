import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO_ROOT, type ProjectConfig } from '../config/loadConfig.ts';

// cityPhy never writes inside a project. Each agent gets a global skill (all three read their
// skills folder in every session) and Claude Code also gets global hooks. The project list lives
// only in cityphy.config.json; the hook and the commands find the project from the current folder.

const START = '<!-- cityphy:start -->';
const END = '<!-- cityphy:end -->';
const CLAUDE_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'SessionEnd'];

/** `node "<cityPhy>/bin/cityphy.ts"` with forward slashes (works in every shell). */
export const cli = () => `node "${join(REPO_ROOT, 'bin', 'cityphy.ts').replace(/\\/g, '/')}"`;

/** Where each agent reads its global skills. */
export const SKILL_FILES: Record<string, string> = {
  claude: join(homedir(), '.claude', 'skills', 'cityphy', 'SKILL.md'),
  codex: join(homedir(), '.codex', 'skills', 'cityphy', 'SKILL.md'),
  antigravity: join(homedir(), '.gemini', 'config', 'skills', 'cityphy', 'SKILL.md'),
};
export const CLAUDE_SETTINGS = join(homedir(), '.claude', 'settings.json');

/** The global skill. Only the frontmatter is loaded every session, so the description stays short. */
export function skillContent(agent: string): string {
  const c = cli();
  return [
    '---',
    'name: cityphy',
    'description: Use em toda tarefa de código numa pasta registrada no cityPhy (grafo, memória e métrica de tokens locais). Rode `cityphy context` para saber se a pasta está registrada.',
    '---',
    '',
    '# cityPhy',
    '',
    `1. No início: \`${c} context\`. Se responder "projeto não encontrado", ignore esta skill.`,
    `2. Antes de ler código: \`${c} query "<nomes de classes/funções>" --agent ${agent}\`; leia só os arquivos que ele apontar.`,
    `3. Para lembrar trabalho anterior: \`${c} mem search "<termos>"\`.`,
    `4. Ao terminar algo importante (se você não tem hook do cityPhy): \`${c} mem save --note "<feito/decidido>" --agent ${agent}\`.`,
    `5. Depois de mudar código: \`${c} refresh\`. Não rode \`graphify update .\` nem \`/graphify .\` dentro do projeto.`,
    `6. Projeto novo ou IA nova: pergunte à pessoa o que ligar e rode \`${c} setup --project <nome> --agent ${agent} --answers graph=sim,memory=sim,inject=sim,metrics=sim\`.`,
    '',
    'O projeto é descoberto pela pasta atual; não escreva nada do cityPhy dentro do projeto.',
    '',
  ].join('\n');
}

export function writeSkill(agent: string): string {
  const path = SKILL_FILES[agent];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, skillContent(agent), 'utf8');
  return path;
}

const isCityphyHook = (h: { command?: string }) => !!h.command && h.command.includes('cityphy.ts') && h.command.includes('hook claude');
type HookGroup = { matcher?: string; hooks: Array<{ type: string; command: string }> };

/** Claude Code hooks in ~/.claude/settings.json. Keeps every other setting. Idempotent. */
export function writeClaudeGlobalHooks(): string {
  const settings = existsSync(CLAUDE_SETTINGS) ? JSON.parse(readFileSync(CLAUDE_SETTINGS, 'utf8')) : {};
  settings.hooks ??= {};
  for (const event of CLAUDE_EVENTS) {
    const list: HookGroup[] = (settings.hooks[event] ??= []);
    if (!list.some((g) => g.hooks?.some(isCityphyHook))) {
      list.push({ ...(event === 'PostToolUse' ? { matcher: '*' } : {}), hooks: [{ type: 'command', command: `${cli()} hook claude` }] });
    }
  }
  mkdirSync(dirname(CLAUDE_SETTINGS), { recursive: true });
  writeFileSync(CLAUDE_SETTINGS, JSON.stringify(settings, null, 2), 'utf8');
  return CLAUDE_SETTINGS;
}

export function hasClaudeGlobalHooks(): boolean {
  return existsSync(CLAUDE_SETTINGS) && readFileSync(CLAUDE_SETTINGS, 'utf8').includes('hook claude');
}

// --- cleanup of what older versions wrote inside projects ---

/** Old versions wrote a block into the project's AGENTS.md; this removes it (and the file, if only the block was there). */
export function removeProjectRules(project: ProjectConfig): string | null {
  const path = join(project.path, 'AGENTS.md');
  if (!existsSync(path)) return null;
  const text = readFileSync(path, 'utf8');
  const re = new RegExp(`\\n*${START}[\\s\\S]*?${END}\\n?`);
  if (!re.test(text)) return null;
  const next = text.replace(re, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (next) writeFileSync(path, `${next}\n`, 'utf8');
  else rmSync(path);
  return path;
}

/** Old versions put the hooks in <project>/.claude/settings.local.json; this removes them (and the file, if empty). */
export function removeProjectClaudeHooks(project: ProjectConfig): string | null {
  const path = join(project.path, '.claude', 'settings.local.json');
  if (!existsSync(path)) return null;
  const settings = JSON.parse(readFileSync(path, 'utf8'));
  if (!settings.hooks || !JSON.stringify(settings.hooks).includes('hook claude')) return null;
  for (const event of Object.keys(settings.hooks)) {
    settings.hooks[event] = (settings.hooks[event] as HookGroup[])
      .map((g) => ({ ...g, hooks: g.hooks.filter((h) => !isCityphyHook(h)) }))
      .filter((g) => g.hooks.length);
    if (!settings.hooks[event].length) delete settings.hooks[event];
  }
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  if (Object.keys(settings).length) writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
  else rmSync(path);
  return path;
}
