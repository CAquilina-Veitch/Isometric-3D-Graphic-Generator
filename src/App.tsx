import { useEffect } from 'react';
import Toolbar from './components/Toolbar';
import ToolRail from './components/ToolRail';
import ContextPanel from './components/ContextPanel';
import RightPanel from './components/RightPanel';
import ViewportSplit from './components/ViewportSplit';
import Overlays from './components/Overlays';
import { initSceneSync } from './three/sceneSync';
import { useProjectStorage } from './hooks/useProjectStorage';
import { undo, redo } from './hooks/useHistory';
import styles from './App.module.css';

export default function App() {
  useProjectStorage();

  useEffect(() => {
    const unsub = initSceneSync();
    return unsub;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
