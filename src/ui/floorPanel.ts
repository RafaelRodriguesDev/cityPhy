import { SECTION_NAMES, type TowerGraph } from '../towers/schema.ts';
import type { PlacedFloor } from '../scene/towerMesh.ts';
import { type Check, none, showPiece, stat } from './blocks.ts';
import { LOAD_TEXT, escapeHtml, formatBytes, formatDate } from './format.ts';

const RELATION_TEXT = { indexes: 'indexa', links_to: 'liga a', lists: 'lista', loads: 'carrega' } as const;
const n = (v: number) => v.toLocaleString('pt-BR');
const DAY = 86_400_000;

/** Side panel with the selected floor: how it loads, how heavy it is, its cables. */
export function showFloor(panel: HTMLElement, f: PlacedFloor, graph: TowerGraph): void {
  const d = f.node.cityphy;
  const label = (id: string) => graph.nodes.find((x) => x.id === id)?.label ?? id;
  const out = graph.links.filter((l) => l.source === f.node.id).map((l) => `${RELATION_TEXT[l.relation]} → ${escapeHtml(label(l.target))}`);
  const inn = graph.links.filter((l) => l.target === f.node.id).map((l) => `${escapeHtml(label(l.source))} ${RELATION_TEXT[l.relation]} este`);
  const size = d.tokensApprox === null ? 'não medido' : `≈ ${n(d.tokensApprox)}`;

  const checks: Check[] = [];
  if (d.tokensApprox === null) checks.push({ level: 'info', text: 'Tamanho não medido: vem embutido na ferramenta, não de um arquivo.' });
  if (d.load === 'always' && (d.tokensApprox ?? 0) > 3000) checks.push({ level: 'warn', text: `Pesado para estar em <b>toda</b> sessão (${size} tokens).` });
  if (d.annex) checks.push({ level: 'info', text: 'Sessão antiga: foi para o anexo.' });
  if (d.load !== 'history' && d.updatedAt && Date.now() - Date.parse(d.updatedAt) > 90 * DAY) checks.push({ level: 'info', text: 'Sem alteração há mais de 90 dias.' });

  showPiece(panel, {
    kicker: `${graph.graph.cityphy.agentName} · ${SECTION_NAMES[d.section]}${d.annex ? ' · anexo' : ''}`,
    title: f.node.label,
    badges: [`<span class="pill on">${escapeHtml(LOAD_TEXT[d.load])}</span>`],
    context: d.load === 'always' ? stat(size, 'tokens, em toda sessão') : none(`Não entra sozinho: ${LOAD_TEXT[d.load]}.`),
    input: `${d.load === 'on-demand' ? stat(size, 'tokens quando a IA abre') : ''}<dl><dt>Tamanho</dt><dd>${formatBytes(d.bytes)}</dd><dt>Atualizado</dt><dd>${formatDate(d.updatedAt)}</dd><dt>Arquivo</dt><dd class="path">${escapeHtml(f.node.source_file)}</dd></dl>`,
    output: out.length || inn.length ? `<ul class="rows">${[...out, ...inn].map((c) => `<li>${c}</li>`).join('')}</ul>` : none('Nenhuma ligação.'),
    checks,
  });
}
