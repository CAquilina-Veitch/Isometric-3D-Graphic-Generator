import { useEffect } from 'react';
import { useStore, type Tool } from '../state/store';
import { record, undo, redo } from './useHistory';

const PLACEMENT_TOOLS: Tool[] = ['cube', 'tile', 'stairs', 'slope'];

function isEditingInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

export function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditingInput(e.target)) return;

      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod) return;

      switch (e.key.toLowerCase()) {
        case 'v':
          s.setActiveTool('select');
          return;
        case '1':
          s.setActiveTool('cube');
          return;
        case '2':
          s.setActiveTool('tile');
          return;
        case '3':
          s.setActiveTool('stairs');
          return;
        case '4':
          s.setActiveTool('slope');
          return;
        case 'b':
          s.setActiveTool('brush');
          return;
        case 'g':
          s.setActiveTool('gizmo');
          return;
        case 'o':
          s.setActiveTool('orbit');
          return;
        case 'r': {
          if (PLACEMENT_TOOLS.includes(s.activeTool)) {
            s.rotateGhost();
          } else if (s.selectedIds.length > 0) {
            record(() => {
              const current = useStore.getState();
              for (const id of current.selectedIds) {
                const p = current.primitives.find((pp) => pp.id === id);
                if (!p) continue;
                current.updatePrimitive(id, {
                  rotation: { ...p.rotation, y: (p.rotation.y + 90) % 360 },
                });
              }
            });
          }
          return;
        }
        case 'delete':
        case 'backspace':
          if (s.selectedIds.length > 0) {
            e.preventDefault();
            record(() => {
              const current = useStore.getState();
              for (const id of [...current.selectedIds]) {
                current.removePrimitive(id);
              }
            });
          }
          return;
        case 'escape':
          s.setSelection([]);
          if (PLACEMENT_TOOLS.includes(s.activeTool)) s.setActiveTool('select');
          return;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
