import { SECTION_NAMES, type TowerGraph } from '../towers/schema.ts';
import type { PlacedFloor } from '../scene/towerMesh.ts';
import { LOAD_TEXT, escapeHtml, formatBytes, formatDate, formatTokens } from './format.ts';

const RELATION_TEXT = { indexes: 'indexa', links_to: 'liga a', lists: 'lista', loads: 'carrega' } as const;

/** Side panel with the selected floor: what it is, how it loads, how heavy it is, its cables. */
export function showFloor(panel: HTMLElement, f: PlacedFloor, graph: TowerGraph): void {
  const d = f.node.cityphy;
  const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
  const out = graph.links.filter((l) => l.source === f.node.id).map((l) => `${RELATION_TEXT[l.relation]} → ${label(l.target)}`);
  const inn = graph.links.filter((l) => l.target === f.node.id).map((l) => `${label(l.source)} ${RELATION_TEXT[l.relation]} este`);
  const cables = [...out, ...inn];

  panel.innerHTML = `
    <button class="close" aria-label="Fechar">×</button>
    <p class="kicker">${escapeHtml(graph.graph.cityphy.agentName)} · ${escapeHtml(SECTION_NAMES[d.section])}${d.annex ? ' · anexo' : ''}</p>
    <h2>${escapeHtml(f.node.label)}</h2>
    <dl>
      <dt>Como entra</dt><dd>${LOAD_TEXT[d.load]}</dd>
      <dt>Tamanho</dt><dd>${formatBytes(d.bytes)} · ${formatTokens(d.tokensApprox)}</dd>
      <dt>Atualizado</dt><dd>${formatDate(d.updatedAt)}</dd>
      <dt>Arquivo</dt><dd class="path">${escapeHtml(f.node.source_file)}</dd>
    </dl>
    <h3>Cabos (${cables.length})</h3>
    ${cables.length ? `<ul>${cables.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>` : '<p class="muted">Nenhum.</p>'}`;
  panel.hidden = false;
  panel.querySelector('.close')!.addEventListener('click', () => (panel.hidden = true));
}
