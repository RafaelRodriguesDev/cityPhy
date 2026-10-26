import type { FloorData } from '../towers/schema.ts';

export const LOAD_TEXT: Record<FloorData['load'], string> = {
  always: 'carregado em toda sessão',
  'on-demand': 'aberto quando preciso',
  history: 'histórico (não carregado)',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function formatBytes(b: number | null): string {
  if (b === null) return 'não medido';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export function formatTokens(t: number | null): string {
  if (t === null) return 'não medido';
  return `≈ ${t.toLocaleString('pt-BR')} tokens`;
}

export function formatDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}
