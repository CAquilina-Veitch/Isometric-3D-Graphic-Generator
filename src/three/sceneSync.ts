import * as THREE from 'three';
import { useStore, type Cutout, type CutoutImage, type Material, type Primitive } from '../state/store';
import { getScene } from './sceneSetup';
import { applyTransform, buildGeometry, createMeshForPrimitive, createThreeMaterial } from './primitives';
import { applyCutoutTransform, createCutoutMesh } from './billboards';

const PRIMITIVES_GROUP = 'primitivesGroup';
const CUTOUTS_GROUP = 'cutoutsGroup';
const SELECTED_EMISSIVE = 0x3a5fd9;

function getGroup(scene: THREE.Scene, name: string): THREE.Group {
  const existing = scene.getObjectByName(name);
  if (existing instanceof THREE.Group) return existing;
  const group = new THREE.Group();
  group.name = name;
  scene.add(group);
  return group;
}

export function initSceneSync(): () => void {
  const scene = getScene();
  const primitivesGroup = getGroup(scene, PRIMITIVES_GROUP);
  const cutoutsGroup = getGroup(scene, CUTOUTS_GROUP);
  const primitiveMeshById = new Map<string, THREE.Mesh>();
  const cutoutMeshById = new Map<string, THREE.Mesh>();

  const resolveMaterial = (id: string | null): Material | null =>
    id ? useStore.getState().materials[id] ?? null : null;
  const resolveImage = (id: string | null): CutoutImage | null =>
    id ? useStore.getState().cutoutImages[id] ?? null : null;

  reconcilePrimitives(useStore.getState().primitives, primitivesGroup, primitiveMeshById, resolveMaterial);
  reconcileCutouts(useStore.getState().cutouts, cutoutsGroup, cutoutMeshById, resolveImage);
  applySelection(useStore.getState().selectedIds, primitiveMeshById, cutoutMeshById);

  const unsub = useStore.subscribe((s, prev) => {
    const primitivesChanged = s.primitives !== prev.primitives;
    const cutoutsChanged = s.cutouts !== prev.cutouts;
    const materialsChanged = s.materials !== prev.materials;
    const cutoutImagesChanged = s.cutoutImages !== prev.cutoutImages;

    if (primitivesChanged || materialsChanged) {
      reconcilePrimitives(s.primitives, primitivesGroup, primitiveMeshById, resolveMaterial);
    }
    if (cutoutsChanged || cutoutImagesChanged) {
      reconcileCutouts(s.cutouts, cutoutsGroup, cutoutMeshById, resolveImage);
    }
    if (s.selectedIds !== prev.selectedIds || primitivesChanged || cutoutsChanged) {
      applySelection(s.selectedIds, primitiveMeshById, cutoutMeshById);
    }
  });

  return () => {
    unsub();
    for (const mesh of primitiveMeshById.values()) {
      disposeMesh(mesh);
      primitivesGroup.remove(mesh);
    }
    primitiveMeshById.clear();
    for (const mesh of cutoutMeshById.values()) {
      disposeMesh(mesh);
      cutoutsGroup.remove(mesh);
    }
    cutoutMeshById.clear();
  };
}

/** Returns { kind, id } for a raycast hit mesh or null. */
export function resolveHit(
  object: THREE.Object3D | null,
): { kind: 'primitive' | 'cutout'; id: string } | null {
  let o: THREE.Object3D | null = object;
  while (o) {
    const pid = o.userData.primitiveId;
    if (typeof pid === 'string') return { kind: 'primitive', id: pid };
    const cid = o.userData.cutoutId;
    if (typeof cid === 'string') return { kind: 'cutout', id: cid };
    o = o.parent;
  }
  return null;
}

export function primitiveIdFor(object: THREE.Object3D | null): string | null {
  const hit = resolveHit(object);
  return hit?.kind === 'primitive' ? hit.id : null;
}

export function getPrimitivesGroupObject(): THREE.Group {
  return getGroup(getScene(), PRIMITIVES_GROUP);
}

export function getCutoutsGroupObject(): THREE.Group {
  return getGroup(getScene(), CUTOUTS_GROUP);
}

/** Returns meshes of all selectable objects across groups, for raycasting. */
export function getSelectableMeshes(): THREE.Object3D[] {
  return [
    ...getPrimitivesGroupObject().children,
    ...getCutoutsGroupObject().children,
  ];
}

function reconcilePrimitives(
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
      const mesh = createMeshForPrimitive(p, resolveMaterial(p.materialId), primitives);
      meshById.set(p.id, mesh);
      group.add(mesh);
    } else {
      applyTransform(existing, p);
      if (existing.userData.materialId !== p.materialId) {
        swapMaterial(existing, resolveMaterial(p.materialId));
        existing.userData.materialId = p.materialId;
      }
      // Rebuild geometry if adaptive flags changed (or if this is adaptive-capable
      // and we haven't yet). This is a diff on the precomputed key string.
      const { geometry, adaptiveKey } = buildGeometry(p, primitives);
      const prevKey = existing.userData.adaptiveKey ?? null;
      if (prevKey !== adaptiveKey) {
        existing.geometry?.dispose();
        existing.geometry = geometry;
        existing.userData.adaptiveKey = adaptiveKey;
      } else {
        geometry.dispose();
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

function reconcileCutouts(
  cutouts: Cutout[],
  group: THREE.Group,
  meshById: Map<string, THREE.Mesh>,
  resolveImage: (id: string | null) => CutoutImage | null,
) {
  const seen = new Set<string>();
  for (const c of cutouts) {
    seen.add(c.id);
    const image = resolveImage(c.imageId);
    if (!image) continue;
    const existing = meshById.get(c.id);
    if (!existing) {
      const mesh = createCutoutMesh(c, image);
      meshById.set(c.id, mesh);
      group.add(mesh);
    } else {
      applyCutoutTransform(existing, c);
      if (existing.userData.cutoutImageId !== c.imageId) {
        disposeMesh(existing);
        group.remove(existing);
        const replacement = createCutoutMesh(c, image);
        meshById.set(c.id, replacement);
        group.add(replacement);
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
  primitiveMeshById: Map<string, THREE.Mesh>,
  cutoutMeshById: Map<string, THREE.Mesh>,
) {
  const selected = new Set(selectedIds);
  for (const [id, mesh] of primitiveMeshById) {
    const material = mesh.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.setHex(selected.has(id) ? SELECTED_EMISSIVE : 0x000000);
      material.emissiveIntensity = selected.has(id) ? 0.35 : 0;
    }
  }
  for (const [id, mesh] of cutoutMeshById) {
    const material = mesh.material;
    if (material instanceof THREE.MeshStandardMaterial) {
      material.emissive.setHex(selected.has(id) ? SELECTED_EMISSIVE : 0x000000);
      material.emissiveIntensity = selected.has(id) ? 0.25 : 0;
    }
  }
}

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material?.dispose();
}
