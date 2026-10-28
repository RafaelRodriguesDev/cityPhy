import { type Check, none, showPiece, stat } from '../ui/blocks.ts';
import { escapeHtml } from '../ui/format.ts';
import { dot, short } from '../ui/agentView.ts';
import { formatDate } from '../ui/format.ts';
import type { ToolCategory } from '../metrics/usage/types.ts';
import type { Project, ProjectEconomy } from './economy.ts';
import { mcpKey, skillKey, type AgentWork } from '../metrics/work/types.ts';

export const PROJECTS_PER_PAGE = 4;

const TOOL_NAMES: Record<ToolCategory, string> = { graph: 'grafo (cityPhy)', file: 'arquivos lidos', search: 'buscas', command: 'comandos', other: 'outros' };
const TOOL_COLOR: Record<ToolCategory, string> = { graph: '#2bb39a', file: '#d9a441', search: '#5b8def', command: '#8b7cf6', other: '#b4b2a9' };
const STATUS = {
  live: ['ao vivo', 'on'],
  history: ['só histórico', 'mid'],
  outside: ['fora do cityPhy', 'off'],
} as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export type ProjectSection = 'summary' | 'chats' | 'tools';

export interface ProjectViewState {
  projects: Project[];
  index: number;
  part: string | null;
  section: ProjectSection;
  /** Conversations of each agent in this project. */
  work: AgentWork[];
  /** Skills and MCP servers used here (library names), busiest first. */
  use: { skills: Array<[string, number]>; mcps: Array<[string, number]> };
  mcpNames: string[];
  onSection(s: ProjectSection): void;
  onSkill(name: string): void;
  onMcp(name: string): void;
  economy: ProjectEconomy;
  feeds: Array<{ agent: string; name: string; status: string }>;
  nameOf(a: string): string;
  color(name: string): string;
  onProject(i: number): void;
  onPart(part: string | null): void;
}

function tabs(s: ProjectViewState): string {
  const page = Math.floor(s.index / PROJECTS_PER_PAGE);
  const pages = Math.ceil(s.projects.length / PROJECTS_PER_PAGE);
  const list = s.projects.slice(page * PROJECTS_PER_PAGE, (page + 1) * PROJECTS_PER_PAGE);
  const tab = (p: Project, i: number) =>
    `<button class="ptab${i === s.index ? ' on' : ''}" data-project="${i}"><i class="dot sq" style="background:${s.color(p.name)}"></i>${escapeHtml(p.name)}</button>`;
  const nav = pages > 1 ? `<span class="pager"><button data-page="${page - 1}"${page ? '' : ' disabled'}>‹</button>${page + 1}/${pages}<button data-page="${page + 1}"${page < pages - 1 ? '' : ' disabled'}>›</button></span>` : '';
  return `<nav class="ptabs">${list.map((p) => tab(p, s.projects.indexOf(p))).join('')}${nav}</nav>`;
}

/** Savings, how the conversation was fed, and which sessions cityPhy saw (live, imported, never). */
function economyHtml(e: ProjectEconomy, nameOf: (a: string) => string): string {
  const saving = e.avoided
    ? `<div class="eco-hero"><strong>≈ ${short(e.saved)}</strong><span>tokens que não entraram na conversa (${pct(e.saved / e.avoided)} do que seria lido)</span></div>
       <div class="cmp"><div><span style="width:100%" class="was"></span><em>ler os arquivos inteiros: ≈ ${short(e.avoided)}</em></div>
       <div><span style="width:${Math.max(1, (e.returned / e.avoided) * 100)}%" class="got"></span><em>resposta do grafo: ≈ ${short(e.returned)}</em></div></div>
       <p class="muted">${e.queries} consulta(s) ao grafo registradas.</p>`
    : none('Nenhuma consulta ao grafo registrada ainda: nada a comparar.');

  const usage = e.agents
    .filter((a) => Object.values(a.tools).some((v) => v > 0))
    .map((a) => {
      const total = Object.values(a.tools).reduce((x, y) => x + y, 0);
      const segs = (Object.keys(TOOL_NAMES) as ToolCategory[])
        .filter((k) => a.tools[k] > 0)
        .map((k) => `<span style="width:${(a.tools[k] / total) * 100}%;background:${TOOL_COLOR[k]}" title="${TOOL_NAMES[k]}: ≈ ${short(a.tools[k])}"></span>`)
        .join('');
      return `<li><div class="row-head">${dot(a.agent)}${escapeHtml(nameOf(a.agent))}<em>≈ ${short(total)} · via grafo ${pct(a.tools.graph / total)}</em></div><div class="stack">${segs}</div></li>`;
    })
    .join('');
  const noUsage = e.agents.filter((a) => a.logSessions && !Object.values(a.tools).some((v) => v > 0)).map((a) => escapeHtml(nameOf(a.agent)));
  const legend = (Object.keys(TOOL_NAMES) as ToolCategory[]).map((k) => `<span><i style="background:${TOOL_COLOR[k]}"></i>${TOOL_NAMES[k]}</span>`).join('');

  const rows = e.agents
    .map((a) => {
      const [label, cls] = STATUS[a.status];
      return `<tr><td>${dot(a.agent)}${escapeHtml(nameOf(a.agent))}</td><td>${a.logSessions}</td><td>${a.live}</td><td>${a.imported}</td><td>${a.outside}</td><td><b class="st ${cls}">${label}</b></td></tr>`;
    })
    .join('');
  const since = e.agents.map((a) => a.firstLive).filter((d): d is string => !!d).sort()[0];

  return `
    <section class="eco"><header><h3>Economia</h3><span>o que o grafo evitou ler</span></header>${saving}</section>
    <section class="eco"><header><h3>Uso da conversa</h3><span>o que entrou pelas ferramentas</span></header>
      ${usage ? `<ul class="usage">${usage}</ul><div class="tool-legend">${legend}</div>` : none('Sem medição das ferramentas neste projeto.')}
      ${noUsage.length ? `<p class="muted">${noUsage.join(', ')}: os registros não dizem por qual ferramenta o contexto entrou.</p>` : ''}
    </section>
    <section class="eco"><header><h3>Controle do cityPhy</h3><span>${since ? `ao vivo desde ${escapeHtml(formatDate(since))}` : 'nenhuma sessão ao vivo'}</span></header>
      <table class="ctl"><thead><tr><th>IA</th><th title="sessões nos registros da própria IA">registros</th><th title="capturadas pelos ganchos do cityPhy enquanto aconteciam">ao vivo</th><th title="trazidas depois com mem import (controle antigo)">antigas</th><th title="o cityPhy nunca viu">fora</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      <p class="muted">Ao vivo = incluída agora pelos ganchos. Antigas = importadas dos registros depois. Fora = sessões que não passaram pelo cityPhy.</p>
    </section>`;
}

function sectionsHtml(s: ProjectViewState): string {
  const chats = s.work.reduce((n, a) => n + a.sessions.length, 0);
  const t = (key: ProjectSection, label: string) => `<button class="stab${s.section === key ? ' on' : ''}" data-section="${key}">${label}</button>`;
  return `<nav class="stabs inner">${t('summary', 'Resumo')}${t('chats', `Conversas <span>${chats}</span>`)}${t('tools', `Skills e MCP <span>${s.use.skills.length + s.use.mcps.length}</span>`)}</nav>`;
}

const chip = (label: string, n: number, cls: string) => `<span class="chip ${cls}">${escapeHtml(label)}${n > 1 ? ` <b>${n}</b>` : ''}</span>`;

/** Every conversation of every agent here: title, when, turns, and the skills and MCP servers it used. */
function chatsHtml(s: ProjectViewState): string {
  if (!s.work.length) return none('Nenhuma conversa encontrada nos registros das IAs para este projeto.');
  return s.work
    .map((a) => {
      const rows = [...a.sessions]
        .sort((x, y) => (y.lastAt ?? '').localeCompare(x.lastAt ?? ''))
        .slice(0, 60)
        .map((c) => {
          const skills = Object.entries(c.skills).map(([k, n]) => chip(skillKey(k), n, 'sk'));
          const mcps = Object.entries(c.mcp).map(([k, t]) => chip(mcpKey(k, s.mcpNames), Object.values(t).reduce((x, y) => x + y, 0), 'mc'));
          return `<li class="chat"><div class="chat-head"><strong>${escapeHtml(c.title ?? 'sem título')}</strong><em>${c.lastAt ? escapeHtml(formatDate(c.lastAt)) : ''}</em></div>
            <div class="chat-meta">${c.turns} ${c.agent === 'codex' ? 'turno(s)' : 'chamada(s) ao modelo'}${skills.length || mcps.length ? ` · ${[...skills, ...mcps].join('')}` : ''}</div></li>`;
        })
        .join('');
      return `<section class="eco"><header><h3>${dot(a.agent)}${escapeHtml(s.nameOf(a.agent))}</h3><span>${a.sessions.length} conversa(s)</span></header>
        ${a.toolsRecorded ? '' : '<p class="muted">Os registros desta IA não guardam skills nem chamadas de ferramenta: só título, data e turnos.</p>'}<ul class="chats">${rows}</ul></section>`;
    })
    .join('');
}

/** Skills and MCP servers used in this project, linked to the library. */
function toolsHtml(s: ProjectViewState): string {
  const row = (attr: string, name: string, n: number, unit: string, cls: string) =>
    `<button class="srow"${attr}><i class="book ${cls}"></i><span class="sname">${escapeHtml(name)}</span><span class="suse"><b>${n}</b><em>${unit}</em></span></button>`;
  const blind = s.work.filter((a) => !a.toolsRecorded).map((a) => escapeHtml(s.nameOf(a.agent)));
  return `<section class="eco"><header><h3>Skills usadas aqui</h3><span>abre na biblioteca</span></header>
      ${s.use.skills.map(([k, n]) => row(` data-skill="${escapeHtml(k)}"`, k, n, 'vez(es)', 'sk')).join('') || none('Nenhuma skill usada nas conversas medidas.')}</section>
    <section class="eco"><header><h3>MCP usados aqui</h3><span>chamadas</span></header>
      ${s.use.mcps.map(([k, n]) => row(` data-mcpname="${escapeHtml(k)}"`, k, n, 'chamadas', 'mc')).join('') || none('Nenhuma chamada MCP nas conversas medidas.')}</section>
    ${blind.length ? `<p class="muted">${blind.join(', ')}: os registros não dizem quais skills e ferramentas foram usadas.</p>` : ''}`;
}

/** The project panel: one tab per project (paginated), sections (summary, conversations, skills and MCP). */
export function showProjectView(panel: HTMLElement, s: ProjectViewState): void {
  if (s.section === 'summary') showProjectSummary(panel, s);
  else {
    const p = s.projects[s.index];
    panel.innerHTML = `<button class="close" aria-label="Fechar">×</button>${tabs(s)}<p class="kicker">Projeto · condomínio</p><h2>${escapeHtml(p.name)}</h2>
      ${sectionsHtml(s)}${s.section === 'chats' ? chatsHtml(s) : toolsHtml(s)}`;
    panel.hidden = false;
    panel.scrollTop = 0;
    panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
    panel.querySelectorAll<HTMLElement>('[data-project]').forEach((b) => b.addEventListener('click', () => s.onProject(Number(b.dataset.project))));
    panel.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((b) => b.addEventListener('click', () => s.onProject(Number(b.dataset.page) * PROJECTS_PER_PAGE)));
  }
  panel.querySelectorAll<HTMLElement>('[data-section]').forEach((b) => b.addEventListener('click', () => s.onSection(b.dataset.section as ProjectSection)));
  panel.querySelectorAll<HTMLElement>('[data-skill]').forEach((b) => b.addEventListener('click', () => s.onSkill(b.dataset.skill!)));
  panel.querySelectorAll<HTMLElement>('[data-mcpname]').forEach((b) => b.addEventListener('click', () => s.onMcp(b.dataset.mcpname!)));
}

/** Summary section: one chip per part, the four blocks and the savings. */
function showProjectSummary(panel: HTMLElement, s: ProjectViewState): void {
  const p = s.projects[s.index];
  const e = s.economy;
  const part = p.parts.find((x) => x.name === s.part) ?? null;
  const chips = [`<button class="pill${part ? '' : ' on'}" data-part="">todos</button>`, ...p.parts.map((x) => `<button class="pill${x === part ? ' on' : ''}" data-part="${escapeHtml(x.name)}">${escapeHtml(x.name)}</button>`)];
  const o = p.cityphy.options;
  const checks: Check[] = [];
  for (const a of e.agents) {
    if (a.logSessions && !o.agents.includes(a.agent)) checks.push({ level: 'warn', text: `${escapeHtml(s.nameOf(a.agent))} trabalha aqui (${a.logSessions} sessões) sem estar registrado no setup.` });
    if (a.outside && a.status !== 'outside') checks.push({ level: 'info', text: `${a.outside} sessão(ões) de ${escapeHtml(s.nameOf(a.agent))} não passaram pelo cityPhy.` });
  }
  if (o.graph && !e.queries) checks.push({ level: 'warn', text: 'O grafo está ligado, mas nenhuma consulta foi registrada: as IAs leem arquivos inteiros.' });
  if (e.inject.on && e.inject.lessons !== null && e.inject.lessons > e.inject.budget) checks.push({ level: 'warn', text: `LESSONS.md (≈ ${short(e.inject.lessons)}) passa do orçamento de ${short(e.inject.budget)} injetado por sessão.` });
  if (e.avoided && e.saved / e.avoided > 0.5) checks.push({ level: 'ok', text: `As consultas ao grafo evitaram ${pct(e.saved / e.avoided)} da leitura.` });

  showPiece(panel, {
    kicker: part ? `Projeto · ${p.name}` : 'Projeto · condomínio',
    title: part ? part.name : p.name,
    badges: chips,
    context: `<div class="stats">${stat(e.inject.on ? `≈ ${short(e.inject.budget)}` : 'desligado', 'resumo injetado por sessão')}${stat(e.inject.lessons === null ? '—' : `≈ ${short(e.inject.lessons)}`, 'LESSONS.md')}</div>`,
    input: part
      ? `<div class="stats">${stat(short(part.nodes), 'símbolos no grafo')}${stat(String(part.files), 'arquivos')}</div>`
      : `<div class="stats">${stat(short(p.nodes), 'símbolos no grafo')}${stat(short(p.edges), 'ligações')}${stat(String(e.queries), 'consultas')}</div>`,
    output: s.feeds.length
      ? `<ul class="rows">${e.agents.map((a) => `<li>${dot(a.agent)}${escapeHtml(s.nameOf(a.agent))} · ${a.logSessions} sessões <span class="muted-inline">· ${escapeHtml(s.feeds.find((f) => f.agent === a.agent)?.status ?? 'sem energia')}</span></li>`).join('')}</ul>`
      : none('Nenhuma IA alimenta este projeto.'),
    checks,
    more: economyHtml(e, s.nameOf),
  });
  panel.querySelector('.kicker')!.insertAdjacentHTML('beforebegin', tabs(s));
  panel.querySelector('h2')!.insertAdjacentHTML('afterend', sectionsHtml(s));
  panel.querySelectorAll<HTMLElement>('[data-project]').forEach((b) => b.addEventListener('click', () => s.onProject(Number(b.dataset.project))));
  panel.querySelectorAll<HTMLButtonElement>('[data-page]').forEach((b) => b.addEventListener('click', () => s.onProject(Number(b.dataset.page) * PROJECTS_PER_PAGE)));
  panel.querySelectorAll<HTMLElement>('[data-part]').forEach((b) => b.addEventListener('click', () => s.onPart(b.dataset.part || null)));
}
