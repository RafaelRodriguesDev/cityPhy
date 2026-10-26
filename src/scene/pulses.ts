import * as THREE from 'three';
import type { Animator } from './stage.ts';
import { glowTexture } from './glow.ts';

/** Anything a pulse can run along: tower cables and power lines. */
export interface PulsePath {
  curve: THREE.Curve<THREE.Vector3>;
  color: THREE.Color;
}

/** One light pulse running along each path, staggered so they do not move in lockstep. */
export function buildPulses(cables: PulsePath[], size = 0.9): { object: THREE.Points; animator: Animator; setRunning(on: boolean): void } {
  const positions = new Float32Array(cables.length * 3);
  const colors = new Float32Array(cables.length * 3);
  const phase = cables.map((_, i) => (i * 0.6180339) % 1);
  const speed = cables.map((c) => 0.9 / Math.max(2, c.curve.getLength()) * 4);
  cables.forEach((c, i) => colors.set([c.color.r, c.color.g, c.color.b], i * 3));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const object = new THREE.Points(geometry, material);
  const p = new THREE.Vector3();
  let running = true;

  const place = () => {
    cables.forEach((c, i) => {
      c.curve.getPoint(phase[i], p);
      positions.set([p.x, p.y, p.z], i * 3);
    });
    geometry.attributes.position.needsUpdate = true;
  };
  place();

  const animator: Animator = (dt) => {
    if (!running) return false;
    for (let i = 0; i < phase.length; i++) phase[i] = (((phase[i] + dt * speed[i]) % 1) + 1) % 1;
    place();
    return true;
  };
  return {
    object,
    animator,
    setRunning(on) {
      running = on;
      object.visible = on;
    },
  };
}
