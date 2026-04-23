import * as THREE from 'three';
import type { PrimitiveType } from '../state/store';
import { createGeometry } from './primitives';

const GHOST_NAME = 'ghostPreview';

export function getOrCreateGhost(
  scene: THREE.Scene,
  type: PrimitiveType,
): THREE.Mesh {
  const existing = scene.getObjectByName(GHOST_NAME);
  if (existing instanceof THREE.Mesh && existing.userData.ghostType === type) {
    return existing;
  }
  // replace if type changed
  if (existing) {
    scene.remove(existing);
    if (existing instanceof THREE.Mesh) {
      existing.geometry?.dispose();
      (existing.material as THREE.Material).dispose();
    }
  }

  const geometry = createGeometry(type);
  const material = new THREE.MeshBasicMaterial({
    color: 0x7aa2ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = GHOST_NAME;
  mesh.userData.ghostType = type;
  mesh.renderOrder = 999;
  scene.add(mesh);
  return mesh;
}

export function removeGhost(scene: THREE.Scene) {
  const existing = scene.getObjectByName(GHOST_NAME);
  if (!existing) return;
  scene.remove(existing);
  if (existing instanceof THREE.Mesh) {
    existing.geometry?.dispose();
    (existing.material as THREE.Material).dispose();
  }
}
