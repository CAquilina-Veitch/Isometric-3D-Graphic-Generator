import * as THREE from 'three';
import type { Primitive, PrimitiveType } from '../state/store';

/**
 * Face-aware box geometry for cubes and tiles:
 *   - Detects which faces are fully covered by a neighboring primitive.
 *   - Emits only the exposed faces as sharp axis-aligned quads.
 *
 * Face indices: 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z.
 *
 * No bevels, no chamfer strips, no corner fillets — every edge is sharp. The
 * adaptive bevel approach we tried earlier created unavoidable artifacts at
 * mixed-size junctions (e.g. tile against cube), so we removed it entirely.
 */

const EPS = 1e-4;

type FaceId = 0 | 1 | 2 | 3 | 4 | 5;

export type AdaptiveType = 'cube' | 'tile';

const ADAPTIVE_TYPES: PrimitiveType[] = ['cube', 'tile'];

function isAdaptive(p: Primitive): p is Primitive & { type: AdaptiveType } {
  return (ADAPTIVE_TYPES as string[]).includes(p.type);
}

/** Base half-extents per adaptive type (before scale). */
const BASE_HALF: Record<AdaptiveType, { x: number; y: number; z: number }> = {
  cube: { x: 0.5, y: 0.5, z: 0.5 },
  tile: { x: 0.5, y: 0.125, z: 0.5 },
};

/** Outward-pointing unit normal per face. */
const FACE_NORMAL: Record<FaceId, [number, number, number]> = {
  0: [1, 0, 0],   // +X
  1: [-1, 0, 0],  // -X
  2: [0, 1, 0],   // +Y
  3: [0, -1, 0],  // -Y
  4: [0, 0, 1],   // +Z
  5: [0, 0, -1],  // -Z
};

/**
 * Face corners in CCW order as seen from OUTSIDE the cube in Three.js's
 * right-handed coordinate system. Each tuple indexes into CORNER_COORDS.
 * Verified so the cross product of the first three vertices points outward
 * along the face's normal (so Three.js front-face culling behaves correctly).
 */
const FACE_CORNERS: Record<FaceId, [number, number, number, number]> = {
  0: [2, 6, 5, 1], // +X
  1: [4, 7, 3, 0], // -X
  2: [7, 6, 2, 3], // +Y
  3: [1, 5, 4, 0], // -Y
  4: [5, 6, 7, 4], // +Z
  5: [3, 2, 1, 0], // -Z
};

/** Corner sign pattern: index → (signX, signY, signZ). */
const CORNER_COORDS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, 1, -1],
  [-1, 1, -1],
  [-1, -1, 1],
  [1, -1, 1],
  [1, 1, 1],
  [-1, 1, 1],
];

/** World-space AABB + axis-aligned half extents for an adaptive primitive. */
type PrimBox = {
  id: string;
  type: AdaptiveType;
  cx: number;
  cy: number;
  cz: number;
  hx: number;
  hy: number;
  hz: number;
};

function getBox(p: Primitive): PrimBox | null {
  if (!isAdaptive(p)) return null;
  const base = BASE_HALF[p.type];
  return {
    id: p.id,
    type: p.type,
    cx: p.position.x,
    cy: p.position.y,
    cz: p.position.z,
    hx: base.x * p.scale.x,
    hy: base.y * p.scale.y,
    hz: base.z * p.scale.z,
  };
}

function approx(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS;
}

/**
 * Returns a map of primitive id → set of covered face indices. A face is
 * "covered" iff an adjacent primitive's perpendicular rectangle fully contains
 * it on both perpendicular axes. Partial overlaps don't count — a small tile
 * shouldn't cover a cube's larger face (we'd leave a visible hole).
 */
export function computeCoveredFaces(
  primitives: Primitive[],
): Map<string, Set<FaceId>> {
  const boxes: PrimBox[] = [];
  for (const p of primitives) {
    const b = getBox(p);
    if (b) boxes.push(b);
  }
  const covered = new Map<string, Set<FaceId>>();
  for (const b of boxes) covered.set(b.id, new Set());

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      checkAxis(a, b, covered, 'y', 2, 3);
      checkAxis(a, b, covered, 'x', 0, 1);
      checkAxis(a, b, covered, 'z', 4, 5);
    }
  }
  return covered;
}

function checkAxis(
  a: PrimBox,
  b: PrimBox,
  covered: Map<string, Set<FaceId>>,
  axis: 'x' | 'y' | 'z',
  posFace: FaceId,
  negFace: FaceId,
) {
  const ac = axis === 'x' ? a.cx : axis === 'y' ? a.cy : a.cz;
  const bc = axis === 'x' ? b.cx : axis === 'y' ? b.cy : b.cz;
  const ah = axis === 'x' ? a.hx : axis === 'y' ? a.hy : a.hz;
  const bh = axis === 'x' ? b.hx : axis === 'y' ? b.hy : b.hz;

  if (approx(ac + ah, bc - bh)) {
    if (rectContains(b, a, axis)) covered.get(a.id)!.add(posFace);
    if (rectContains(a, b, axis)) covered.get(b.id)!.add(negFace);
  }
  if (approx(ac - ah, bc + bh)) {
    if (rectContains(b, a, axis)) covered.get(a.id)!.add(negFace);
    if (rectContains(a, b, axis)) covered.get(b.id)!.add(posFace);
  }
}

function rectContains(
  outer: PrimBox,
  inner: PrimBox,
  axis: 'x' | 'y' | 'z',
): boolean {
  const checks: [number, number, number, number][] = [];
  if (axis !== 'x') checks.push([outer.cx, outer.hx, inner.cx, inner.hx]);
  if (axis !== 'y') checks.push([outer.cy, outer.hy, inner.cy, inner.hy]);
  if (axis !== 'z') checks.push([outer.cz, outer.hz, inner.cz, inner.hz]);
  for (const [oc, oh, ic, ih] of checks) {
    if (oc - oh > ic - ih + EPS) return false;
    if (oc + oh < ic + ih - EPS) return false;
  }
  return true;
}

/** 6-bit mask → Set for convenience. */
export function coveredSet(mask: number): Set<FaceId> {
  const out = new Set<FaceId>();
  for (let i = 0; i < 6; i++) if (mask & (1 << i)) out.add(i as FaceId);
  return out;
}

/** Stable identity for a covered-face set so reconcilers can detect changes. */
export function adaptiveKey(covered: Set<FaceId>): string {
  let mask = 0;
  covered.forEach((f) => (mask |= 1 << f));
  return String(mask);
}

/**
 * Builds an axis-aligned box with all covered faces omitted. Sharp edges,
 * no bevels — predictable geometry that behaves well at every adjacency.
 */
export function createAdaptiveBoxGeometry(
  halfX: number,
  halfY: number,
  halfZ: number,
  covered: Set<FaceId>,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  const cornerPos = (c: number): readonly [number, number, number] => {
    const [sx, sy, sz] = CORNER_COORDS[c];
    return [sx * halfX, sy * halfY, sz * halfZ];
  };

  const emitTri = (
    pa: readonly [number, number, number],
    pb: readonly [number, number, number],
    pc: readonly [number, number, number],
    normal: readonly [number, number, number],
  ) => {
    positions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2], pc[0], pc[1], pc[2]);
    for (let i = 0; i < 3; i++) normals.push(normal[0], normal[1], normal[2]);
    uvs.push(0, 0, 1, 0, 1, 1);
  };

  for (let f = 0; f < 6; f++) {
    const faceId = f as FaceId;
    if (covered.has(faceId)) continue;
    const normal = FACE_NORMAL[faceId];
    const [c0, c1, c2, c3] = FACE_CORNERS[faceId];
    const p0 = cornerPos(c0);
    const p1 = cornerPos(c1);
    const p2 = cornerPos(c2);
    const p3 = cornerPos(c3);
    emitTri(p0, p1, p2, normal);
    emitTri(p0, p2, p3, normal);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/** Convenience: compute covered faces + return geometry for one primitive. */
export function buildAdaptiveGeometryFor(
  primitive: Primitive,
  allPrimitives: Primitive[],
): { geometry: THREE.BufferGeometry; covered: Set<FaceId> } | null {
  if (!isAdaptive(primitive)) return null;
  const coveredMap = computeCoveredFaces(allPrimitives);
  const covered = coveredMap.get(primitive.id) ?? new Set<FaceId>();
  const base = BASE_HALF[primitive.type];
  const geometry = createAdaptiveBoxGeometry(
    base.x * primitive.scale.x,
    base.y * primitive.scale.y,
    base.z * primitive.scale.z,
    covered,
  );
  return { geometry, covered };
}
