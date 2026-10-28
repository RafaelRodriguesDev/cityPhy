import * as THREE from 'three';
import { shelvesOf } from '../library/buildLibrary.ts';
import type { Library, Origin } from '../library/types.ts';
import { ORIGIN_COLOR } from '../scene/library.ts';
import { block, gable, paint, pickable, solid } from './kit.ts';

const STONE = 0xefe6d3;
const ROOF = 0xc0634a;
const COLUMN = 0xfaf6ec;

/**
 * The library as a building: steps, a portico of columns with a pediment facing the viewer (+z),
 * tall windows on the side, and a frieze painted with the share of each skill origin.
 * Longer with more shelves.
 */
export function buildLibraryHall(lib: Library, at: { x: number; z: number }): THREE.Group {
  const group = new THREE.Group();
  group.position.set(at.x, 0, at.z);
  const W = 14;
  const L = 16 + shelvesOf(lib).length * 2.5;
  const H = 7;
  group.add(block(W + 4, 0.5, L + 4, 0xd8d2c4), block(W + 2, 0.5, L + 2, 0xe4dfd2, 0, 0.5, 0));
  const body = block(W - 2, H, L - 4, STONE, 0, 1, -1.5);
  group.add(pickable(body, { kind: 'library' }));

  // Portico: columns along the front.
  const front = L / 2 - 0.6;
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 1 + (i * (W - 2)) / 5;
    const col = solid(new THREE.CylinderGeometry(0.42, 0.5, H, 12), paint(COLUMN));
    col.position.set(x, 1 + H / 2, front);
    group.add(pickable(col, { kind: 'library' }));
  }
  const door = block(2.6, 4.2, 0.1, 0x6b5340, 0, 1, front - 2.95);
  group.add(door);
  group.add(block(W + 0.6, 0.9, L + 0.2, 0xe9dfc9, 0, 1 + H, -0.1)); // entablature
  const roof = gable(W + 1, 3.2, L + 0.6, 0xf1e8d4, ROOF);
  roof.position.set(0, 1.9 + H, -0.1);
  group.add(pickable(roof, { kind: 'library' }));
  const oculus = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.1, 6, 20), paint(0x8a7a5c));
  oculus.position.set(0, 1.9 + H + 1.1, L / 2 + 0.25);
  group.add(oculus);

  // Side windows (east wall, facing the viewer).
  for (let z = -L / 2 + 1.5; z < L / 2 - 5; z += 3) group.add(block(0.1, 4, 1.4, 0x7fa9c9, (W - 2) / 2 + 0.05, 2, z));

  // Frieze: one stripe per origin, as wide as its share of skills.
  const total = lib.skills.length || 1;
  const counts = new Map<Origin, number>();
  for (const s of lib.skills) counts.set(s.origin, (counts.get(s.origin) ?? 0) + 1);
  let z = L / 2 - 0.2;
  for (const [origin, n] of [...counts].sort((a, b) => b[1] - a[1])) {
    const len = (n / total) * (L + 0.2);
    group.add(block(0.08, 0.6, len, ORIGIN_COLOR[origin], (W + 0.6) / 2 + 0.04, 1 + H + 0.15, z - len / 2));
    z -= len;
  }
  return group;
}
