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
 * The outline plane is larger than the cutout by `thickness` on every side.
 * Its shader dilates the cutout's alpha by sampling around each fragment in
 * world-space, so the outline width is uniform around every edge of the
 * silhouette regardless of shape or aspect ratio.
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

  // Outline plane must contain the dilated silhouette: base + thickness per side.
  const outlineX = base.x + 2 * thickness;
  const outlineY = base.y + 2 * thickness;

  const colorUniform = new THREE.Color(cutout.outlineColor);
  const main = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const alphaSource =
    main instanceof THREE.MeshStandardMaterial ? main.map : null;

  if (existing) {
    const existingMat = existing.material as THREE.ShaderMaterial;
    existingMat.uniforms.outlineColor.value.copy(colorUniform);
    existingMat.uniforms.thickness.value = thickness;
    existingMat.uniforms.baseSize.value.set(base.x, base.y);
    existingMat.uniforms.outlineSize.value.set(outlineX, outlineY);
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
      thickness: { value: thickness },
      baseSize: { value: new THREE.Vector2(base.x, base.y) },
      outlineSize: { value: new THREE.Vector2(outlineX, outlineY) },
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
      uniform float thickness;
      uniform vec2 baseSize;
      uniform vec2 outlineSize;
      varying vec2 vUv;

      // Samples the cutout alpha at a point offset from the outline plane's
      // center, given in world units. Returns 0 if outside the cutout rect.
      float sampleAlphaAt(vec2 worldOffset) {
        vec2 uv = worldOffset / baseSize + 0.5;
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;
        return texture2D(map, uv).a;
      }

      void main() {
        // This fragment's position on the plane, in world units, centered.
        vec2 pos = (vUv - 0.5) * outlineSize;

        // Inside the silhouette — let the cutout itself render here.
        if (sampleAlphaAt(pos) >= 0.5) discard;

        // TODO(user): write the dilation sample loop.
        // Decide if any opaque pixel lies within 'thickness' world units of 'pos'.
        // If so, set hit = true and this fragment is part of the outline ring.
        // Offsets MUST be in world units (not UV); use sampleAlphaAt(pos + offset).
        bool hit = false;
        // ... your sampling loop here ...

        if (!hit) discard;
        gl_FragColor = vec4(outlineColor, 1.0);
      }
    `,
    side: THREE.DoubleSide,
    transparent: false,
    depthWrite: true,
  });

  const outline = new THREE.Mesh(geometry, material);
  outline.name = OUTLINE_MESH_NAME;
  outline.position.set(0, 0, -0.002);
  outline.castShadow = true;
  outline.receiveShadow = false;
  outline.userData.outlineSize = { x: outlineX, y: outlineY };
  mesh.add(outline);
}

export function applyCutoutTransform(mesh: THREE.Object3D, c: Cutout) {
  mesh.position.set(c.position.x, c.position.y, c.position.z);
  const toRad = Math.PI / 180;
  mesh.rotation.set(c.rotation.x * toRad, c.rotation.y * toRad, c.rotation.z * toRad, 'YXZ');
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
