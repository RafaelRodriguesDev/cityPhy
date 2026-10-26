import * as THREE from 'three';
import { fillOf, type ToolConsumption } from '../metrics/consumption/types.ts';
import { FIRST_MODEL_X, TOWER_X } from './cityLayout.ts';
import { makeLabel } from './label.ts';

const HEIGHT = 10;
const BLOCK_W = 2.1;
const DEPTH = 4.5;
const GAP = 0.3;

export interface BlockValue {
  key: 'week' | 'day';
  label: string; // "semana", "dia", "5 horas"
  fill: number | null; // 0..1, null = no 100% known
  text: string; // what the label on top says
  source: 'plano' | 'limite' | 'sem limite';
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} mi` : n >= 1e3 ? `${Math.round(n / 1e3)} mil` : String(n));

/**
 * What each block shows: the tool's own plan window when it reports one (real percent), else the
 * limit set in the local config, else the absolute consumption with "sem limite".
 */
export function blockValues(c: ToolConsumption): BlockValue[] {
  const win = (minutes: number) => c.windows.find((w) => w.minutes === minutes);
  const make = (key: BlockValue['key'], label: string, used: number, limit: number | null, window?: { usedPercent: number }): BlockValue => {
    if (window) return { key, label, fill: Math.min(1, window.usedPercent / 100), text: `${label} ${Math.round(window.usedPercent)}%`, source: 'plano' };
    const fill = fillOf(used, limit);
    if (fill !== null) return { key, label, fill, text: `${label} ${Math.round(fill * 100)}%`, source: 'limite' };
    return { key, label, fill: null, text: `${label} · ${fmt(used)}`, source: 'sem limite' };
  };
  const fiveHours = win(300);
  return [
    make('week', 'semana', c.week.fresh, c.limits.weekly, win(10080)),
    fiveHours ? make('day', '5 horas', c.today.fresh, null, fiveHours) : make('day', 'dia', c.today.fresh, c.limits.daily),
  ];
}

/** Fill color: calm under 60%, warm up to 85%, red above. */
const fillColor = (f: number) => new THREE.Color(f < 0.6 ? 0x5fd3ff : f < 0.85 ? 0xf2c46b : 0xe24b4a);

export interface ConsumptionBlock {
  kind: 'consumption';
  agent: string;
  value: BlockValue;
  consumption: ToolConsumption;
  mesh: THREE.InstancedMesh;
  index: number;
  color: THREE.Color;
}

/**
 * The consumption tower: two glass blocks (week | day or the tool's 5-hour window) that fill up
 * to 100%. It takes the first slot west of the annex; model towers come after it.
 */
export function buildConsumptionTower(c: ToolConsumption, origin: { x: number; z: number }): { group: THREE.Group; blocks: ConsumptionBlock[]; mesh: THREE.InstancedMesh } {
  const group = new THREE.Group();
  const x0 = origin.x + (FIRST_MODEL_X - TOWER_X);
  const glass = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, roughness: 0.1, metalness: 0.1, depthWrite: false }),
    2,
  );
  const blocks: ConsumptionBlock[] = [];
  const m = new THREE.Matrix4();
  const edges = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

  blockValues(c).forEach((value, i) => {
    const x = x0 + (i === 0 ? -1 : 1) * (BLOCK_W / 2 + GAP / 2);
    m.compose(new THREE.Vector3(x, HEIGHT / 2, origin.z), new THREE.Quaternion(), new THREE.Vector3(BLOCK_W, HEIGHT, DEPTH));
    glass.setMatrixAt(i, m);
    const color = new THREE.Color(0xffffff);
    glass.setColorAt(i, color);
    blocks.push({ kind: 'consumption', agent: c.agent, value, consumption: c, mesh: glass, index: i, color });

    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BLOCK_W, HEIGHT, DEPTH)), edges);
    frame.position.set(x, HEIGHT / 2, origin.z);
    group.add(frame);

    if (value.fill !== null && value.fill > 0) {
      const h = Math.max(0.05, value.fill * HEIGHT);
      const fill = new THREE.Mesh(
        new THREE.BoxGeometry(BLOCK_W * 0.86, h, DEPTH * 0.86),
        new THREE.MeshStandardMaterial({ color: fillColor(value.fill), emissive: fillColor(value.fill), emissiveIntensity: 0.35, roughness: 0.4 }),
      );
      fill.position.set(x, h / 2 + 0.02, origin.z);
      group.add(fill);
    }
    const tag = makeLabel(value.text, 0.6);
    tag.position.set(x, HEIGHT + 0.8 + i * 0.8, origin.z);
    group.add(tag);
  });
  glass.instanceMatrix.needsUpdate = true;
  if (glass.instanceColor) glass.instanceColor.needsUpdate = true;
  group.add(glass);

  const title = makeLabel('consumo', 0.8);
  title.position.set(x0, HEIGHT + 2.6, origin.z);
  group.add(title);
  return { group, blocks, mesh: glass };
}
