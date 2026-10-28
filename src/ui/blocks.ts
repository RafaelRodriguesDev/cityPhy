import { escapeHtml } from './format.ts';

/** A finding in "Esperado × real": ok (as expected), warn (worth a look) or info. */
export interface Check {
  level: 'ok' | 'warn' | 'info';
  text: string; // already-escaped HTML
}

/** Every piece of the city opens with the same four blocks, in the same order. */
export interface PieceSpec {
  kicker: string; // what kind of piece and where ("Claude · torre")
  title: string;
  badges?: string[]; // short already-escaped HTML pills under the title
  /** What is paid in every session. */
  context: string;
  /** What the agent fetches on demand / what comes in. */
  input: string;
  /** What it produced / what goes out. */
  output: string;
  /** Expected vs. actual. */
  checks: Check[];
  /** Optional extra section after the blocks (charts, links). */
  more?: string;
}

const BLOCKS = [
  ['context', 'Contexto', 'o que é pago em toda sessão'],
  ['input', 'Entrada', 'o que é buscado quando precisa'],
  ['output', 'Saída', 'o que foi produzido ou gasto'],
] as const;

const ICON = { ok: '✓', warn: '!', info: 'i' } as const;

export const none = (why: string) => `<p class="empty">${escapeHtml(why)}</p>`;

/** Big number + caption, the unit every block uses. */
export const stat = (value: string, caption: string) => `<div class="stat"><strong>${value}</strong><span>${escapeHtml(caption)}</span></div>`;

/** Renders a piece in the side panel with the four fixed blocks. */
export function showPiece(panel: HTMLElement, p: PieceSpec): void {
  const blocks = BLOCKS.map(
    ([key, title, hint]) => `<section class="block b-${key}"><header><h3>${title}</h3><span>${hint}</span></header>${p[key] || none('—')}</section>`,
  ).join('');
  const checks = p.checks.length
    ? `<ul class="checks">${p.checks.map((c) => `<li class="${c.level}"><i class="ic">${ICON[c.level]}</i><span>${c.text}</span></li>`).join('')}</ul>`
    : none('Nada fora do esperado.');
  panel.innerHTML = `
    <button class="close" aria-label="Fechar">×</button>
    <p class="kicker">${escapeHtml(p.kicker)}</p>
    <h2>${escapeHtml(p.title)}</h2>
    ${p.badges?.length ? `<div class="pills">${p.badges.join('')}</div>` : ''}
    ${blocks}
    <section class="block b-check"><header><h3>Esperado × real</h3><span>o que olhar</span></header>${checks}</section>
    ${p.more ?? ''}`;
  panel.hidden = false;
  panel.scrollTop = 0;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
