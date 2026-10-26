import * as THREE from 'three';
import { CROSSARM_Y, type LampPost } from './streetLamps.ts';

/** Cables of different projects hang on different slots of the same crossarm. */
const SLOT_SPACING = 0.3;
const SLOTS = 5;

function nearestIndex(posts: LampPost[], z: number): number {
  let best = 0;
  posts.forEach((p, i) => {
    if (Math.abs(p.base.z - z) < Math.abs(posts[best].base.z - z)) best = i;
  });
  return best;
}

/** Point on a post's crossarm for a given slot (crossarm runs perpendicular to the street). */
function onCrossarm(post: LampPost, slot: number): THREE.Vector3 {
  const offset = ((slot % SLOTS) - (SLOTS - 1) / 2) * SLOT_SPACING;
  return new THREE.Vector3(post.base.x + (post.along === 'z' ? offset : 0), CROSSARM_Y, post.base.z + (post.along === 'x' ? offset : 0));
}

/**
 * Route of a power line: tower → nearest lamp post on the west sidewalk → along the west posts
 * to the one facing the project's gate → across the street through the air → east post →
 * the project's gatehouse. Never a pole on the street.
 */
export function routePowerLine(
  from: THREE.Vector3,
  entry: THREE.Vector3,
  posts: { west: LampPost[]; east: LampPost[] },
  slot: number,
): THREE.Vector3[] {
  const a = nearestIndex(posts.west, from.z);
  const b = nearestIndex(posts.west, entry.z);
  const step = a <= b ? 1 : -1;
  const points = [from.clone()];
  for (let i = a; i !== b + step; i += step) points.push(onCrossarm(posts.west[i], slot));
  points.push(onCrossarm(posts.east[nearestIndex(posts.east, entry.z)], slot));
  points.push(entry.clone());
  return points;
}

/** Sagging cable through the given points (a tube, so it reads at a distance) in the project's color. */
export function buildCable(points: THREE.Vector3[], color: THREE.Color): { object: THREE.Mesh; curve: THREE.CurvePath<THREE.Vector3> } {
  const curve = new THREE.CurvePath<THREE.Vector3>();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const mid = a.clone().add(b).multiplyScalar(0.5);
    mid.y -= 0.25 + 0.05 * a.distanceTo(b); // sag
    curve.add(new THREE.QuadraticBezierCurve3(a, mid, b));
  }
  const tube = new THREE.TubeGeometry(curve, points.length * 16, 0.05, 5, false);
  const object = new THREE.Mesh(tube, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 }));
  return { object, curve };
}
