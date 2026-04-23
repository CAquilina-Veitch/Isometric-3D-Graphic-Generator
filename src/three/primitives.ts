import * as THREE from 'three';
import type { Primitive, PrimitiveType } from '../state/store';

const DEFAULT_COLORS: Record<PrimitiveType, number> = {
  cube: 0x8aa2d4,
  tile: 0xc4a47a,
  stairs: 0xb38aa8,
  slope: 0x8cbfa3,
};

export function createMeshForPrimitive(p: Primitive): THREE.Mesh {
  const geometry = createGeometry(p.type);
  const material = new THREE.MeshStandardMaterial({
    color: DEFAULT_COLORS[p.type],
    roughness: 0.6,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  applyTransform(mesh, p);
  mesh.userData.primitiveId = p.id;
  return mesh;
}

export function createGeometry(type: PrimitiveType): THREE.BufferGeometry {
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
    // bottom
    -0.5, -0.5, -0.5,
     0.5, -0.5, -0.5,
     0.5, -0.5,  0.5,
    -0.5, -0.5,  0.5,
    // top edge (high end at +z, low at -z)
    -0.5,  0.5,  0.5,
     0.5,  0.5,  0.5,
  ]);
  const index = [
    // bottom
    0, 2, 1,
    0, 3, 2,
    // ramp (top)
    3, 4, 5,
    3, 5, 2,
    // back (low end)
    0, 1, 4,
    1, 5, 4,
    // left
    0, 4, 3,
    // right
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
