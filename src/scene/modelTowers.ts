import * as THREE from 'three';
import { groupByModel } from '../metrics/modelStats.ts';
import type { ModelBreakdown } from '../metrics/usage/types.ts';
import { FIRST_MODEL_X, MODEL_SPACING, TOWER_X } from './cityLayout.ts';
import { makeLabel } from './label.ts';

export const EFFORT_COLOR: Record<string, number> = {
  minimal: 0x9fe1cb,
  low: 0x5dcaa5,
  medium: 0x378add,
  high: 0xd4537e,
  xhigh: 0xe24b4a,
  padrão: 0x8b7cf6,
  desconhecido: 0x6b7280,
};
const WIDTH = 4.5;
const GAP = 0.12;

/** One reasoning level of one model: a band of its tower. */
export interface ModelBand {
  kind: 'model';
  agent: string;
  model: string;
  row: ModelBreakdown;
  allRows: ModelBreakdown[]; // every level of this model (for the panel)
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/** More tokens = taller band (log scale), so a huge model does not hide the small ones. */
export function bandHeight(tokens: number): number {
  return 0.8 + 1.8 * Math.log10(1 + tokens / 100_000);
}

/**
 * The models of an agent as towers next to its headquarters, one band per reasoning level
 * (stacked lowest level first). Height = tokens used; a model never used is not drawn.
 */
export function buildModelTowers(
  agent: string,
  rows: ModelBreakdown[],
  origin: { x: number; z: number },
  firstSlot = 0, // slots already taken west of the annex (e.g. by the consumption tower)
): { group: THREE.Group; bands: ModelBand[]; mesh: THREE.InstancedMesh | null; count: number } {
  const group = new THREE.Group();
  const models = groupByModel(rows);
  const bandsTotal = models.reduce((n, m) => n + m.rows.length, 0);
  if (!bandsTotal) return { group, bands: [], mesh: null, count: 0 };

  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.15, emissive: 0x0a0d14 }),
    bandsTotal,
  );
  const bands: ModelBand[] = [];
  const m = new THREE.Matrix4();
  let index = 0;
  models.forEach((model, i) => {
    const x = origin.x + (FIRST_MODEL_X - TOWER_X) - (i + firstSlot) * MODEL_SPACING;
    let y = 0;
    for (const row of model.rows) {
      const h = bandHeight(row.input + row.cacheWrite + row.cacheRead + row.output);
      m.compose(new THREE.Vector3(x, y + h / 2, origin.z), new THREE.Quaternion(), new THREE.Vector3(WIDTH, h - GAP, WIDTH));
      mesh.setMatrixAt(index, m);
      const color = new THREE.Color(EFFORT_COLOR[row.effort] ?? EFFORT_COLOR.desconhecido);
      mesh.setColorAt(index, color);
      bands.push({ kind: 'model', agent, model: model.model, row, allRows: model.rows, mesh, index, color });
      index++;
      y += h;
    }
    const tag = makeLabel(model.model, 0.7);
    tag.position.set(x, y + 1, origin.z);
    group.add(tag);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  return { group, bands, mesh, count: models.length };
}
