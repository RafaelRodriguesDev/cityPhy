import type { Library } from '../library/types.ts';
import { ago } from '../metrics/activity/types.ts';
import { blockValues } from '../scene/consumptionTower.ts';
import { type AgentView, dot, groundOf, short } from '../ui/agentView.ts';
import { escapeHtml } from '../ui/format.ts';
import type { Project, ProjectEconomy } from './economy.ts';
import { PROJECTS_PER_PAGE } from './projectView.ts';

export type SideTab = 'agents' | 'projects' | 'civic';

export interface SidebarState {
  tab: SideTab;
  page: number;
  agents: AgentView[];
  projects: Project[];
  economies: ProjectEconomy[];
  lib: Library;
  now: string;
  color(name: string): string;
}

export interface SidebarHandlers {
  onTab(t: SideTab): void;
  onPage(p: number): void;
  onAgent(a: string): void;
  onProject(i: number): void;
  onLibrary(): void;
  onMcp(i: number): void;
  onOverview(): void;
}

function agentCard(a: AgentView, now: string): string {
  const week = a.consumption ? blockValues(a.consumption)[0] : null;
  const status = a.activeNow ? '<em class="live">trabalhando</em>' : `<em>${a.lastActive ? escapeHtml(ago(a.lastActive, now)) : 'sem atividade'}</em>`;
  return `<button class="card" data-agent="${escapeHtml(a.agent)}"><div class="card-head">${dot(a.agent)}<strong>${escapeHtml(a.name)}</strong>${status}</div>
    <div class="card-stats"><span><b>${a.tower ? `≈ ${short(groundOf(a.tower).tokens)}` : '—'}</b>térreo</span><span><b>${a.consumption ? short(a.consumption.week.fresh) : '—'}</b>semana</span><span><b>${a.powers.length}</b>projetos</span></div>
    ${week ? `<div class="meter"><span style="width:${Math.round((week.fill ?? 0) * 100)}%"></span></div>` : ''}</button>`;
}

function projectCard(p: Project, e: ProjectEconomy, i: number, color: string): string {
  const live = e.agents.filter((a) => a.status === 'live').length;
  return `<button class="card" data-project="${i}"><div class="card-head"><i class="dot sq" style="background:${color}"></i><strong>${escapeHtml(p.name)}</strong><em>${p.parts.length} partes</em></div>
    <div class="card-stats"><span><b>${e.saved ? `≈ ${short(e.saved)}` : '—'}</b>economizado</span><span><b>${e.queries}</b>consultas</span><span><b>${live}/${e.agents.length}</b>IAs no controle</span></div></button>`;
}

/** Left sidebar with three tabs; projects are paginated. */
export function renderSidebar(el: HTMLElement, s: SidebarState, on: SidebarHandlers): void {
  const tab = (key: SideTab, label: string, n: number) => `<button class="stab${s.tab === key ? ' on' : ''}" data-tab="${key}">${label}<span>${n}</span></button>`;
  let body = '';
  if (s.tab === 'agents') body = s.agents.map((a) => agentCard(a, s.now)).join('');
  if (s.tab === 'projects') {
    const pages = Math.max(1, Math.ceil(s.projects.length / PROJECTS_PER_PAGE));
    const page = Math.min(s.page, pages - 1);
    body =
      s.projects
        .slice(page * PROJECTS_PER_PAGE, (page + 1) * PROJECTS_PER_PAGE)
        .map((p, k) => projectCard(p, s.economies[page * PROJECTS_PER_PAGE + k], page * PROJECTS_PER_PAGE + k, s.color(p.name)))
        .join('') || '<p class="muted">Nenhum projeto com grafo.</p>';
    if (pages > 1) body += `<div class="pager"><button data-page="${page - 1}"${page ? '' : ' disabled'}>‹</button>página ${page + 1} de ${pages}<button data-page="${page + 1}"${page < pages - 1 ? '' : ' disabled'}>›</button></div>`;
  }
  if (s.tab === 'civic') {
    const shared = s.lib.skills.filter((k) => k.agents.length > 1).length;
    body = `<button class="card" data-library="1"><div class="card-head"><strong>Biblioteca</strong><em>skills</em></div>
      <div class="card-stats"><span><b>${s.lib.skills.length}</b>skills</span><span><b>${shared}</b>compartilhadas</span><span><b>${s.lib.skills.filter((k) => k.divergent).length}</b>divergentes</span></div></button>
      ${s.lib.mcps.map((m, i) => `<button class="card" data-mcp="${i}"><div class="card-head"><strong>${escapeHtml(m.name)}</strong><em>${m.transport === 'remote' ? 'remoto' : 'local'}</em></div><div class="card-line">${m.agents.map((a) => dot(a)).join('')} rádio · MCP</div></button>`).join('')}`;
  }
  el.innerHTML = `<header class="brand"><div><h1>cityPhy</h1><p>mapa local das suas IAs</p></div><button class="ghost" data-overview="1">ver cidade toda</button></header>
    <nav class="stabs">${tab('agents', 'IAs', s.agents.length)}${tab('projects', 'Projetos', s.projects.length)}${tab('civic', 'Cívico', 1 + s.lib.mcps.length)}</nav>
    <div class="sbody">${body}</div>
    <p class="foot"><a href="/classica.html">cidade clássica</a></p>`;
  el.querySelectorAll<HTMLElement>('[data-tab]').forEach((b) => b.addEventListener('click', () => on.onTab(b.dataset.tab as SideTab)));
  el.querySelectorAll<HTMLElement>('[data-page]').forEach((b) => b.addEventListener('click', () => on.onPage(Number(b.dataset.page))));
  el.querySelectorAll<HTMLElement>('[data-agent]').forEach((b) => b.addEventListener('click', () => on.onAgent(b.dataset.agent!)));
  el.querySelectorAll<HTMLElement>('[data-project]').forEach((b) => b.addEventListener('click', () => on.onProject(Number(b.dataset.project))));
  el.querySelectorAll<HTMLElement>('[data-mcp]').forEach((b) => b.addEventListener('click', () => on.onMcp(Number(b.dataset.mcp))));
  el.querySelector('[data-library]')?.addEventListener('click', () => on.onLibrary());
  el.querySelector('[data-overview]')!.addEventListener('click', () => on.onOverview());
}
