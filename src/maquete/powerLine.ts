import * as THREE from 'three';
import type { Animator } from './stage.ts';

const DARK = 0x8c8a84;

export interface PowerLine {
  agent: string;
  project: string;
  setOn(on: boolean): void;
  animate: Animator;
}

/**
 * From the agent's tower, up to a lamp post across the street (through the air), along the posts and down
 * to the condominium gatehouse. Sags a little between supports. Lit (project color, running pulse) only while active.
 */
export function buildPowerLine(agent: string, project: string, from: THREE.Vector3, gate: THREE.Vector3, lamps: THREE.Vector3[], color: number, scene: THREE.Scene): PowerLine {
  const near = (z: number) => lamps.reduce((a, b) => (Math.abs(b.z - z) < Math.abs(a.z - z) ? b : a));
  const a = near(from.z);
  const b = near(gate.z);
  const posts = lamps.filter((l) => (l.z - a.z) * (l.z - b.z) <= 0).sort((p, q) => (a.z < b.z ? p.z - q.z : q.z - p.z));
  const supports = [from, ...posts.map((p) => p.clone().add(new THREE.Vector3(0.2, -0.2, 0))), gate];
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < supports.length - 1; i++) {
    const p = supports[i];
    const q = supports[i + 1];
    for (let k = 0; k < 8; k++) {
      const t = k / 8;
      const v = new THREE.Vector3().lerpVectors(p, q, t);
      v.y -= Math.sin(Math.PI * t) * Math.min(1.2, p.distanceTo(q) * 0.05);
      points.push(v);
    }
  }
  points.push(gate);
  const curve = new THREE.CatmullRomCurve3(points);
  const material = new THREE.MeshBasicMaterial({ color: DARK });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, points.length * 4, 0.09, 5), material);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c2 }));
  pulse.visible = false;
  scene.add(tube, pulse);
  let on = false;
  let t = 0;
  return {
    agent,
    project,
    setOn(v) {
      on = v;
      material.color.setHex(v ? color : DARK);
      pulse.visible = v;
    },
    animate(dt) {
      if (!on) return false;
      t = (t + dt * 0.25) % 1;
      pulse.position.copy(curve.getPointAt(t));
      return true;
    },
  };
}
