import { callPresets, estimateForCalls, groupByModel, statOf, type Multipliers } from '../metrics/modelStats.ts';
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
    { model, effort: 'todos', calls: 0, sessions: 0, input: 0, cacheWrite: 0, cacheRead: 0, output: 0, reasoning: 0, sessionTotals: [] as number[], sessionCalls: [] as number[] },
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

/** Table of the calculator for N calls (re-rendered while the person types). */
function calculatorTable(rows: ModelBreakdown[], calls: number, multiplier: number | null): string {
  const est = estimateForCalls(rows, calls, multiplier);
  const body = est
    .map(
      (e) => `<tr><td>${escapeHtml(e.effort)}</td><td>≈ ${n(e.fresh)}</td><td>≈ ${n(e.cached)}</td><td>${e.ratio === null ? '—' : `${e.ratio.toFixed(1)}×`}</td><td>${e.weighted === null ? '—' : `≈ ${n(e.weighted)}`}</td></tr>`,
    )
    .join('');
  const single = est.length === 1
    ? `<p class="note">Só há dados do nível <strong>${escapeHtml(est[0].effort)}</strong> neste modelo, então não dá para comparar níveis ainda. Use outro nível em uma tarefa (ou o teste real, quando existir) e a comparação aparece aqui.</p>`
    : '';
  return `<table class="grid"><thead><tr><th>Nível</th><th>Tokens novos</th><th>Do cache</th><th>vs ref.</th><th>× custo</th></tr></thead><tbody>${body}</tbody></table>${single}`;
}

function calculatorTab(rows: ModelBreakdown[], multiplier: number | null): string {
  const presets = callPresets(rows);
  return `
    <p class="muted">Quanto custaria uma tarefa em cada nível, pela média por chamada deste modelo aqui.</p>
    <label class="calc-input">Chamadas na tarefa <input type="number" min="1" step="1" value="${presets['média']}" class="calls"></label>
    <div class="pills">${(['pequena', 'média', 'grande'] as const).map((s) => `<button class="pill preset${s === 'média' ? ' on' : ''}" data-calls="${presets[s]}">${s} (${n(presets[s])})</button>`).join('')}</div>
    <div class="calc-result">${calculatorTable(rows, presets['média'], multiplier)}</div>
    <p class="muted">Tokens novos = entrada sem cache + escrita no cache + saída (o que pesa no custo). Do cache = reaproveitado, bem mais barato.
    Atalhos = suas sessões reais (25/50/75%). "vs ref." compara com o nível medium (ou o mais usado). × custo usa o multiplicador do cityphy.config.json.</p>`;
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
  const multiplier = multipliers[band.model]?.multiplier ?? null;
  const input = panel.querySelector<HTMLInputElement>('input.calls')!;
  const result = panel.querySelector<HTMLElement>('.calc-result')!;
  const update = () => {
    const calls = Math.max(1, Math.round(Number(input.value) || 1));
    result.innerHTML = calculatorTable(band.allRows, calls, multiplier);
    panel.querySelectorAll<HTMLButtonElement>('.preset').forEach((b) => b.classList.toggle('on', Number(b.dataset.calls) === calls));
  };
  input.addEventListener('input', update);
  panel.querySelectorAll<HTMLButtonElement>('.preset').forEach((b) =>
    b.addEventListener('click', () => {
      input.value = b.dataset.calls!;
      update();
    }),
  );
  panel.hidden = false;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
