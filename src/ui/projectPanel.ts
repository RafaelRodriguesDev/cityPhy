import type { ProjectExtras } from '../readers/projectExtras.ts';
import type { ProjectSummary } from '../readers/projects.ts';
import type { ProjectBuilding } from '../scene/projectBlock.ts';
import { type Check, none, showPiece, stat } from './blocks.ts';
import { short } from './agentView.ts';
import { escapeHtml, formatDate } from './format.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
const onOff = (on: boolean, label: string) => `<span class="pill${on ? ' on' : ''}">${on ? '✓' : '✗'} ${label}</span>`;

/** A tool that powers this project, with when it last worked here. */
export interface Feed {
  agent: string;
  name: string;
  status: string; // "ativo agora", "há 3 h"
}

/** Side panel for a project building, with the whole condominium in the four blocks. */
export function showProjectBuilding(panel: HTMLElement, b: ProjectBuilding, feeds: Feed[]): void {
  const p = b.project as ProjectSummary & { cityphy?: ProjectExtras; group?: { name: string; path: string }; groupCityphy?: ProjectExtras };
  const x = p.cityphy;
  const mem = (p.groupCityphy ?? x)?.memory;
  const o = x?.options;
  const s = x?.savings;

  const checks: Check[] = [];
  if (!o) checks.push({ level: 'warn', text: 'Projeto sem opções: rode <code>cityphy setup</code>.' });
  else {
    const unregistered = feeds.filter((f) => !o.agents.includes(f.agent));
    if (unregistered.length) checks.push({ level: 'warn', text: `${unregistered.map((f) => `<b>${escapeHtml(f.name)}</b>`).join(', ')} trabalha(m) aqui sem estar registrada(s) no setup do projeto.` });
    if (!o.memory) checks.push({ level: 'info', text: 'Memória local desligada.' });
    if (!o.inject) checks.push({ level: 'info', text: 'Resumo inicial desligado: cada sessão começa sem contexto do trabalho anterior.' });
    if (o.inject && x?.lessonsTokens != null && x.lessonsTokens > o.injectBudget) checks.push({ level: 'warn', text: `Resumo inicial (≈ ${n(x.lessonsTokens)}) acima do teto de ${n(o.injectBudget)} tokens.` });
  }
  if (!s?.queries) checks.push({ level: 'info', text: 'Nenhuma IA consultou o grafo ainda: elas estão lendo arquivos inteiros.' });
  if (!feeds.length) checks.push({ level: 'info', text: 'Nenhuma IA trabalhou aqui.' });

  const recent = mem?.recent.slice(0, 4).map((r) => `<li><span class="muted-inline">${formatDate(r.at)} · ${escapeHtml(r.agent)}</span><br>${escapeHtml(r.summary)}</li>`).join('');
  showPiece(panel, {
    kicker: `Condomínio ${p.name} · prédio ${b.part.name}`,
    title: p.name,
    badges: o ? [onOff(o.graph, 'grafo'), onOff(o.memory, 'memória'), onOff(o.inject, 'resumo inicial'), onOff(o.metrics, 'métricas')] : [],
    context:
      o?.inject && x?.lessonsTokens != null
        ? `${stat(`≈ ${n(x.lessonsTokens)}`, `tokens do resumo inicial (teto ${n(o.injectBudget)})`)}<p class="muted">Entra no começo de toda sessão neste projeto.</p>`
        : none('Nada do projeto entra sozinho no começo da sessão.'),
    input: `<div class="stats">${stat(s?.queries ? n(s.queries) : '0', 'consultas ao grafo')}${stat(s?.queries ? `≈ ${short(s.saved)}` : '—', 'tokens economizados')}</div>
      <dl><dt>Prédio</dt><dd>${escapeHtml(b.part.name)}: ${n(b.part.files)} arquivos · ${n(b.part.nodes)} símbolos</dd>
      <dt>Projeto</dt><dd>${n(p.nodes)} símbolos · ${n(p.edges)} ligações</dd>
      <dt>Raiz</dt><dd class="path">${escapeHtml(p.root)}</dd>
      ${p.group ? `<dt>Grupo</dt><dd>${escapeHtml(p.group.name)}</dd>` : ''}</dl>`,
    output: `<h4>Energia de</h4>${feeds.length ? `<ul class="rows">${feeds.map((f) => `<li>${escapeHtml(f.name)} <span class="muted-inline">${escapeHtml(f.status)}</span></li>`).join('')}</ul>` : none('Nenhuma IA.')}
      <h4>Memória${p.group ? ' do grupo' : ''}</h4>${mem ? `<p>${n(mem.observations)} observações · ${n(mem.sessions)} sessões · última ${formatDate(mem.last)}</p><ul class="rows">${recent}</ul>` : none('Sem memória ainda.')}`,
    checks,
  });
}
