import { useEffect } from 'react';
import { useStore, type Material } from '../state/store';

const PALETTE_KEY = 'palette:global';

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
      activeBrushMaterialId:
        useStore.getState().activeBrushMaterialId ?? materials[0]?.id ?? null,
    });
  } catch (err) {
    console.warn('Failed to hydrate palette from localStorage:', err);
  }
}

function persistPalette() {
  try {
    const state = useStore.getState();
    const payload = {
      version: 1,
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
