import { SECTIONS, SECTION_NAMES, type TowerGraph } from '../towers/schema.ts';
import { SECTION_COLOR } from '../scene/towerMesh.ts';
import { escapeHtml } from './format.ts';

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;

export interface ProjectLegend {
  name: string;
  color: number;
  /** Agents feeding this project (empty: no power). */
  agents: string[];
}

/** Top-left panel: per tower what is paid in every session, tower legend, and each project's line color. */
export function renderSummary(el: HTMLElement, towers: TowerGraph[], projects: ProjectLegend[], onPulses: (on: boolean) => void): void {
  const legend = SECTIONS.map(
    (s) => `<li><span class="swatch" style="background:${hex(SECTION_COLOR[s])}"></span>${escapeHtml(SECTION_NAMES[s])}</li>`,
  ).join('');

  const rows = towers
    .map((t) => {
      const ground = t.nodes.filter((n) => n.cityphy.load === 'always');
      const known = ground.reduce((sum, n) => sum + (n.cityphy.tokensApprox ?? 0), 0);
      const unknown = ground.filter((n) => n.cityphy.tokensApprox === null).length;
      const annex = t.nodes.filter((n) => n.cityphy.annex).length;
      return `<li><strong>${escapeHtml(t.graph.cityphy.agentName)}</strong>: ${t.nodes.length} andares${annex ? ` (${annex} no anexo)` : ''}<br>
        térreo ≈ ${known.toLocaleString('pt-BR')} tokens${unknown ? ` + ${unknown} não medido` : ''} em toda sessão</li>`;
    })
    .join('');

  el.innerHTML = `
    <h1>cityPhy</h1>
    <ul class="towers">${rows || '<li>Nenhuma torre encontrada.</li>'}</ul>
    <ul class="legend">${legend}</ul>
    <h3>Projetos</h3>
    <ul class="legend">${projects
      .map(
        (p) => `<li><span class="swatch" style="background:${hex(p.color)}"></span>${escapeHtml(p.name)}
          <span class="muted-inline">${p.agents.length ? `← ${p.agents.map(escapeHtml).join(', ')}` : 'sem energia'}</span></li>`,
      )
      .join('')}</ul>
    <label class="toggle"><input type="checkbox" checked> pulsos de luz</label>
    <p class="muted">Altura do andar = peso do conteúdo. Passe o mouse; clique para abrir.</p>`;
  el.querySelector('input')!.addEventListener('change', (e) => onPulses((e.target as HTMLInputElement).checked));
}
