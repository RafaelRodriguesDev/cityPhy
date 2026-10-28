import type { Library } from '../library/types.ts';
import { alertsOf } from '../ui/hud.ts';
import { type AgentView, groundOf, short } from '../ui/agentView.ts';
import { escapeHtml } from '../ui/format.ts';
import type { ProjectEconomy } from './economy.ts';

export interface HudHandlers {
  onAgent(a: string): void;
  onProjects(): void;
  onLibrary(): void;
}

/** Five numbers on top: fixed context, week, who works now, what cityPhy saved, what to look at. */
export function renderMaqueteHud(el: HTMLElement, agents: AgentView[], economies: ProjectEconomy[], lib: Library, on: HudHandlers): void {
  const heaviest = [...agents].filter((a) => a.tower).sort((x, y) => groundOf(y.tower).tokens - groundOf(x.tower).tokens)[0];
  const week = agents.reduce((s, a) => s + (a.consumption?.week.fresh ?? 0), 0);
  const active = agents.filter((a) => a.activeNow);
  const saved = economies.reduce((s, e) => s + e.saved, 0);
  const queries = economies.reduce((s, e) => s + e.queries, 0);
  const rows = economies.flatMap((e) => e.agents);
  // A tool's own logs may already have dropped sessions cityPhy kept: count what is known from either side.
  const logs = rows.reduce((s, a) => s + Math.max(a.logSessions, a.live + a.imported), 0);
  const live = rows.reduce((s, a) => s + a.live, 0);
  const alerts = alertsOf(agents, lib);
  const card = (key: string, label: string, value: string, caption: string, cls = '') =>
    `<button class="kpi ${cls}" data-k="${key}"><span class="label">${label}</span><strong>${value}</strong><span class="caption">${escapeHtml(caption)}</span></button>`;
  el.innerHTML = [
    card('ctx', 'Contexto fixo', heaviest ? `≈ ${short(groundOf(heaviest.tower).tokens)}` : '—', heaviest ? `tokens por sessão · ${heaviest.name}` : 'sem torre'),
    card('week', 'Consumo da semana', short(week), 'tokens novos, todas as IAs'),
    card('live', 'IAs trabalhando', `${active.length} de ${agents.length}`, active.map((a) => a.name).join(', ') || 'nenhuma agora', active.length ? 'live' : ''),
    card('saved', 'Economia do cityPhy', saved ? `≈ ${short(saved)}` : '—', `${queries} consultas · ${live} de ${logs} sessões no controle`, saved ? 'ok' : ''),
    card('warn', 'Atenção', String(alerts.length), alerts[0] ?? 'nada fora do esperado', alerts.length ? 'warn' : ''),
  ].join('');
  el.hidden = false;
  el.querySelector('[data-k="ctx"]')!.addEventListener('click', () => heaviest && on.onAgent(heaviest.agent));
  el.querySelector('[data-k="week"]')!.addEventListener('click', () => agents[0] && on.onAgent([...agents].sort((x, y) => (y.consumption?.week.fresh ?? 0) - (x.consumption?.week.fresh ?? 0))[0].agent));
  el.querySelector('[data-k="live"]')!.addEventListener('click', () => active[0] && on.onAgent(active[0].agent));
  el.querySelector('[data-k="saved"]')!.addEventListener('click', () => on.onProjects());
  el.querySelector('[data-k="warn"]')!.addEventListener('click', () => on.onLibrary());
}
