import { useState, useEffect } from 'react';
import { useWorkspaceStore } from './stores/workspaceStore';
import { getFS } from './host/fs';
import { AppLayout } from './components/layout/AppLayout';
import { SettingsModal } from './components/modals/SettingsModal';
import { DiffModal } from './components/modals/DiffModal';
import { ApprovalModal } from './components/modals/ApprovalModal';
import { CommandPalette } from './components/modals/CommandPalette';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditorStore } from './stores/editorStore';

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const diffModal = useEditorStore((s) => s.diffModal);

  const refreshTree = useWorkspaceStore((s) => s.refreshTree);
  const setRoot = useWorkspaceStore((s) => s.setRoot);

  useEffect(() => {
    (async () => {
      const fs = await getFS();
      const root = fs.getProjectRoot();
      if (root) {
        setRoot(root);
        await refreshTree();
      }
    })();
  }, [refreshTree, setRoot]);

  useKeyboardShortcuts({
    onChat: () => document.getElementById('chat-input')?.focus(),
    onInlineEdit: () => useEditorStore.getState().setInlineEditOpen(true),
    onAgent: () => document.getElementById('agent-panel')?.scrollIntoView(),
    onTerminal: () => window.dispatchEvent(new CustomEvent('toggle-terminal')),
    onPalette: () => setPaletteOpen(true),
  });

  return (
    <>
      <AppLayout onOpenSettings={() => setSettingsOpen(true)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {diffModal && <DiffModal />}
      <ApprovalModal />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}
