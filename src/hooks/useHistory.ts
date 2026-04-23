import { useSyncExternalStore } from 'react';
import { useStore, type Primitive } from '../state/store';

const MAX_ENTRIES = 50;

type Snapshot = Primitive[];

const past: Snapshot[] = [];
const future: Snapshot[] = [];
let pendingTx: Snapshot | null = null;
let txDepth = 0;

const listeners = new Set<() => void>();
function emit() {
  for (const cb of listeners) cb();
}

function cloneSnapshot(primitives: Primitive[]): Snapshot {
  return primitives.map((p) => ({
    ...p,
    position: { ...p.position },
    rotation: { ...p.rotation },
    scale: { ...p.scale },
  }));
}

function primitivesEqual(a: Snapshot, b: Snapshot): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const pa = a[i];
    const pb = b[i];
    if (
      pa.id !== pb.id ||
      pa.type !== pb.type ||
      pa.materialId !== pb.materialId ||
      pa.position.x !== pb.position.x ||
      pa.position.y !== pb.position.y ||
      pa.position.z !== pb.position.z ||
      pa.rotation.x !== pb.rotation.x ||
      pa.rotation.y !== pb.rotation.y ||
      pa.rotation.z !== pb.rotation.z ||
      pa.scale.x !== pb.scale.x ||
      pa.scale.y !== pb.scale.y ||
      pa.scale.z !== pb.scale.z
    ) {
      return false;
    }
  }
  return true;
}

/** Begin a transaction. Nested calls are allowed — only the outermost commit records a snapshot. */
export function beginTx() {
  if (txDepth === 0) {
    pendingTx = cloneSnapshot(useStore.getState().primitives);
  }
  txDepth++;
}

/** End a transaction. If this is the outermost commit and the state actually changed, push a snapshot. */
export function commitTx() {
  if (txDepth === 0) return;
  txDepth--;
  if (txDepth > 0) return;
  if (!pendingTx) return;
  const current = useStore.getState().primitives;
  if (!primitivesEqual(pendingTx, current)) {
    past.push(pendingTx);
    if (past.length > MAX_ENTRIES) past.shift();
    future.length = 0;
    emit();
  }
  pendingTx = null;
}

/** Record a single discrete action: snapshot the pre-state, run the fn, commit. */
export function record(fn: () => void) {
  beginTx();
  try {
    fn();
  } finally {
    commitTx();
  }
}

export function undo() {
  if (past.length === 0) return;
  const target = past.pop()!;
  future.push(cloneSnapshot(useStore.getState().primitives));
  useStore.setState((s) => ({
    primitives: target,
    sceneDirty: s.sceneDirty + 1,
  }));
  emit();
}

export function redo() {
  if (future.length === 0) return;
  const target = future.pop()!;
  past.push(cloneSnapshot(useStore.getState().primitives));
  useStore.setState((s) => ({
    primitives: target,
    sceneDirty: s.sceneDirty + 1,
  }));
  emit();
}

let cachedState = { canUndo: false, canRedo: false };
export function historyState(): { canUndo: boolean; canRedo: boolean } {
  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  if (cachedState.canUndo !== canUndo || cachedState.canRedo !== canRedo) {
    cachedState = { canUndo, canRedo };
  }
  return cachedState;
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** React hook for Undo/Redo button enabled state. */
export function useHistoryState() {
  return useSyncExternalStore(subscribe, historyState, historyState);
}
