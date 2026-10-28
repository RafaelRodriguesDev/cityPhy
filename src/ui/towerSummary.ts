import { SECTIONS, SECTION_NAMES } from '../towers/schema.ts';
import { SECTION_COLOR } from '../scene/towerMesh.ts';
import { ORIGIN_COLOR, ORIGIN_NAMES } from '../scene/library.ts';
import { MCP_COLOR } from '../scene/radio.ts';
import { blockValues } from '../scene/consumptionTower.ts';
import { groupByModel } from '../metrics/modelStats.ts';
import { ago } from '../metrics/activity/types.ts';
import type { Library, Origin } from '../library/types.ts';
import { type AgentView, dot, groundOf, short, swatch } from './agentView.ts';
import { escapeHtml } from './format.ts';

const n = (v: number) => v.toLocaleString('pt-BR');

export interface ProjectLegend {
  name: string;
  color: number;
  /** Agents feeding this project (empty: no power). */
  agents: string[];
  nodes: number;
  buildings: number;
}

export interface SidebarHandlers {
  onAgent(agent: string): void;
  onProject(name: string): void;
  onLibrary(): void;
  onOverview(): void;
  onPulses(on: boolean): void;
  onShowInactive(on: boolean): void;
}

/** A thin bar: how full the week is (plan, limit or history), as on the glass tower. */
function weekBar(a: AgentView): string {
  if (!a.consumption) return '';
  const week = blockValues(a.consumption)[0];
  const pct = Math.round((week.fill ?? 0) * 100);
  return `<div class="meter" title="${escapeHtml(week.text)}"><span style="width:${pct}%"></span></div>`;
}

function agentCard(a: AgentView, now: string): string {
  const g = groundOf(a.tower);
  const status = a.activeNow ? '<em class="live">trabalhando</em>' : `<em>${a.lastActive ? escapeHtml(ago(a.lastActive, now)) : 'sem atividade'}</em>`;
  return `<button class="card" data-agent="${escapeHtml(a.agent)}">
    <div class="card-head">${dot(a.agent)}<strong>${escapeHtml(a.name)}</strong>${status}</div>
    <div class="card-stats">
      <span><b>${a.tower ? `≈ ${short(g.tokens)}` : '—'}</b>térreo</span>
      <span><b>${a.consumption ? short(a.consumption.week.fresh) : '—'}</b>semana</span>
      <span><b>${groupByModel(a.models).length}</b>modelos</span>
    </div>${weekBar(a)}</button>`;
}

function projectCard(p: ProjectLegend, nameOf: (a: string) => string): string {
  return `<button class="card" data-project="${escapeHtml(p.name)}">
    <div class="card-head">${swatch(p.color)}<strong>${escapeHtml(p.name)}</strong></div>
    <div class="card-line">${n(p.buildings)} prédios · ${short(p.nodes)} símbolos</div>
    <div class="card-line muted-inline">${p.agents.length ? `energia de ${p.agents.map((a) => escapeHtml(nameOf(a))).join(', ')}` : 'sem energia'}</div></button>`;
}

function legend(): string {
  const row = (color: number, text: string) => `<li>${swatch(color)}${escapeHtml(text)}</li>`;
  return `<details class="legend-box"><summary>Legenda</summary>
    <h4>Andares das torres</h4><ul class="legend">${SECTIONS.map((s) => row(SECTION_COLOR[s], SECTION_NAMES[s])).join('')}</ul>
    <h4>Livros (skills)</h4><ul class="legend">${(Object.keys(ORIGIN_COLOR) as Origin[]).map((o) => row(ORIGIN_COLOR[o], ORIGIN_NAMES[o])).join('')}</ul>
    <h4>Antenas (MCP)</h4><ul class="legend">${row(MCP_COLOR.local, 'local · baixa')}${row(MCP_COLOR.remote, 'remoto · alta')}</ul>
    <p class="muted">Altura do andar = peso do conteúdo. Vidro = consumo. Cabo aceso = a IA trabalha no projeto agora.</p></details>`;
}

/** Left sidebar: agents, projects and the civic district as cards (a click opens the piece and takes the camera there); legend and view options below. */
export function renderSummary(
  el: HTMLElement,
  agents: AgentView[],
  projects: ProjectLegend[],
  lib: Library,
  view: { pulses: boolean; showInactive: boolean },
  now: string,
  nameOf: (a: string) => string,
  on: SidebarHandlers,
): void {
  const shared = lib.skills.filter((s) => s.agents.length > 1).length;
  el.innerHTML = `
    <header class="brand"><div><h1>cityPhy</h1><p>mapa local das suas IAs</p></div><button class="ghost" data-overview="1" title="Volta a câmera para a cidade inteira">ver cidade toda</button></header>
    <h3>IAs <span>${agents.length}</span></h3>${agents.map((a) => agentCard(a, now)).join('')}
    <h3>Projetos <span>${projects.length}</span></h3>${projects.map((p) => projectCard(p, nameOf)).join('') || '<p class="muted">Nenhum projeto com grafo.</p>'}
    <h3>Centro cívico</h3>
    <button class="card" data-library="1">
      <div class="card-head"><strong>Biblioteca e rádio</strong></div>
      <div class="card-stats"><span><b>${n(lib.skills.length)}</b>skills</span><span><b>${n(shared)}</b>compartilhadas</span><span><b>${n(lib.mcps.length)}</b>MCP</span></div>
    </button>
    ${legend()}
    <div class="view-opts">
      <label class="toggle"><input type="checkbox" class="opt-pulses"${view.pulses ? ' checked' : ''}> pulsos de luz</label>
      <label class="toggle"><input type="checkbox" class="opt-inactive"${view.showInactive ? ' checked' : ''}> cabos inativos</label>
    </div>`;
  el.querySelectorAll<HTMLElement>('[data-agent]').forEach((b) => b.addEventListener('click', () => on.onAgent(b.dataset.agent!)));
  el.querySelectorAll<HTMLElement>('[data-project]').forEach((b) => b.addEventListener('click', () => on.onProject(b.dataset.project!)));
  el.querySelector('[data-library]')!.addEventListener('click', () => on.onLibrary());
  el.querySelector('[data-overview]')!.addEventListener('click', () => on.onOverview());
  el.querySelector('.opt-pulses')!.addEventListener('change', (e) => on.onPulses((e.target as HTMLInputElement).checked));
  el.querySelector('.opt-inactive')!.addEventListener('change', (e) => on.onShowInactive((e.target as HTMLInputElement).checked));
}
