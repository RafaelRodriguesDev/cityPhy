import type { ToolConsumption } from '../metrics/consumption/types.ts';
import { short } from '../ui/agentView.ts';
import { escapeHtml, formatDate } from '../ui/format.ts';

const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/** Next moment (local time) at hh:mm, today or tomorrow. */
export function nextTime(hhmm: string, now = new Date()): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const d = new Date(now);
  d.setHours(Number(m[1]), Number(m[2]), 0, 0);
  if (d <= now) d.setDate(d.getDate() + 1);
  return d;
}

/** Next moment (local time) on that weekday (0 = Sunday) at hh:mm, within 7 days. */
export function nextWeekday(day: number, hhmm: string, now = new Date()): Date | null {
  const t = nextTime(hhmm, now);
  if (!t || day < 0 || day > 6) return null;
  const d = new Date(now);
  d.setHours(t.getHours(), t.getMinutes(), 0, 0);
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  if (d <= now) d.setDate(d.getDate() + 7);
  return d;
}

function currentHtml(c: ToolConsumption): string {
  const row = (minutes: number, name: string) => {
    const w = c.windows.find((x) => x.minutes === minutes);
    if (!w?.calibrated) return `<li><b>${name}</b> <span class="muted-inline">sem calibração ainda</span></li>`;
    const k = w.calibrated;
    const reset = w.resetsAt ? ` · redefine ${escapeHtml(formatDate(w.resetsAt))}` : ' · sem janela aberta agora';
    return `<li><b>${name} ≈ ${Math.round(w.usedPercent)}%</b> <span class="muted-inline">${short(k.used)} de ≈ ${short(k.limit)} tokens novos${reset}<br>
      ${k.fromApp} leitura(s) do app · ${k.fromBlocks} bloqueio(s) registrado(s)</span></li>`;
  };
  return `<ul class="rows">${row(300, 'Sessão (5 horas)')}${row(10080, 'Semana')}</ul>`;
}

/**
 * "Limites do plano" under the Claude panel: what the estimate says now, and a form to type what the app shows
 * (session and week percent, and when each resets). Each reading becomes one sample of the limit.
 */
export function appendCalibration(panel: HTMLElement, c: ToolConsumption, onSaved: () => void): void {
  const section = document.createElement('section');
  section.className = 'eco calib';
  section.innerHTML = `<header><h3>Limites do plano</h3><span>calibrar com o app</span></header>
    ${currentHtml(c)}
    <p class="muted">O Claude Code não grava o % do plano no computador. Abra <b>Limites de uso do plano</b> no app do Claude e copie os números:
    cada leitura vira uma amostra do limite, junto com as vezes em que o app bloqueou por limite (registradas nos logs).</p>
    <form class="calib-form">
      <label>Sessão <input name="sp" type="number" min="1" max="100" placeholder="%" inputmode="numeric"> % · redefine às <input name="st" type="time"></label>
      <label>Semana <input name="wp" type="number" min="1" max="100" placeholder="%" inputmode="numeric"> % · reinicia
        <select name="wd">${WEEKDAYS.map((d, i) => `<option value="${i}"${i === 6 ? ' selected' : ''}>${d}</option>`).join('')}</select>
        <input name="wt" type="time" value="16:00"></label>
      <div class="calib-actions"><button type="submit">Salvar leitura</button><span class="calib-msg" role="status"></span></div>
    </form>
    ${c.calibration?.samples.length ? `<details><summary>Leituras salvas (${c.calibration.samples.length})</summary><ul class="rows">${[...c.calibration.samples]
      .reverse()
      .map((s) => `<li>${s.kind === 'session' ? 'Sessão' : 'Semana'} ${s.percent}% <span class="muted-inline">· ${short(s.tokens)} tokens vistos · ${escapeHtml(formatDate(s.at))}</span></li>`)
      .join('')}</ul></details>` : ''}`;
  panel.appendChild(section);

  const form = section.querySelector<HTMLFormElement>('.calib-form')!;
  const msg = section.querySelector<HTMLElement>('.calib-msg')!;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const readings: Array<{ kind: 'session' | 'week'; percent: number; resetsAt: Date | null }> = [];
    if (f.get('sp')) readings.push({ kind: 'session', percent: Number(f.get('sp')), resetsAt: nextTime(String(f.get('st') ?? '')) });
    if (f.get('wp')) readings.push({ kind: 'week', percent: Number(f.get('wp')), resetsAt: nextWeekday(Number(f.get('wd')), String(f.get('wt') ?? '')) });
    if (!readings.length) {
      msg.textContent = 'Digite ao menos um percentual.';
      return;
    }
    if (readings.some((r) => !r.resetsAt)) {
      msg.textContent = 'Preencha o horário em que a janela redefine.';
      return;
    }
    msg.textContent = 'Salvando…';
    for (const r of readings) {
      const res = await fetch('/api/calibrate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: r.kind, percent: r.percent, resetsAt: r.resetsAt!.toISOString() }) });
      const out = await res.json().catch(() => ({ error: 'Resposta inválida do servidor.' }));
      if (!res.ok) {
        msg.textContent = `${r.kind === 'session' ? 'Sessão' : 'Semana'}: ${out.error ?? 'não salvou'}`;
        return;
      }
    }
    msg.textContent = 'Salvo.';
    onSaved();
  });
}
