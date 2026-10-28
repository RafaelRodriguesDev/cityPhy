import type { Library } from '../library/types.ts';
import { type AgentView, groundOf, short } from './agentView.ts';
import { escapeHtml } from './format.ts';

export interface HudHandlers {
  onAgent(agent: string): void;
  onLibrary(): void;
}

/** Findings worth a look across the city (the same rules the panels use). */
export function alertsOf(agents: AgentView[], lib: Library): string[] {
  const out: string[] = [];
  const divergent = lib.skills.filter((s) => s.divergent).length;
  if (divergent) out.push(`${divergent} skill(s) com cópias diferentes`);
  for (const a of agents) for (const w of a.consumption?.windows ?? []) if (w.usedPercent >= 85) out.push(`${a.name}: ${w.label} em ${w.calibrated ? '≈ ' : ''}${Math.round(w.usedPercent)}%`);
  const remote = lib.mcps.filter((m) => m.transport === 'remote').length;
  if (remote) out.push(`${remote} MCP remoto(s)`);
  return out;
}

/** Top bar: four numbers that answer "how is it going" before anything is clicked. */
export function renderHud(el: HTMLElement, agents: AgentView[], lib: Library, on: HudHandlers): void {
  const heaviest = [...agents].filter((a) => a.tower).sort((x, y) => groundOf(y.tower).tokens - groundOf(x.tower).tokens)[0];
  const week = agents.reduce((s, a) => s + (a.consumption?.week.fresh ?? 0), 0);
  const today = agents.reduce((s, a) => s + (a.consumption?.today.fresh ?? 0), 0);
  const busiest = [...agents].sort((x, y) => (y.consumption?.week.fresh ?? 0) - (x.consumption?.week.fresh ?? 0))[0];
  const active = agents.filter((a) => a.activeNow);
  const alerts = alertsOf(agents, lib);

  const card = (key: string, value: string, label: string, caption: string, cls = '') =>
    `<button class="kpi ${cls}" data-kpi="${key}"><span class="label">${label}</span><strong>${value}</strong><span class="caption">${caption}</span></button>`;
  el.innerHTML = [
    card('ground', heaviest ? `≈ ${short(groundOf(heaviest.tower).tokens)}` : '—', 'Contexto fixo', heaviest ? `tokens por sessão · ${escapeHtml(heaviest.name)}` : 'nenhuma torre'),
    card('week', short(week), 'Consumo da semana', `tokens novos · hoje ${short(today)}`),
    card('active', `${active.length} de ${agents.length}`, 'IAs trabalhando', active.length ? escapeHtml(active.map((a) => a.name).join(', ')) : 'nenhuma agora', active.length ? 'live' : ''),
    card('alerts', String(alerts.length), 'Atenção', alerts.length ? escapeHtml(alerts[0]) + (alerts.length > 1 ? '…' : '') : 'nada fora do esperado', alerts.length ? 'warn' : 'ok'),
  ].join('');
  el.hidden = false;
  const click = (key: string, fn: () => void) => el.querySelector(`[data-kpi="${key}"]`)!.addEventListener('click', fn);
  click('ground', () => heaviest && on.onAgent(heaviest.agent));
  click('week', () => busiest && on.onAgent(busiest.agent));
  click('active', () => (active[0] ? on.onAgent(active[0].agent) : undefined));
  click('alerts', () => on.onLibrary());
}
