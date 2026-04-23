import * as THREE from 'three';
import { useStore, type Primitive } from '../state/store';
import { getScene } from './sceneSetup';
import { applyTransform, createMeshForPrimitive } from './primitives';

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

  reconcile(useStore.getState().primitives, group, meshById);
  applySelection(useStore.getState().selectedIds, meshById);

  const unsub = useStore.subscribe((s, prev) => {
    if (s.primitives !== prev.primitives) {
      reconcile(s.primitives, group, meshById);
      applySelection(s.selectedIds, meshById);
    }
    if (s.selectedIds !== prev.selectedIds) {
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

/** Returns the primitive id for a hit mesh, or null if it's not a primitive. */
export function primitiveIdFor(object: THREE.Object3D | null): string | null {
  let o: THREE.Object3D | null = object;
  while (o) {
    const id = o.userData.primitiveId;
    if (typeof id === 'string') return id;
    o = o.parent;
  }
  return null;
}

/** Returns the primitives group for raycasting. */
export function getPrimitivesGroupObject(): THREE.Group {
  return getPrimitivesGroup(getScene());
}

function reconcile(
  primitives: Primitive[],
  group: THREE.Group,
  meshById: Map<string, THREE.Mesh>,
) {
  const seen = new Set<string>();
  for (const p of primitives) {
    seen.add(p.id);
    const existing = meshById.get(p.id);
    if (!existing) {
      const mesh = createMeshForPrimitive(p);
      meshById.set(p.id, mesh);
      group.add(mesh);
    } else {
      applyTransform(existing, p);
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
