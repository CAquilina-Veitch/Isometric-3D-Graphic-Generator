import { useStore, type Tool } from '../state/store';
import PaletteList from './PaletteList';
import styles from './ContextPanel.module.css';

const LABELS: Record<Tool, string> = {
  select: 'Select',
  cube: 'Cube',
  tile: 'Tile',
  stairs: 'Stairs',
  slope: 'Slope',
  brush: 'Brush',
  gizmo: 'Move',
  orbit: 'Orbit',
};

const HINTS: Record<Tool, string> = {
  select: 'Click an object to select it.',
  cube: 'Click to place. Drag for a line.',
  tile: 'Click to place. Stacks on sub-grid Y (0.25).',
  stairs: 'Click to place. Press R to rotate.',
  slope: 'Click to place. Press R to rotate.',
  brush: 'Click to paint. Drag to paint many.',
  gizmo: 'Drag arrows to move selection.',
  orbit: 'Drag to orbit the editor camera.',
};

export default function ContextPanel() {
  const activeTool = useStore((s) => s.activeTool);

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>{LABELS[activeTool]}</div>
      <div className={styles.hint}>{HINTS[activeTool]}</div>
      <div className={styles.body}>
        <Placeholder tool={activeTool} />
      </div>
    </aside>
  );
}

function Placeholder({ tool }: { tool: Tool }) {
  switch (tool) {
    case 'cube':
    case 'tile':
    case 'stairs':
    case 'slope':
      return (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>Variants</div>
          <div className={styles.grid}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.swatch} />
            ))}
          </div>
        </section>
      );
    case 'brush':
      return <PaletteList />;
    default:
      return <div className={styles.empty}>No options for this tool.</div>;
  }
}
