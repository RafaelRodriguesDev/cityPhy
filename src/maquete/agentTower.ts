import * as THREE from 'three';
import { SECTIONS, type TowerGraph } from '../towers/schema.ts';
import { SECTION_COLOR } from '../scene/towerMesh.ts';
import { block, paint, pickable, solid, windows } from './kit.ts';

const WIDTH = 9;

/** One floor per section, taller when heavier (log scale); sessions are history, kept thin. */
export function sectionFloors(tower: TowerGraph | null): Array<{ section: (typeof SECTIONS)[number]; tokens: number; height: number }> {
  if (!tower) return [];
  return SECTIONS.map((section) => {
    const tokens = tower.nodes.filter((n) => n.cityphy.section === section).reduce((s, n) => s + (n.cityphy.tokensApprox ?? 0), 0);
    const h = 2.4 + 2 * Math.log10(1 + tokens / 300);
    return { section, tokens, height: section === 'sessions' ? Math.min(h, 3.2) : h };
  }).filter((f) => f.tokens > 0 || f.section === 'ground');
}

/**
 * An agent's tower: stacked floors with window rows, setbacks between floors, a water tank and a mast
 * with a beacon in the agent's color. Agents without a tower get a one-floor kiosk.
 */
export function buildAgentTower(tower: TowerGraph | null, agent: string, color: number, at: { x: number; z: number }): { group: THREE.Group; anchor: THREE.Vector3; top: number } {
  const group = new THREE.Group();
  group.position.set(at.x, 0, at.z);
  group.add(block(WIDTH + 3, 0.5, WIDTH + 3, 0xd8d3c6)); // plinth
  let y = 0.5;
  const floors = sectionFloors(tower);
  if (!floors.length) floors.push({ section: 'ground', tokens: 0, height: 3 });
  floors.forEach((f, i) => {
    const w = WIDTH - (i % 2) * 0.8 - i * 0.35;
    const side = new THREE.MeshLambertMaterial({ color: SECTION_COLOR[f.section], map: windows(w / 2.2, f.height / 1.6) });
    const top = paint(new THREE.Color(SECTION_COLOR[f.section]).lerp(new THREE.Color(0xffffff), 0.35).getHex());
    const floor = block(w, f.height, w, [side, side, top, top, side, side], 0, y, 0);
    group.add(pickable(floor, { kind: 'agent', agent }));
    group.add(block(w + 0.3, 0.18, w + 0.3, 0xf3f0e8, 0, y + f.height - 0.09, 0)); // slab line
    y += f.height;
  });
  const roof = WIDTH - floors.length * 0.6;
  group.add(block(roof * 0.5, 0.6, roof * 0.5, 0xcfcac0, -roof * 0.15, y, -roof * 0.15));
  const tank = solid(new THREE.CylinderGeometry(0.9, 0.9, 1.6, 12), paint(0xb7b2a6));
  tank.position.set(roof * 0.2, y + 0.8 + 0.6, roof * 0.2);
  group.add(tank);
  const mast = solid(new THREE.CylinderGeometry(0.06, 0.1, 4, 6), paint(0x4a4843), false);
  mast.position.set(-roof * 0.15, y + 2.6, -roof * 0.15);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color }));
  beacon.position.set(-roof * 0.15, y + 4.7, -roof * 0.15);
  group.add(mast, beacon);
  return { group, anchor: new THREE.Vector3(at.x + WIDTH / 2, 3, at.z), top: y + 5 };
}
