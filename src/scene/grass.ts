import * as THREE from 'three';

/**
 * Night grass: a small canvas of dark greens with speckles, repeated over the ground.
 * Deterministic (seeded) so the city looks the same on every load.
 */
export function grassTexture(base: string, repeat: number): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tones = ['#1d3a26', '#14281b', '#24452d', '#102017'];
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = tones[i % tones.length];
    ctx.fillRect(rnd() * size, rnd() * size, 1 + rnd() * 2, 1 + rnd() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
