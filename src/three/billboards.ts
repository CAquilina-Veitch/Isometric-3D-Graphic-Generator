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

const OUTLINE_MESH_NAME = 'cutoutOutline';

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
  mesh.userData.cutoutBaseSize = { x, y };
  return mesh;
}

/**
 * Adds / updates / removes a silhouette outline mesh as a child of the cutout.
 * The outline is a slightly-scaled-up copy of the cutout plane; its shader
 * samples the cutout's alpha map and paints all opaque pixels with a single
 * flat color — giving that "paper cutout" offset-silhouette look.
 */
export function syncCutoutOutline(mesh: THREE.Mesh, cutout: Cutout) {
  const existing = mesh.children.find(
    (c) => c.name === OUTLINE_MESH_NAME,
  ) as THREE.Mesh | undefined;

  if (!cutout.outlineColor) {
    if (existing) {
      mesh.remove(existing);
      existing.geometry.dispose();
      if (!Array.isArray(existing.material)) existing.material.dispose();
    }
    return;
  }

  const thickness = cutout.outlineThickness ?? 0.04;
  const base = mesh.userData.cutoutBaseSize as { x: number; y: number } | undefined;
  if (!base) return;

  // Size the outline plane slightly larger by a world-space margin on each side.
  const outlineX = base.x + 2 * thickness;
  const outlineY = base.y + 2 * thickness;

  const colorUniform = new THREE.Color(cutout.outlineColor);
  const main = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const alphaSource =
    main instanceof THREE.MeshStandardMaterial ? main.map : null;

  if (existing) {
    // Resize geometry if thickness changed; otherwise just update color.
    const existingMat = existing.material as THREE.ShaderMaterial;
    existingMat.uniforms.outlineColor.value.copy(colorUniform);
    if (alphaSource && existingMat.uniforms.map.value !== alphaSource) {
      existingMat.uniforms.map.value = alphaSource;
    }
    if (
      existing.userData.outlineSize?.x !== outlineX ||
      existing.userData.outlineSize?.y !== outlineY
    ) {
      existing.geometry.dispose();
      existing.geometry = new THREE.PlaneGeometry(outlineX, outlineY);
      existing.userData.outlineSize = { x: outlineX, y: outlineY };
    }
    return;
  }

  const geometry = new THREE.PlaneGeometry(outlineX, outlineY);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: alphaSource },
      outlineColor: { value: colorUniform },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D map;
      uniform vec3 outlineColor;
      varying vec2 vUv;
      void main() {
        vec4 tex = texture2D(map, vUv);
        if (tex.a < 0.5) discard;
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });

  const outline = new THREE.Mesh(geometry, material);
  outline.name = OUTLINE_MESH_NAME;
  // Position slightly behind the cutout's local plane so it sits *behind* in
  // its local frame but still casts a shadow. 0.002 is below typical depth
  // precision thresholds at this world scale so z-fighting is unlikely.
  outline.position.set(0, 0, -0.002);
  outline.castShadow = true;
  outline.receiveShadow = false;
  outline.userData.outlineSize = { x: outlineX, y: outlineY };
  mesh.add(outline);
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
