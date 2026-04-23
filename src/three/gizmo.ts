import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { useStore, type Cutout, type Primitive, type Vec3 } from '../state/store';
import { GRID_STEP } from '../utils/snap';
import { beginTx, commitTx } from '../hooks/useHistory';

/** Target of an attached gizmo — a primitive (snap to grid) or a cutout (free). */
type AttachTarget =
  | { kind: 'primitive'; value: Primitive }
  | { kind: 'cutout'; value: Cutout };

export type GizmoHost = {
  camera: THREE.Camera;
  domElement: HTMLElement;
  scene: THREE.Scene;
  onDraggingChange: (dragging: boolean) => void;
};

/** Snaps a new position to the primitive's grid, preserving its offset within a cell. */
function snapPrimitivePosition(
  type: Primitive['type'],
  newPos: Vec3,
  anchor: Vec3,
): Vec3 {
  const step = GRID_STEP[type];
  const baseX = anchor.x - Math.round(anchor.x / step.xz) * step.xz;
  const baseY = anchor.y - Math.round(anchor.y / step.y) * step.y;
  const baseZ = anchor.z - Math.round(anchor.z / step.xz) * step.xz;
  return {
    x: Math.round((newPos.x - baseX) / step.xz) * step.xz + baseX,
    y: Math.round((newPos.y - baseY) / step.y) * step.y + baseY,
    z: Math.round((newPos.z - baseZ) / step.xz) * step.xz + baseZ,
  };
}

export function createGizmo(host: GizmoHost): {
  attachPrimitive: (mesh: THREE.Object3D, primitive: Primitive) => void;
  attachCutout: (mesh: THREE.Object3D, cutout: Cutout) => void;
  detach: () => void;
  dispose: () => void;
} {
  const controls = new TransformControls(host.camera, host.domElement);
  controls.setMode('translate');
  controls.setSize(0.8);

  const helper = controls.getHelper();
  helper.visible = false;
  helper.name = 'editorHelper:gizmo';
  helper.userData.editorOnly = true;
  host.scene.add(helper);

  let target: AttachTarget | null = null;

  controls.addEventListener('dragging-changed', (ev) => {
    const dragging = (ev as unknown as { value: boolean }).value;
    host.onDraggingChange(dragging);
    if (dragging) {
      beginTx();
      return;
    }
    if (!controls.object || !target) {
      commitTx();
      return;
    }
    const dragged: Vec3 = {
      x: controls.object.position.x,
      y: controls.object.position.y,
      z: controls.object.position.z,
    };
    if (target.kind === 'primitive') {
      // Primitives snap to their grid so stacks stay neat.
      const snapped = snapPrimitivePosition(target.value.type, dragged, target.value.position);
      useStore.getState().updatePrimitive(target.value.id, { position: snapped });
    } else {
      // Cutouts are free-positioned — no snap; just store where the user dropped them.
      useStore.getState().updateCutout(target.value.id, { position: dragged });
    }
    commitTx();
  });

  return {
    attachPrimitive(mesh, primitive) {
      target = { kind: 'primitive', value: primitive };
      controls.attach(mesh);
      helper.visible = true;
    },
    attachCutout(mesh, cutout) {
      target = { kind: 'cutout', value: cutout };
      controls.attach(mesh);
      helper.visible = true;
    },
    detach() {
      target = null;
      controls.detach();
      helper.visible = false;
    },
    dispose() {
      controls.detach();
      controls.dispose();
      host.scene.remove(helper);
    },
  };
}
