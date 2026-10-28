import { groupByModel } from '../metrics/modelStats.ts';
import type { Library } from '../library/types.ts';
import { ago } from '../metrics/activity/types.ts';
import { type Check, none, showPiece, stat } from './blocks.ts';
import { type AgentView, groundOf, mcpsOf, short, skillsOf } from './agentView.ts';
import { escapeHtml } from './format.ts';

const n = (v: number) => v.toLocaleString('pt-BR');

/** An agent as a whole: its ground floor, what it fetches, what it spent, and what looks off. */
export function showAgent(panel: HTMLElement, a: AgentView, lib: Library, now: string): void {
  const ground = groundOf(a.tower);
  const skills = skillsOf(lib, a.agent);
  const mcps = mcpsOf(lib, a.agent);
  const heavy = [...ground.floors]
    .sort((x, y) => (y.cityphy.tokensApprox ?? -1) - (x.cityphy.tokensApprox ?? -1))
    .slice(0, 6)
    .map((f) => `<li>${escapeHtml(f.label)} <span class="muted-inline">${f.cityphy.tokensApprox === null ? 'não medido' : `≈ ${n(f.cityphy.tokensApprox)}`}</span></li>`)
    .join('');
  const memory = a.tower?.nodes.filter((f) => f.cityphy.section === 'memory') ?? [];
  const sessions = a.tower?.nodes.filter((f) => f.cityphy.section === 'sessions').length ?? 0;
  // All history in the registered projects; fresh tokens apart from cache reads, like the week numbers above.
  const models = groupByModel(a.models)
    .map((m) => {
      const cached = m.rows.reduce((s, r) => s + r.cacheRead, 0);
      return `<li>${escapeHtml(m.model)} <span class="muted-inline">${short(m.total - cached)} novos · ${short(cached)} do cache</span></li>`;
    })
    .join('');
  const c = a.consumption;

  const checks: Check[] = [];
  if (!a.tower) checks.push({ level: 'info', text: 'Sem gerador de torre ainda: o térreo e a memória desta IA não aparecem.' });
  if (ground.unknown) checks.push({ level: 'info', text: `${ground.unknown} parte(s) do térreo sem tamanho medido (regras embutidas da ferramenta).` });
  const divergent = skills.filter((s) => s.divergent);
  if (divergent.length) checks.push({ level: 'warn', text: `${n(divergent.length)} skill(s) com versão diferente das outras IAs.` });
  for (const w of c?.windows ?? [])
    if (w.usedPercent >= 85) checks.push({ level: 'warn', text: `Janela de ${escapeHtml(w.label)} em ${w.usedPercent}% do plano.` });
  if (skills.length > 150) checks.push({ level: 'warn', text: `${n(skills.length)} skills na lista de toda sessão: uma lista longa pesa no contexto.` });
  if (mcpsOf(lib, a.agent).some((m) => m.transport === 'remote')) checks.push({ level: 'info', text: 'Tem servidor MCP remoto.' });

  showPiece(panel, {
    kicker: `IA · ${a.activeNow ? 'trabalhando agora' : a.lastActive ? `ativa ${ago(a.lastActive, now)}` : 'sem atividade recente'}`,
    title: a.name,
    context: a.tower
      ? `${stat(`≈ ${n(ground.tokens)}`, 'tokens do térreo, em toda sessão')}<ul class="rows">${heavy}</ul><p class="muted">+ a lista de ${n(skills.length)} skills e as ferramentas de ${n(mcps.length)} MCP.</p>`
      : none('Sem torre: térreo não mapeado.'),
    input: `<div class="stats">${stat(n(memory.length), 'memórias')}${stat(n(skills.length), 'skills')}${stat(n(mcps.length), 'MCP')}</div>
      ${mcps.length ? `<p class="muted">MCP: ${mcps.map((m) => escapeHtml(m.name)).join(', ')}</p>` : ''}`,
    output: `${c ? `<div class="stats">${stat(short(c.today.fresh), 'tokens novos hoje')}${stat(short(c.week.fresh), 'na semana')}</div><p class="muted">${short(c.week.cached)} lidos do cache · ${n(c.week.calls)} chamadas na semana</p>` : ''}
      ${models ? `<h4>Modelos · todo o histórico nos projetos</h4><ul class="rows">${models}</ul>` : ''}
      <h4>Projetos</h4><p>${a.powers.length ? a.powers.map(escapeHtml).join(', ') : '—'}</p>
      ${sessions ? `<p class="muted">${n(sessions)} sessões registradas na torre.</p>` : ''}`,
    checks,
  });
}
