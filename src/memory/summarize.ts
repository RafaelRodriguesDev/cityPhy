import type { Observation } from './schema.ts';

const shortDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** One line per session, built only from what was recorded (no model involved). */
export function summarizeSession(obs: Observation[]): string {
  if (!obs.length) return '';
  const first = obs[0];
  const prompts = obs.filter((o) => o.kind === 'prompt').map((o) => o.summary.replace(/^pedido: /, ''));
  const edited = [...new Set(obs.filter((o) => o.kind === 'edit').flatMap((o) => o.files))];
  const commands = obs.filter((o) => o.kind === 'command').length;
  const queries = obs.filter((o) => o.kind === 'graph-query').length;
  const parts = [`${shortDate(first.at)} · ${first.agent}`];
  if (prompts.length) parts.push(`pedido: ${prompts[0]}${prompts.length > 1 ? ` (+${prompts.length - 1})` : ''}`);
  if (edited.length) parts.push(`editou ${edited.length}: ${edited.slice(0, 4).join(', ')}${edited.length > 4 ? '…' : ''}`);
  if (commands) parts.push(`${commands} comando(s)`);
  if (queries) parts.push(`${queries} consulta(s) ao grafo`);
  return parts.join(' · ');
}

/** LESSONS.md: most recent sessions first, cut to ≈ `budgetTokens` (4 characters per token). */
export function buildLessons(projectName: string, sessions: Observation[][], budgetTokens: number): string {
  const header = `# Trabalho recente em ${projectName}\n\n`;
  let out = header;
  for (const s of sessions) {
    const line = `- ${summarizeSession(s)}\n`;
    if ((out + line).length / 4 > budgetTokens) break;
    out += line;
  }
  return out === header ? `${header}- (nada registrado ainda)\n` : out;
}
