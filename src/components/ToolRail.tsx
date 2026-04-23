import type { ComponentType } from 'react';
import {
  Box,
  Eraser,
  MousePointer2,
  Paintbrush,
  Scissors,
  Square,
  Triangle,
} from 'lucide-react';
import { useStore, type Tool } from '../state/store';
import styles from './ToolRail.module.css';

type IconProps = { size?: number; strokeWidth?: number };

type ToolDef = {
  id: Tool;
  icon: ComponentType<IconProps>;
  label: string;
  shortcut?: string;
};

/** Minimal stairs icon — Lucide doesn't ship one, so we inline a stepped path. */
function StairsIcon({ size = 20, strokeWidth = 1.75 }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 20 L3 16 L9 16 L9 12 L15 12 L15 8 L21 8 L21 4" />
    </svg>
  );
}

const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'cube', icon: Box, label: 'Cube', shortcut: '1' },
  { id: 'tile', icon: Square, label: 'Tile', shortcut: '2' },
  { id: 'stairs', icon: StairsIcon, label: 'Stairs', shortcut: '3' },
  { id: 'slope', icon: Triangle, label: 'Slope', shortcut: '4' },
  { id: 'brush', icon: Paintbrush, label: 'Brush', shortcut: 'B' },
  { id: 'erase', icon: Eraser, label: 'Erase', shortcut: 'E' },
  { id: 'cutout', icon: Scissors, label: 'Cutout', shortcut: 'C' },
];

export default function ToolRail() {
  const activeTool = useStore((s) => s.activeTool);
  const setActiveTool = useStore((s) => s.setActiveTool);

  return (
    <aside className={styles.rail}>
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            className={styles.tool}
            data-active={activeTool === t.id}
            onClick={() => setActiveTool(t.id)}
            title={t.shortcut ? `${t.label} (${t.shortcut})` : t.label}
          >
            <Icon size={20} strokeWidth={1.75} />
          </button>
        );
      })}
    </aside>
  );
}
