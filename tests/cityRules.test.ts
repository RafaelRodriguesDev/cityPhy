import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CROSS_STREET_Z, SIDEWALK, STREET_WIDTH, STREET_X, layoutProjects, layoutTowers, type Lot } from '../src/scene/cityLayout.ts';
import { CROSSARM_Y, lampPosts, type LampPost } from '../src/scene/streetLamps.ts';
import { routePowerLine } from '../src/scene/powerLine.ts';

// The maintainer's rules: nothing stands on a street; power only travels on lamp posts.
const ROAD_X: [number, number] = [STREET_X - STREET_WIDTH / 2, STREET_X + STREET_WIDTH / 2];
const ROAD_Z: [number, number] = [CROSS_STREET_Z - STREET_WIDTH / 2, CROSS_STREET_Z + STREET_WIDTH / 2];
const WALK_X: [number, number] = [ROAD_X[0] - SIDEWALK, ROAD_X[1] + SIDEWALK];
const WALK_Z: [number, number] = [ROAD_Z[0] - SIDEWALK, ROAD_Z[1] + SIDEWALK];
const inside = (v: number, [a, b]: [number, number]) => v > a && v < b;
const overlaps = (lo: number, hi: number, [a, b]: [number, number]) => lo < b && hi > a;

const lots = (): Lot[] => [
  ...layoutTowers(3).map((s) => s.lot),
  ...layoutProjects([33, 6, 60, 15], 6).map((s) => s.lot),
];

describe('lots', () => {
  it('never touch a street or its sidewalks', () => {
    for (const lot of lots()) {
      expect(overlaps(lot.minX, lot.maxX, WALK_X), `lot x ${lot.minX}..${lot.maxX}`).toBe(false);
      expect(overlaps(lot.minZ, lot.maxZ, WALK_Z), `lot z ${lot.minZ}..${lot.maxZ}`).toBe(false);
    }
  });

  it('do not overlap each other', () => {
    const all = lots();
    for (let i = 0; i < all.length; i++)
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        const hit = a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
        expect(hit, `lots ${i} and ${j}`).toBe(false);
      }
  });
});

describe('lamp posts', () => {
  const posts = lampPosts(-200, 46);
  const all = [...posts.west, ...posts.east, ...posts.cross];

  it('stand on sidewalks, never on asphalt', () => {
    for (const p of all) {
      const onMainRoad = inside(p.base.x, ROAD_X) && p.base.z > -1e9;
      const onCrossRoad = inside(p.base.z, ROAD_Z);
      expect(onMainRoad || onCrossRoad, `post at ${p.base.x},${p.base.z}`).toBe(false);
    }
  });

  it('keep out of the crossing', () => {
    for (const p of all) expect(inside(p.base.x, WALK_X) && inside(p.base.z, WALK_Z), `post at ${p.base.x},${p.base.z}`).toBe(false);
  });
});

describe('power line', () => {
  const posts = lampPosts(-200, 46);
  const isOnCrossarm = (pt: THREE.Vector3, list: LampPost[]) =>
    pt.y === CROSSARM_Y && list.some((p) => Math.abs(p.base.x - pt.x) < 1 && Math.abs(p.base.z - pt.z) < 1e-6);

  for (const [name, projectZ] of [['near project', -8], ['far project', -150]] as const) {
    it(`only uses lamp posts between tower and gatehouse (${name})`, () => {
      const from = new THREE.Vector3(3.5, 3.4, 1.5);
      const entry = new THREE.Vector3(31.4, 2.6, projectZ);
      const route = routePowerLine(from, entry, posts, 2);
      expect(route[0]).toEqual(from);
      expect(route.at(-1)).toEqual(entry);
      const middle = route.slice(1, -1);
      expect(middle.length).toBeGreaterThan(1);
      for (const pt of middle) expect(isOnCrossarm(pt, [...posts.west, ...posts.east]), `point ${pt.x},${pt.y},${pt.z}`).toBe(true);
      // exactly one crossing: the last post is on the east sidewalk, all others on the west
      expect(middle.slice(0, -1).every((pt) => pt.x < STREET_X)).toBe(true);
      expect(middle.at(-1)!.x).toBeGreaterThan(STREET_X);
    });
  }
});
