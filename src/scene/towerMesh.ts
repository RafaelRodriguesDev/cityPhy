import * as THREE from 'three';
import { SECTIONS, type Section, type TowerGraph, type TowerNode } from '../towers/schema.ts';
import { makeLabel } from './label.ts';

export const SECTION_COLOR: Record<Section, number> = {
  ground: 0xe0a64a,
  memory: 0x8b7cf6,
  skills: 0x2bb39a,
  sessions: 0x6b84a8,
};
const UNKNOWN_SIZE_COLOR = 0x8a6a3a;
const SECTION_WIDTH: Record<Section, number> = { ground: 7, memory: 5.6, skills: 5.6, sessions: 5 };
const GAP = 0.08;

export interface PlacedFloor {
  node: TowerNode;
  agent: string;
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
  /** Point on the front face where cables attach. */
  anchor: THREE.Vector3;
}

/**
 * Heavier content = taller floor (log scale); unknown size gets a fixed height.
 * Sessions are history, not loaded context: their log size only nudges a thin floor.
 */
export function floorHeight(n: TowerNode): number {
  const b = n.cityphy.bytes;
  if (b === null) return 1.4;
  const kb = Math.log2(1 + b / 1024);
  if (n.cityphy.section === 'sessions') return Math.min(0.9, 0.4 + 0.03 * kb);
  return Math.min(2.4, 0.35 + 0.12 * kb);
}

/** Bottom-up order: ground, memory, skills, sessions; sessions oldest first. */
export function stackOrder(nodes: TowerNode[]): TowerNode[] {
  const rank = (n: TowerNode) => SECTIONS.indexOf(n.cityphy.section);
  return [...nodes].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (a.cityphy.section === 'sessions') return (a.cityphy.updatedAt ?? '').localeCompare(b.cityphy.updatedAt ?? '');
    if (a.cityphy.section === 'ground') return 0; // keep the generator's order
    return a.label.localeCompare(b.label);
  });
}

function column(nodes: TowerNode[], agent: string, x: number, z: number, placed: PlacedFloor[]): THREE.InstancedMesh {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.1, emissive: 0x0a0d14 });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, nodes.length));
  mesh.count = nodes.length;
  const m = new THREE.Matrix4();
  let y = 0;
  nodes.forEach((node, index) => {
    const h = floorHeight(node);
    const w = SECTION_WIDTH[node.cityphy.section];
    m.compose(new THREE.Vector3(x, y + h / 2, z), new THREE.Quaternion(), new THREE.Vector3(w, h - GAP, w));
    mesh.setMatrixAt(index, m);
    const color = new THREE.Color(node.cityphy.bytes === null ? UNKNOWN_SIZE_COLOR : SECTION_COLOR[node.cityphy.section]);
    mesh.setColorAt(index, color);
    placed.push({ node, agent, mesh, index, color, anchor: new THREE.Vector3(x, y + h / 2, z + w / 2) });
    y += h;
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.height = y;
  return mesh;
}

/**
 * One agent tower at `origin`, with its annex behind it (away from the street) when older
 * sessions moved out. `powerAnchor` is where the power line leaves: street side of the ground floor.
 */
export function buildTower(
  graph: TowerGraph,
  origin: { x: number; z: number },
): { group: THREE.Group; floors: PlacedFloor[]; meshes: THREE.InstancedMesh[]; powerAnchor: THREE.Vector3 } {
  const agent = graph.graph.cityphy.agent;
  const ordered = stackOrder(graph.nodes);
  const floors: PlacedFloor[] = [];
  const group = new THREE.Group();

  const main = column(ordered.filter((n) => !n.cityphy.annex), agent, origin.x, origin.z, floors);
  group.add(main);
  const meshes = [main];

  const annexNodes = ordered.filter((n) => n.cityphy.annex);
  if (annexNodes.length) {
    const annexX = origin.x - 9;
    const annex = column(annexNodes, agent, annexX, origin.z, floors);
    group.add(annex);
    meshes.push(annex);
    const tag = makeLabel('anexo', 1);
    tag.position.set(annexX, annex.userData.height + 1.2, origin.z);
    group.add(tag);
  }

  const name = makeLabel(graph.graph.cityphy.agentName, 1.4);
  name.position.set(origin.x, main.userData.height + 2, origin.z);
  group.add(name);

  const groundTop = floors.filter((f) => f.node.cityphy.section === 'ground').reduce((y, f) => Math.max(y, f.anchor.y), 1);
  const powerAnchor = new THREE.Vector3(origin.x + SECTION_WIDTH.ground / 2, groundTop, origin.z);
  return { group, floors, meshes, powerAnchor };
}
