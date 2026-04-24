import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import ToolRail from './components/ToolRail';
import MaterialsPanel from './components/MaterialsPanel';
import RightPanel from './components/RightPanel';
import ViewportSplit from './components/ViewportSplit';
import Overlays from './components/Overlays';
import { initSceneSync } from './three/sceneSync';
import { applyShadowIntensity, applyLightState } from './three/sceneSetup';
import { useProjectStorage } from './hooks/useProjectStorage';
import { useKeyboard } from './hooks/useKeyboard';
import { useStore } from './state/store';
import styles from './App.module.css';

export default function App() {
  useProjectStorage();
  useKeyboard();

  useEffect(() => {
    const unsub = initSceneSync();
    return unsub;
  }, []);

  useEffect(() => {
    const applyAll = () => {
      const s = useStore.getState();
      applyLightState(s.lightState);
      applyShadowIntensity(s.renderState.shadowIntensity);
    };
    applyAll();
    const unsub = useStore.subscribe((s, prev) => {
      if (s.lightState !== prev.lightState) applyLightState(s.lightState);
      if (
        s.renderState !== prev.renderState &&
        s.renderState.shadowIntensity !== prev.renderState.shadowIntensity
      ) {
        applyShadowIntensity(s.renderState.shadowIntensity);
      }
    });
    return unsub;
  }, []);

  return (
    <div className={styles.app}>
      <Toolbar />
      <ToolRail />
      <MaterialsPanel />
      <ViewportSplit />
      <RightPanel />
      <Overlays />
    </div>
  );
}
