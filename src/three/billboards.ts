import * as THREE from 'three';
import type { Cutout, CutoutImage } from '../state/store';

const textureCache = new Map<string, THREE.Texture>();

/**
 * Loads an image file, processes near-white pixels to alpha=0, returns a
 * serializable CutoutImage with a dataUrl containing the processed bitmap.
 */
export async function processImageFile(
  file: File,
  options: { whiteThreshold?: number } = {},
): Promise<Omit<CutoutImage, 'id' | 'name'>> {
  const whiteThreshold = options.whiteThreshold ?? 240;
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d canvas context');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, image.width, image.height);
    for (let i = 0; i < data.data.length; i += 4) {
      const r = data.data[i];
      const g = data.data[i + 1];
      const b = data.data[i + 2];
      if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
        data.data[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    return {
      textureDataUrl: canvas.toDataURL('image/png'),
      width: image.width,
      height: image.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function getOrCreateCutoutTexture(image: CutoutImage): THREE.Texture {
  const cached = textureCache.get(image.id);
  if (cached) return cached;
  const loader = new THREE.TextureLoader();
  const texture = loader.load(image.textureDataUrl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  textureCache.set(image.id, texture);
  return texture;
}

/** World size (x, y) for a cutout of given pixel dimensions. */
export function cutoutWorldSize(image: CutoutImage, targetHeight = 2): { x: number; y: number } {
  const aspect = image.width / image.height;
  return { x: targetHeight * aspect, y: targetHeight };
}

export function createCutoutMesh(cutout: Cutout, image: CutoutImage): THREE.Mesh {
  const { x, y } = cutoutWorldSize(image);
  const geometry = new THREE.PlaneGeometry(x, y);
  const texture = getOrCreateCutoutTexture(image);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.9,
    metalness: 0.0,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  applyCutoutTransform(mesh, cutout);
  mesh.userData.cutoutId = cutout.id;
  mesh.userData.cutoutImageId = cutout.imageId;
  return mesh;
}

export function applyCutoutTransform(mesh: THREE.Object3D, c: Cutout) {
  mesh.position.set(c.position.x, c.position.y, c.position.z);
  const toRad = Math.PI / 180;
  mesh.rotation.set(c.rotation.x * toRad, c.rotation.y * toRad, c.rotation.z * toRad);
  mesh.scale.set(c.scale.x, c.scale.y, c.scale.z);
}

/** Call each frame to update billboards that face the camera. */
export function updateBillboardFacings(
  group: THREE.Group,
  cutoutsById: Map<string, Cutout>,
  camera: THREE.Camera,
) {
  for (const mesh of group.children) {
    const id = mesh.userData.cutoutId;
    if (typeof id !== 'string') continue;
    const cutout = cutoutsById.get(id);
    if (!cutout || cutout.facing !== 'billboard') continue;
    mesh.lookAt(camera.position);
  }
}
