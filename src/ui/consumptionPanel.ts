import type { ToolConsumption } from '../metrics/consumption/types.ts';
import { blockValues, type ConsumptionBlock } from '../scene/consumptionTower.ts';
import { type Check, showPiece, stat } from './blocks.ts';
import { short } from './agentView.ts';
import { escapeHtml, formatDate } from './format.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
export const SOURCE_TEXT = {
  plano: 'percentual real do plano, informado pela ferramenta',
  calibrado: 'estimado: limite calibrado pelo % que você leu no app e pelos bloqueios registrados',
  limite: 'seu limite no cityphy.config.json',
  histórico: 'comparado ao dia mais pesado dos últimos 7 (semana: 7 dias desse pico)',
  'sem limite': 'nenhum uso nos últimos 7 dias',
} as const;

/** Bars of the last 7 days (fresh tokens), as plain HTML. */
function daysHtml(c: ToolConsumption): string {
  const max = Math.max(1, ...c.days.map((d) => d.fresh));
  return `<div class="bars">${c.days
    .map((d) => `<div class="bar" title="${n(d.fresh)} tokens novos · ${n(d.calls)} chamadas"><span style="height:${Math.round((d.fresh / max) * 100)}%"></span><em>${d.date.slice(8)}/${d.date.slice(5, 7)}</em></div>`)
    .join('')}</div>`;
}

/** Panel of a tool's consumption tower: how full, what 100% means, the last 7 days. */
export function showConsumption(panel: HTMLElement, b: ConsumptionBlock, toolName: string): void {
  const c = b.consumption;
  const values = blockValues(c);
  const fills = values
    .map((v) => `<dt>${escapeHtml(v.label)}</dt><dd>${v.fill === null ? '—' : `<b>${Math.round(v.fill * 100)}%</b>`} <span class="muted-inline">${SOURCE_TEXT[v.source]}</span></dd>`)
    .join('');

  const checks: Check[] = [];
  for (const v of values) if (v.source !== 'histórico' && (v.fill ?? 0) >= 0.85) checks.push({ level: 'warn', text: `${escapeHtml(v.label)} em ${Math.round(v.fill! * 100)}% do ${v.source === 'plano' || v.source === 'calibrado' ? 'plano' : 'seu limite'}.` });
  if (values.every((v) => v.source === 'histórico' || v.source === 'sem limite'))
    checks.push({ level: 'info', text: `Sem 100% real: defina <code>"tools": { "${escapeHtml(c.agent)}": { "weeklyLimit": … } }</code> no config para medir contra o seu plano.` });
  const stale = c.windows.filter((w) => w.resetsAt && Date.parse(w.resetsAt) < Date.now());
  if (stale.length) checks.push({ level: 'info', text: `Janela ${stale.map((w) => escapeHtml(w.label)).join(', ')} já reiniciou; a ferramenta ainda não informou a nova.` });
  for (const w of c.windows) checks.push({ level: 'info', text: `Plano · ${escapeHtml(w.label)}: ${w.calibrated ? '≈ ' : ''}${Math.round(w.usedPercent)}%${w.calibrated ? ' (estimado)' : ''} (reinicia ${formatDate(w.resetsAt)}).` });

  showPiece(panel, {
    kicker: `${toolName} · torre de consumo (todas as pastas)`,
    title: `Consumo de ${toolName}`,
    context: `<dl>${fills}</dl>`,
    input: `<div class="stats">${stat(short(c.week.cached), 'lidos do cache na semana')}${stat(n(c.week.calls), 'chamadas na semana')}</div><p class="muted">Cache sai mais barato: é o que a ferramenta reaproveita da conversa.</p>`,
    output: `<div class="stats">${stat(short(c.today.fresh), 'tokens novos hoje')}${stat(short(c.week.fresh), 'tokens novos na semana')}</div>${daysHtml(c)}<p class="muted">Tokens novos = entrada sem cache + escrita no cache + saída.</p>`,
    checks,
  });
}
