import * as THREE from 'three';
import type { LibraryMcp } from '../library/types.ts';
import { makeLabel } from './label.ts';

/** Remote servers stand tall and orange (data leaves the machine); local ones short and blue. */
export const MCP_COLOR = { local: 0x5fd3ff, remote: 0xf2a65a } as const;
const HEIGHT = { local: 4.5, remote: 8 } as const;
const SPACING = 3.2;
const PER_ROW = 6; // antennas along the street before starting another row further east

/** One MCP server: one antenna. */
export interface Antenna {
  kind: 'mcp';
  mcp: LibraryMcp;
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/** Length (along the street) and width the radio park needs. */
export const radioLength = (count: number) => Math.min(count, PER_ROW) * SPACING;
export const radioWidth = (count: number) => Math.ceil(count / PER_ROW) * SPACING;

/** The radio park: one antenna per MCP server, in rows along the street (towards -z from `origin`). */
export function buildRadio(mcps: LibraryMcp[], origin: { x: number; z: number }): { group: THREE.Group; antennas: Antenna[]; mesh: THREE.InstancedMesh | null } {
  const group = new THREE.Group();
  if (!mcps.length) return { group, antennas: [], mesh: null };
  // The mast is what gets picked; one unit-tall cylinder scaled per antenna.
  const mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.3, 1, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.4 }), mcps.length);
  const antennas: Antenna[] = [];
  const m = new THREE.Matrix4();
  mcps.forEach((mcp, i) => {
    const h = HEIGHT[mcp.transport];
    const z = origin.z - (i % PER_ROW) * SPACING - SPACING / 2;
    const x = origin.x + Math.floor(i / PER_ROW) * SPACING + SPACING / 2;
    m.compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
    mesh.setMatrixAt(i, m);
    const color = new THREE.Color(MCP_COLOR[mcp.transport]);
    mesh.setColorAt(i, color);
    antennas.push({ kind: 'mcp', mcp, mesh, index: i, color });

    const top = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 }));
    top.position.set(x, h + 0.3, z);
    group.add(top);
    // One ring per agent that has it configured.
    mcp.agents.forEach((_, r) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20), new THREE.MeshBasicMaterial({ color }));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, 1 + r * 0.6, z);
      group.add(ring);
    });
    const tag = makeLabel(mcp.name, 0.55);
    tag.position.set(x, h + 1.3, z);
    group.add(tag);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  group.add(mesh);
  const title = makeLabel('Rádio · MCP', 1);
  title.position.set(origin.x + radioWidth(mcps.length) / 2, 10.5, origin.z - radioLength(mcps.length) / 2);
  group.add(title);
  return { group, antennas, mesh };
}
