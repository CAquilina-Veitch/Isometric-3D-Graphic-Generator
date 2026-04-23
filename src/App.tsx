import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import ToolRail from './components/ToolRail';
import ContextPanel from './components/ContextPanel';
import RightPanel from './components/RightPanel';
import ViewportSplit from './components/ViewportSplit';
import Overlays from './components/Overlays';
import { initSceneSync } from './three/sceneSync';
import styles from './App.module.css';

export default function App() {
  useEffect(() => {
    const unsub = initSceneSync();
    return unsub;
  }, []);

  return (
    <div className={styles.app}>
      <Toolbar />
      <ToolRail />
      <ContextPanel />
      <ViewportSplit />
      <RightPanel />
      <Overlays />
    </div>
  );
}
