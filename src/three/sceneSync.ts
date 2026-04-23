import * as THREE from 'three';
import { useStore, type Primitive } from '../state/store';
import { getScene } from './sceneSetup';
import { applyTransform, createMeshForPrimitive } from './primitives';

const PRIMITIVES_GROUP = 'primitivesGroup';

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

  const unsub = useStore.subscribe((s, prev) => {
    if (s.primitives !== prev.primitives) {
      reconcile(s.primitives, group, meshById);
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
  // remove meshes whose primitives are gone
  for (const [id, mesh] of meshById) {
    if (!seen.has(id)) {
      disposeMesh(mesh);
      group.remove(mesh);
      meshById.delete(id);
    }
  }
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material?.dispose();
}
