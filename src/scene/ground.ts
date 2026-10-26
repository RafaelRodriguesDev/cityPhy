import * as THREE from 'three';
import { CROSS_STREET_Z, SIDEWALK, STREET_WIDTH, STREET_X } from './cityLayout.ts';
import { grassTexture } from './grass.ts';

const ASPHALT = 0x191e28;
const SIDEWALK_COLOR = 0x262c39;
const LANE = 0x5d6578;

function slab(w: number, d: number, color: number, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), new THREE.MeshStandardMaterial({ color, roughness: 0.95 }));
  m.position.set(x, y, z);
  return m;
}

/** Dashed center line, instanced (one draw call). */
function laneMarks(points: Array<[number, number]>, alongZ: boolean): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.02, 1), new THREE.MeshBasicMaterial({ color: LANE }), points.length);
  const m = new THREE.Matrix4();
  points.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 0.07, z), new THREE.Quaternion(), alongZ ? new THREE.Vector3(0.18, 1, 1.6) : new THREE.Vector3(1.6, 1, 0.18));
    mesh.setMatrixAt(i, m);
  });
  return mesh;
}

/** Ground, the main street (along z) with sidewalks, and a cross street in front. Visual only. */
export function buildGround(minZ: number, maxZ: number): THREE.Group {
  const g = new THREE.Group();
  const length = maxZ - minZ;
  const midZ = (minZ + maxZ) / 2;
  const span = 160;

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(span * 2, length + 80),
    new THREE.MeshStandardMaterial({ map: grassTexture('#16301f', 40), roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(STREET_X, -0.01, midZ);
  g.add(ground);

  // main street + sidewalks
  g.add(slab(STREET_WIDTH, length, ASPHALT, STREET_X, 0.0, midZ));
  for (const side of [-1, 1]) g.add(slab(SIDEWALK, length, SIDEWALK_COLOR, STREET_X + side * (STREET_WIDTH / 2 + SIDEWALK / 2), 0.06, midZ));

  // cross street in front of the city
  g.add(slab(span * 2, STREET_WIDTH, ASPHALT, STREET_X, 0.01, CROSS_STREET_Z));
  for (const side of [-1, 1]) g.add(slab(span * 2, SIDEWALK, SIDEWALK_COLOR, STREET_X, 0.06, CROSS_STREET_Z + side * (STREET_WIDTH / 2 + SIDEWALK / 2)));

  const dashes: Array<[number, number]> = [];
  for (let z = minZ; z < maxZ; z += 4) if (Math.abs(z - CROSS_STREET_Z) > STREET_WIDTH / 2 + 1) dashes.push([STREET_X, z]);
  g.add(laneMarks(dashes, true));
  const cross: Array<[number, number]> = [];
  for (let x = STREET_X - span; x < STREET_X + span; x += 4) if (Math.abs(x - STREET_X) > STREET_WIDTH / 2 + 1) cross.push([x, CROSS_STREET_Z]);
  g.add(laneMarks(cross, false));
  return g;
}
