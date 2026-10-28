import type { Library, LibrarySkill } from '../library/types.ts';
import type { UsageIndex } from '../metrics/work/usageIndex.ts';
import { ORIGIN_COLOR, ORIGIN_NAMES } from '../scene/library.ts';
import { MCP_COLOR } from '../scene/radio.ts';
import { showLibrary } from '../ui/libraryPanel.ts';
import { dot, short } from '../ui/agentView.ts';
import { stat } from '../ui/blocks.ts';
import { escapeHtml } from '../ui/format.ts';

export type LibTab = 'summary' | 'skills' | 'mcp';
const MAX_ROWS = 150;
const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
const n = (v: number) => v.toLocaleString('pt-BR');

export interface LibraryViewState {
  lib: Library;
  index: UsageIndex;
  tab: LibTab;
  query: string;
  /** 'all', 'used', 'unused' or an agent id. */
  filter: string;
  nameOf(a: string): string;
  onTab(t: LibTab): void;
  onFilter(f: string, query: string): void;
  onSkill(name: string): void;
  onMcp(i: number): void;
}

const usedOf = (s: LibrarySkill, idx: UsageIndex) => idx.skills.get(s.name.toLowerCase())?.total ?? 0;

function tabsHtml(s: LibraryViewState): string {
  const app = [...s.index.mcps.keys()].filter((k) => !s.lib.mcps.some((m) => m.name === k)).length;
  const t = (key: LibTab, label: string) => `<button class="ptab${s.tab === key ? ' on' : ''}" data-ltab="${key}">${label}</button>`;
  return `<nav class="ptabs">${t('summary', 'Resumo')}${t('skills', `Skills <span class="count">${n(s.lib.skills.length)}</span>`)}${t('mcp', `MCP <span class="count">${s.lib.mcps.length + app}</span>`)}</nav>`;
}

/** Totals of measured use for the summary tab. */
function summaryUse(s: LibraryViewState): string {
  const used = s.lib.skills.filter((k) => usedOf(k, s.index) > 0).length;
  const calls = [...s.index.mcps.values()].reduce((a, u) => a + u.total, 0);
  const who = s.index.measured.map(s.nameOf).join(', ') || 'nenhuma IA';
  return `<div class="stats">${stat(`${n(used)} de ${n(s.lib.skills.length)}`, 'skills usadas')}${stat(n(calls), 'chamadas MCP')}</div>
    <p class="muted">Medido nos registros de ${escapeHtml(who)}.${s.index.unmeasured.length ? ` ${escapeHtml(s.index.unmeasured.map(s.nameOf).join(', '))} não registra chamadas.` : ''}</p>`;
}

function skillRows(s: LibraryViewState): string {
  const q = s.query.trim().toLowerCase();
  const rows = s.lib.skills
    .map((k) => ({ k, used: usedOf(k, s.index) }))
    .filter(({ k, used }) => (!q || k.name.toLowerCase().includes(q) || (k.plugin ?? '').toLowerCase().includes(q)) && (s.filter === 'all' || (s.filter === 'used' ? used > 0 : s.filter === 'unused' ? used === 0 : k.agents.includes(s.filter))))
    .sort((a, b) => b.used - a.used || a.k.name.localeCompare(b.k.name));
  const list = rows
    .slice(0, MAX_ROWS)
    .map(
      ({ k, used }) => `<button class="srow" data-skill="${escapeHtml(k.name)}">
      <i class="book" style="background:${hex(ORIGIN_COLOR[k.origin])}" title="${escapeHtml(ORIGIN_NAMES[k.origin])}"></i>
      <span class="sname">${escapeHtml(k.name)}${k.divergent ? ' <b class="st mid">diverge</b>' : ''}<em>${k.agents.map((a) => dot(a)).join('')}${k.plugin ? escapeHtml(k.plugin) : ''}</em></span>
      <span class="suse">${used ? `<b>${n(used)}×</b>` : '<span class="muted-inline">sem uso</span>'}<em>≈ ${short(k.tokensApprox)}</em></span></button>`,
    )
    .join('');
  return `<p class="muted">${n(rows.length)} skill(s)${rows.length > MAX_ROWS ? `, mostrando ${MAX_ROWS}` : ''}.</p>${list}`;
}

function skillsHtml(s: LibraryViewState): string {
  const chip = (key: string, label: string) => `<button class="pill${s.filter === key ? ' on' : ''}" data-filter="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
  return `<input class="search" type="search" placeholder="Procurar skill ou plugin" value="${escapeHtml(s.query)}">
    <div class="pills">${chip('all', 'todas')}${chip('used', 'usadas')}${chip('unused', 'nunca usadas')}${s.lib.agents.map((a) => chip(a, `só ${s.nameOf(a)}`)).join('')}</div>
    <div class="slist">${skillRows(s)}</div>`;
}

function mcpHtml(s: LibraryViewState): string {
  const row = (name: string, sub: string, color: number, calls: number, attr: string) =>
    `<button class="srow"${attr}><i class="book" style="background:${hex(color)}"></i><span class="sname">${escapeHtml(name)}<em>${sub}</em></span><span class="suse">${calls ? `<b>${n(calls)}</b><em>chamadas</em>` : '<span class="muted-inline">sem uso</span>'}</span></button>`;
  const configured = s.lib.mcps.map((m, i) => row(m.name, `${m.agents.map((a) => dot(a)).join('')}${m.transport === 'remote' ? 'remoto' : 'local'}`, MCP_COLOR[m.transport], s.index.mcps.get(m.name)?.total ?? 0, ` data-mcp="${i}"`)).join('');
  const app = [...s.index.mcps]
    .filter(([k]) => !s.lib.mcps.some((m) => m.name === k))
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k, u]) => row(k, `${Object.keys(u.agents).map((a) => dot(a)).join('')}do aplicativo · ${Object.keys(u.tools).length} ferramentas`, 0xb4b2a9, u.total, ''))
    .join('');
  return `<h4>Configurados</h4>${configured || '<p class="empty">Nenhum.</p>'}
    ${app ? `<h4>Do aplicativo</h4><p class="muted">Servidores que o próprio aplicativo da IA traz (navegador, sessões…): não estão na configuração, mas aparecem nas chamadas.</p>${app}` : ''}`;
}

/** The library panel with tabs: summary (four blocks), searchable skills with their use, MCP servers with calls. */
export function showLibraryView(panel: HTMLElement, s: LibraryViewState): void {
  if (s.tab === 'summary') {
    showLibrary(panel, s.lib, s.nameOf, summaryUse(s));
    panel.querySelector('.kicker')!.insertAdjacentHTML('beforebegin', tabsHtml(s));
  } else {
    panel.innerHTML = `<button class="close" aria-label="Fechar">×</button>${tabsHtml(s)}<p class="kicker">Centro cívico · biblioteca</p>
      <h2>${s.tab === 'skills' ? 'Skills' : 'Servidores MCP'}</h2>${s.tab === 'skills' ? skillsHtml(s) : mcpHtml(s)}`;
    panel.hidden = false;
    panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
  }
  panel.querySelectorAll<HTMLElement>('[data-ltab]').forEach((b) => b.addEventListener('click', () => s.onTab(b.dataset.ltab as LibTab)));
  panel.querySelectorAll<HTMLElement>('[data-filter]').forEach((b) => b.addEventListener('click', () => s.onFilter(b.dataset.filter!, s.query)));
  panel.querySelectorAll<HTMLElement>('[data-mcp]').forEach((b) => b.addEventListener('click', () => s.onMcp(Number(b.dataset.mcp))));
  const bindRows = () => panel.querySelectorAll<HTMLElement>('[data-skill]').forEach((b) => b.addEventListener('click', () => s.onSkill(b.dataset.skill!)));
  bindRows();
  const search = panel.querySelector<HTMLInputElement>('.search');
  search?.addEventListener('input', () => {
    s.query = search.value;
    s.onFilter(s.filter, s.query);
    panel.querySelector('.slist')!.innerHTML = skillRows(s);
    bindRows();
  });
}
