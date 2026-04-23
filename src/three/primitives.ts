import * as THREE from 'three';
import type { Material, Primitive, PrimitiveType } from '../state/store';
import { getTexture } from './textures';
import {
  BEVEL_SIZE,
  adaptiveKey,
  computeCoveredFaces,
  createAdaptiveBoxGeometry,
  edgeBevelMask,
} from './adaptiveGeometry';

export type GeometryResult = {
  geometry: THREE.BufferGeometry;
  adaptiveKey: string | null;
};

export function createMeshForPrimitive(
  p: Primitive,
  material: Material | null,
  allPrimitives: Primitive[],
): THREE.Mesh {
  const { geometry, adaptiveKey: key } = buildGeometry(p, allPrimitives);
  const threeMaterial = createThreeMaterial(material);
  const mesh = new THREE.Mesh(geometry, threeMaterial);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  applyTransform(mesh, p);
  mesh.userData.primitiveId = p.id;
  mesh.userData.materialId = p.materialId;
  mesh.userData.adaptiveKey = key;
  return mesh;
}

export function buildGeometry(
  p: Primitive,
  allPrimitives: Primitive[],
): GeometryResult {
  if (p.type === 'cube' || p.type === 'tile') {
    const covered = computeCoveredFaces(allPrimitives).get(p.id) ?? new Set();
    const bevelMask = edgeBevelMask(covered);
    const half = p.type === 'cube'
      ? { x: 0.5, y: 0.5, z: 0.5 }
      : { x: 0.5, y: 0.125, z: 0.5 };
    const geometry = createAdaptiveBoxGeometry(
      half.x * p.scale.x,
      half.y * p.scale.y,
      half.z * p.scale.z,
      covered,
      bevelMask,
      BEVEL_SIZE,
    );
    return { geometry, adaptiveKey: adaptiveKey(covered, bevelMask) };
  }
  return {
    geometry: createSimpleGeometry(p.type),
    adaptiveKey: null,
  };
}

export function createThreeMaterial(material: Material | null): THREE.MeshStandardMaterial {
  if (!material) {
    return new THREE.MeshStandardMaterial({
      color: 0x808080,
      roughness: 0.6,
      metalness: 0.05,
    });
  }
  const map = getTexture({
    kind: material.textureKind,
    color: material.color,
    secondaryColor: material.secondaryColor,
  });
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(material.color),
    map,
    roughness: material.roughness,
    metalness: material.metalness,
  });
}

function createSimpleGeometry(type: PrimitiveType): THREE.BufferGeometry {
  switch (type) {
    case 'cube':
      return new THREE.BoxGeometry(1, 1, 1);
    case 'tile':
      return new THREE.BoxGeometry(1, 0.25, 1);
    case 'stairs':
      return createStairsGeometry();
    case 'slope':
      return createSlopeGeometry();
  }
}

/** Public helper for ghost mesh generation (doesn't need adaptive). */
export function createGeometry(type: PrimitiveType): THREE.BufferGeometry {
  return createSimpleGeometry(type);
}

export function applyTransform(mesh: THREE.Object3D, p: Primitive) {
  mesh.position.set(p.position.x, p.position.y, p.position.z);
  const toRad = Math.PI / 180;
  mesh.rotation.set(
    p.rotation.x * toRad,
    p.rotation.y * toRad,
    p.rotation.z * toRad,
  );
  mesh.scale.set(p.scale.x, p.scale.y, p.scale.z);
}

function createStairsGeometry(): THREE.BufferGeometry {
  const steps = 4;
  const geometries: THREE.BoxGeometry[] = [];
  const stepDepth = 1 / steps;
  const stepHeight = 1 / steps;
  for (let i = 0; i < steps; i++) {
    const h = stepHeight * (i + 1);
    const box = new THREE.BoxGeometry(1, h, stepDepth);
    box.translate(0, h / 2 - 0.5, 0.5 - stepDepth * (i + 0.5));
    geometries.push(box);
  }
  return mergeBoxes(geometries);
}

function createSlopeGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
    -0.5, -0.5,  0.5,
    -0.5,  0.5,  0.5,
     0.5,  0.5,  0.5,
  ]);
  const index = [
    0, 2, 1,
    0, 3, 2,
    3, 4, 5,
    3, 5, 2,
    0, 1, 4,
    1, 5, 4,
    0, 4, 3,
    1, 2, 5,
  ];
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function mergeBoxes(boxes: THREE.BoxGeometry[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const b of boxes) {
    const pos = b.getAttribute('position');
    const norm = b.getAttribute('normal');
    const idx = b.getIndex();
    for (let i = 0; i < pos.count; i++) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
    }
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    }
    offset += pos.count;
    b.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setIndex(indices);
  return g;
}
