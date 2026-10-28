import * as THREE from 'three';
import { block, paint, solid } from './kit.ts';
import { CROSS_Z, STREET_HALF } from './layout.ts';

const LAMP_STEP = 14;
export const LAMP_HEIGHT = 6;
const EAST_END = 62;
const WEST_END = -42;

/** Ground, main street along z, cross street to the east, sidewalks, lamp posts (east side) and trees. */
export function buildStreets(minZ: number, maxZ: number): { group: THREE.Group; lamps: THREE.Vector3[] } {
  const group = new THREE.Group();
  const len = maxZ - minZ;
  const mid = (minZ + maxZ) / 2;
  const ground = new THREE.Mesh(new THREE.BoxGeometry(EAST_END - WEST_END + 20, 1, len + 20), paint(0xdfe4d2));
  ground.position.set((EAST_END + WEST_END) / 2, -0.5, mid);
  ground.receiveShadow = true;
  group.add(ground);

  const road = (w: number, d: number, x: number, z: number) => {
    const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), paint(0x9fa2a6));
    r.position.set(x, 0.05, z);
    r.receiveShadow = true;
    group.add(r);
  };
  road(STREET_HALF * 2, len, 0, mid);
  road(EAST_END - STREET_HALF, 6, (EAST_END + STREET_HALF) / 2, CROSS_Z);
  for (const side of [-1, 1]) {
    const walk = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, len), paint(0xe8e5dd));
    walk.position.set(side * (STREET_HALF + 0.7), 0.1, mid);
    walk.receiveShadow = true;
    group.add(walk);
  }
  const dash = paint(0xf7f5ef);
  for (let z = minZ + 2; z < maxZ - 2; z += 5) {
    if (Math.abs(z - CROSS_Z) < 4) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.04, 2.4), dash);
    m.position.set(0, 0.12, z);
    group.add(m);
  }
  for (let x = STREET_HALF + 3; x < EAST_END - 2; x += 5) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.25), dash);
    m.position.set(x, 0.12, CROSS_Z);
    group.add(m);
  }

  const lamps: THREE.Vector3[] = [];
  for (let z = minZ + 8; z < maxZ - 4; z += LAMP_STEP) {
    if (Math.abs(z - CROSS_Z) < 5) continue;
    const x = STREET_HALF + 1.1;
    const pole = solid(new THREE.CylinderGeometry(0.08, 0.12, LAMP_HEIGHT, 6), paint(0x4a4945), false);
    pole.position.set(x, LAMP_HEIGHT / 2, z);
    const arm = block(1.4, 0.1, 0.1, 0x4a4945, x - 0.7, LAMP_HEIGHT - 0.1, z);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd36a }));
    bulb.position.set(x - 1.3, LAMP_HEIGHT - 0.3, z);
    group.add(pole, arm, bulb);
    lamps.push(new THREE.Vector3(x, LAMP_HEIGHT, z));
  }

  // Trees along the outer edges (deterministic).
  const crown = paint(0x9cc48a);
  const trunk = paint(0x7a5c45);
  const tree = (x: number, z: number, s: number) => {
    const t = solid(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.6 * s, 6), trunk, false);
    t.position.set(x, 0.8 * s, z);
    const c = solid(new THREE.IcosahedronGeometry(1.4 * s, 0), crown);
    c.position.set(x, 2.4 * s, z);
    group.add(t, c);
  };
  for (let z = minZ + 4, i = 0; z < maxZ; z += 9, i++) {
    tree(WEST_END + 4 + (i % 3), z, 1 + (i % 2) * 0.3);
    tree(EAST_END - 2 - (i % 2) * 2, z + 3, 0.9 + (i % 3) * 0.15);
  }
  return { group, lamps };
}
