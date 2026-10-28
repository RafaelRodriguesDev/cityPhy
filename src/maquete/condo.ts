import * as THREE from 'three';
import type { ProjectSummary } from '../readers/projects.ts';
import { block, gable, paint, pickable, windows } from './kit.ts';
import { LOT_HALF } from './layout.ts';

const LOT_W = 28;
const GRID = [
  [-6, -7],
  [5, -7],
  [-6, 3],
  [5, 3],
  [-6, 11],
  [5, 11],
] as const;

const lighter = (c: number, k: number) => new THREE.Color(c).lerp(new THREE.Color(0xffffff), k).getHex();
const darker = (c: number, k: number) => new THREE.Color(c).multiplyScalar(1 - k).getHex();

/** Building height from the number of graph symbols in the part (log scale). */
export const partHeight = (nodes: number) => 3 + 3.2 * Math.log10(1 + nodes / 40);

/**
 * A project condominium: low wall with a gatehouse on the street side, one building per part
 * (houses with gable roofs when small, blocks with windows and a roof terrace when large).
 */
export function buildCondo(p: ProjectSummary, color: number, at: { x: number; z: number }): { group: THREE.Group; gate: THREE.Vector3 } {
  const group = new THREE.Group();
  group.position.set(at.x, 0, at.z);
  const d = LOT_HALF * 2;
  group.add(block(LOT_W, 0.12, d, 0xe6eadb));
  const wall = 0xd9d4c8;
  group.add(block(LOT_W, 0.9, 0.3, wall, 0, 0, -d / 2), block(LOT_W, 0.9, 0.3, wall, 0, 0, d / 2), block(0.3, 0.9, d, wall, LOT_W / 2, 0, 0));
  group.add(block(0.3, 0.9, d / 2 - 2.5, wall, -LOT_W / 2, 0, -d / 4 - 1.25), block(0.3, 0.9, d / 2 - 2.5, wall, -LOT_W / 2, 0, d / 4 + 1.25));
  const house = block(2.4, 2.2, 2.4, lighter(color, 0.5), -LOT_W / 2 + 1.8, 0, -3.2);
  const cap = block(3, 0.3, 3, darker(color, 0.25), -LOT_W / 2 + 1.8, 2.2, -3.2);
  group.add(house, cap);

  p.parts.slice(0, GRID.length).forEach((part, i) => {
    const [x, z] = GRID[i];
    const h = partHeight(part.nodes);
    const w = 6.5;
    const dep = 6;
    const pick = { kind: 'project', name: p.name, part: part.name } as const;
    if (h < 6) {
      const wallMat = new THREE.MeshLambertMaterial({ color: lighter(color, 0.55), map: windows(2, 1) });
      group.add(pickable(block(w, h, dep, [wallMat, wallMat, paint(lighter(color, 0.6)), paint(lighter(color, 0.6)), wallMat, wallMat], x, 0, z), pick));
      const roof = gable(dep + 0.6, 2.4, w + 0.6, lighter(color, 0.45), darker(color, 0.15));
      roof.rotation.y = Math.PI / 2;
      roof.position.set(x, h, z);
      group.add(pickable(roof, pick));
    } else {
      const side = new THREE.MeshLambertMaterial({ color: lighter(color, 0.3), map: windows(w / 2, h / 1.8) });
      const top = paint(lighter(color, 0.55));
      group.add(pickable(block(w, h, dep, [side, side, top, top, side, side], x, 0, z), pick));
      group.add(block(w + 0.3, 0.35, dep + 0.3, darker(color, 0.2), x, h, z));
      group.add(block(2, 1.2, 2, 0xcfcac0, x + 1.2, h + 0.35, z - 1));
    }
  });
  return { group, gate: new THREE.Vector3(at.x - LOT_W / 2 + 1.8, 2.4, at.z - 3.2) };
}

export const CONDO_WIDTH = LOT_W;
