import { estimateByEffort, groupByModel, statOf, type Multipliers, type TaskSize } from '../metrics/modelStats.ts';
import type { ModelBreakdown } from '../metrics/usage/types.ts';
import type { ModelBand } from '../scene/modelTowers.ts';
import { escapeHtml } from './format.ts';
import { renderTabs } from './tabs.ts';

const n = (v: number) => v.toLocaleString('pt-BR');
const pct = (v: number) => `${Math.round(v * 100)}%`;
const mult = (m: number | null) => (m === null ? 'não informado' : `${m}x`);

function summaryTab(rows: ModelBreakdown[], model: string, multipliers: Multipliers, projects: string[]): string {
  const all = rows.reduce(
    (t, r) => ({ ...t, calls: t.calls + r.calls, sessions: t.sessions + r.sessions, input: t.input + r.input, cacheWrite: t.cacheWrite + r.cacheWrite, cacheRead: t.cacheRead + r.cacheRead, output: t.output + r.output, reasoning: t.reasoning + r.reasoning }),
    { model, effort: 'todos', calls: 0, sessions: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, sessionTotals: [] as number[] },
  );
  const s = statOf(all, multipliers);
  return `
    <div class="metrics"><div><span>Tokens no total</span><strong>${n(s.total)}</strong></div><div><span>Custo relativo</span><strong>${mult(s.multiplier)}</strong></div></div>
    <dl>
      <dt>Chamadas</dt><dd>${n(s.calls)} em ${n(s.sessions)} sessão(ões)</dd>
      <dt>Por sessão</dt><dd>≈ ${n(s.perSession)} tokens</dd>
      <dt>Do cache</dt><dd>${pct(s.cacheShare)} da entrada (mais barato)</dd>
      <dt>Raciocínio</dt><dd>${pct(s.reasoningShare)} da saída</dd>
      <dt>Ponderado</dt><dd>${s.weighted === null ? 'defina o multiplicador em cityphy.config.json → models' : `≈ ${n(s.weighted)} (tokens × ${s.multiplier})`}</dd>
      <dt>Projetos</dt><dd>${projects.map(escapeHtml).join(', ') || '—'}</dd>
    </dl>`;
}

function levelsTab(rows: ModelBreakdown[], multipliers: Multipliers): string {
  const body = rows
    .map((r) => statOf(r, multipliers))
    .map((s) => `<tr><td>${escapeHtml(s.effort)}</td><td>${n(s.calls)}</td><td>${n(s.perCall)}</td><td>${n(s.perSession)}</td><td>${pct(s.reasoningShare)}</td></tr>`)
    .join('');
  return `<table class="grid"><thead><tr><th>Nível</th><th>Chamadas</th><th>Tokens/chamada</th><th>Tokens/sessão</th><th>Raciocínio</th></tr></thead><tbody>${body}</tbody></table>
    <p class="muted">Médias desta máquina. Nível sem linha = nunca usado.</p>`;
}

function calculatorTab(rows: ModelBreakdown[], multiplier: number | null): string {
  const sizes: TaskSize[] = ['pequena', 'média', 'grande'];
  const tables = sizes
    .map((size) => {
      const est = estimateByEffort(rows, size, multiplier);
      const body = est
        .map((e) => `<tr><td>${escapeHtml(e.effort)}</td><td>${e.tokens === null ? 'sem dados' : `≈ ${n(e.tokens)}`}</td><td>${e.ratio === null ? '—' : `${e.ratio.toFixed(1)}×`}</td><td>${e.weighted === null ? '—' : `≈ ${n(e.weighted)}`}</td><td>${e.samples}</td></tr>`)
        .join('');
      return `<div class="calc" data-size="${size}"${size === 'média' ? '' : ' hidden'}><table class="grid"><thead><tr><th>Nível</th><th>Tokens</th><th>vs ref.</th><th>× custo</th><th>Sessões</th></tr></thead><tbody>${body}</tbody></table></div>`;
    })
    .join('');
  return `
    <p class="muted">Quanto custaria uma tarefa em cada nível, pelo que este modelo já gastou aqui.</p>
    <div class="pills">${sizes.map((s) => `<button class="pill size${s === 'média' ? ' on' : ''}" data-size="${s}">tarefa ${s}</button>`).join('')}</div>
    ${tables}
    <p class="muted">Pequena/média/grande = sessões reais no quartil 25/50/75. "vs ref." compara com o nível medium (ou o mais usado).</p>`;
}

function compareTab(agentRows: ModelBreakdown[], multipliers: Multipliers): string {
  const body = groupByModel(agentRows)
    .map((g) => {
      const merged = g.rows.reduce((t, r) => ({ ...t, calls: t.calls + r.calls, sessions: t.sessions + r.sessions, input: t.input + r.input, cacheWrite: t.cacheWrite + r.cacheWrite, cacheRead: t.cacheRead + r.cacheRead, output: t.output + r.output, reasoning: t.reasoning + r.reasoning }), { ...g.rows[0], effort: 'todos', calls: 0, sessions: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0 });
      const s = statOf(merged, multipliers);
      return `<tr><td>${escapeHtml(g.model)}</td><td>${n(s.perSession)}</td><td>${pct(s.cacheShare)}</td><td>${mult(s.multiplier)}</td><td>${s.weighted === null ? '—' : n(s.weighted)}</td></tr>`;
    })
    .join('');
  return `<table class="grid"><thead><tr><th>Modelo</th><th>Tokens/sessão</th><th>Cache</th><th>Custo</th><th>Ponderado</th></tr></thead><tbody>${body}</tbody></table>`;
}

/** Side panel of a model tower: summary, levels, calculator and comparison with the agent's other models. */
export function showModel(panel: HTMLElement, band: ModelBand, agentName: string, agentRows: ModelBreakdown[], multipliers: Multipliers, projects: string[]): void {
  panel.innerHTML = `
    <button class="close" aria-label="Fechar">×</button>
    <p class="kicker">${escapeHtml(agentName)} · modelo · nível ${escapeHtml(band.row.effort)}</p>
    <h2>${escapeHtml(band.model)}</h2>
    <div class="tabs-host"></div>`;
  renderTabs(panel.querySelector('.tabs-host')!, [
    { label: 'Resumo', html: summaryTab(band.allRows, band.model, multipliers, projects) },
    { label: 'Níveis', html: levelsTab(band.allRows, multipliers) },
    { label: 'Calculadora', html: calculatorTab(band.allRows, multipliers[band.model]?.multiplier ?? null) },
    { label: 'Comparar', html: compareTab(agentRows, multipliers) },
  ]);
  panel.querySelectorAll<HTMLButtonElement>('.size').forEach((b) =>
    b.addEventListener('click', () => {
      panel.querySelectorAll('.size').forEach((x) => x.classList.toggle('on', x === b));
      panel.querySelectorAll<HTMLElement>('.calc').forEach((c) => (c.hidden = c.dataset.size !== b.dataset.size));
    }),
  );
  panel.hidden = false;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
