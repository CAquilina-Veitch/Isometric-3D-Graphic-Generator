import { create } from 'zustand';

export type Tool =
  | 'select'
  | 'cube'
  | 'tile'
  | 'stairs'
  | 'slope'
  | 'brush'
  | 'gizmo'
  | 'orbit';

export type RightTab = 'properties' | 'camera' | 'light' | 'render';

type UiSlice = {
  activeTool: Tool;
  activeRightTab: RightTab;
  previewVisible: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  sceneDirty: number;
};

type UiActions = {
  setActiveTool: (t: Tool) => void;
  setActiveRightTab: (t: RightTab) => void;
  togglePreview: () => void;
  toggleGrid: () => void;
  toggleSnap: () => void;
  markSceneDirty: () => void;
};

export type Store = UiSlice & UiActions;

export const useStore = create<Store>((set) => ({
  activeTool: 'select',
  activeRightTab: 'properties',
  previewVisible: true,
  showGrid: true,
  snapEnabled: true,
  sceneDirty: 0,

  setActiveTool: (t) => set({ activeTool: t }),
  setActiveRightTab: (t) => set({ activeRightTab: t }),
  togglePreview: () => set((s) => ({ previewVisible: !s.previewVisible })),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  markSceneDirty: () => set((s) => ({ sceneDirty: s.sceneDirty + 1 })),
}));
