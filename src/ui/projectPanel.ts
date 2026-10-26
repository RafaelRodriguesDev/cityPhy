import type { ProjectExtras } from '../readers/projectExtras.ts';
import type { ProjectSummary } from '../readers/projects.ts';
import type { ProjectBuilding } from '../scene/projectBlock.ts';
import { escapeHtml, formatDate } from './format.ts';
import { renderTabs } from './tabs.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
const onOff = (on: boolean, label: string) => `<span class="pill${on ? ' on' : ''}">${on ? '✓' : '✗'} ${label}</span>`;
const noData = '<p class="muted">Sem dados ainda.</p>';

function savingsTab(x: ProjectExtras | undefined): string {
  if (!x?.savings.queries) return `${noData}<p class="muted">Aparece quando uma IA usar <code>cityphy query</code>.</p>`;
  const s = x.savings;
  const agents = Object.entries(s.byAgent).map(([a, v]) => `<li>${escapeHtml(a)}: ${n(v.queries)} consulta(s) · ≈ ${n(v.saved)} tokens poupados</li>`).join('');
  const last = s.last.map((q) => `<li>${escapeHtml(q.question)} <span class="muted-inline">${n(q.returned)} × ${n(q.avoided)}</span></li>`).join('');
  return `
    <div class="metrics"><div><span>Tokens economizados</span><strong>≈ ${n(s.saved)}</strong></div><div><span>Consultas ao grafo</span><strong>${n(s.queries)}</strong></div></div>
    <p class="muted">Devolvido pelo grafo: ≈ ${n(s.returned)} · arquivos inteiros evitados: ≈ ${n(s.avoided)}</p>
    <h3>Por IA</h3><ul>${agents}</ul>
    <h3>Últimas consultas (devolvido × evitado)</h3><ul>${last}</ul>`;
}

function memoryTab(x: ProjectExtras | undefined): string {
  const m = x?.memory;
  if (!m) return `${noData}<p class="muted">Ligue a memória com <code>cityphy setup</code>.</p>`;
  const agents = Object.entries(m.byAgent).map(([a, v]) => `${escapeHtml(a)} ${n(v)}`).join(' · ');
  const recent = m.recent.map((o) => `<li><span class="muted-inline">${formatDate(o.at)} · ${escapeHtml(o.agent)}</span><br>${escapeHtml(o.summary)}</li>`).join('');
  return `
    <div class="metrics"><div><span>Observações</span><strong>${n(m.observations)}</strong></div><div><span>Sessões</span><strong>${n(m.sessions)}</strong></div></div>
    <dl><dt>Por IA</dt><dd>${agents || '—'}</dd><dt>Última</dt><dd>${formatDate(m.last)}</dd>
    <dt>Resumo inicial</dt><dd>${x?.lessonsTokens === null ? '—' : `≈ ${n(x!.lessonsTokens!)} tokens (LESSONS.md)`}</dd></dl>
    <h3>Recente</h3><ul>${recent || '<li>—</li>'}</ul>`;
}

function optionsTab(x: ProjectExtras | undefined): string {
  const o = x?.options;
  if (!o) return noData;
  return `
    <div class="pills">${onOff(o.graph, 'grafo')}${onOff(o.memory, 'memória')}${onOff(o.inject, `resumo inicial (${n(o.injectBudget)} tokens)`)}${onOff(o.metrics, 'métricas')}${onOff(o.localLlm, 'IA local')}</div>
    <dl><dt>IAs registradas</dt><dd>${o.agents.length ? o.agents.map(escapeHtml).join(', ') : 'nenhuma — rode cityphy setup'}</dd></dl>`;
}

/** Side panel for a project building, with tabs for the whole condominium. */
export function showProjectBuilding(panel: HTMLElement, b: ProjectBuilding, linkedAgents: string[]): void {
  const p = b.project as ProjectSummary & { cityphy?: ProjectExtras };
  panel.innerHTML = `
    <button class="close" aria-label="Fechar">×</button>
    <p class="kicker">Condomínio ${escapeHtml(p.name)} · prédio ${escapeHtml(b.part.name)}</p>
    <h2>${escapeHtml(p.name)}</h2>
    <div class="tabs-host"></div>`;
  renderTabs(panel.querySelector('.tabs-host')!, [
    {
      label: 'Resumo',
      html: `<dl>
        <dt>Prédio</dt><dd>${escapeHtml(b.part.name)}: ${n(b.part.files)} arquivos · ${n(b.part.nodes)} símbolos</dd>
        <dt>Projeto</dt><dd>${n(p.nodes)} nós · ${n(p.edges)} ligações</dd>
        <dt>Raiz</dt><dd class="path">${escapeHtml(p.root)}</dd>
        <dt>Energia de</dt><dd>${linkedAgents.length ? linkedAgents.map(escapeHtml).join(', ') : 'nenhuma IA ligada'}</dd></dl>`,
    },
    { label: 'Economia', html: savingsTab(p.cityphy) },
    { label: 'Memória', html: memoryTab(p.cityphy) },
    { label: 'Opções', html: optionsTab(p.cityphy) },
  ]);
  panel.hidden = false;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
