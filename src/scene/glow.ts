import * as THREE from 'three';

let texture: THREE.Texture | null = null;

/** Soft round dot so lights read as light, not as squares. Shared by pulses and lamps. */
export function glowTexture(): THREE.Texture {
  if (texture) return texture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  texture = new THREE.CanvasTexture(c);
  return texture;
}
