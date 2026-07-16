import { useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import { Sparkles } from 'lucide-react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useEditorStore } from '@/stores/editorStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getModelRouter, resetModelRouter } from '@/adapters/core';
import { t } from '@/i18n';

interface Props {
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
}

export function InlineEditOverlay({ editorRef }: Props) {
  const locale = useSettingsStore((s) => s.locale);
  const theme = useSettingsStore((s) => s.theme);
  const {
    inlineEditOpen,
    inlineEditPrompt,
    inlineEditPreview,
    setInlineEditOpen,
    setInlineEditPrompt,
    setInlineEditPreview,
    getActiveTab,
    updateContent,
  } = useEditorStore();
  const [loading, setLoading] = useState(false);

  if (!inlineEditOpen) return null;

  const handleGenerate = async () => {
    const tab = getActiveTab();
    const editor = editorRef.current;
    if (!tab || !editor || !inlineEditPrompt.trim()) return;

    setLoading(true);
    try {
      resetModelRouter();
      const router = getModelRouter();
      const client = router.getClient();
      const model = router.getModel('chat', inlineEditPrompt);
      const selection = editor.getSelection();
      const selectedText = selection
        ? editor.getModel()?.getValueInRange(selection) ?? tab.content
        : tab.content;

      const response = await client.chatCompletion({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a code editor. Apply the requested change and return only the modified code.',
          },
          {
            role: 'user',
            content: `File: ${tab.path}\n\nInstruction: ${inlineEditPrompt}\n\nCode:\n${selectedText}`,
          },
        ],
        temperature: 0.2,
      });

      const modified = response.choices[0]?.message?.content ?? selectedText;
      setInlineEditPreview({ original: selectedText, modified });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate';
      setInlineEditPreview({ original: tab.content, modified: `// Error: ${msg}` });
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => {
    const tab = getActiveTab();
    if (tab && inlineEditPreview) {
      updateContent(tab.id, inlineEditPreview.modified);
    }
    setInlineEditPreview(null);
    setInlineEditOpen(false);
    setInlineEditPrompt('');
  };

  const handleReject = () => {
    setInlineEditPreview(null);
    setInlineEditOpen(false);
    setInlineEditPrompt('');
  };

  return (
    <div className="inline-edit-overlay">
      {!inlineEditPreview ? (
        <div className="inline-edit-prompt">
          <div className="inline-edit-header">
            <Sparkles size={14} />
            <span>{t(locale, 'editor.inlineEdit')}</span>
          </div>
          <textarea
            value={inlineEditPrompt}
            onChange={(e) => setInlineEditPrompt(e.target.value)}
            placeholder={t(locale, 'editor.promptPlaceholder')}
            rows={3}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleGenerate();
            }}
          />
          <div className="inline-edit-actions">
            <button className="btn btn-ghost" onClick={handleReject}>
              {t(locale, 'editor.reject')}
            </button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading}>
              {loading ? '...' : 'Generate'}
            </button>
          </div>
        </div>
      ) : (
        <div className="inline-edit-diff">
          <DiffEditor
            height="300px"
            language={getActiveTab()?.language ?? 'typescript'}
            original={inlineEditPreview.original}
            modified={inlineEditPreview.modified}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            options={{ readOnly: true, renderSideBySide: true }}
          />
          <div className="inline-edit-actions">
            <button className="btn btn-ghost" onClick={handleReject}>
              {t(locale, 'editor.reject')}
            </button>
            <button className="btn btn-primary" onClick={handleAccept}>
              {t(locale, 'editor.accept')}
            </button>
          </div>
        </div>
      )}
      <style>{`
        .inline-edit-overlay {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          width: min(640px, 90%);
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 8px;
          box-shadow: var(--shadow);
          z-index: 10;
          overflow: hidden;
        }
        .inline-edit-prompt { padding: 12px; }
        .inline-edit-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
        }
        .inline-edit-prompt textarea {
          width: 100%;
          resize: vertical;
          margin-bottom: 8px;
        }
        .inline-edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 8px 12px;
          border-top: 1px solid var(--border-subtle);
        }
        .inline-edit-diff { display: flex; flex-direction: column; }
      `}</style>
    </div>
  );
}
