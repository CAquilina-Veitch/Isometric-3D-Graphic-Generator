import { useStore } from '../state/store';
import { exportPNG } from '../utils/export';
import styles from './RightPanel.module.css';

export default function RenderTab() {
  const state = useStore((s) => s.renderState);
  const update = useStore((s) => s.updateRender);
  const gridBoundsEnabled = useStore((s) => s.gridBoundsEnabled);
  const gridBoundsSize = useStore((s) => s.gridBoundsSize);
  const setGridBoundsEnabled = useStore((s) => s.setGridBoundsEnabled);
  const setGridBoundsSize = useStore((s) => s.setGridBoundsSize);

  const bgMode: 'transparent' | 'color' | 'gradient' = state.backgroundGradientEnabled
    ? 'gradient'
    : state.backgroundTransparent
    ? 'transparent'
    : 'color';

  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Workspace</div>
      <div className={styles.row}>
        <button
          data-active={!gridBoundsEnabled}
          onClick={() => setGridBoundsEnabled(false)}
        >
          Unbounded
        </button>
        <button
          data-active={gridBoundsEnabled}
          onClick={() => setGridBoundsEnabled(true)}
        >
          Bounded
        </button>
      </div>
      {gridBoundsEnabled && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Size</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            max={40}
            step={1}
            value={gridBoundsSize}
            onChange={(e) => setGridBoundsSize(parseInt(e.target.value, 10) || 1)}
          />
          <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>
            {gridBoundsSize}×{gridBoundsSize}
          </span>
        </div>
      )}

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Background
      </div>
      <div className={styles.row}>
        <button
          data-active={bgMode === 'transparent'}
          onClick={() =>
            update({ backgroundTransparent: true, backgroundGradientEnabled: false })
          }
        >
          Transparent
        </button>
        <button
          data-active={bgMode === 'color'}
          onClick={() =>
            update({ backgroundTransparent: false, backgroundGradientEnabled: false })
          }
        >
          Color
        </button>
        <button
          data-active={bgMode === 'gradient'}
          onClick={() => update({ backgroundGradientEnabled: true })}
        >
          Gradient
        </button>
      </div>
      {bgMode === 'color' && (
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Color</label>
          <input
            className={styles.input}
            type="color"
            value={state.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
          />
        </div>
      )}
      {bgMode === 'gradient' && (
        <>
          <div className={styles.row}>
            <button
              data-active={state.backgroundGradientStyle === 'linear'}
              onClick={() => update({ backgroundGradientStyle: 'linear' })}
            >
              Linear
            </button>
            <button
              data-active={state.backgroundGradientStyle === 'radial'}
              onClick={() => update({ backgroundGradientStyle: 'radial' })}
            >
              Radial
            </button>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Top</label>
            <input
              className={styles.input}
              type="color"
              value={state.backgroundGradientTop}
              onChange={(e) => update({ backgroundGradientTop: e.target.value })}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Bottom</label>
            <input
              className={styles.input}
              type="color"
              value={state.backgroundGradientBottom}
              onChange={(e) => update({ backgroundGradientBottom: e.target.value })}
            />
          </div>
        </>
      )}

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Tonemap
      </div>
      <div className={styles.row}>
        <button
          data-active={!state.tonemapEnabled}
          onClick={() => update({ tonemapEnabled: false })}
        >
          Off
        </button>
        <button
          data-active={state.tonemapEnabled}
          onClick={() => update({ tonemapEnabled: true })}
        >
          ACES
        </button>
      </div>
      <Slider
        label="Exposure"
        min={0.3}
        max={2.5}
        step={0.05}
        value={state.exposure}
        onChange={(v) => update({ exposure: v })}
      />

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Outline
      </div>
      <div className={styles.row}>
        <button
          data-active={!state.outlineEnabled}
          onClick={() => update({ outlineEnabled: false })}
        >
          Off
        </button>
        <button
          data-active={state.outlineEnabled}
          onClick={() => update({ outlineEnabled: true })}
        >
          On
        </button>
      </div>
      {state.outlineEnabled && (
        <>
          <Slider
            label="Thickness"
            min={0.5}
            max={8}
            step={0.1}
            value={state.outlineThickness}
            onChange={(v) => update({ outlineThickness: v })}
          />
          <Slider
            label="Strength"
            min={0}
            max={10}
            step={0.1}
            value={state.outlineStrength}
            onChange={(v) => update({ outlineStrength: v })}
          />
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Color</label>
            <input
              className={styles.input}
              type="color"
              value={state.outlineColor}
              onChange={(e) => update({ outlineColor: e.target.value })}
            />
          </div>
        </>
      )}

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Tilt-shift
      </div>
      <div className={styles.row}>
        <button
          data-active={!state.tiltShiftEnabled}
          onClick={() => update({ tiltShiftEnabled: false })}
        >
          Off
        </button>
        <button
          data-active={state.tiltShiftEnabled}
          onClick={() => update({ tiltShiftEnabled: true })}
        >
          On
        </button>
      </div>
      {state.tiltShiftEnabled && (
        <>
          <Slider
            label="Focus Y"
            min={0}
            max={1}
            step={0.01}
            value={state.tiltShiftFocusY}
            onChange={(v) => update({ tiltShiftFocusY: v })}
          />
          <Slider
            label="Range"
            min={0}
            max={0.5}
            step={0.01}
            value={state.tiltShiftRange}
            onChange={(v) => update({ tiltShiftRange: v })}
          />
          <Slider
            label="Blur"
            min={0}
            max={8}
            step={0.1}
            value={state.tiltShiftBlur}
            onChange={(v) => update({ tiltShiftBlur: v })}
          />
        </>
      )}

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Shadows
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>Intensity</label>
        <input
          className={styles.input}
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={state.shadowIntensity}
          onChange={(e) => update({ shadowIntensity: parseFloat(e.target.value) })}
        />
        <span style={{ fontSize: 11, color: 'var(--fg-2)', width: 36, textAlign: 'right' }}>
          {state.shadowIntensity.toFixed(2)}
        </span>
      </div>

      <div className={styles.sectionTitle} style={{ marginTop: 10 }}>
        Export resolution
      </div>
      <div className={styles.row}>
        {([1, 2, 4] as const).map((s) => (
          <button
            key={s}
            data-active={state.exportScale === s}
            onClick={() => update({ exportScale: s })}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className={styles.row} style={{ marginTop: 4 }}>
        <button style={{ flex: 1 }} onClick={() => exportPNG()}>
          Download PNG
        </button>
      </div>
      <div className={styles.row}>
        <button style={{ flex: 1 }} onClick={() => exportPNG({ shadowOnly: true })}>
          Download shadow pass
        </button>
      </div>
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
