import { useStore } from '../state/store';
import styles from './RightPanel.module.css';

export default function LightTab() {
  const state = useStore((s) => s.lightState);
  const update = useStore((s) => s.updateLight);

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Directional</div>
      <Slider
        label="Intensity"
        min={0}
        max={10}
        step={0.1}
        value={state.directionalIntensity}
        onChange={(v) => update({ directionalIntensity: v })}
      />
      <Slider
        label="Azimuth"
        min={-180}
        max={180}
        step={1}
        value={state.azimuthDeg}
        onChange={(v) => update({ azimuthDeg: v })}
      />
      <Slider
        label="Elevation"
        min={0}
        max={90}
        step={1}
        value={state.elevationDeg}
        onChange={(v) => update({ elevationDeg: v })}
      />
      <Slider
        label="Shadow soft"
        min={0}
        max={3}
        step={0.1}
        value={state.shadowSoftness}
        onChange={(v) => update({ shadowSoftness: v })}
      />
      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Ambient
      </div>
      <Slider
        label="Intensity"
        min={0}
        max={5}
        step={0.05}
        value={state.ambientIntensity}
        onChange={(v) => update({ ambientIntensity: v })}
      />
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Color</label>
        <input
          type="color"
          value={state.ambientColor ?? '#ffffff'}
          onChange={(e) => update({ ambientColor: e.target.value })}
          style={{ width: 28, height: 22, padding: 0, borderRadius: 4, border: '1px solid var(--border-strong)', background: 'transparent' }}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'monospace', flex: 1 }}>
          {state.ambientColor ?? '#ffffff'}
        </span>
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Three-point rig
      </div>
      <div className={styles.row}>
        <button
          data-active={!state.rigEnabled}
          onClick={() => update({ rigEnabled: false })}
        >
          Off
        </button>
        <button
          data-active={state.rigEnabled}
          onClick={() => update({ rigEnabled: true })}
        >
          On
        </button>
      </div>

      {state.rigEnabled && (
        <>
          <div className={styles.sectionTitle} style={{ marginTop: 6 }}>
            Fill
          </div>
          <Slider
            label="Intensity"
            min={0}
            max={5}
            step={0.05}
            value={state.fillIntensity}
            onChange={(v) => update({ fillIntensity: v })}
          />
          <ColorField
            label="Color"
            value={state.fillColor}
            onChange={(hex) => update({ fillColor: hex })}
          />
          <Slider
            label="Azimuth"
            min={0}
            max={360}
            step={1}
            value={state.fillAzimuthDeg}
            onChange={(v) => update({ fillAzimuthDeg: v })}
          />
          <Slider
            label="Elevation"
            min={0}
            max={90}
            step={1}
            value={state.fillElevationDeg}
            onChange={(v) => update({ fillElevationDeg: v })}
          />

          <div className={styles.sectionTitle} style={{ marginTop: 6 }}>
            Rim
          </div>
          <Slider
            label="Intensity"
            min={0}
            max={8}
            step={0.05}
            value={state.rimIntensity}
            onChange={(v) => update({ rimIntensity: v })}
          />
          <ColorField
            label="Color"
            value={state.rimColor}
            onChange={(hex) => update({ rimColor: hex })}
          />
          <Slider
            label="Azimuth"
            min={0}
            max={360}
            step={1}
            value={state.rimAzimuthDeg}
            onChange={(v) => update({ rimAzimuthDeg: v })}
          />
          <Slider
            label="Elevation"
            min={0}
            max={90}
            step={1}
            value={state.rimElevationDeg}
            onChange={(v) => update({ rimElevationDeg: v })}
          />
        </>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: 28, height: 22, padding: 0, borderRadius: 4, border: '1px solid var(--border-strong)', background: 'transparent' }}
      />
      <span style={{ fontSize: 11, color: 'var(--fg-2)', fontFamily: 'monospace', flex: 1 }}>
        {value}
      </span>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        className={styles.input}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span style={{ fontSize: 11, color: 'var(--fg-2)', width: 36, textAlign: 'right' }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}
