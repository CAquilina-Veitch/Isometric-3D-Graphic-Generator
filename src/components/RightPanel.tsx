import { useStore, type RightTab } from '../state/store';
import PropertiesTab from './PropertiesTab';
import CameraTab from './CameraTab';
import LightTab from './LightTab';
import RenderTab from './RenderTab';
import styles from './RightPanel.module.css';

const TABS: { id: RightTab; label: string }[] = [
  { id: 'properties', label: 'Properties' },
  { id: 'camera', label: 'Camera' },
  { id: 'light', label: 'Light' },
  { id: 'render', label: 'Render' },
];

export default function RightPanel() {
  const activeRightTab = useStore((s) => s.activeRightTab);
  const setActiveRightTab = useStore((s) => s.setActiveRightTab);

  return (
    <aside className={styles.panel}>
      <nav className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={styles.tab}
            data-active={activeRightTab === t.id}
            onClick={() => setActiveRightTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className={styles.body}>
        {activeRightTab === 'properties' && <PropertiesTab />}
        {activeRightTab === 'camera' && <CameraTab />}
        {activeRightTab === 'light' && <LightTab />}
        {activeRightTab === 'render' && <RenderTab />}
      </div>
    </aside>
  );
}
