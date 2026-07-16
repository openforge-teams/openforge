import { DiffEditor } from '@monaco-editor/react';
import { X } from 'lucide-react';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { t } from '@/i18n';

export function DiffModal() {
  const diffModal = useEditorStore((s) => s.diffModal);
  const setDiffModal = useEditorStore((s) => s.setDiffModal);
  const theme = useSettingsStore((s) => s.theme);
  const locale = useSettingsStore((s) => s.locale);
  const activeTab = useEditorStore((s) => s.getActiveTab());

  if (!diffModal) return null;

  const handleAccept = () => {
    diffModal.onAccept?.();
    setDiffModal(null);
  };

  return (
    <div className="modal-overlay" onClick={() => setDiffModal(null)}>
      <div className="modal diff-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span>{diffModal.title}</span>
          <button className="icon-btn" onClick={() => setDiffModal(null)}><X size={16} /></button>
        </div>
        <div className="modal-body" style={{ padding: 0 }}>
          <DiffEditor
            height="400px"
            language={activeTab?.language ?? 'typescript'}
            original={diffModal.original}
            modified={diffModal.modified}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            options={{ readOnly: true, renderSideBySide: true }}
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={() => setDiffModal(null)}>
            {t(locale, 'diff.reject')}
          </button>
          <button className="btn btn-primary" onClick={handleAccept}>
            {t(locale, 'diff.accept')}
          </button>
        </div>
        <style>{`.diff-modal { width: 800px; }`}</style>
      </div>
    </div>
  );
}
