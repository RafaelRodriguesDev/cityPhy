import * as THREE from 'three';
import { CROSS_STREET_Z, SIDEWALK, STREET_WIDTH, STREET_X } from './cityLayout.ts';
import { glowTexture } from './glow.ts';

/** Lamp posts double as utility poles: tall, with a crossarm that carries the power lines. */
export const POLE_HEIGHT = 6.5;
/** Height where cables rest on the crossarm. */
export const CROSSARM_Y = POLE_HEIGHT - 0.2;
const SPACING = 10;
const WARM = 0xffd38a;
const CURB = STREET_WIDTH / 2 + SIDEWALK * 0.6;
/** Keep posts out of the crossing (street half width + sidewalk + a little air). */
const CROSSING_CLEAR = STREET_WIDTH / 2 + SIDEWALK + 1.5;

export interface LampPost {
  base: THREE.Vector3;
  /** Direction of the street the post stands on: crossarm is perpendicular to it. */
  along: 'z' | 'x';
  /** Unit x/z pointing from the post towards the street (where the bulb hangs). */
  toStreet: THREE.Vector3;
}

/** Posts on both sidewalks of the main street (west and east lists, sorted by z) and of the cross street. */
export function lampPosts(minZ: number, maxZ: number, crossHalfLength = 80): { west: LampPost[]; east: LampPost[]; cross: LampPost[] } {
  const west: LampPost[] = [];
  const east: LampPost[] = [];
  for (let z = minZ + 4; z < maxZ; z += SPACING) {
    for (const side of [-1, 1]) {
      const pz = z + (side > 0 ? SPACING / 2 : 0);
      if (Math.abs(pz - CROSS_STREET_Z) < CROSSING_CLEAR) continue;
      const post = { base: new THREE.Vector3(STREET_X + side * CURB, 0, pz), along: 'z' as const, toStreet: new THREE.Vector3(-side, 0, 0) };
      (side < 0 ? west : east).push(post);
    }
  }
  const cross: LampPost[] = [];
  for (let x = STREET_X - crossHalfLength; x < STREET_X + crossHalfLength; x += SPACING) {
    for (const side of [-1, 1]) {
      const px = x + (side > 0 ? SPACING / 2 : 0);
      if (Math.abs(px - STREET_X) < CROSSING_CLEAR) continue;
      cross.push({ base: new THREE.Vector3(px, 0, CROSS_STREET_Z + side * CURB), along: 'x', toStreet: new THREE.Vector3(0, 0, -side) });
    }
  }
  return { west, east, cross };
}

/** Lamp posts with crossarms, a glowing bulb on a short arm over the street, and a pool of light. No real lights. */
export function buildStreetLamps(posts: LampPost[]): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x3a4252, roughness: 0.6 });
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.14, POLE_HEIGHT, 6), mat, posts.length);
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.1, 0.1), mat, posts.length);
  const pools = new THREE.InstancedMesh(
    new THREE.CircleGeometry(2.6, 24),
    new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }),
    posts.length,
  );
  const m = new THREE.Matrix4();
  const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const alongX = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
  const bulbs = new Float32Array(posts.length * 3);
  const one = new THREE.Vector3(1, 1, 1);

  posts.forEach((p, i) => {
    m.compose(new THREE.Vector3(p.base.x, POLE_HEIGHT / 2, p.base.z), new THREE.Quaternion(), one);
    poles.setMatrixAt(i, m);
    // crossarm perpendicular to the street it follows, 1.6 long
    m.compose(new THREE.Vector3(p.base.x, CROSSARM_Y - 0.08, p.base.z), p.along === 'z' ? new THREE.Quaternion() : alongX, new THREE.Vector3(1.6, 1, 1));
    arms.setMatrixAt(i, m);
    const bulb = p.base.clone().addScaledVector(p.toStreet, 0.9);
    m.compose(new THREE.Vector3(bulb.x, 0.08, bulb.z), flat, one);
    pools.setMatrixAt(i, m);
    bulbs.set([bulb.x, CROSSARM_Y - 0.9, bulb.z], i * 3);
  });
  g.add(poles, arms, pools);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(bulbs, 3));
  g.add(
    new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: WARM, size: 1.3, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    ),
  );
  return g;
}
