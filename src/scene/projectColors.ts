import * as THREE from 'three';

/** Each project gets its own color: its power line, pulses and lot wiring use it. */
const PALETTE = [0xffb347, 0x5fd3ff, 0xc792ff, 0x7dffa1, 0xff7ab6, 0xfff07a];

export function projectColor(index: number): THREE.Color {
  return new THREE.Color(PALETTE[index % PALETTE.length]);
}
