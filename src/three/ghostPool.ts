import * as THREE from 'three';
import type { PrimitiveType } from '../state/store';
import { createGeometry } from './primitives';

const POOL_NAME = 'ghostPool';

export interface GhostPool {
  setPositions(
    positions: Array<{ x: number; y: number; z: number }>,
    rotationYDeg: number,
  ): void;
  clear(): void;
  dispose(): void;
}

export function createGhostPool(scene: THREE.Scene, type: PrimitiveType): GhostPool {
  const group = new THREE.Group();
  group.name = POOL_NAME;
  scene.add(group);

  const geometry = createGeometry(type);
  const material = new THREE.MeshBasicMaterial({
    color: 0x7aa2ff,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });

  const meshes: THREE.Mesh[] = [];

  const ensureCapacity = (n: number) => {
    while (meshes.length < n) {
      const m = new THREE.Mesh(geometry, material);
      m.renderOrder = 999;
      group.add(m);
      meshes.push(m);
    }
  };

  return {
    setPositions(positions, rotationYDeg) {
      ensureCapacity(positions.length);
      const ry = (rotationYDeg * Math.PI) / 180;
      for (let i = 0; i < meshes.length; i++) {
        const visible = i < positions.length;
        meshes[i].visible = visible;
        if (visible) {
          const p = positions[i];
          meshes[i].position.set(p.x, p.y, p.z);
          meshes[i].rotation.y = ry;
        }
      }
    },
    clear() {
      for (const m of meshes) m.visible = false;
    },
    dispose() {
      scene.remove(group);
      geometry.dispose();
      material.dispose();
      meshes.length = 0;
    },
  };
}
