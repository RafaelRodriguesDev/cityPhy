import { SECTIONS, SECTION_NAMES, type TowerGraph } from '../towers/schema.ts';
import { SECTION_COLOR } from '../scene/towerMesh.ts';
import { blockValues } from '../scene/consumptionTower.ts';
import { groupByModel } from '../metrics/modelStats.ts';
import type { ToolConsumption } from '../metrics/consumption/types.ts';
import type { ModelBreakdown } from '../metrics/usage/types.ts';
import { escapeHtml } from './format.ts';
import { renderTabs } from './tabs.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const num = (v: number) => v.toLocaleString('pt-BR');

export interface ProjectLegend {
  name: string;
  color: number;
  /** Agents feeding this project (empty: no power). */
  agents: string[];
}

export interface ToolSummary {
  agent: string;
  name: string;
  tower: TowerGraph | null;
  consumption: ToolConsumption | null;
  models: ModelBreakdown[];
}

function toolTab(t: ToolSummary, projects: ProjectLegend[]): string {
  const parts: string[] = [];
  if (t.consumption) {
    const blocks = blockValues(t.consumption)
      .map((b) => `<li>${escapeHtml(b.label)}: ${b.fill === null ? 'sem limite' : `${Math.round(b.fill * 100)}%`}</li>`)
      .join('');
    parts.push(`<div class="metrics"><div><span>Hoje</span><strong>${num(t.consumption.today.fresh)}</strong></div><div><span>Semana</span><strong>${num(t.consumption.week.fresh)}</strong></div></div>
      <p class="muted">tokens novos, todas as pastas</p><ul class="legend">${blocks}</ul>`);
  } else parts.push('<p class="muted">Sem leitor de consumo para esta ferramenta.</p>');

  const models = groupByModel(t.models);
  parts.push(`<h3>Modelos</h3>${models.length ? `<ul>${models.map((m) => `<li>${escapeHtml(m.model)} <span class="muted-inline">${num(m.total)} tokens</span></li>`).join('')}</ul>` : '<p class="muted">—</p>'}`);

  if (t.tower) {
    const ground = t.tower.nodes.filter((n) => n.cityphy.load === 'always');
    const known = ground.reduce((s, n) => s + (n.cityphy.tokensApprox ?? 0), 0);
    const unknown = ground.filter((n) => n.cityphy.tokensApprox === null).length;
    parts.push(`<h3>Torre</h3><p>${t.tower.nodes.length} andares · térreo ≈ ${num(known)} tokens${unknown ? ` + ${unknown} não medido` : ''} em toda sessão</p>`);
  }
  const powers = projects.filter((p) => p.agents.includes(t.name)).map((p) => p.name);
  parts.push(`<h3>Alimenta</h3><p>${powers.length ? powers.map(escapeHtml).join(', ') : '—'}</p>`);
  return parts.join('');
}

/** Top-left panel: a "Geral" tab plus one tab per tool found (new tools get a tab by themselves). */
export function renderSummary(el: HTMLElement, tools: ToolSummary[], projects: ProjectLegend[], onPulses: (on: boolean) => void): void {
  const legend = SECTIONS.map((s) => `<li><span class="swatch" style="background:${hex(SECTION_COLOR[s])}"></span>${escapeHtml(SECTION_NAMES[s])}</li>`).join('');
  const projectList = projects
    .map((p) => `<li><span class="swatch" style="background:${hex(p.color)}"></span>${escapeHtml(p.name)} <span class="muted-inline">${p.agents.length ? `← ${p.agents.map(escapeHtml).join(', ')}` : 'sem energia'}</span></li>`)
    .join('');
  const totalWeek = tools.reduce((s, t) => s + (t.consumption?.week.fresh ?? 0), 0);

  el.innerHTML = `<h1>cityPhy</h1><div class="tabs-host"></div>
    <label class="toggle"><input type="checkbox" checked> pulsos de luz</label>`;
  renderTabs(el.querySelector('.tabs-host')!, [
    {
      label: 'Geral',
      html: `<p>${tools.length} ferramenta(s) · semana ≈ ${num(totalWeek)} tokens novos</p>
        <h3>Andares das torres</h3><ul class="legend">${legend}</ul>
        <h3>Projetos</h3><ul class="legend">${projectList}</ul>
        <p class="muted">Altura do andar = peso do conteúdo. Passe o mouse; clique para abrir.</p>`,
    },
    ...tools.map((t) => ({ label: escapeHtml(t.name), html: toolTab(t, projects) })),
  ]);
  el.querySelector('input')!.addEventListener('change', (e) => onPulses((e.target as HTMLInputElement).checked));
}
