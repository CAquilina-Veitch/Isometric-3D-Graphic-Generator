import * as THREE from 'three';
import type { Material, Primitive, PrimitiveType } from '../state/store';
import { getTexture } from './textures';
import {
  adaptiveKey,
  computeCoveredFaces,
  createAdaptiveBoxGeometry,
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
    const half = p.type === 'cube'
      ? { x: 0.5, y: 0.5, z: 0.5 }
      : { x: 0.5, y: 0.125, z: 0.5 };
    const geometry = createAdaptiveBoxGeometry(
      half.x * p.scale.x,
      half.y * p.scale.y,
      half.z * p.scale.z,
      covered,
    );
    return { geometry, adaptiveKey: adaptiveKey(covered) };
  }
  return {
    geometry: createSimpleGeometry(p.type),
    adaptiveKey: null,
  };
}

export function createThreeMaterial(
  material: Material | null,
): THREE.MeshStandardMaterial | THREE.MeshBasicMaterial {
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
  const lighting = material.lighting ?? 'lit';
  if (lighting === 'unlit') {
    // Flat shading — ignores lights. MeshBasicMaterial's map is multiplied by color,
    // so we still get color+texture, just no lighting.
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(material.color),
      map,
    });
  }
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(material.color),
    map,
    roughness: material.roughness,
    metalness: material.metalness,
  });
  if (lighting === 'emissive') {
    mat.emissive.set(material.color);
    mat.emissiveIntensity = material.emissiveStrength ?? 1;
    mat.emissiveMap = map;
  }
  return mat;
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
    case 'curve':
      return createCurveGeometry();
    case 'curveHorizontal':
      return createCurveHorizontalGeometry();
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

/**
 * Stairs as the extrusion of a 2D staircase profile. The old mergeBoxes
 * approach stacked four whole BoxGeometrys; their coplanar back/front faces
 * overlapped inside the merged mesh and caused shadow-map z-fighting that
 * showed up as bright slivers at each tread's inner corner. Extruding a
 * single closed profile gives us one contiguous solid with no internal faces.
 */
function createStairsGeometry(): THREE.BufferGeometry {
  const steps = 4;
  const inv = 1 / steps;
  const shape = new THREE.Shape();
  // Shape is (2D X = primitive Z depth, 2D Y = primitive Y height). We author
  // it CCW so ExtrudeGeometry emits outward-facing tris. Front of stairs at
  // +Z, top of stairs at +Y; profile traces front-bottom up to top-back.
  shape.moveTo(0.5, -0.5);
  for (let i = 0; i < steps; i++) {
    const topY = -0.5 + (i + 1) * inv;
    const backZ = 0.5 - (i + 1) * inv;
    // Up the riser of this step
    shape.lineTo(0.5 - i * inv, topY);
    // Back along this step's tread
    shape.lineTo(backZ, topY);
  }
  // From top-back down the back wall and forward along the bottom.
  shape.lineTo(-0.5, -0.5);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: false,
    curveSegments: 1,
  });
  // ExtrudeGeometry's native frame: shape in XY, extrusion along +Z. We want
  // shape in (primitive Z, primitive Y) and extrusion along primitive X.
  // rotateY(π/2) maps (x, y, z) → (z, y, -x):
  //   shape X (depth) → primitive Z
  //   shape Y (height) → primitive Y
  //   extrude Z (0..1) → primitive X (0..-1)
  geometry.rotateY(Math.PI / 2);
  // After rotateY(π/2) the extrusion spans X ∈ [0, 1] (three.js matrix maps
  // +Z → +X for that angle). Shift by -0.5 so the mesh is centered at origin —
  // otherwise Y-rotation pivots off-centre and swings outside the tile footprint.
  geometry.translate(-0.5, 0, 0);
  return geometry;
}

/**
 * Vertical quarter-pie extruded to 1×1×1 bounds. Pie tip sits at the
 * primitive's (+X, +Z) corner; the arc of radius 1 sweeps from (+X, -Z) to
 * (-X, +Z) through the (-X, -Z) region. Rotating four copies 90° and tiling
 * them 2×2 so the pie tips all meet at the shared inner corner composes a
 * complete cylinder of diameter 2 with its axis along +Y.
 */
function createCurveGeometry(): THREE.BufferGeometry {
  return buildQuarterPieExtrusion('vertical');
}

/**
 * Horizontal quarter-pie: same pie cross-section but extruded along +Z so the
 * cylinder axis is horizontal. Four of them tiled 2×2 in the X/Y plane form a
 * horizontal cylinder along +Z. Useful for curved floor-to-wall fillets and
 * half-pipes.
 */
function createCurveHorizontalGeometry(): THREE.BufferGeometry {
  return buildQuarterPieExtrusion('horizontal');
}

function buildQuarterPieExtrusion(
  orientation: 'vertical' | 'horizontal',
): THREE.BufferGeometry {
  // 2D shape, authored CCW so ExtrudeGeometry's front faces stay outward after
  // we rotate. Pie tip at (0.5, -0.5) in 2D; arc of radius 1 sweeps from
  // (0.5, 0.5) down to (-0.5, -0.5). Traversing tip → (0.5, 0.5) → arc →
  // (-0.5, -0.5) → tip keeps the filled interior on the traversal's left.
  const shape = new THREE.Shape();
  shape.moveTo(0.5, -0.5);
  shape.lineTo(0.5, 0.5);
  shape.absarc(0.5, -0.5, 1, Math.PI / 2, Math.PI, false);
  shape.lineTo(0.5, -0.5);

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 1,
    bevelEnabled: false,
    curveSegments: 24,
  });
  // ExtrudeGeometry native orientation: shape lives in XY, extrusion runs +Z.
  // Normals/winding are already correct for the CCW shape — we only rotate
  // (no scales-by-negative) so the normal matrix stays identity-like.
  if (orientation === 'vertical') {
    // Swing the shape up into XZ and turn the extrusion into +Y. rotateX(-π/2)
    // maps (x, y, z) → (x, z, -y). Shape's Y axis (which held the pie's
    // +Y direction) becomes the primitive's -Z, so the tip at 2D (0.5, -0.5)
    // ends up at primitive (0.5, y, 0.5) — our desired (+X, +Z) corner.
    geometry.rotateX(-Math.PI / 2);
    // Extrusion went from Y=0 to Y=1; shift down to center on Y=0.
    geometry.translate(0, -0.5, 0);
  } else {
    // Shape already in XY; extrusion along +Z is exactly what we want. The
    // cross-section sits upright (quarter-pie in XY) and the piece is 1 unit
    // long along Z. Shift Z to center.
    geometry.translate(0, 0, -0.5);
  }
  return geometry;
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
  // Triangle order is CCW from outside in Three.js's right-handed coords so
  // the computed normals point outward and front-face culling renders them.
  const index = [
    0, 1, 2,
    0, 2, 3,
    3, 5, 4,
    3, 2, 5,
    0, 4, 1,
    1, 4, 5,
    0, 3, 4,
    1, 5, 2,
  ];
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.setIndex(index);
  // Un-index before computing normals so each triangle owns its vertex copies.
  // With shared vertices, computeVertexNormals averages across adjacent faces
  // and the slope gets smeared shading at every corner; we want crisp per-face
  // flat shading.
  const nonIndexed = g.toNonIndexed();
  nonIndexed.computeVertexNormals();
  g.dispose();
  return nonIndexed;
}

