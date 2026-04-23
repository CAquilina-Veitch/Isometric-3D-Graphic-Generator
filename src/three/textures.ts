import * as THREE from 'three';

export type TextureKind = 'plain' | 'checker' | 'noise' | 'brick';

export type TextureParams = {
  kind: TextureKind;
  color: string;
  secondaryColor?: string;
};

const cache = new Map<string, THREE.CanvasTexture | null>();

function cacheKey(params: TextureParams): string {
  return `${params.kind}|${params.color}|${params.secondaryColor ?? ''}`;
}

/** Returns a cached THREE texture, or null for 'plain' (no texture map). */
export function getTexture(params: TextureParams): THREE.CanvasTexture | null {
  const key = cacheKey(params);
  if (cache.has(key)) return cache.get(key) ?? null;

  let texture: THREE.CanvasTexture | null = null;
  switch (params.kind) {
    case 'plain':
      texture = null;
      break;
    case 'checker':
      texture = makeChecker(params.color, params.secondaryColor ?? darken(params.color, 0.35));
      break;
    case 'noise':
      texture = makeNoise(params.color);
      break;
    case 'brick':
      texture = makeBrick(params.color, params.secondaryColor ?? darken(params.color, 0.55));
      break;
  }

  cache.set(key, texture);
  return texture;
}

export function clearTextureCache() {
  for (const t of cache.values()) t?.dispose();
  cache.clear();
}

function makeCanvas(size: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get 2d context for texture');
  return { canvas, ctx };
}

function finishTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function makeChecker(a: string, b: string): THREE.CanvasTexture {
  const { canvas, ctx } = makeCanvas(64);
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillRect(32, 32, 32, 32);
  return finishTexture(canvas);
}

function makeNoise(base: string): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const jitter = (Math.random() - 0.5) * 40;
    img.data[i] = clamp8(img.data[i] + jitter);
    img.data[i + 1] = clamp8(img.data[i + 1] + jitter);
    img.data[i + 2] = clamp8(img.data[i + 2] + jitter);
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas);
}

function makeBrick(brick: string, mortar: string): THREE.CanvasTexture {
  const size = 128;
  const { canvas, ctx } = makeCanvas(size);
  ctx.fillStyle = mortar;
  ctx.fillRect(0, 0, size, size);
  const rowH = size / 4;
  const brickW = size / 2;
  ctx.fillStyle = brick;
  for (let row = 0; row < 4; row++) {
    const offset = (row % 2) * (brickW / 2);
    for (let col = 0; col < 3; col++) {
      const x = (col * brickW + offset) % size;
      ctx.fillRect(x + 1, row * rowH + 1, brickW - 2, rowH - 2);
    }
  }
  return finishTexture(canvas);
}

function clamp8(v: number): number {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

function darken(hex: string, factor: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const k = 1 - factor;
  return (
    '#' +
    [r, g, b]
      .map((v) => Math.round(v * k).toString(16).padStart(2, '0'))
      .join('')
  );
}
