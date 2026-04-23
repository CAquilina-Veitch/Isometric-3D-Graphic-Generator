import * as THREE from 'three';
import { useStore, type Material, type Primitive } from '../state/store';
import { getScene } from './sceneSetup';
import { applyTransform, createMeshForPrimitive, createThreeMaterial } from './primitives';

const PRIMITIVES_GROUP = 'primitivesGroup';
const SELECTED_EMISSIVE = 0x3a5fd9;

function getPrimitivesGroup(scene: THREE.Scene): THREE.Group {
  const existing = scene.getObjectByName(PRIMITIVES_GROUP);
  if (existing instanceof THREE.Group) return existing;
  const group = new THREE.Group();
  group.name = PRIMITIVES_GROUP;
  scene.add(group);
  return group;
}

/** Initializes scene sync. Subscribes to store and reconciles mesh tree. Idempotent. */
export function initSceneSync(): () => void {
  const scene = getScene();
  const group = getPrimitivesGroup(scene);
  const meshById = new Map<string, THREE.Mesh>();

  const resolveMaterial = (id: string | null): Material | null =>
    id ? useStore.getState().materials[id] ?? null : null;

  reconcile(useStore.getState().primitives, group, meshById, resolveMaterial);
  applySelection(useStore.getState().selectedIds, meshById);

  const unsub = useStore.subscribe((s, prev) => {
    const primitivesChanged = s.primitives !== prev.primitives;
    const materialsChanged = s.materials !== prev.materials;
    if (primitivesChanged || materialsChanged) {
      reconcile(s.primitives, group, meshById, resolveMaterial);
      applySelection(s.selectedIds, meshById);
    }
    if (!primitivesChanged && !materialsChanged && s.selectedIds !== prev.selectedIds) {
      applySelection(s.selectedIds, meshById);
    }
  });

  return () => {
    unsub();
    for (const mesh of meshById.values()) {
      disposeMesh(mesh);
      group.remove(mesh);
    }
    meshById.clear();
  };
}

export function primitiveIdFor(object: THREE.Object3D | null): string | null {
  let o: THREE.Object3D | null = object;
  while (o) {
    const id = o.userData.primitiveId;
    if (typeof id === 'string') return id;
    o = o.parent;
  }
  return null;
}

export function getPrimitivesGroupObject(): THREE.Group {
  return getPrimitivesGroup(getScene());
}

function reconcile(
  primitives: Primitive[],
  group: THREE.Group,
  meshById: Map<string, THREE.Mesh>,
  resolveMaterial: (id: string | null) => Material | null,
) {
  const seen = new Set<string>();
  for (const p of primitives) {
    seen.add(p.id);
    const existing = meshById.get(p.id);
    if (!existing) {
      const mesh = createMeshForPrimitive(p, resolveMaterial(p.materialId));
      meshById.set(p.id, mesh);
      group.add(mesh);
    } else {
      applyTransform(existing, p);
      if (existing.userData.materialId !== p.materialId) {
        swapMaterial(existing, resolveMaterial(p.materialId));
        existing.userData.materialId = p.materialId;
      }
    }
  }
  for (const [id, mesh] of meshById) {
    if (!seen.has(id)) {
      disposeMesh(mesh);
      group.remove(mesh);
      meshById.delete(id);
    }
  }
}

function swapMaterial(mesh: THREE.Mesh, material: Material | null) {
  const old = mesh.material;
  if (Array.isArray(old)) old.forEach((m) => m.dispose());
  else old?.dispose();
  mesh.material = createThreeMaterial(material);
}

function applySelection(
  selectedIds: string[],
  meshById: Map<string, THREE.Mesh>,
) {
  const selected = new Set(selectedIds);
  for (const [id, mesh] of meshById) {
    const material = mesh.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.setHex(selected.has(id) ? SELECTED_EMISSIVE : 0x000000);
      material.emissiveIntensity = selected.has(id) ? 0.35 : 0;
    }
  }
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material?.dispose();
}
