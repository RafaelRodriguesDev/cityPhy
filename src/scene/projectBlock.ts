import * as THREE from 'three';
import type { ProjectPart, ProjectSummary } from '../readers/projects.ts';
import { makeLabel } from './label.ts';

const FLOOR_H = 1.1;
export const PROJECT_BUILDING_WIDTH = 6;
const WIDTH = PROJECT_BUILDING_WIDTH;
const GAP_Z = 3;

/** Length of a condominium's row of buildings along the street. */
export function projectRowLength(project: ProjectSummary): number {
  return project.parts.length * WIDTH + (project.parts.length - 1) * GAP_Z;
}
const COLORS = [0x2a9c88, 0x2f8fa8, 0x3d7fb8, 0x4a6fae, 0x56679e, 0x5f6390];

export interface ProjectBuilding {
  project: ProjectSummary;
  part: ProjectPart;
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/** More files = more floors (log scale), so one huge folder does not dwarf the city. */
export function partFloors(files: number): number {
  return Math.max(3, Math.min(26, Math.round(Math.log2(files + 1) * 2.4)));
}

/**
 * One project condominium: a building per top folder, in a row along the street. Each floor is
 * one instance, so a hovered floor maps back to its building.
 */
export function buildProjectBlock(
  project: ProjectSummary,
  origin: { x: number; z: number },
): { group: THREE.Group; buildings: ProjectBuilding[]; mesh: THREE.InstancedMesh; doors: THREE.Vector3[] } {
  const group = new THREE.Group();
  const totalFloors = project.parts.reduce((s, p) => s + partFloors(p.files), 0);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, emissive: 0x0a0d14 }),
    Math.max(1, totalFloors),
  );
  const buildings: ProjectBuilding[] = [];
  const m = new THREE.Matrix4();
  let z = origin.z + projectRowLength(project) / 2 - WIDTH / 2;
  let index = 0;
  let tallest = 0;
  const doors: THREE.Vector3[] = [];

  project.parts.forEach((part, i) => {
    const floors = partFloors(part.files);
    const color = new THREE.Color(COLORS[i % COLORS.length]);
    for (let f = 0; f < floors; f++) {
      m.compose(new THREE.Vector3(origin.x, f * FLOOR_H + FLOOR_H / 2, z), new THREE.Quaternion(), new THREE.Vector3(WIDTH, FLOOR_H - 0.08, WIDTH));
      mesh.setMatrixAt(index, m);
      mesh.setColorAt(index, color);
      buildings[index] = { project, part, mesh, index, color };
      index++;
    }
    const tag = makeLabel(part.name, 0.8);
    tag.position.set(origin.x, floors * FLOOR_H + 1, z);
    group.add(tag);
    tallest = Math.max(tallest, floors * FLOOR_H);
    doors.push(new THREE.Vector3(origin.x - WIDTH / 2, 0.07, z)); // street-facing side, ground level
    z -= WIDTH + GAP_Z;
  });
  mesh.count = index;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);

  const name = makeLabel(project.name, 1.6);
  name.position.set(origin.x, tallest + 3.4, origin.z);
  group.add(name);

  return { group, buildings, mesh, doors };
}
