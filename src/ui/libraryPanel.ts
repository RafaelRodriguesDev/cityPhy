import { shelvesOf } from '../library/buildLibrary.ts';
import type { Library } from '../library/types.ts';
import { ORIGIN_NAMES } from '../scene/library.ts';
import type { Book } from '../scene/library.ts';
import type { Antenna } from '../scene/radio.ts';
import { type Check, none, showPiece, stat } from './blocks.ts';
import { escapeHtml, formatDate } from './format.ts';
import type { Use } from '../metrics/work/usageIndex.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
type NameOf = (agent: string) => string;
const pill = (text: string, on = false) => `<span class="pill${on ? ' on' : ''}">${escapeHtml(text)}</span>`;

/** A skill (one book): where each copy lives, what it costs and whether the copies agree. */
export function showSkill(panel: HTMLElement, b: Book, nameOf: NameOf, use?: UseInfo): void {
  const s = b.skill;
  const copies = s.copies
    .map(
      (c) =>
        `<li><strong>${escapeHtml(nameOf(c.agent))}</strong> · ${escapeHtml(ORIGIN_NAMES[c.origin])}${c.plugin ? ` (${escapeHtml(c.plugin)})` : ''}${c.project ? ` · ${escapeHtml(c.project)}` : ''}<br><span class="muted-inline">≈ ${n(c.tokensApprox)} tokens · ${formatDate(c.updatedAt)}</span></li>`,
    )
    .join('');
  const checks: Check[] = [];
  if (s.divergent) checks.push({ level: 'warn', text: 'Cópias <b>diferentes</b> com o mesmo nome: cada IA lê uma versão. Unificar numa só pasta resolve.' });
  else if (s.agents.length > 1) checks.push({ level: 'ok', text: `Mesmo texto em ${s.agents.length} IAs.` });
  if (s.agents.length === 1) checks.push({ level: 'info', text: `Só ${escapeHtml(nameOf(s.agents[0]))} enxerga esta skill.` });
  if (s.origin === 'plugin') checks.push({ level: 'info', text: `Veio do plugin <b>${escapeHtml(s.plugin ?? '')}</b>: some se o plugin for desligado.` });
  if (!use) checks.push({ level: 'info', text: 'Uso por sessão ainda não é medido.' });
  else if (!use.use?.total && s.agents.some((a) => use.measured.includes(a))) checks.push({ level: 'info', text: 'Nenhum uso nos registros: talvez nem precise estar instalada.' });

  showPiece(panel, {
    kicker: `Biblioteca · ${b.shelf}`,
    title: s.name,
    badges: [pill(ORIGIN_NAMES[s.origin], true), ...s.agents.map((a) => pill(nameOf(a)))],
    context: `<p>O <b>nome e a descrição</b> entram na lista de skills de toda sessão de ${s.agents.map((a) => escapeHtml(nameOf(a))).join(', ')}.</p>`,
    input: `${stat(`≈ ${n(s.tokensApprox)}`, 'tokens quando a IA abre a skill')}<h4>Cópias (${s.copies.length})</h4><ul class="rows">${copies}</ul>`,
    output: use ? usedHtml(use, nameOf, 'vez(es)') : none('Ainda não medido: quantas vezes cada IA usou esta skill.'),
    checks,
  });
}

/** An MCP server (one antenna): who has it, local or remote, from where. */
export function showMcp(panel: HTMLElement, a: Antenna, nameOf: NameOf, use?: UseInfo): void {
  const m = a.mcp;
  const where = (c: (typeof m.copies)[number]) =>
    c.origin === 'plugin' ? `plugin ${escapeHtml(c.plugin ?? '')}` : c.origin === 'project' ? `projeto ${escapeHtml(c.project ?? '')}` : 'configuração global';
  const copies = m.copies.map((c) => `<li><strong>${escapeHtml(nameOf(c.agent))}</strong> · ${where(c)}</li>`).join('');
  const checks: Check[] = [
    m.transport === 'remote'
      ? { level: 'warn', text: `Servidor <b>remoto</b>${m.host ? ` (${escapeHtml(m.host)})` : ''}: o que a IA manda para ele sai da máquina.` }
      : { level: 'ok', text: 'Roda na sua máquina.' },
  ];
  if (m.agents.length === 1) checks.push({ level: 'info', text: `Só ${escapeHtml(nameOf(m.agents[0]))} tem este servidor.` });
  if (m.copies.some((c) => c.origin === 'plugin')) checks.push({ level: 'info', text: 'Instalado por plugin: some se o plugin for desligado.' });

  showPiece(panel, {
    kicker: 'Rádio · servidor MCP',
    title: m.name,
    badges: [pill(m.transport === 'remote' ? 'remoto' : 'local', true), ...m.agents.map((x) => pill(nameOf(x)))],
    context:
      '<p>As <b>definições das ferramentas</b> deste servidor entram no contexto enquanto ele está ligado. O tamanho não é medido: ele só aparece com o servidor rodando, e o cityPhy não liga servidores.</p>',
    input: `<ul class="rows">${copies}</ul>`,
    output: use ? usedHtml(use, nameOf, 'chamada(s)') : none('Ainda não medido: chamadas a este servidor.'),
    checks,
  });
}

/** Measured use of a skill or MCP server, and which agents' logs could not tell. */
export interface UseInfo {
  use: Use | undefined;
  measured: string[];
  unmeasured: string[];
}

function usedHtml(u: UseInfo, nameOf: NameOf, unit: string): string {
  const not = u.unmeasured.length ? `<p class="muted">${u.unmeasured.map((a) => escapeHtml(nameOf(a))).join(', ')}: os registros não guardam chamadas de ferramenta.</p>` : '';
  const use = u.use;
  if (!use?.total) return `${none(`Nenhum uso nos registros de ${u.measured.map((a) => escapeHtml(nameOf(a))).join(', ') || 'nenhuma IA'}.`)}${not}`;
  const list = (r: Record<string, number>, label: (k: string) => string) =>
    Object.entries(r)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `<li>${escapeHtml(label(k))} <span class="muted-inline">${n(v)}</span></li>`)
      .join('');
  const tools = Object.keys(use.tools).length ? `<h4>Ferramentas</h4><ul class="rows">${list(use.tools, (k) => k)}</ul>` : '';
  const sessions = use.sessions
    .slice(0, 6)
    .map((s) => `<li>${escapeHtml(s.title ?? 'sem título')} <span class="muted-inline">· ${escapeHtml(s.project)} · ${escapeHtml(nameOf(s.agent))} · ${s.at ? formatDate(s.at) : ''} · ${n(s.count)}×</span></li>`)
    .join('');
  return `<div class="stats">${stat(n(use.total), `${unit} nos registros`)}${stat(n(use.sessions.length), 'conversas')}</div>
    <h4>Onde</h4><ul class="rows">${list(use.projects, (k) => k)}</ul>${tools}<h4>Últimas conversas</h4><ul class="rows">${sessions}</ul>${not}`;
}

/** The whole civic district at a glance (from the HUD). */
export function showLibrary(panel: HTMLElement, lib: Library, nameOf: NameOf, usedHtml?: string): void {
  const divergent = lib.skills.filter((s) => s.divergent);
  const shelves = shelvesOf(lib).map((s) => `<li>${escapeHtml(s.label)} <span class="muted-inline">${n(s.skills.length)}</span></li>`).join('');
  const perAgent = lib.agents.map((a) => `<li>${escapeHtml(nameOf(a))} <span class="muted-inline">${n(lib.skills.filter((s) => s.agents.includes(a)).length)} skills · ${n(lib.mcps.filter((m) => m.agents.includes(a)).length)} MCP</span></li>`).join('');
  const checks: Check[] = [];
  if (divergent.length)
    checks.push({ level: 'warn', text: `${n(divergent.length)} skill(s) com cópias diferentes entre IAs: ${divergent.slice(0, 6).map((s) => `<b>${escapeHtml(s.name)}</b>`).join(', ')}${divergent.length > 6 ? '…' : ''}` });
  const remote = lib.mcps.filter((m) => m.transport === 'remote');
  if (remote.length) checks.push({ level: 'warn', text: `${n(remote.length)} MCP remoto(s): ${remote.map((m) => escapeHtml(m.name)).join(', ')}` });
  if (!checks.length) checks.push({ level: 'ok', text: 'Cópias iguais e nenhum MCP remoto.' });

  showPiece(panel, {
    kicker: 'Centro cívico',
    title: 'Biblioteca e rádio',
    context: '<p>Cada IA lista <b>nome e descrição</b> de todas as skills que enxerga em toda sessão; quanto mais livros, mais longa a lista.</p>',
    input: `<div class="stats">${stat(n(lib.skills.length), 'skills')}${stat(n(lib.mcps.length), 'servidores MCP')}</div><h4>Estantes</h4><ul class="rows">${shelves}</ul><h4>Por IA</h4><ul class="rows">${perAgent}</ul>`,
    output: usedHtml ?? none('Ainda não medido: uso de cada skill e de cada servidor.'),
    checks,
  });
}
