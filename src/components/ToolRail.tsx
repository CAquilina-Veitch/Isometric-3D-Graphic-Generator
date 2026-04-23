import { useStore, type Tool } from '../state/store';
import styles from './ToolRail.module.css';

type ToolDef = { id: Tool; icon: string; label: string; shortcut?: string };

const TOOLS: ToolDef[] = [
  { id: 'select', icon: 'V', label: 'Select', shortcut: 'V' },
  { id: 'cube', icon: '■', label: 'Cube', shortcut: '1' },
  { id: 'tile', icon: '▱', label: 'Tile', shortcut: '2' },
  { id: 'stairs', icon: '▲', label: 'Stairs', shortcut: '3' },
  { id: 'slope', icon: '◢', label: 'Slope', shortcut: '4' },
  { id: 'brush', icon: 'B', label: 'Brush', shortcut: 'B' },
  { id: 'gizmo', icon: '✥', label: 'Move', shortcut: 'G' },
  { id: 'orbit', icon: '✇', label: 'Orbit', shortcut: 'O' },
];

export default function ToolRail() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);

  return (
    <aside className={styles.rail}>
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={styles.tool}
          data-active={activeTool === t.id}
          onClick={() => setActiveTool(t.id)}
          title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
        >
          <span className={styles.icon}>{t.icon}</span>
        </button>
      ))}
    </aside>
  );
}
