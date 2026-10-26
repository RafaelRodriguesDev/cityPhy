import * as THREE from 'three';

/** Text sprite that always faces the camera. `scale` is the world height of the text. */
export function makeLabel(text: string, scale: number): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  const font = '600 64px system-ui, sans-serif';
  ctx.font = font;
  canvas.width = Math.ceil(ctx.measureText(text).width) + 32;
  canvas.height = 96;
  ctx.font = font;
  ctx.fillStyle = '#e8ecf5';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 16, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set((scale * canvas.width) / canvas.height, scale, 1);
  return sprite;
}
