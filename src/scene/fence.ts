import * as THREE from 'three';
import type { Lot } from './cityLayout.ts';
import { grassTexture } from './grass.ts';
import { makeLabel } from './label.ts';

const POST_SPACING = 2;
const HEIGHT = 1.1;
const GATE_WIDTH = 5;
const FENCE_COLOR = 0x8a93a6;

/** Points every POST_SPACING along a segment, skipping the gate opening when given. */
function postsAlong(a: THREE.Vector3, b: THREE.Vector3, gate?: { center: THREE.Vector3 }): THREE.Vector3[] {
  const n = Math.max(1, Math.round(a.distanceTo(b) / POST_SPACING));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i <= n; i++) {
    const p = a.clone().lerp(b, i / n);
    if (gate && p.distanceTo(gate.center) < GATE_WIDTH / 2) continue;
    out.push(p);
  }
  return out;
}

/** A rail between consecutive posts (two heights). */
function rails(posts: THREE.Vector3[], mat: THREE.Material, group: THREE.Group): void {
  for (let i = 0; i < posts.length - 1; i++) {
    const a = posts[i];
    const b = posts[i + 1];
    const len = a.distanceTo(b);
    if (len > POST_SPACING * 1.5) continue; // the gate opening
    for (const y of [0.45, HEIGHT - 0.1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), mat);
      rail.position.set((a.x + b.x) / 2, y, (a.z + b.z) / 2);
      rail.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
      group.add(rail);
    }
  }
}

/**
 * The fence around a condominium: lighter grass inside, posts and rails around, a gate on the
 * street side and a small gatehouse (the "portaria") next to it.
 */
export function buildFence(
  lot: Lot,
  name: string,
  windowColor = 0xffd38a,
): { group: THREE.Group; gate: THREE.Vector3; house: THREE.Vector3; entry: THREE.Vector3 } {
  const group = new THREE.Group();
  const w = lot.maxX - lot.minX;
  const d = lot.maxZ - lot.minZ;

  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: grassTexture('#1c3a26', Math.max(2, Math.round(w / 6))), roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(lot.minX + w / 2, 0.03, lot.minZ + d / 2);
  group.add(lawn);

  const gateX = lot.gate === 'east' ? lot.maxX : lot.minX;
  const gate = new THREE.Vector3(gateX, 0, (lot.minZ + lot.maxZ) / 2);
  const c = [
    new THREE.Vector3(lot.minX, 0, lot.maxZ),
    new THREE.Vector3(lot.maxX, 0, lot.maxZ),
    new THREE.Vector3(lot.maxX, 0, lot.minZ),
    new THREE.Vector3(lot.minX, 0, lot.minZ),
  ];
  const sides: Array<[THREE.Vector3, THREE.Vector3, boolean]> = [
    [c[0], c[1], false],
    [c[1], c[2], lot.gate === 'east'],
    [c[2], c[3], false],
    [c[3], c[0], lot.gate === 'west'],
  ];

  const mat = new THREE.MeshStandardMaterial({ color: FENCE_COLOR, roughness: 0.6, metalness: 0.3 });
  const allPosts: THREE.Vector3[] = [];
  for (const [a, b, hasGate] of sides) {
    const posts = postsAlong(a, b, hasGate ? { center: gate } : undefined);
    rails(posts, mat, group);
    allPosts.push(...posts);
  }
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, HEIGHT, 0.14), mat, allPosts.length);
  const m = new THREE.Matrix4();
  allPosts.forEach((p, i) => {
    m.makeTranslation(p.x, HEIGHT / 2, p.z);
    posts.setMatrixAt(i, m);
  });
  group.add(posts);

  // Gatehouse just inside the gate, beside the opening, with a lit window.
  const inward = lot.gate === 'east' ? -1 : 1;
  const house = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), new THREE.MeshStandardMaterial({ color: 0x3b4458, roughness: 0.7 }));
  house.position.set(gateX + inward * 1.4, 0.9, gate.z + GATE_WIDTH / 2 + 1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.8, 4), new THREE.MeshStandardMaterial({ color: 0x252b38 }));
  roof.position.set(house.position.x, 2.2, house.position.z);
  roof.rotation.y = Math.PI / 4;
  const window = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ color: windowColor }));
  window.position.set(house.position.x - inward * 0.91, 1.1, house.position.z);
  window.rotation.y = lot.gate === 'east' ? Math.PI / 2 : -Math.PI / 2;
  group.add(house, roof, window);

  const sign = makeLabel(`portaria · ${name}`, 0.55);
  sign.position.set(house.position.x, 3.1, house.position.z);
  group.add(sign);
  // Power comes in at the top of the gatehouse roof.
  const entry = new THREE.Vector3(house.position.x, 2.6, house.position.z);
  return { group, gate, house: house.position.clone(), entry };
}
