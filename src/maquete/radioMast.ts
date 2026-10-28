import * as THREE from 'three';
import type { LibraryMcp } from '../library/types.ts';
import { MCP_COLOR } from '../scene/radio.ts';
import { block, lines, paint, pickable, rod, solid, type Pick as PickTarget } from './kit.ts';
import type { Animator } from './stage.ts';

const SEGMENTS = 7;

/** Taller with more agents using it; remote servers stand taller still (data leaves the machine). */
export const mastHeight = (m: LibraryMcp) => 14 + 4 * m.agents.length + (m.transport === 'remote' ? 6 : 0);

export interface MastOptions {
  height?: number;
  /** Half-width of the foot. */
  base?: number;
  /** Server brought by the agent app (not configured): gray bands and gray waves. */
  app?: boolean;
  /** No equipment hut (masts on a roof or in a small station). */
  bare?: boolean;
  pick?: PickTarget;
  /** Height of the ground the mast stands on (roof). */
  y?: number;
}

const APP_GRAY = 0x9a978f;

/**
 * One MCP server: a lattice radio tower painted in red and white bands, X bracing, a platform with a dish,
 * a beacon on top and rings of waves (blue = local, orange = remote). A small equipment hut at its foot.
 */
export function buildRadioMast(
  m: Pick<LibraryMcp, 'agents' | 'transport'>,
  index: number,
  at: { x: number; z: number },
  opts: MastOptions = {},
): { group: THREE.Group; animate: Animator; top: THREE.Vector3 } {
  const group = new THREE.Group();
  group.position.set(at.x, opts.y ?? 0, at.z);
  const H = opts.height ?? mastHeight(m as LibraryMcp);
  const base = opts.base ?? 1.8;
  const band = opts.app ? APP_GRAY : 0xd24a3a;
  const half = (t: number) => base * (1 - 0.8 * t);
  const corner = (k: number, t: number) => {
    const sx = k === 0 || k === 3 ? -1 : 1;
    const sz = k < 2 ? -1 : 1;
    return new THREE.Vector3(sx * half(t), 0.4 + H * t, sz * half(t));
  };
  if (!opts.bare) group.add(block(base * 2 + 2, 0.4, base * 2 + 2, 0xcdc8bd));

  const brace: THREE.Vector3[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const a = i / SEGMENTS;
    const b = (i + 1) / SEGMENTS;
    for (let k = 0; k < 4; k++) {
      group.add(rod(corner(k, a), corner(k, b), 0.11 * Math.max(0.5, base / 1.8), i % 2 ? 0xf6f2ea : band));
      const j = (k + 1) % 4;
      brace.push(corner(k, a), corner(j, b), corner(j, a), corner(k, b), corner(k, b), corner(j, b));
    }
  }
  group.add(lines(brace));

  const deck = 0.72;
  if (!opts.bare) {
    group.add(block(half(deck) * 2 + 1.2, 0.15, half(deck) * 2 + 1.2, 0x9a978f, 0, 0.4 + H * deck, 0));
    const dish = solid(new THREE.CylinderGeometry(1, 0.6, 0.3, 16), paint(0xf6f2ea));
    dish.rotation.z = Math.PI / 2;
    dish.position.set(half(0.8) + 0.8, 0.4 + H * 0.8, 0);
    group.add(dish);
  }
  const top = new THREE.Vector3(0, 0.4 + H, 0);
  group.add(rod(top, top.clone().add(new THREE.Vector3(0, 3.5, 0)), 0.07, 0x4a4843));
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff5a3c }));
  beacon.position.set(0, 0.4 + H + 3.6, 0);
  group.add(beacon);
  if (!opts.bare) group.add(block(3, 2, 2.4, 0xc8c6bf, base + 2.2, 0, 0.6), block(3.3, 0.25, 2.7, 0x8f8b82, base + 2.2, 2, 0.6));

  // Invisible hit box for hover and click.
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(base, base, H + 4, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  hit.position.y = (H + 4) / 2;
  group.add(pickable(hit, opts.pick ?? { kind: 'mcp', index }));

  // Waves: three rings growing out of the beacon and fading.
  const color = opts.app ? APP_GRAY : MCP_COLOR[m.transport];
  const rings = [0, 1, 2].map(() => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    ring.rotation.x = Math.PI / 2;
    ring.position.copy(beacon.position);
    group.add(ring);
    return ring;
  });
  let t = index * 0.37;
  const animate: Animator = (dt) => {
    t += dt * 0.45;
    rings.forEach((r, i) => {
      const k = (t + i / 3) % 1;
      r.scale.setScalar((0.6 + k * 5) * Math.max(0.45, base / 1.8));
      (r.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - k);
    });
    return true;
  };
  animate(0);
  return { group, animate, top: new THREE.Vector3(at.x, (opts.y ?? 0) + beacon.position.y, at.z) };
}
