import type { ToolConsumption } from '../metrics/consumption/types.ts';
import { blockValues, type ConsumptionBlock } from '../scene/consumptionTower.ts';
import { escapeHtml, formatDate } from './format.ts';
import { renderTabs } from './tabs.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
const SOURCE_TEXT = { plano: 'percentual real do plano, informado pela ferramenta', limite: 'seu limite no cityphy.config.json', 'sem limite': 'sem 100% definido' } as const;

/** Bars of the last 7 days (fresh tokens), as plain HTML. */
function daysHtml(c: ToolConsumption): string {
  const max = Math.max(1, ...c.days.map((d) => d.fresh));
  return `<div class="bars">${c.days
    .map((d) => `<div class="bar" title="${n(d.fresh)} tokens novos · ${n(d.calls)} chamadas"><span style="height:${Math.round((d.fresh / max) * 100)}%"></span><em>${d.date.slice(8)}/${d.date.slice(5, 7)}</em></div>`)
    .join('')}</div>`;
}

function blocksHtml(c: ToolConsumption): string {
  return blockValues(c)
    .map((v) => `<dt>${escapeHtml(v.label)}</dt><dd>${v.fill === null ? '—' : `${Math.round(v.fill * 100)}%`} <span class="muted-inline">(${SOURCE_TEXT[v.source]})</span></dd>`)
    .join('');
}

/** Panel of a tool's consumption tower: now, last 7 days and how the 100% is defined. */
export function showConsumption(panel: HTMLElement, b: ConsumptionBlock, toolName: string): void {
  const c = b.consumption;
  panel.innerHTML = `
    <button class="close" aria-label="Fechar">×</button>
    <p class="kicker">${escapeHtml(toolName)} · torre de consumo (todas as pastas)</p>
    <h2>Consumo de ${escapeHtml(toolName)}</h2>
    <div class="tabs-host"></div>`;
  renderTabs(panel.querySelector('.tabs-host')!, [
    {
      label: 'Agora',
      html: `
        <div class="metrics"><div><span>Hoje (tokens novos)</span><strong>${n(c.today.fresh)}</strong></div><div><span>Semana (tokens novos)</span><strong>${n(c.week.fresh)}</strong></div></div>
        <dl>${blocksHtml(c)}
          <dt>Do cache</dt><dd>hoje ${n(c.today.cached)} · semana ${n(c.week.cached)}</dd>
          <dt>Chamadas</dt><dd>hoje ${n(c.today.calls)} · semana ${n(c.week.calls)}</dd></dl>`,
    },
    { label: '7 dias', html: `${daysHtml(c)}<p class="muted">Tokens novos por dia (entrada sem cache + escrita no cache + saída).</p>` },
    {
      label: 'Limites',
      html: `${
        c.windows.length
          ? `<h3>Janelas do plano (informadas pela ferramenta)</h3><ul>${c.windows.map((w) => `<li>${escapeHtml(w.label)}: ${w.usedPercent}% · reinicia ${formatDate(w.resetsAt)}</li>`).join('')}</ul>`
          : '<p class="muted">Esta ferramenta não informa o uso do plano nos registros.</p>'
      }
        <h3>Seus limites</h3>
        <dl><dt>Diário</dt><dd>${c.limits.daily === null ? 'não definido' : `${n(c.limits.daily)} tokens`}</dd><dt>Semanal</dt><dd>${c.limits.weekly === null ? 'não definido' : `${n(c.limits.weekly)} tokens`}</dd></dl>
        <p class="muted">Para definir o 100%: no <code>cityphy.config.json</code> (local), <code>"tools": { "${escapeHtml(c.agent)}": { "dailyLimit": 2000000, "weeklyLimit": 10000000 } }</code>.</p>`,
    },
  ]);
  panel.hidden = false;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
