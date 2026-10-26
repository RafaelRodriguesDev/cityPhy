import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, type ProjectConfig } from '../config/loadConfig.ts';

const START = '<!-- cityphy:start -->';
const END = '<!-- cityphy:end -->';
const CLAUDE_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop', 'SessionEnd'];

/** `node "<cityPhy>/bin/cityphy.ts"` with forward slashes (works in every shell). */
export const cli = () => `node "${join(REPO_ROOT, 'bin', 'cityphy.ts').replace(/\\/g, '/')}"`;

/** The short block every agent reads in the project's AGENTS.md. Kept small: it is paid every session. */
export function rulesBlock(project: ProjectConfig): string {
  const c = cli();
  const p = `--project ${project.name}`;
  return [
    START,
    '## cityPhy: grafo e memória locais',
    `- Antes de ler código: \`${c} query "<pergunta>" ${p} --agent <sua-ia>\`; leia só os arquivos que ele apontar.`,
    `- Para lembrar trabalho anterior: \`${c} mem search "<termos>" ${p}\`.`,
    `- Se você não tem hook do cityPhy: ao terminar algo importante, \`${c} mem save --note "<feito/decidido>" ${p} --agent <sua-ia>\`.`,
    `- Depois de mudar código: \`${c} refresh\`. Não rode \`graphify update .\` nem \`/graphify .\` aqui: os grafos ficam fora do projeto.`,
    `- IA nova neste projeto: pergunte à pessoa o que ligar e rode \`${c} setup ${p} --agent <sua-ia> --answers graph=sim,memory=sim,inject=sim,metrics=sim\`.`,
    END,
  ].join('\n');
}

/** Writes or replaces the cityPhy block in AGENTS.md (everything outside the markers is kept). */
export function writeRulesBlock(project: ProjectConfig): string {
  const path = join(project.path, 'AGENTS.md');
  const current = existsSync(path) ? readFileSync(path, 'utf8') : '';
  const block = rulesBlock(project);
  const re = new RegExp(`${START}[\\s\\S]*?${END}`);
  const next = re.test(current) ? current.replace(re, block) : `${current.trimEnd()}${current ? '\n\n' : ''}${block}\n`;
  writeFileSync(path, next, 'utf8');
  return path;
}

/** Claude Code hooks in the project's `.claude/settings.local.json` (personal, not committed). Idempotent. */
export function writeClaudeHooks(project: ProjectConfig): string {
  const dir = join(project.path, '.claude');
  const path = join(dir, 'settings.local.json');
  const settings = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : {};
  const command = `${cli()} hook claude`;
  settings.hooks ??= {};
  for (const event of CLAUDE_EVENTS) {
    const list: Array<{ matcher?: string; hooks: Array<{ type: string; command: string }> }> = (settings.hooks[event] ??= []);
    const has = list.some((g) => g.hooks?.some((h) => h.command.includes('cityphy.ts') && h.command.includes('hook claude')));
    if (!has) list.push({ ...(event === 'PostToolUse' ? { matcher: '*' } : {}), hooks: [{ type: 'command', command }] });
  }
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf8');
  return path;
}

/** True when the project's Claude settings already call the cityPhy hook. */
export function hasClaudeHooks(project: ProjectConfig): boolean {
  const path = join(project.path, '.claude', 'settings.local.json');
  return existsSync(path) && readFileSync(path, 'utf8').includes('hook claude') && readFileSync(path, 'utf8').includes('cityphy.ts');
}
