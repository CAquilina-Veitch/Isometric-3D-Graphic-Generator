import * as THREE from 'three';
import type { Primitive, PrimitiveType } from '../state/store';

/**
 * Adaptive geometry for axis-aligned cubes and tiles:
 *   - Detects face-plane coincidence with neighbouring primitives.
 *   - Covered faces are hidden; edges where both adjacent faces are exposed
 *     get a small bevel; edges where either face is covered stay sharp.
 *
 * Face indices:        0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z
 * Corner indices:      0..7, each at a ± combination (see CORNER_COORDS).
 * Edge indices 0..11:  see EDGE_ENDPOINTS / EDGE_ADJACENT_FACES below.
 */

export const BEVEL_SIZE = 0.055;
const EPS = 1e-4;

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

type FaceId = 0 | 1 | 2 | 3 | 4 | 5;

/** Signed-axis unit vectors matching face indices. */
const FACE_NORMAL: Record<FaceId, [number, number, number]> = {
  0: [1, 0, 0],
  1: [-1, 0, 0],
  2: [0, 1, 0],
  3: [0, -1, 0],
  4: [0, 0, 1],
  5: [0, 0, -1],
};

/** For each face, its 4 edge indices (one per boundary edge, CCW around the outward normal). */
const FACE_EDGES: Record<FaceId, [number, number, number, number]> = {
  0: [9, 7, 11, 5], // +X
  1: [4, 6, 10, 8], // -X
  2: [1, 3, 10, 11], // +Y
  3: [0, 2, 8, 9], // -Y
  4: [2, 3, 6, 7], // +Z
  5: [0, 1, 4, 5], // -Z
};

/** Corner ± pattern: index → (signX, signY, signZ). */
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

/** Edge → [cornerA, cornerB]. */
const EDGE_ENDPOINTS: [number, number][] = [
  [0, 1], // 0
  [2, 3], // 1
  [4, 5], // 2
  [6, 7], // 3
  [0, 3], // 4
  [1, 2], // 5
  [4, 7], // 6
  [5, 6], // 7
  [0, 4], // 8
  [1, 5], // 9
  [3, 7], // 10
  [2, 6], // 11
];

/** Edge → the two faces that share it. */
const EDGE_ADJACENT_FACES: [FaceId, FaceId][] = [
  [3, 5], // 0
  [2, 5], // 1
  [3, 4], // 2
  [2, 4], // 3
  [1, 5], // 4
  [0, 5], // 5
  [1, 4], // 6
  [0, 4], // 7
  [1, 3], // 8
  [0, 3], // 9
  [1, 2], // 10
  [0, 2], // 11
];

/** Edge → the axis it runs along (0=X, 1=Y, 2=Z). */
const EDGE_AXIS: (0 | 1 | 2)[] = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];

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

/** Returns a record keyed by primitive id → 6-bit mask of covered face indices. */
export function computeCoveredFaces(primitives: Primitive[]): Map<string, Set<FaceId>> {
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
  posFace: FaceId, // face on +axis
  negFace: FaceId, // face on -axis
) {
  const ac = axis === 'x' ? a.cx : axis === 'y' ? a.cy : a.cz;
  const bc = axis === 'x' ? b.cx : axis === 'y' ? b.cy : b.cz;
  const ah = axis === 'x' ? a.hx : axis === 'y' ? a.hy : a.hz;
  const bh = axis === 'x' ? b.hx : axis === 'y' ? b.hy : b.hz;

  // A's +axis face at ac+ah; B's -axis face at bc-bh
  if (approx(ac + ah, bc - bh) && rectOverlap(a, b, axis)) {
    covered.get(a.id)!.add(posFace);
    covered.get(b.id)!.add(negFace);
  }
  if (approx(ac - ah, bc + bh) && rectOverlap(a, b, axis)) {
    covered.get(a.id)!.add(negFace);
    covered.get(b.id)!.add(posFace);
  }
}

/** Returns true if boxes overlap on the two axes other than `axis`. */
function rectOverlap(a: PrimBox, b: PrimBox, axis: 'x' | 'y' | 'z'): boolean {
  const checks: [number, number, number, number][] = [];
  if (axis !== 'x') checks.push([a.cx, a.hx, b.cx, b.hx]);
  if (axis !== 'y') checks.push([a.cy, a.hy, b.cy, b.hy]);
  if (axis !== 'z') checks.push([a.cz, a.hz, b.cz, b.hz]);
  for (const [ac, ah, bc, bh] of checks) {
    const lo = Math.max(ac - ah, bc - bh);
    const hi = Math.min(ac + ah, bc + bh);
    if (hi - lo <= EPS) return false;
  }
  return true;
}

/** Returns a 12-bit mask; bit i = edge i bevelled. */
export function edgeBevelMask(covered: Set<FaceId>): number {
  let mask = 0;
  for (let e = 0; e < 12; e++) {
    const [fa, fb] = EDGE_ADJACENT_FACES[e];
    if (!covered.has(fa) && !covered.has(fb)) mask |= 1 << e;
  }
  return mask;
}

/** 6-bit mask → Set for convenience. */
export function coveredSet(mask: number): Set<FaceId> {
  const out = new Set<FaceId>();
  for (let i = 0; i < 6; i++) if (mask & (1 << i)) out.add(i as FaceId);
  return out;
}

/** Pack covered + bevels into one key so we can detect changes cheaply. */
export function adaptiveKey(covered: Set<FaceId>, bevelMask: number): string {
  let coverMask = 0;
  covered.forEach((f) => (coverMask |= 1 << f));
  return `${coverMask}|${bevelMask}`;
}

/**
 * Builds an axis-aligned box with per-edge bevels and per-face hiding.
 *
 * Geometry: 3 face-corner positions are computed per cube corner (one for each
 * of its 3 adjacent faces). A face's polygon uses the 4 face-corners at its
 * boundary. Each bevelled edge emits a chamfer strip connecting 2 face-corners
 * at each end. When all 3 edges meeting at a cube corner are bevelled, emit a
 * triangular fillet that closes the opening.
 */
export function createAdaptiveBoxGeometry(
  halfX: number,
  halfY: number,
  halfZ: number,
  covered: Set<FaceId>,
  bevelMask: number,
  bevel = BEVEL_SIZE,
): THREE.BufferGeometry {
  const b = Math.min(bevel, halfX * 0.45, halfY * 0.45, halfZ * 0.45);
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  /** For each (corner 0..7, face 0..5), the face-corner position. -1 if not adjacent. */
  const faceCornerPos: (readonly [number, number, number] | null)[][] = Array.from(
    { length: 8 },
    () => Array(6).fill(null),
  );
  for (let c = 0; c < 8; c++) {
    const [sx, sy, sz] = CORNER_COORDS[c];
    const base = [sx * halfX, sy * halfY, sz * halfZ] as const;
    for (let f = 0; f < 6; f++) {
      const faceId = f as FaceId;
      const [nx, ny, nz] = FACE_NORMAL[faceId];
      // Is this corner on this face?
      if (nx !== 0 && Math.sign(nx) !== sx) continue;
      if (ny !== 0 && Math.sign(ny) !== sy) continue;
      if (nz !== 0 && Math.sign(nz) !== sz) continue;
      // Find the 2 edges at this corner that belong to this face.
      const faceEdges = FACE_EDGES[faceId];
      const edgesAtCorner: number[] = [];
      for (const e of faceEdges) {
        const [ca, cb] = EDGE_ENDPOINTS[e];
        if (ca === c || cb === c) edgesAtCorner.push(e);
      }
      // Position = base, inset by b along each bevelled edge axis toward center.
      let x = base[0];
      let y = base[1];
      let z = base[2];
      for (const e of edgesAtCorner) {
        if (!(bevelMask & (1 << e))) continue;
        const axis = EDGE_AXIS[e];
        // Inset in the direction OPPOSITE the corner sign on the edge's axis.
        if (axis === 0) x -= sx * b;
        else if (axis === 1) y -= sy * b;
        else z -= sz * b;
      }
      faceCornerPos[c][f] = [x, y, z];
    }
  }

  // Emit face polygons (as two triangles each) for exposed faces.
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

  // Each face corners, in CCW order relative to the face normal.
  const FACE_CORNERS: Record<FaceId, [number, number, number, number]> = {
    0: [1, 5, 6, 2],
    1: [0, 3, 7, 4],
    2: [3, 2, 6, 7],
    3: [0, 4, 5, 1],
    4: [4, 7, 6, 5],
    5: [0, 1, 2, 3],
  };

  for (let f = 0; f < 6; f++) {
    const faceId = f as FaceId;
    if (covered.has(faceId)) continue;
    const normal = FACE_NORMAL[faceId];
    const [c0, c1, c2, c3] = FACE_CORNERS[faceId];
    const p0 = faceCornerPos[c0][faceId];
    const p1 = faceCornerPos[c1][faceId];
    const p2 = faceCornerPos[c2][faceId];
    const p3 = faceCornerPos[c3][faceId];
    if (!p0 || !p1 || !p2 || !p3) continue;
    emitTri(p0, p1, p2, normal);
    emitTri(p0, p2, p3, normal);
  }

  // Each bevelled edge: emit chamfer strip (quad).
  const emitQuad = (
    pa: readonly [number, number, number],
    pb: readonly [number, number, number],
    pc: readonly [number, number, number],
    pd: readonly [number, number, number],
  ) => {
    // Compute normal from cross product.
    const u: [number, number, number] = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const v: [number, number, number] = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n: [number, number, number] = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const nn: [number, number, number] = [n[0] / len, n[1] / len, n[2] / len];
    emitTri(pa, pb, pc, nn);
    emitTri(pa, pc, pd, nn);
  };

  for (let e = 0; e < 12; e++) {
    if (!(bevelMask & (1 << e))) continue;
    const [ca, cb] = EDGE_ENDPOINTS[e];
    const [fa, fb] = EDGE_ADJACENT_FACES[e];
    // Skip strip if either face is covered — it's "inside" geometry.
    if (covered.has(fa) || covered.has(fb)) continue;
    const aFa = faceCornerPos[ca][fa];
    const aFb = faceCornerPos[ca][fb];
    const bFa = faceCornerPos[cb][fa];
    const bFb = faceCornerPos[cb][fb];
    if (!aFa || !aFb || !bFa || !bFb) continue;
    // Quad: aFa → bFa → bFb → aFb, oriented outward.
    emitQuad(aFa, bFa, bFb, aFb);
  }

  // Corner fillets: where all 3 adjacent edges at a corner are bevelled and none of
  // the 3 adjacent faces are covered, emit a triangle between the 3 face-corners.
  const CORNER_EDGES: [number, number, number][] = [
    [0, 4, 8],  // corner 0: edges 0, 4, 8
    [0, 5, 9],  // 1
    [1, 5, 11], // 2
    [1, 4, 10], // 3
    [2, 6, 8],  // 4
    [2, 7, 9],  // 5
    [3, 7, 11], // 6
    [3, 6, 10], // 7
  ];
  const CORNER_FACES: [FaceId, FaceId, FaceId][] = [
    [1, 3, 5],
    [0, 3, 5],
    [0, 2, 5],
    [1, 2, 5],
    [1, 3, 4],
    [0, 3, 4],
    [0, 2, 4],
    [1, 2, 4],
  ];

  for (let c = 0; c < 8; c++) {
    const [e1, e2, e3] = CORNER_EDGES[c];
    const allBev =
      bevelMask & (1 << e1) && bevelMask & (1 << e2) && bevelMask & (1 << e3);
    if (!allBev) continue;
    const [fa, fb, fc] = CORNER_FACES[c];
    if (covered.has(fa) || covered.has(fb) || covered.has(fc)) continue;
    const pa = faceCornerPos[c][fa];
    const pb = faceCornerPos[c][fb];
    const pc = faceCornerPos[c][fc];
    if (!pa || !pb || !pc) continue;
    // Orient outward via the corner's sign vector.
    const [sx, sy, sz] = CORNER_COORDS[c];
    const normal: [number, number, number] = [sx, sy, sz];
    const len = Math.hypot(normal[0], normal[1], normal[2]) || 1;
    normal[0] /= len; normal[1] /= len; normal[2] /= len;
    // Pick winding that matches outward normal.
    const centroid: [number, number, number] = [
      (pa[0] + pb[0] + pc[0]) / 3,
      (pa[1] + pb[1] + pc[1]) / 3,
      (pa[2] + pb[2] + pc[2]) / 3,
    ];
    const u: [number, number, number] = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const v: [number, number, number] = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const cross: [number, number, number] = [
      u[1] * v[2] - u[2] * v[1],
      u[2] * v[0] - u[0] * v[2],
      u[0] * v[1] - u[1] * v[0],
    ];
    const dot = cross[0] * normal[0] + cross[1] * normal[1] + cross[2] * normal[2];
    if (dot >= 0) emitTri(pa, pb, pc, normal);
    else emitTri(pa, pc, pb, normal);
    void centroid;
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

/** Convenience: compute covered + bevel flags + return geometry for one primitive. */
export function buildAdaptiveGeometryFor(
  primitive: Primitive,
  allPrimitives: Primitive[],
): { geometry: THREE.BufferGeometry; covered: Set<FaceId>; bevelMask: number } | null {
  if (!isAdaptive(primitive)) return null;
  const coveredMap = computeCoveredFaces(allPrimitives);
  const covered = coveredMap.get(primitive.id) ?? new Set<FaceId>();
  const bevelMask = edgeBevelMask(covered);
  const base = BASE_HALF[primitive.type];
  const geometry = createAdaptiveBoxGeometry(
    base.x * primitive.scale.x,
    base.y * primitive.scale.y,
    base.z * primitive.scale.z,
    covered,
    bevelMask,
  );
  return { geometry, covered, bevelMask };
}
