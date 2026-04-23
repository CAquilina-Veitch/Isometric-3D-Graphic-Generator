import { useState } from 'react';
import { useStore } from '../state/store';
import { undo, redo, useHistoryState } from '../hooks/useHistory';
import { exportPNG } from '../utils/export';
import {
  saveCurrentProjectToStorage,
  listSavedProjects,
  loadProjectFromStorage,
} from '../hooks/useProjectStorage';
import styles from './Toolbar.module.css';

export default function Toolbar() {
  const previewVisible = useStore((s) => s.previewVisible);
  const togglePreview = useStore((s) => s.togglePreview);
  const projectName = useStore((s) => s.projectName);
  const setProjectName = useStore((s) => s.setProjectName);
  const scenes = useStore((s) => s.scenes);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const switchScene = useStore((s) => s.switchScene);
  const addScene = useStore((s) => s.addScene);
  const removeScene = useStore((s) => s.removeScene);
  const renameScene = useStore((s) => s.renameScene);
  const newProject = useStore((s) => s.newProject);
  const loadProjectData = useStore((s) => s.loadProjectData);
  const { canUndo, canRedo } = useHistoryState();

  const [editingProjectName, setEditingProjectName] = useState(false);
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);

  const onNew = () => {
    if (confirm('Discard current scene and start a new project?')) {
      newProject();
    }
  };

  const onSave = () => {
    if (saveCurrentProjectToStorage()) {
      alert(`Saved "${projectName}".`);
    } else {
      alert('Failed to save. LocalStorage may be full or disabled.');
    }
  };

  const onLoad = () => {
    const list = listSavedProjects();
    if (list.length === 0) {
      alert('No saved projects found.');
      return;
    }
    const choice = prompt(
      'Load project — type the name:\n\n' + list.map((p) => `• ${p.name}`).join('\n'),
    );
    if (!choice) return;
    const target = list.find((p) => p.name === choice);
    if (!target) {
      alert(`No project named "${choice}".`);
      return;
    }
    const data = loadProjectFromStorage(target.id);
    if (!data) {
      alert('Failed to load project.');
      return;
    }
    loadProjectData(data);
  };

  return (
    <header className={styles.toolbar}>
      <div className={styles.left}>
        {editingProjectName ? (
          <input
            className={styles.projectInput}
            autoFocus
            defaultValue={projectName}
            onBlur={(e) => {
              setProjectName(e.target.value.trim() || 'Untitled Project');
              setEditingProjectName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              else if (e.key === 'Escape') setEditingProjectName(false);
            }}
          />
        ) : (
          <span
            className={styles.project}
            title="Double-click to rename"
            onDoubleClick={() => setEditingProjectName(true)}
          >
            {projectName}
          </span>
        )}
        <div className={styles.sep} />
        <div className={styles.tabs}>
          {scenes.map((sc) =>
            renamingSceneId === sc.id ? (
              <input
                key={sc.id}
                className={styles.tabInput}
                autoFocus
                defaultValue={sc.name}
                onBlur={(e) => {
                  renameScene(sc.id, e.target.value.trim() || sc.name);
                  setRenamingSceneId(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  else if (e.key === 'Escape') setRenamingSceneId(null);
                }}
              />
            ) : (
              <button
                key={sc.id}
                className={styles.tab}
                data-active={sc.id === activeSceneId}
                onClick={() => switchScene(sc.id)}
                onDoubleClick={() => setRenamingSceneId(sc.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (scenes.length === 1) return;
                  if (confirm(`Delete scene "${sc.name}"?`)) removeScene(sc.id);
                }}
                title="Click to switch, double-click to rename, right-click to delete"
              >
                {sc.name}
              </button>
            ),
          )}
          <button className={styles.tab} onClick={() => addScene()} title="Add scene">
            +
          </button>
        </div>
      </div>

      <div className={styles.right}>
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          ⎌
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
          ⎌
        </button>
        <div className={styles.sep} />
        <button onClick={onNew} title="New project">New</button>
        <button onClick={onLoad} title="Load project">Load</button>
        <button onClick={onSave} title="Save project to localStorage">Save</button>
        <button onClick={() => exportPNG()} title="Download scene as PNG">
          Export
        </button>
        <div className={styles.sep} />
        <button
          data-active={previewVisible}
          onClick={togglePreview}
          title="Toggle render preview"
        >
          ⧉ Preview
        </button>
      </div>
    </header>
  );
}
