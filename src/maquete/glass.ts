import * as THREE from 'three';
import type { ToolConsumption } from '../metrics/consumption/types.ts';
import { blockValues } from '../scene/consumptionTower.ts';
import { paint, pickable, solid } from './kit.ts';

const LIQUID = { ok: 0x2bb39a, warn: 0xe0a64a, high: 0xd85a30 } as const;

/** Liquid color: teal while it is just history, amber from 60%, red from 85% of a real limit. */
const liquidOf = (fill: number, history: boolean) => (history || fill < 0.6 ? LIQUID.ok : fill < 0.85 ? LIQUID.warn : LIQUID.high);

/** Two glass cylinders (week and day) filled like a measuring glass. */
export function buildGlass(c: ToolConsumption, agent: string, at: { x: number; z: number }): THREE.Group {
  const group = new THREE.Group();
  group.position.set(at.x, 0, at.z);
  const [week, day] = blockValues(c);
  [
    { v: week, r: 2.2, h: 12, dx: 0 },
    { v: day, r: 1.4, h: 7, dx: 4.2 },
  ].forEach(({ v, r, h, dx }) => {
    const fill = Math.max(0.02, Math.min(1, v?.fill ?? 0));
    const base = solid(new THREE.CylinderGeometry(r + 0.3, r + 0.4, 0.4, 24), paint(0xd8d3c6));
    base.position.set(dx, 0.2, 0);
    const liquid = solid(new THREE.CylinderGeometry(r * 0.9, r * 0.9, h * fill, 24), paint(liquidOf(fill, v?.source === 'histórico'), 0.92), false);
    liquid.position.set(dx, 0.4 + (h * fill) / 2, 0);
    const glass = solid(new THREE.CylinderGeometry(r, r, h, 24, 1, true), new THREE.MeshLambertMaterial({ color: 0xcfe9f5, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    glass.position.set(dx, 0.4 + h / 2, 0);
    glass.castShadow = false;
    const rim = solid(new THREE.TorusGeometry(r, 0.08, 6, 28), paint(0x7aa6bd), false);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(dx, 0.4 + h, 0);
    // Scale marks every 25%.
    for (let k = 1; k < 4; k++) {
      const mark = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.03, 4, 28, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x5f7f90 }));
      mark.rotation.x = Math.PI / 2;
      mark.rotation.z = -Math.PI / 4;
      mark.position.set(dx, 0.4 + (h * k) / 4, 0);
      group.add(mark);
    }
    group.add(base, liquid, pickable(glass, { kind: 'glass', agent }), rim);
  });
  return group;
}
