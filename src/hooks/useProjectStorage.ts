import { useEffect } from 'react';
import { useStore, type Material, type ProjectData, type StoredScene } from '../state/store';

const PALETTE_KEY = 'palette:global';
const SCHEMA_VERSION = 1;

function projectKey(id: string): string {
  return `proj:${id}`;
}

export function useProjectStorage() {
  useEffect(() => {
    hydratePalette();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.materials !== prev.materials || s.paletteOrder !== prev.paletteOrder) {
        persistPalette();
      }
    });
    return unsub;
  }, []);
}

function hydratePalette() {
  try {
    const raw = localStorage.getItem(PALETTE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.materials)) return;
    const order: string[] = Array.isArray(parsed.order) ? parsed.order : [];
    const materials = parsed.materials as Material[];
    useStore.setState({
      materials: Object.fromEntries(materials.map((m) => [m.id, m])),
      paletteOrder: order.length ? order : materials.map((m) => m.id),
      activeMaterialId:
        useStore.getState().activeMaterialId ?? materials[0]?.id ?? null,
    });
  } catch (err) {
    console.warn('Failed to hydrate palette from localStorage:', err);
  }
}

function persistPalette() {
  try {
    const state = useStore.getState();
    const payload = {
      version: SCHEMA_VERSION,
      order: state.paletteOrder,
      materials: state.paletteOrder
        .map((id) => state.materials[id])
        .filter(Boolean),
    };
    localStorage.setItem(PALETTE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('Failed to persist palette to localStorage:', err);
  }
}

/** Serializes the current project (all scenes including the active one). */
export function currentProjectData(): ProjectData {
  const s = useStore.getState();
  // Active scene's top-level state is not guaranteed to be in scenes[]; update.
  const scenes: StoredScene[] = s.scenes.map((sc) =>
    sc.id === s.activeSceneId
      ? {
          ...sc,
          primitives: s.primitives,
          cutouts: s.cutouts,
          renderCameraState: s.renderCameraState,
          lightState: s.lightState,
          renderState: s.renderState,
        }
      : sc,
  );
  return {
    id: s.projectId,
    name: s.projectName,
    scenes,
    activeSceneId: s.activeSceneId,
    cutoutImages: s.cutoutImages,
    schemaVersion: SCHEMA_VERSION,
  };
}

export function saveCurrentProjectToStorage() {
  const data = currentProjectData();
  try {
    localStorage.setItem(projectKey(data.id), JSON.stringify(data));
    localStorage.setItem('proj:current', data.id);
    return true;
  } catch (err) {
    console.warn('Failed to save project:', err);
    return false;
  }
}

export function listSavedProjects(): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('proj:') || key === 'proj:current') continue;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as ProjectData;
      if (data.id && data.name) out.push({ id: data.id, name: data.name });
    } catch {
      // skip corrupt entries
    }
  }
  return out;
}

export function loadProjectFromStorage(id: string): ProjectData | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as ProjectData;
  } catch (err) {
    console.warn('Failed to load project:', err);
    return null;
  }
}
