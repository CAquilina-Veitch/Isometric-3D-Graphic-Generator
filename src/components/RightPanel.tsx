import { useStore, type RightTab } from '../state/store';
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
        {activeRightTab === 'properties' && <PropertiesPlaceholder />}
        {activeRightTab === 'camera' && <CameraPlaceholder />}
        {activeRightTab === 'light' && <LightPlaceholder />}
        {activeRightTab === 'render' && <RenderPlaceholder />}
      </div>
    </aside>
  );
}

function PropertiesPlaceholder() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Transform</div>
      <Field label="Position" values={[0, 0, 0]} />
      <Field label="Rotation" values={[0, 0, 0]} />
      <Field label="Scale" values={[1, 1, 1]} />
      <div className={styles.sectionTitle} style={{ marginTop: 14 }}>
        Material
      </div>
      <div className={styles.materialRow}>
        <div
          className={styles.swatch}
          style={{ background: 'hsl(200 55% 55%)' }}
        />
        <span className={styles.materialLabel}>(no selection)</span>
      </div>
    </div>
  );
}

function CameraPlaceholder() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Render camera</div>
      <p className={styles.muted}>
        Configures the locked camera shown in Preview and used for Export.
      </p>
      <Field label="Zoom" values={[1]} />
      <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
        Iso angle
      </div>
      <div className={styles.row}>
        <button data-active="true">30°</button>
        <button>45°</button>
        <button>60°</button>
      </div>
    </div>
  );
}

function LightPlaceholder() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Directional</div>
      <Field label="Intensity" values={[1]} />
      <Field label="Azimuth" values={[45]} />
      <Field label="Elevation" values={[50]} />
      <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
        Ambient
      </div>
      <Field label="Intensity" values={[0.3]} />
    </div>
  );
}

function RenderPlaceholder() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Background</div>
      <div className={styles.row}>
        <button data-active="true">Transparent</button>
        <button>Color</button>
      </div>
      <div className={styles.sectionTitle} style={{ marginTop: 8 }}>
        Export
      </div>
      <div className={styles.row}>
        <button>1×</button>
        <button>2×</button>
        <button>4×</button>
      </div>
      <div className={styles.row}>
        <button style={{ flex: 1 }}>Download PNG</button>
      </div>
      <div className={styles.row}>
        <button style={{ flex: 1 }}>Download shadow pass</button>
      </div>
    </div>
  );
}

function Field({ label, values }: { label: string; values: number[] }) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <div className={styles.fieldInputs}>
        {values.map((v, i) => (
          <input
            key={i}
            className={styles.input}
            type="number"
            defaultValue={v}
            step={0.1}
            disabled
          />
        ))}
      </div>
    </div>
  );
}
