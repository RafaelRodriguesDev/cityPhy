import * as THREE from 'three';
import { block, pickable, sign, windows } from './kit.ts';
import { LOT_HALF } from './layout.ts';
import { buildRadioMast } from './radioMast.ts';
import type { StationPlan } from './stationPlan.ts';
import type { Animator } from './stage.ts';

/** Width of the station lot, east of (behind) the condominium. */
export const STATION_WIDTH = 12;
const GAP = 3;
const SLOTS: Array<[number, number]> = [
  [-2.6, -8],
  [2.6, -4],
  [-2.6, 0],
  [2.6, 4],
  [-2.6, 8],
  [2.6, 11],
];

/** x of the station's center for a condominium centered at `condoX` with width `condoWidth`. */
export const stationX = (condoX: number, condoWidth: number) => condoX + condoWidth / 2 + GAP + STATION_WIDTH / 2;

/**
 * What the project used, behind its condominium: one lattice mast per MCP server (gray when the agent app brought it),
 * or, above the limit, a radio central (a building with masts on its roof and the real total on its sign).
 * Returns the top of each configured server's mast, to wire it to the civic radio park.
 */
export function buildStation(
  project: string,
  plan: StationPlan,
  at: { x: number; z: number },
): { group: THREE.Group; animators: Animator[]; tops: Array<{ name: string; top: THREE.Vector3 }> } {
  const group = new THREE.Group();
  const animators: Animator[] = [];
  const tops: Array<{ name: string; top: THREE.Vector3 }> = [];
  if (plan.mode === 'none') return { group, animators, tops };
  const pad = block(STATION_WIDTH, 0.15, LOT_HALF * 2, 0xd8d3c6, at.x, 0, at.z);
  group.add(pickable(pad, { kind: 'station', project, mcp: null }));
  const fence = 0xbfb9ab;
  group.add(
    block(STATION_WIDTH, 0.6, 0.15, fence, at.x, 0, at.z - LOT_HALF),
    block(STATION_WIDTH, 0.6, 0.15, fence, at.x, 0, at.z + LOT_HALF),
    block(0.15, 0.6, LOT_HALF * 2, fence, at.x + STATION_WIDTH / 2, 0, at.z),
  );

  if (plan.mode === 'masts') {
    plan.masts.forEach((m, i) => {
      const [dx, dz] = SLOTS[i];
      const mast = buildRadioMast({ agents: [], transport: m.transport }, i, { x: at.x + dx, z: at.z + dz }, {
        height: m.height,
        base: 0.9,
        app: !m.configured,
        bare: true,
        pick: { kind: 'station', project, mcp: m.name },
      });
      group.add(mast.group);
      animators.push(mast.animate);
      if (m.configured) tops.push({ name: m.name, top: mast.top });
      const tag = sign(m.name, 1.3, `${m.calls.toLocaleString('pt-BR')} chamadas`);
      tag.position.set(at.x + dx, m.height + 6, at.z + dz);
      group.add(tag);
    });
    const title = sign('Antenas do projeto', 1.8, `${plan.total} MCP · ${plan.calls.toLocaleString('pt-BR')} chamadas`);
    title.position.set(at.x, 3, at.z + LOT_HALF + 2);
    group.add(title);
  } else {
    const H = 9;
    const wall = new THREE.MeshLambertMaterial({ color: 0xc9c4b8, map: windows(4, 5) });
    const top = new THREE.MeshLambertMaterial({ color: 0xa9a49a });
    group.add(pickable(block(9, H, 18, [wall, wall, top, top, wall, wall], at.x, 0, at.z), { kind: 'station', project, mcp: null }));
    group.add(block(9.4, 0.35, 18.4, 0x8f8b82, at.x, H, at.z));
    plan.masts.forEach((m, i) => {
      const dx = ((i % 3) - 1) * 2.6;
      const dz = (Math.floor(i / 3) - 1) * 5.5;
      const mast = buildRadioMast({ agents: [], transport: m.transport }, i, { x: at.x + dx, z: at.z + dz }, {
        height: m.height,
        base: 0.45,
        app: !m.configured,
        bare: true,
        y: H + 0.35,
        pick: { kind: 'station', project, mcp: m.name },
      });
      group.add(mast.group);
      animators.push(mast.animate);
      if (m.configured) tops.push({ name: m.name, top: mast.top });
    });
    const title = sign('Central de rádio', 2.2, `${plan.total} MCP · ${plan.calls.toLocaleString('pt-BR')} chamadas`);
    title.position.set(at.x, H + 12, at.z);
    group.add(title);
  }
  return { group, animators, tops };
}

/** Dashed arc from a station mast to the same server's mast in the civic radio park (configured servers only). */
export function radioLink(from: THREE.Vector3, to: THREE.Vector3, color: number): THREE.Line {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.max(from.y, to.y) + 8;
  const curve = new THREE.QuadraticBezierCurve3(from, mid, to);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(48)), new THREE.LineDashedMaterial({ color, dashSize: 0.8, gapSize: 0.6 }));
  line.computeLineDistances();
  return line;
}
